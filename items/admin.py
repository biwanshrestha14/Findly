from django.contrib import admin
from django.utils.html import format_html, mark_safe
from django.utils import timezone
from django.shortcuts import redirect
from django.urls import path
from django.db.models import Q
from unfold.admin import ModelAdmin, TabularInline
from .models import (
    Match, Notification, KYCSubmission, UserProfile,
    ItemVerificationDetail, ClaimRequest, ClaimAnswer, MatchingConfiguration,
    LostElectronic, FoundElectronic, LostItem, FoundItem
)


# ── Dashboard Callback ────────────────────────────────────────────────────────

def dashboard_callback(request, context):
    from django.utils import timezone
    from datetime import date
    from .models import Item, KYCSubmission, ClaimRequest, Match

    today = date.today()
    
    total_lost_items = Item.objects.filter(item_type='LOST').count()
    total_found_items = Item.objects.filter(item_type='FOUND').count()
    pending_kyc_reviews = KYCSubmission.objects.filter(kyc_status='PENDING').count()
    pending_claims = ClaimRequest.objects.filter(status='PENDING_REVIEW').count()
    total_matches_today = Match.objects.filter(created_at__date=today).count()

    context.update({
        "total_lost_items": total_lost_items,
        "total_found_items": total_found_items,
        "pending_kyc_reviews": pending_kyc_reviews,
        "pending_claims": pending_claims,
        "total_matches_today": total_matches_today,
    })
    return context


# ── Inlines ───────────────────────────────────────────────────────────────────

class VerificationDetailInline(TabularInline):
    model = ItemVerificationDetail
    extra = 0
    fields = ('order', 'detail_text', 'detail_hint')


class ClaimAnswerInline(TabularInline):
    model = ClaimAnswer
    extra = 0
    readonly_fields = ('verification_detail', 'detail_text_display', 'answer')
    fields = ('verification_detail', 'detail_text_display', 'answer')

    def detail_text_display(self, obj):
        return obj.verification_detail.detail_text
    detail_text_display.short_description = 'Actual Detail'


# ── Lost & Found Item Admins ─────────────────────────────────────────────────

@admin.register(LostItem)
class LostItemAdmin(ModelAdmin):
    list_display = ('title', 'category', 'status', 'user', 'top_match_score_display', 'color_vectors_display', 'ai_labels_display', 'created_at')
    list_filter = ('status', 'category')
    search_fields = ('title', 'description')
    list_per_page = 25
    readonly_fields = ('top_match_score_display', 'color_vectors_display', 'ai_labels_display', 'image_preview', 'created_at')

    def image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" style="max-height: 200px; border-radius: 8px; border: 1px solid #e5e7eb;" />', obj.image.url)
        return "—"
    image_preview.short_description = "Image Preview"

    def top_match_score_display(self, obj):
        top_match = Match.objects.filter(Q(item=obj) | Q(matched_item=obj)).order_by('-score').first()
        if not top_match:
            return "No matches"
        percentage = f"{top_match.score * 100:.1f}%"
        other_item = top_match.matched_item if top_match.item == obj else top_match.item
        return format_html(
            '<span style="font-weight: bold; color: #059669; background-color: #d1fae5; padding: 2px 6px; border-radius: 4px;">{}</span> with <a href="/admin/items/match/{}/change/" style="color: #2563eb; font-weight: 600; text-decoration: underline;">{}</a>',
            percentage, top_match.id, other_item.title
        )
    top_match_score_display.short_description = "Top AI Match Score"

    def color_vectors_display(self, obj):
        if not obj.color_vector:
            return "—"
        swatches = []
        for rgb in obj.color_vector:
            color_str = f"rgb({rgb[0]},{rgb[1]},{rgb[2]})"
            swatches.append(f'<span style="display:inline-block; width:16px; height:16px; background-color:{color_str}; border-radius:4px; margin-right:4px; border:1px solid #ccc;" title="{color_str}"></span>')
        return mark_safe("".join(swatches) + f" <code style='font-size: 11px;'>{obj.color_vector}</code>")
    color_vectors_display.short_description = "Color Vectors"

    def ai_labels_display(self, obj):
        if not obj.label_scores:
            if not obj.labels:
                return "—"
            return ", ".join(obj.labels)
        badges = []
        for item in obj.label_scores:
            lbl = item.get('label', '')
            score = item.get('score', 0.0)
            percentage = f"{score * 100:.1f}%"
            badges.append(
                f'<span style="display:inline-block; background-color:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-weight:600; font-size:10px; margin-right:4px; margin-bottom:4px;">{lbl} ({percentage})</span>'
            )
        return mark_safe("".join(badges))
    ai_labels_display.short_description = "AI Labels"

    fieldsets = (
        ('Basic Info', {'fields': ('user', 'title', 'description', 'image_preview', 'image', 'status', 'created_at')}),
        ('Computed AI Data', {'fields': ('top_match_score_display', 'color_vectors_display', 'ai_labels_display', 'color_vector', 'labels', 'label_scores')}),
    )


