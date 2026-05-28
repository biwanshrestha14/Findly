"""
Matching Service — Image Processing & Score Computation
========================================================

Handles the complete pipeline from item image upload to match generation:
  1. Background removal (rembg)
  2. Perceptual hashing (imagehash)
  3. Dominant color extraction (ColorThief)
  4. Label extraction via MobileNetV2 (services.label_extraction)
  5. Multi-signal match scoring and storage
"""

import io
import math
from PIL import Image
import imagehash
from colorthief import ColorThief
from rembg import remove
from items.models import Item, Match

# Import custom vector mathematical operations for TF-IDF and Cosine Similarity
from services.text_similarity import compute_custom_text_similarity

# Import MobileNetV2-based label extraction and weighted similarity
from services.label_extraction import (
    extract_labels,
    labels_to_list,
    compute_label_similarity,
)


def process_item_image(item):
    """
    Full image processing pipeline for a newly created item.
    Runs: background removal → perceptual hash → dominant color → MobileNetV2 label extraction.

    Performance notes:
      • First inference takes 3-5 s to load MobileNetV2 weights.
      • Subsequent inferences take ~200-500 ms on CPU.
      • For production, move this to a Celery background task.
    """
    if not item.image:
        return

    try:
        # 1. Read raw image data
        item.image.open()
        img_data = item.image.read()
        item.image.close()

        # 2. Remove background to isolate the item for accurate processing
        processed_data = remove(img_data)

        # Retain original image for UI rendering.
        # Utilize the background-removed image for feature extraction.
        img = Image.open(io.BytesIO(processed_data))

        # 3. Generate perceptual image hash
        hash_val = str(imagehash.phash(img))
        item.image_hash = hash_val

        # 4. Extract top dominant colors via ColorThief
        # Buffer the processed image for color extraction
        with io.BytesIO(processed_data) as f:
            color_thief = ColorThief(f)
            # Extract 3 dominant colors into RGB tuples
            palette = color_thief.get_palette(color_count=3)
            # palette is a list of RGB tuples: [(r, g, b), ...]
            item.color_vector = palette

        # 5. Label extraction using MobileNetV2 (replaces placeholder labels)
        #    Pass the background-removed image for cleaner predictions.
        #    The model is lazy-loaded on first call — not imported at startup.
        cleaned_rgb = img.convert('RGB')
        label_results = extract_labels(cleaned_rgb, top_n=10, min_confidence=0.03)
        item.labels = labels_to_list(label_results)    # ['wallet', 'purse', ...]
        item.label_scores = label_results              # [{'label': 'wallet', 'score': 0.72}, ...]

        item.save(update_fields=['image_hash', 'color_vector', 'labels', 'label_scores'])

        print(f"[process_item_image] Item {item.id} processed — "
              f"{len(label_results)} labels extracted: "
              f"{', '.join(r['label'] for r in label_results[:5])}")

    except Exception as e:
        print(f"[process_item_image] Failed for item {item.id}: {e}")

def get_color_similarity(c1, c2):
    """ Returns similarity between two colors (RGB tuples). """
    if not c1 or not c2:
        return 0.0
    # Simple Euclidean distance in RGB space
    r_diff = (c1[0] - c2[0]) ** 2
    g_diff = (c1[1] - c2[1]) ** 2
    b_diff = (c1[2] - c2[2]) ** 2
    dist = math.sqrt(r_diff + g_diff + b_diff)
    max_dist = math.sqrt(3 * (255**2))
    return 1.0 - (dist / max_dist)

def color_similarity(item1, item2):
    """
    Compare dominant colors of two items.
    Checks the best match among the top 3 dominant colors.
    """
    if not item1.color_vector or not item2.color_vector:
        return 0.0
    
    max_sim = 0.0
    for c1 in item1.color_vector:
        for c2 in item2.color_vector:
            sim = get_color_similarity(c1, c2)
            if sim > max_sim:
                max_sim = sim
    return max_sim

def label_similarity(item1, item2):
    """
    Weighted label similarity using MobileNetV2 confidence scores.

    Uses a dual-strategy approach (Weighted Jaccard + geometric-mean overlap)
    implemented in services.label_extraction.compute_label_similarity.

    Falls back to plain Jaccard index when label_scores are not available
    (e.g. items created before MobileNetV2 was integrated).
    """
    # Prefer weighted similarity using label_scores (MobileNetV2 output)
    scores_a = getattr(item1, 'label_scores', None) or []
    scores_b = getattr(item2, 'label_scores', None) or []

    if scores_a and scores_b:
        return compute_label_similarity(scores_a, scores_b)

    # Fallback: plain Jaccard on the labels list (backward compat)
    l1 = set(item1.labels) if item1.labels else set()
    l2 = set(item2.labels) if item2.labels else set()
    if not l1 and not l2:
        return 0.0
    intersection = l1.intersection(l2)
    union = l1.union(l2)
    return len(intersection) / len(union) if union else 0.0

