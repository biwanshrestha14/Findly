"""
Label Extraction Service — MobileNetV2 on ImageNet
===================================================

Extracts real object labels from item images using a pre-trained
MobileNetV2 model (via TensorFlow/Keras).  The model is lazy-loaded
on first use so Django startup and management commands stay fast.

Performance notes (add context for BSc project):
  • First inference: 3-5 s (weight download + graph build).
  • Subsequent inferences: ~200-500 ms on CPU.
  • Model weights (~14 MB) are cached by Keras in ~/.keras/models/.
  • For production, move image processing to a Celery background task.
"""

import io
import math

import numpy as np
from PIL import Image

# ── Lazy-loaded module-level singletons ──────────────────────────────────────
_model = None
_decode_fn = None
_preprocess_fn = None


def _get_model():
    """
    Lazy-load MobileNetV2 so it only initializes on first use.
    Model is cached in the module-level _model variable.
    Weights are downloaded once by Keras and cached in ~/.keras/models/.
    """
    global _model, _decode_fn, _preprocess_fn
    if _model is None:
        from tensorflow.keras.applications import MobileNetV2
        from tensorflow.keras.applications.mobilenet_v2 import (
            preprocess_input,
            decode_predictions,
        )
        _model = MobileNetV2(weights='imagenet', include_top=True)
        _model.trainable = False          # inference-only
        _decode_fn = decode_predictions
        _preprocess_fn = preprocess_input
        print("[label_extraction] MobileNetV2 loaded successfully.")
    return _model, _decode_fn, _preprocess_fn


# ── Core extraction ─────────────────────────────────────────────────────────

def extract_labels(image_input, top_n=10, min_confidence=0.03):
    """
    Extract ImageNet labels from an image using MobileNetV2.

    Args:
        image_input: PIL.Image, bytes, file path string, or BytesIO object
        top_n:           number of top predictions to return  (default 10)
        min_confidence:  minimum confidence threshold          (default 0.03)

    Returns:
        List of dicts sorted by score descending:
            [{ 'label': str, 'score': float }, ...]

        Labels are human-readable ImageNet synset descriptions.
        Returns empty list if extraction fails.

    Example output:
        [
            { 'label': 'wallet',  'score': 0.72 },
            { 'label': 'purse',   'score': 0.14 },
            { 'label': 'leather', 'score': 0.05 },
        ]
    """
    try:
        model, decode_fn, preprocess_input = _get_model()

        # ── Normalize input to PIL Image ─────────────────────────────────
        if isinstance(image_input, bytes):
            pil_image = Image.open(io.BytesIO(image_input))
        elif isinstance(image_input, io.BytesIO):
            image_input.seek(0)
            pil_image = Image.open(image_input)
        elif isinstance(image_input, str):
            pil_image = Image.open(image_input)
        elif isinstance(image_input, Image.Image):
            pil_image = image_input
        else:
            raise ValueError(f"Unsupported image_input type: {type(image_input)}")

        # ── MobileNetV2 expects RGB, 224×224 ────────────────────────────
        pil_image = pil_image.convert('RGB')
        pil_image = pil_image.resize((224, 224), Image.LANCZOS)

        img_array = np.array(pil_image, dtype=np.float32)
        img_array = np.expand_dims(img_array, axis=0)   # batch dim
        img_array = preprocess_input(img_array)

        # ── Predict ─────────────────────────────────────────────────────
        predictions = model.predict(img_array, verbose=0)
        decoded = decode_fn(predictions, top=top_n)[0]

        results = []
        for _synset_id, label, score in decoded:
            if score >= min_confidence:
                # Clean up ImageNet label formatting
                clean_label = label.replace('_', ' ').lower().strip()
                results.append({
                    'label': clean_label,
                    'score': round(float(score), 4),
                })

        return results

    except Exception as e:
        print(f"[label_extraction] Error extracting labels: {e}")
        return []


# ── Serialization helpers ────────────────────────────────────────────────────

def labels_to_list(label_results):
    """
    Convert label extraction results to a plain list of label strings.
    Suitable for storage in the Item.labels JSONField.

    Example: ['wallet', 'purse', 'leather']
    """
    return [item['label'] for item in label_results]


def labels_from_json(labels_json):
    """
    Normalize stored labels (JSONField) to a list of strings.
    Handles both list-of-strings and list-of-dicts formats.
    Returns empty list if input is None or empty.
    """
    if not labels_json:
        return []
    if isinstance(labels_json, list):
        if len(labels_json) > 0 and isinstance(labels_json[0], dict):
            return [item.get('label', '') for item in labels_json]
        return [str(l) for l in labels_json]
    return []


# ── Similarity computation ───────────────────────────────────────────────────

def compute_label_similarity(label_scores_a, label_scores_b):
    """
    Compute similarity between two items' label sets using two strategies:

    Strategy 1 — Weighted Jaccard similarity:
      Treats each label's confidence score as its weight.
      Measures overlap between the two label sets weighted by confidence.

    Strategy 2 — Score-weighted overlap:
      For each label that appears in BOTH sets, sums the geometric mean
      of the two confidence scores.  Normalized by total possible score.

    Final similarity = average of both strategies.
    Range: 0.0 (no overlap) to 1.0 (identical labels and scores)

    Args:
        label_scores_a: list of { 'label': str, 'score': float }
        label_scores_b: list of { 'label': str, 'score': float }

    Returns:
        float: similarity score between 0.0 and 1.0
    """
    if not label_scores_a or not label_scores_b:
        return 0.0

    # Build score dicts
    scores_a = {item['label']: item['score'] for item in label_scores_a}
    scores_b = {item['label']: item['score'] for item in label_scores_b}

    labels_a = set(scores_a.keys())
    labels_b = set(scores_b.keys())

    common_labels = labels_a & labels_b
    all_labels = labels_a | labels_b

    if not all_labels:
        return 0.0

    # ── Strategy 1: Weighted Jaccard ─────────────────────────────────
    intersection_weight = sum(
        min(scores_a[l], scores_b[l]) for l in common_labels
    )
    union_weight = sum(
        max(scores_a.get(l, 0), scores_b.get(l, 0)) for l in all_labels
    )
    weighted_jaccard = intersection_weight / union_weight if union_weight > 0 else 0.0

    # ── Strategy 2: Score-weighted overlap (geometric mean) ──────────
    overlap_score = sum(
        math.sqrt(scores_a[l] * scores_b[l]) for l in common_labels
    )
    max_possible = sum(
        max(scores_a.get(l, 0), scores_b.get(l, 0)) for l in all_labels
    )
    weighted_overlap = overlap_score / max_possible if max_possible > 0 else 0.0

    return round((weighted_jaccard + weighted_overlap) / 2, 4)