@admin.register(FoundItem)
class FoundItemAdmin(ModelAdmin):
    list_display = ('title', 'category', 'status', 'user', 'top_match_score_display', 'color_vectors_display', 'ai_labels_display', 'created_at')
    list_filter = ('status', 'category')
    search_fields = ('title', 'description')
    list_per_page = 25
    inlines = [VerificationDetailInline]
    readonly_fields = ('top_match_score_display', 'color_vectors_display', 'ai_labels_display', 'image_preview', 'created_at')

    def image_preview(self, obj):
        if obj.image:
            return format_html('<img src="{}" style="max-height: 200px; border-radius: 8px; border: 1px solid #e5e7eb;" />', obj.image.url)
        return "—"
    image_preview.short_description = "Image Preview"

    def top_match_score_display(self, obj):
        top_match = Match.objects.filter(Q(item=obj) | Q(matched_item=obj)).order_by('-score').first()
        if not top_match:
            return "No matches"
        percentage = f"{top_match.score * 100:.1f}%"
        other_item = top_match.matched_item if top_match.item == obj else top_match.item
        return format_html(
            '<span style="font-weight: bold; color: #059669; background-color: #d1fae5; padding: 2px 6px; border-radius: 4px;">{}</span> with <a href="/admin/items/match/{}/change/" style="color: #2563eb; font-weight: 600; text-decoration: underline;">{}</a>',
            percentage, top_match.id, other_item.title
        )
    top_match_score_display.short_description = "Top AI Match Score"

    def color_vectors_display(self, obj):
        if not obj.color_vector:
            return "—"
        swatches = []
        for rgb in obj.color_vector:
            color_str = f"rgb({rgb[0]},{rgb[1]},{rgb[2]})"
            swatches.append(f'<span style="display:inline-block; width:16px; height:16px; background-color:{color_str}; border-radius:4px; margin-right:4px; border:1px solid #ccc;" title="{color_str}"></span>')
        return mark_safe("".join(swatches) + f" <code style='font-size: 11px;'>{obj.color_vector}</code>")
    color_vectors_display.short_description = "Color Vectors"

    def ai_labels_display(self, obj):
        if not obj.label_scores:
            if not obj.labels:
                return "—"
            return ", ".join(obj.labels)
        badges = []
        for item in obj.label_scores:
            lbl = item.get('label', '')
            score = item.get('score', 0.0)
            percentage = f"{score * 100:.1f}%"
            badges.append(
                f'<span style="display:inline-block; background-color:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:4px; font-weight:600; font-size:10px; margin-right:4px; margin-bottom:4px;">{lbl} ({percentage})</span>'
            )
        return mark_safe("".join(badges))
    ai_labels_display.short_description = "AI Labels"

    fieldsets = (
        ('Basic Info', {'fields': ('user', 'title', 'description', 'image_preview', 'image', 'status', 'created_at')}),
        ('Computed AI Data', {'fields': ('top_match_score_display', 'color_vectors_display', 'ai_labels_display', 'color_vector', 'labels', 'label_scores')}),
    )