def location_similarity(item1, item2):
    """
    Haversine distance between two items.
    Returns score 0-1 based on an exponential decay (e.g. max dist ~ 50km).
    """
    if not item1.latitude or not item1.longitude or not item2.latitude or not item2.longitude:
        return 0.0

    lat1, lon1 = float(item1.latitude), float(item1.longitude)
    lat2, lon2 = float(item2.latitude), float(item2.longitude)

    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2) * math.sin(dlat/2) + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
        math.sin(dlon/2) * math.sin(dlon/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    dist_km = R * c

    # Target constraints: 0km -> 1.0, 1km -> 0.8, 5km -> 0.5.
    if dist_km <= 0.0:
        score = 1.0
    elif dist_km <= 1.0:
        score = 1.0 - (dist_km * 0.2)
    elif dist_km <= 5.0:
        score = 0.8 - ((dist_km - 1.0) * 0.075)
    else:
        score = 0.5 - ((dist_km - 5.0) * 0.05)
        
    return max(0.0, min(1.0, score))

def text_similarity(item1, item2):
    """
    Custom TF-IDF + Cosine Similarity from scratch on title and description.
    """
    t1 = f"{item1.title} {item1.description}"
    t2 = f"{item2.title} {item2.description}"
    
    return compute_custom_text_similarity(t1, t2)

def compute_match_score(item1, item2):
    """
    Compute aggregate match score based on individual feature similarities.
    Weight distribution:
      - Retrieved dynamically from MatchingConfiguration (defaults: color 25%, labels 35%, location 20%, text 20%)
    """
    # Enforce category constraint and opposite item type (Lost vs. Found)
    if item1.category != item2.category:
        return 0.0
    if item1.item_type == item2.item_type:
        return 0.0

    from items.models import MatchingConfiguration
    config = MatchingConfiguration.get_config()

    s_color = color_similarity(item1, item2)
    s_labels = label_similarity(item1, item2)
    s_loc = location_similarity(item1, item2)
    s_text = text_similarity(item1, item2)

    score = (config.color_weight * s_color +
             config.label_weight * s_labels +
             config.location_weight * s_loc +
             config.text_weight * s_text)
    return score, s_color, s_labels, s_loc, s_text

def find_matches(new_item):
    """
    Find and store top matches for a newly created item.
    """
    # Target opposite type
    target_type = 'FOUND' if new_item.item_type == 'LOST' else 'LOST'
    
    # Query potential candidates: same category, opposite type, ACTIVE status
    candidates = Item.objects.filter(
        category=new_item.category,
        item_type=target_type,
        status='ACTIVE'
    )

    # Import Notification and MatchingConfiguration here to avoid circular imports
    from items.models import Notification, MatchingConfiguration
    config = MatchingConfiguration.get_config()

    for cand in candidates:
        score_data = compute_match_score(new_item, cand)
        if isinstance(score_data, tuple):
            score, c_score, l_score, loc_score, t_score = score_data
        else:
            score, c_score, l_score, loc_score, t_score = score_data, 0, 0, 0, 0

        if score >= config.threshold:  # Dynamic threshold from admin settings
            match1 = Match.objects.create(item=new_item, matched_item=cand, score=score, color_score=c_score, label_score=l_score, location_score=loc_score, text_score=t_score)
            match2 = Match.objects.create(item=cand, matched_item=new_item, score=score, color_score=c_score, label_score=l_score, location_score=loc_score, text_score=t_score)
            
            # ── Create in-app notifications for both item owners ──────────────
            confidence = int(score * 100)

            Notification.objects.create(
                user=new_item.user,
                match=match1,
                message=f'Possible match found for your {new_item.get_item_type_display().lower()} item "{new_item.title}" — {confidence}% confidence'
            )
            Notification.objects.create(
                user=cand.user,
                match=match2,
                message=f'Possible match found for your {cand.get_item_type_display().lower()} item "{cand.title}" — {confidence}% confidence'
            )

            # ──────────────────────────────────────────────────────────────────
            # TODO: Expo Push Notifications
            # 
            # To enable real-time push notifications:
            # 1. Install expo-notifications in the React Native app
            # 2. On login, register the device push token and store it on
            #    a UserProfile.expo_push_token field
            # 3. Here, after creating the Notification, send a push via:
            #    import requests
            #    requests.post('https://exp.host/--/api/v2/push/send', json={
            #        'to': user_push_token,
            #        'title': 'Match Found!',
            #        'body': message,
            #        'data': {'match_id': match.id},
            #    })
            # ──────────────────────────────────────────────────────────────────

            # Dispatch real-time match notification events
            print("="*50)
            print(f"!!! MATCH RESULT DETECTED !!! [Final Score: {score:.2f}]")
            print(f"-> Notification sent to {new_item.user.username} regarding item '{new_item.title}'")
            print(f"-> Notification sent to {cand.user.username} regarding item '{cand.title}'")
            print("="*50)


# ── Electronic-specific matching ──────────────────────────────────────────────

def compute_electronic_match_score(lost_el, found_el):
    """
    Compute match score specifically for LostElectronic vs FoundElectronic.

    Priority logic:
      1. Both have imei_or_serial → exact match returns 0.99, mismatch returns 0.0
      2. One has imei_or_serial   → run AI pipeline with 0.85 confidence penalty
      3. Neither has imei_or_serial → run full AI pipeline unchanged
    """
    from items.models import LostElectronic, FoundElectronic

    # Ensure electronic_type is matching
    if lost_el.electronic_type != found_el.electronic_type:
        return 0.0, 0.0, 0.0, 0.0, 0.0, 'ai'

    lost_id = getattr(lost_el, 'imei_or_serial', None) or None
    found_id = getattr(found_el, 'imei_or_serial', None) or None

    match_type = 'ai'  # default

    # Case 1: Both have Identifier (IMEI or Serial Number)
    if lost_id and found_id:
        if str(lost_id).strip() == str(found_id).strip():
            match_type = 'identifier'
            return 0.99, 1.0, 1.0, 1.0, 1.0, match_type
        else:
            # Identifier mismatch — definitely not the same device
            return 0.0, 0.0, 0.0, 0.0, 0.0, match_type

    # For AI-based matching, use the parent Item's compute_match_score
    score_data = compute_match_score(lost_el.item_ptr, found_el.item_ptr)
    if not isinstance(score_data, tuple):
        return 0.0, 0.0, 0.0, 0.0, 0.0, match_type

    score, c_score, l_score, loc_score, t_score = score_data

    # Case 2: One side has Identifier → apply 0.85 confidence penalty
    if lost_id or found_id:
        score = score * 0.85

    # Case 3: Neither has Identifier → full AI score (no penalty)
    return score, c_score, l_score, loc_score, t_score, match_type


def find_electronic_matches(new_electronic):
    """
    Find and store matches for a newly created LostElectronic or FoundElectronic.
    Uses Identifier-first matching logic before falling back to the AI pipeline.
    """
    from items.models import LostElectronic, FoundElectronic, Match, Notification, MatchingConfiguration

    config = MatchingConfiguration.get_config()

    if isinstance(new_electronic, LostElectronic):
        candidates = FoundElectronic.objects.filter(status='ACTIVE', electronic_type=new_electronic.electronic_type)
    elif isinstance(new_electronic, FoundElectronic):
        candidates = LostElectronic.objects.filter(status='ACTIVE', electronic_type=new_electronic.electronic_type)
    else:
        return

    for cand in candidates:
        if isinstance(new_electronic, LostElectronic):
            lost, found = new_electronic, cand
        else:
            lost, found = cand, new_electronic

        result = compute_electronic_match_score(lost, found)
        score, c_score, l_score, loc_score, t_score, match_type = result

        if score >= config.threshold or match_type == 'identifier':
            match1 = Match.objects.create(
                item=new_electronic.item_ptr, matched_item=cand.item_ptr,
                score=score, color_score=c_score, label_score=l_score,
                location_score=loc_score, text_score=t_score,
            )
            match2 = Match.objects.create(
                item=cand.item_ptr, matched_item=new_electronic.item_ptr,
                score=score, color_score=c_score, label_score=l_score,
                location_score=loc_score, text_score=t_score,
            )

            confidence = int(score * 100)
            el_display = new_electronic.get_electronic_type_display().lower()
            if match_type == 'identifier':
                msg_suffix = f'🔍 Exact Device Match (Identifier verified)'
            else:
                msg_suffix = f'{confidence}% confidence'

            Notification.objects.create(
                user=new_electronic.user, match=match1,
                message=f'Possible match found for your {new_electronic.get_item_type_display().lower()} {el_display} "{new_electronic.title}" — {msg_suffix}'
            )
            Notification.objects.create(
                user=cand.user, match=match2,
                message=f'Possible match found for your {cand.get_item_type_display().lower()} {el_display} "{cand.title}" — {msg_suffix}'
            )

            print("=" * 50)
            print(f"!!! ELECTRONIC MATCH DETECTED !!! [Type: {match_type.upper()} | Score: {score:.2f}]")
            print(f"-> {new_electronic.user.username}: '{new_electronic.title}'")
            print(f"-> {cand.user.username}: '{cand.title}'")
            print("=" * 50)


