from django.contrib import admin
from django.utils.html import format_html
from django.utils import timezone
from .models import (
    Item, Match, Notification, KYCSubmission, UserProfile,
    ItemVerificationDetail, ClaimRequest, ClaimAnswer,
)


# ── Inlines ───────────────────────────────────────────────────────────────────

class VerificationDetailInline(admin.TabularInline):
    model = ItemVerificationDetail
    extra = 0
    fields = ('order', 'detail_text', 'detail_hint')


class ClaimAnswerInline(admin.TabularInline):
    model = ClaimAnswer
    extra = 0
    readonly_fields = ('verification_detail', 'detail_text_display', 'answer')
    fields = ('verification_detail', 'detail_text_display', 'answer')

    def detail_text_display(self, obj):
        return obj.verification_detail.detail_text
    detail_text_display.short_description = 'Actual Detail'


# ── Item Admin ────────────────────────────────────────────────────────────────

@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ('title', 'item_type', 'category', 'status', 'user', 'created_at')
    list_filter = ('status', 'item_type', 'category')
    search_fields = ('title', 'description')
    list_per_page = 25
    inlines = [VerificationDetailInline]

    actions = ['mark_as_returned']

    @admin.action(description='Mark selected items as Returned')
    def mark_as_returned(self, request, queryset):
        updated = queryset.update(status='RETURNED')
        self.message_user(request, f'{updated} item(s) marked as RETURNED.')


# ── Match Admin ───────────────────────────────────────────────────────────────

@admin.register(Match)
class MatchAdmin(admin.ModelAdmin):
    list_display = ('item', 'matched_item', 'score', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('item__title', 'matched_item__title')
    list_per_page = 25


# ── Notification Admin ────────────────────────────────────────────────────────

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'message_short', 'is_read', 'created_at')
    list_filter = ('is_read',)
    search_fields = ('user__username', 'message')
    list_per_page = 25

    def message_short(self, obj):
        return obj.message[:80] + '...' if len(obj.message) > 80 else obj.message
    message_short.short_description = 'Message'


# ── KYC Submission Admin ──────────────────────────────────────────────────────

@admin.register(KYCSubmission)
class KYCSubmissionAdmin(admin.ModelAdmin):
    list_display = ('user', 'document_type', 'kyc_status', 'submitted_at', 'reviewed_at')
    list_filter = ('kyc_status', 'document_type')
    search_fields = ('user__username', 'email')
    list_per_page = 25
    readonly_fields = ('live_photo_preview', 'document_preview', 'submitted_at')

    actions = ['approve_kyc', 'reject_kyc']

    def live_photo_preview(self, obj):
        if obj.live_photo:
            return format_html('<img src="{}" style="max-height:300px; border-radius:8px;" />', obj.live_photo.url)
        return '—'
    live_photo_preview.short_description = 'Live Photo Preview'

    def document_preview(self, obj):
        if obj.document_image:
            return format_html('<img src="{}" style="max-height:300px; border-radius:8px;" />', obj.document_image.url)
        return '—'
    document_preview.short_description = 'Document Preview'

    fieldsets = (
        ('User Info', {'fields': ('user', 'phone_number', 'email')}),
        ('Photos', {'fields': ('live_photo_preview', 'live_photo', 'document_preview', 'document_image')}),
        ('Document', {'fields': ('document_type',)}),
        ('Review', {'fields': ('kyc_status', 'admin_notes', 'submitted_at', 'reviewed_at')}),
    )

    @admin.action(description='Approve selected KYC submissions')
    def approve_kyc(self, request, queryset):
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
    def reject_kyc(self, request, queryset):
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
class ClaimRequestAdmin(admin.ModelAdmin):
    list_display = ('claimant', 'status', 'reviewed_at', 'admin_reviewed_by', 'created_at')
    list_filter = ('status',)
    search_fields = ('claimant__username',)
    readonly_fields = ('match', 'claimant', 'created_at', 'lost_item_photo', 'found_item_photo')
    list_per_page = 25
    inlines = [ClaimAnswerInline]

    actions = ['approve_claims', 'reject_claims']

    fieldsets = (
        ('Claim Info', {'fields': ('match', 'claimant', 'status', 'created_at')}),
        ('Item Photos', {'fields': ('lost_item_photo', 'found_item_photo')}),
        ('Admin Review', {'fields': ('admin_notes', 'admin_reviewed_by', 'reviewed_at')}),
    )

    def lost_item_photo(self, obj):
        lost = obj.match.item if obj.match.item.user == obj.claimant else obj.match.matched_item
        if lost.image:
            return format_html(
                '<div><strong>{}</strong><br/><img src="{}" style="max-height:200px; border-radius:8px; margin-top:4px;" /></div>',
                lost.title, lost.image.url
            )
        return f'{lost.title} (no photo)'
    lost_item_photo.short_description = 'Lost Item'

    def found_item_photo(self, obj):
        found = obj.match.matched_item if obj.match.item.user == obj.claimant else obj.match.item
        if found.image:
            return format_html(
                '<div><strong>{}</strong><br/><img src="{}" style="max-height:200px; border-radius:8px; margin-top:4px;" /></div>',
                found.title, found.image.url
            )
        return f'{found.title} (no photo)'
    found_item_photo.short_description = 'Found Item'

    @admin.action(description='Approve selected claims')
    def approve_claims(self, request, queryset):
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
                message=f'✅ Your claim for "{found.title}" has been approved!'
            )
            Notification.objects.create(
                user=found.user, match=match,
                message=f'✅ The claim for your found item "{found.title}" has been approved.'
            )
        self.message_user(request, f'{queryset.count()} claim(s) approved.')

    @admin.action(description='Reject selected claims')
    def reject_claims(self, request, queryset):
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


# ── Other ─────────────────────────────────────────────────────────────────────

@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'full_name', 'phone_number')
    search_fields = ('user__username', 'full_name')
    list_per_page = 25

@admin.register(ItemVerificationDetail)
class ItemVerificationDetailAdmin(admin.ModelAdmin):
    list_display = ('item', 'order', 'detail_hint', 'created_at')
    search_fields = ('item__title', 'detail_text')
    list_per_page = 25