# ── Match Admin ───────────────────────────────────────────────────────────────

@admin.register(Match)
class MatchAdmin(ModelAdmin):
    list_display = ('items_summary', 'confidence_score_badge', 'status_badge', 'created_at')
    list_filter = ('status',)
    search_fields = ('item__title', 'matched_item__title')
    list_per_page = 25
    readonly_fields = ('items_side_by_side', 'created_at')

    def items_summary(self, obj):
        return format_html('<strong>{}</strong> <span style="color:#6b7280; font-weight: 500;">(Lost)</span> ↔ <strong>{}</strong> <span style="color:#6b7280; font-weight: 500;">(Found)</span>', obj.item.title, obj.matched_item.title)
    items_summary.short_description = "Matched Items"

    def confidence_score_badge(self, obj):
        color = "#ef4444" if obj.score < 0.5 else "#f59e0b" if obj.score < 0.75 else "#10b981"
        bg = "#fee2e2" if obj.score < 0.5 else "#fef3c7" if obj.score < 0.75 else "#d1fae5"
        return format_html('<span style="color:{}; background-color:{}; padding:4px 10px; border-radius:9999px; font-weight:700; font-size:11px;">{:.1f}%</span>', color, bg, obj.score * 100)
    confidence_score_badge.short_description = "AI Confidence Score"

    def status_badge(self, obj):
        colors = {
            'pending': ('#f59e0b', '#fef3c7'),
            'matched': ('#10b981', '#d1fae5'),
            'rejected': ('#ef4444', '#fee2e2'),
        }
        color, bg = colors.get(obj.status, ('#6b7280', '#f3f4f6'))
        return format_html('<span style="color:{}; background-color:{}; padding:4px 8px; border-radius:4px; font-weight:600; text-transform:uppercase; font-size:11px;">{}</span>', color, bg, obj.status)
    status_badge.short_description = "Status"

    def items_side_by_side(self, obj):
        item = obj.item
        matched_item = obj.matched_item
        
        def make_card(it, role):
            img_url = it.image.url if it.image else ""
            img_tag = f'<img src="{img_url}" style="max-height:220px; border-radius:8px; object-fit:cover; margin-bottom:12px; border:1px solid #e5e7eb;" />' if img_url else '<div style="height:220px; background:#f3f4f6; display:flex; align-items:center; justify-content:center; border-radius:8px; margin-bottom:12px; color:#9ca3af;">No Image</div>'
            
            return f"""
            <div style="flex:1; min-width:280px; border:1px solid #e5e7eb; border-radius:12px; padding:18px; background-color:#fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05); color:#111827;">
                <div style="display:flex; justify-content:between; align-items:center; margin-bottom:8px;">
                    <span style="font-size:11px; font-weight:700; color:#2563eb; text-transform:uppercase; letter-spacing:0.05em;">{role}</span>
                </div>
                <h3 style="font-size:18px; font-weight:600; margin-bottom:8px; color:#111827;">{it.title}</h3>
                {img_tag}
                <p style="font-size:13px; color:#4b5563; margin-bottom:8px;"><strong>Category:</strong> {it.category} ({it.sub_category or ''})</p>
                <p style="font-size:13px; color:#4b5563; margin-bottom:8px;"><strong>User:</strong> {it.user.username} ({it.user.email})</p>
                <p style="font-size:13px; color:#4b5563; margin-bottom:8px;"><strong>Status:</strong> <span style="font-weight:600; color:#059669;">{it.status}</span></p>
                <p style="font-size:13px; color:#6b7280; white-space:pre-wrap;">{it.description}</p>
            </div>
            """

        card_left = make_card(item, f"{item.item_type} ITEM (Alice's Lost Report)")
        card_right = make_card(matched_item, f"{matched_item.item_type} ITEM (Bob's Found Report)")
        
        score_breakdown = f"""
        <div style="width:200px; padding:16px; display:flex; flex-direction:column; justify-content:center; align-items:center; border:1px solid #e5e7eb; border-radius:12px; background-color:#f9fafb; margin: 0 8px; color:#111827;">
            <span style="font-size:11px; font-weight:600; color:#6b7280; margin-bottom:4px;">MATCH SCORE</span>
            <span style="font-size:36px; font-weight:800; color:#059669;">{obj.score * 100:.1f}%</span>
            <div style="width:100%; margin-top:12px; font-size:12px; color:#4b5563;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span>Label:</span><strong>{obj.label_score * 100:.0f}%</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span>Color:</span><strong>{obj.color_score * 100:.0f}%</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <span>Location:</span><strong>{obj.location_score * 100:.0f}%</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span>Text:</span><strong>{obj.text_score * 100:.0f}%</strong>
                </div>
            </div>
        </div>
        """

        html = f"""
        <div style="display:flex; flex-wrap:wrap; align-items:stretch; gap:16px;">
            {card_left}
            {score_breakdown}
            {card_right}
        </div>
        """
        return mark_safe(html)
    items_side_by_side.short_description = "Match Analysis"

    fieldsets = (
        ('Match Configuration', {'fields': ('status', 'created_at')}),
        ('Match Inspection', {'fields': ('items_side_by_side',)}),
    )


# ── KYC Submission Admin ──────────────────────────────────────────────────────

@admin.register(KYCSubmission)
class KYCSubmissionAdmin(ModelAdmin):
    list_display = ('user', 'phone_number', 'email', 'document_type', 'kyc_status_badge', 'actions_buttons', 'submitted_at')
    list_filter = ('kyc_status', 'document_type')
    search_fields = ('user__username', 'email')
    list_per_page = 25
    readonly_fields = ('live_photo_preview', 'document_preview', 'submitted_at', 'reviewed_at')
    actions = ['approve_kyc_action', 'reject_kyc_action']

    def kyc_status_badge(self, obj):
        colors = {
            'PENDING': ('#f59e0b', '#fef3c7'),
            'APPROVED': ('#10b981', '#d1fae5'),
            'REJECTED': ('#ef4444', '#fee2e2'),
        }
        color, bg = colors.get(obj.kyc_status, ('#6b7280', '#f3f4f6'))
        return format_html('<span style="color:{}; background-color:{}; padding:4px 8px; border-radius:4px; font-weight:600; text-transform:uppercase; font-size:11px;">{}</span>', color, bg, obj.kyc_status)
    kyc_status_badge.short_description = 'KYC Status'

    def live_photo_preview(self, obj):
        if obj.live_photo:
            return format_html('<img src="{}" style="max-height:260px; border-radius:8px; border:1px solid #e5e7eb;" />', obj.live_photo.url)
        return '—'
    live_photo_preview.short_description = 'Live Photo Preview'

    def document_preview(self, obj):
        if obj.document_image:
            return format_html('<img src="{}" style="max-height:260px; border-radius:8px; border:1px solid #e5e7eb;" />', obj.document_image.url)
        return '—'
    document_preview.short_description = 'ID Document Preview'

    fieldsets = (
        ('User Info', {'fields': ('user', 'phone_number', 'email')}),
        ('Verification Photos', {'fields': ('live_photo_preview', 'live_photo', 'document_preview', 'document_image')}),
        ('Document Type', {'fields': ('document_type',)}),
        ('Review Summary', {'fields': ('kyc_status', 'admin_notes', 'submitted_at', 'reviewed_at')}),
    )

    def actions_buttons(self, obj):
        if obj.kyc_status == 'PENDING':
            approve_url = f"/admin/items/kycsubmission/{obj.id}/approve-kyc-direct/"
            reject_url = f"/admin/items/kycsubmission/{obj.id}/reject-kyc-direct/"
            return format_html(
                '<a href="{}" style="display:inline-block; background-color:#10b981; color:#fff; font-weight:700; padding:4px 10px; border-radius:4px; font-size:11px; text-decoration:none; margin-right:8px; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor=\'#059669\'" onmouseout="this.style.backgroundColor=\'#10b981\'">Approve</a>'
                '<a href="{}" style="display:inline-block; background-color:#ef4444; color:#fff; font-weight:700; padding:4px 10px; border-radius:4px; font-size:11px; text-decoration:none; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor=\'#dc2626\'" onmouseout="this.style.backgroundColor=\'#ef4444\'">Reject</a>',
                approve_url, reject_url
            )
        return mark_safe('<span style="color:#6b7280; font-size:11px; font-weight:500;">Reviewed</span>')
    actions_buttons.short_description = "Quick Actions"

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('<int:kyc_id>/approve-kyc-direct/', self.admin_site.admin_view(self.approve_kyc_direct), name='approve_kyc_direct'),
            path('<int:kyc_id>/reject-kyc-direct/', self.admin_site.admin_view(self.reject_kyc_direct), name='reject_kyc_direct'),
        ]
        return custom_urls + urls

    def approve_kyc_direct(self, request, kyc_id):
        kyc = KYCSubmission.objects.get(pk=kyc_id)
        kyc.kyc_status = 'APPROVED'
        kyc.reviewed_at = timezone.now()
        kyc.save()
        Notification.objects.create(
            user=kyc.user,
            message='✅ Your KYC verification has been approved! You can now claim matched items.'
        )
        self.message_user(request, f"KYC for {kyc.user.username} approved successfully.")
        return redirect(request.META.get('HTTP_REFERER', 'admin:items_kycsubmission_changelist'))

    def reject_kyc_direct(self, request, kyc_id):
        kyc = KYCSubmission.objects.get(pk=kyc_id)
        kyc.kyc_status = 'REJECTED'
        kyc.reviewed_at = timezone.now()
        kyc.save()
        Notification.objects.create(
            user=kyc.user,
            message='❌ Your KYC verification was rejected. Please re-submit with valid documents.'
        )
        self.message_user(request, f"KYC for {kyc.user.username} rejected.")
        return redirect(request.META.get('HTTP_REFERER', 'admin:items_kycsubmission_changelist'))

    @admin.action(description='Approve selected KYC submissions')
    def approve_kyc_action(self, request, queryset):
        for kyc in queryset:
            kyc.kyc_status = 'APPROVED'
            kyc.reviewed_at = timezone.now()
            kyc.save()
            Notification.objects.create(
                user=kyc.user,
                message='✅ Your KYC verification has been approved! You can now claim matched items.'
            )
        self.message_user(request, f'{queryset.count()} KYC submission(s) approved.')

    @admin.action(description='Reject selected KYC submissions')
    def reject_kyc_action(self, request, queryset):
        for kyc in queryset:
            kyc.kyc_status = 'REJECTED'
            kyc.reviewed_at = timezone.now()
            kyc.save()
            Notification.objects.create(
                user=kyc.user,
                message='❌ Your KYC verification was rejected. Please re-submit with valid documents.'
            )
        self.message_user(request, f'{queryset.count()} KYC submission(s) rejected.')


# ── Claim Request Admin ───────────────────────────────────────────────────────

@admin.register(ClaimRequest)
class ClaimRequestAdmin(ModelAdmin):
    list_display = ('claimant', 'match_score_display', 'claim_status_badge', 'claim_actions_buttons', 'created_at')
    list_filter = ('status',)
    search_fields = ('claimant__username',)
    readonly_fields = ('claim_summary_card', 'lost_item_photo', 'found_item_photo', 'created_at', 'reviewed_at')
    list_per_page = 25
    inlines = [ClaimAnswerInline]
    actions = ['approve_claims_action', 'reject_claims_action']

    def match_score_display(self, obj):
        return f"{obj.match.score * 100:.1f}%"
    match_score_display.short_description = "AI Match Score"

    def claim_status_badge(self, obj):
        colors = {
            'PENDING_REVIEW': ('#f59e0b', '#fef3c7'),
            'APPROVED': ('#10b981', '#d1fae5'),
            'REJECTED': ('#ef4444', '#fee2e2'),
            'INFO_REQUESTED': ('#2563eb', '#dbeafe'),
        }
        color, bg = colors.get(obj.status, ('#6b7280', '#f3f4f6'))
        return format_html('<span style="color:{}; background-color:{}; padding:4px 8px; border-radius:4px; font-weight:600; text-transform:uppercase; font-size:11px;">{}</span>', color, bg, obj.status)
    claim_status_badge.short_description = 'Claim Status'

    def claim_summary_card(self, obj):
        try:
            kyc = obj.claimant.kyc
            kyc_status = kyc.kyc_status
            kyc_color = "#10b981" if kyc_status == "APPROVED" else "#ef4444" if kyc_status == "REJECTED" else "#f59e0b"
        except Exception:
            kyc_status = "NO SUBMISSION"
            kyc_color = "#ef4444"

        match_score = obj.match.score
        score_color = "#10b981" if match_score >= 0.7 else "#f59e0b"

        answers = obj.answers.all()
        total_answers = answers.count()
        correct_answers = sum(1 for a in answers if a.answer is True)
        
        html = f"""
        <div style="border:1px solid #e5e7eb; border-radius:12px; padding:20px; background-color:#fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05); margin-bottom:15px; display:flex; gap:40px; color:#111827;">
            <div>
                <span style="font-size:11px; color:#6b7280; font-weight:600; text-transform:uppercase;">Claimant KYC Status</span>
                <div style="font-size:18px; font-weight:700; color:{kyc_color}; margin-top:4px;">{kyc_status}</div>
            </div>
            <div>
                <span style="font-size:11px; color:#6b7280; font-weight:600; text-transform:uppercase;">AI Match Confidence</span>
                <div style="font-size:18px; font-weight:700; color:{score_color}; margin-top:4px;">{match_score * 100:.1f}%</div>
            </div>
            <div>
                <span style="font-size:11px; color:#6b7280; font-weight:600; text-transform:uppercase;">Verification Answers</span>
                <div style="font-size:18px; font-weight:700; color:#1f2937; margin-top:4px;">{correct_answers} / {total_answers} "YES" Responses</div>
            </div>
        </div>
        """
        return mark_safe(html)
    claim_summary_card.short_description = "Claim Evaluation Summary"

    def lost_item_photo(self, obj):
        lost = obj.match.item if obj.match.item.user == obj.claimant else obj.match.matched_item
        if lost.image:
            return format_html(
                '<div><strong>{}</strong><br/><img src="{}" style="max-height:220px; border-radius:8px; border:1px solid #e5e7eb; margin-top:6px;" /></div>',
                lost.title, lost.image.url
            )
        return f'{lost.title} (no photo)'
    lost_item_photo.short_description = 'Lost Item (Claimant)'

    def found_item_photo(self, obj):
        found = obj.match.matched_item if obj.match.item.user == obj.claimant else obj.match.item
        if found.image:
            return format_html(
                '<div><strong>{}</strong><br/><img src="{}" style="max-height:220px; border-radius:8px; border:1px solid #e5e7eb; margin-top:6px;" /></div>',
                found.title, found.image.url
            )
        return f'{found.title} (no photo)'
    found_item_photo.short_description = 'Found Item (Finder)'

    fieldsets = (
        ('Evaluation Overview', {'fields': ('claim_summary_card',)}),
        ('Items Photo Comparison', {'fields': ('lost_item_photo', 'found_item_photo')}),
        ('Claim Details', {'fields': ('match', 'claimant', 'status', 'created_at')}),
        ('Resolution Status', {'fields': ('admin_notes', 'admin_reviewed_by', 'reviewed_at')}),
    )

    def claim_actions_buttons(self, obj):
        if obj.status == 'PENDING_REVIEW':
            approve_url = f"/admin/items/claimrequest/{obj.id}/approve-claim-direct/"
            reject_url = f"/admin/items/claimrequest/{obj.id}/reject-claim-direct/"
            return format_html(
                '<a href="{}" style="display:inline-block; background-color:#10b981; color:#fff; font-weight:700; padding:4px 10px; border-radius:4px; font-size:11px; text-decoration:none; margin-right:8px; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor=\'#059669\'" onmouseout="this.style.backgroundColor=\'#10b981\'">Approve</a>'
                '<a href="{}" style="display:inline-block; background-color:#ef4444; color:#fff; font-weight:700; padding:4px 10px; border-radius:4px; font-size:11px; text-decoration:none; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor=\'#dc2626\'" onmouseout="this.style.backgroundColor=\'#ef4444\'">Reject</a>',
                approve_url, reject_url
            )
        return mark_safe('<span style="color:#6b7280; font-size:11px; font-weight:500;">Reviewed</span>')
    claim_actions_buttons.short_description = "Quick Actions"

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path('<int:claim_id>/approve-claim-direct/', self.admin_site.admin_view(self.approve_claim_direct), name='approve_claim_direct'),
            path('<int:claim_id>/reject-claim-direct/', self.admin_site.admin_view(self.reject_claim_direct), name='reject_claim_direct'),
        ]
        return custom_urls + urls

    def approve_claim_direct(self, request, claim_id):
        claim = ClaimRequest.objects.get(pk=claim_id)
        claim.status = 'APPROVED'
        claim.admin_reviewed_by = request.user
        claim.reviewed_at = timezone.now()
        claim.save()

        match = claim.match
        match.status = 'matched'
        match.save()

        lost = match.item if match.item.user == claim.claimant else match.matched_item
        found = match.matched_item if match.item.user == claim.claimant else match.item
        lost.status = 'RETURNED'
        lost.save()
        found.status = 'RETURNED'
        found.save()

        # Send Notifications
        Notification.objects.create(
            user=claim.claimant, match=match,
            message=f'✅ Your claim for "{found.title}" has been approved! Contact the finder to arrange pickup.'
        )
        Notification.objects.create(
            user=found.user, match=match,
            message=f'✅ The claim for your found item "{found.title}" has been approved. The owner will contact you.'
        )

        self.message_user(request, f"Claim request for {claim.claimant.username} approved.")
        return redirect(request.META.get('HTTP_REFERER', 'admin:items_claimrequest_changelist'))

    def reject_claim_direct(self, request, claim_id):
        claim = ClaimRequest.objects.get(pk=claim_id)
        claim.status = 'REJECTED'
        claim.admin_reviewed_by = request.user
        claim.reviewed_at = timezone.now()
        claim.save()

        match = claim.match
        found = match.matched_item if match.item.user == claim.claimant else match.item
        
        Notification.objects.create(
            user=claim.claimant, match=match,
            message=f'❌ Your claim for "{found.title}" was rejected.'
        )

        self.message_user(request, f"Claim request for {claim.claimant.username} rejected.")
        return redirect(request.META.get('HTTP_REFERER', 'admin:items_claimrequest_changelist'))

    @admin.action(description='Approve selected claims')
    def approve_claims_action(self, request, queryset):
        for claim in queryset:
            claim.status = 'APPROVED'
            claim.admin_reviewed_by = request.user
            claim.reviewed_at = timezone.now()
            claim.save()

            match = claim.match
            match.status = 'matched'
            match.save()

            lost = match.item if match.item.user == claim.claimant else match.matched_item
            found = match.matched_item if match.item.user == claim.claimant else match.item
            lost.status = 'RETURNED'
            lost.save()
            found.status = 'RETURNED'
            found.save()

            Notification.objects.create(
                user=claim.claimant, match=match,
                message=f'✅ Your claim for "{found.title}" has been approved! Contact the finder to arrange pickup.'
            )
            Notification.objects.create(
                user=found.user, match=match,
                message=f'✅ The claim for your found item "{found.title}" has been approved. The owner will contact you.'
            )
        self.message_user(request, f'{queryset.count()} claim(s) approved.')

    @admin.action(description='Reject selected claims')
    def reject_claims_action(self, request, queryset):
        for claim in queryset:
            claim.status = 'REJECTED'
            claim.admin_reviewed_by = request.user
            claim.reviewed_at = timezone.now()
            claim.save()

            match = claim.match
            found = match.matched_item if match.item.user == claim.claimant else match.item
            Notification.objects.create(
                user=claim.claimant, match=match,
                message=f'❌ Your claim for "{found.title}" was rejected.'
            )
        self.message_user(request, f'{queryset.count()} claim(s) rejected.')


# ── Matching Configuration Admin ──────────────────────────────────────────────

@admin.register(MatchingConfiguration)
class MatchingConfigurationAdmin(ModelAdmin):
    list_display = ('color_weight', 'label_weight', 'location_weight', 'text_weight', 'threshold')
    
    def has_add_permission(self, request):
        if MatchingConfiguration.objects.exists():
            return False
        return super().has_add_permission(request)

    def has_delete_permission(self, request, obj=None):
        return False


# ── Electronics Admins ────────────────────────────────────────────────────────

@admin.register(LostElectronic)
class LostElectronicAdmin(ModelAdmin):
    list_display = ('title', 'electronic_type', 'brand', 'model_name', 'color', 'os_type', 'user', 'created_at')
    list_filter = ('electronic_type', 'brand', 'os_type', 'condition')
    search_fields = ('brand', 'model_name', 'color', 'lock_screen_message', 'title')
    list_per_page = 25


@admin.register(FoundElectronic)
class FoundElectronicAdmin(ModelAdmin):
    list_display = ('title', 'electronic_type', 'brand', 'model_name', 'color', 'os_type', 'is_device_locked', 'factory_reset_alert', 'is_suspicious', 'created_at')
    list_filter = ('electronic_type', 'brand', 'os_type', 'is_device_locked', 'is_factory_reset', 'is_suspicious')
    search_fields = ('brand', 'model_name', 'color', 'lock_screen_message', 'title')
    list_per_page = 25
    readonly_fields = ('factory_reset_alert_detail',)

    def factory_reset_alert(self, obj):
        if obj.is_factory_reset:
            return mark_safe('<span style="color: #ef4444; font-weight: bold; background-color: #fee2e2; padding: 4px 8px; border-radius: 4px; font-size: 11px;">⚠️ Reset Alert</span>')
        return 'No'
    factory_reset_alert.short_description = 'Reset Status'

    def factory_reset_alert_detail(self, obj):
        if obj.is_factory_reset:
            return mark_safe('<div style="color: #ef4444; font-weight: bold; background-color: #fee2e2; border: 1px solid #fca5a5; padding: 12px; border-radius: 6px; margin-bottom: 15px;">⚠️ WARNING: This device has been reported as factory reset by the finder. This is highly suspicious for a lost electronic device!</div>')
        return 'Device has not been factory reset.'
    factory_reset_alert_detail.short_description = 'Factory Reset Warning'

    fieldsets = (
        ('Basic Info', {'fields': ('user', 'title', 'description', 'image', 'status')}),
        ('Electronic Specs', {'fields': ('electronic_type', 'brand', 'model_name', 'color', 'os_type', 'imei_or_serial', 'imei_or_serial_source')}),
        ('Device State', {'fields': ('is_device_locked', 'lock_screen_message', 'condition')}),
        ('Admin Checks', {'fields': ('is_factory_reset', 'is_suspicious', 'factory_reset_alert_detail')}),
    )


# ── Other Admins ──────────────────────────────────────────────────────────────

@admin.register(UserProfile)
class UserProfileAdmin(ModelAdmin):
    list_display = ('user', 'full_name', 'phone_number')
    search_fields = ('user__username', 'full_name')
    list_per_page = 25


@admin.register(Notification)
class NotificationAdmin(ModelAdmin):
    list_display = ('user', 'message_short', 'is_read', 'created_at')
    list_filter = ('is_read',)
    search_fields = ('user__username', 'message')
    list_per_page = 25

    def message_short(self, obj):
        return obj.message[:80] + '...' if len(obj.message) > 80 else obj.message
    message_short.short_description = 'Message'
