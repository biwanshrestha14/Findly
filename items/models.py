import math
from django.core.exceptions import ValidationError
from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from encrypted_model_fields.fields import EncryptedCharField


class Item(models.Model):
    CATEGORY_CHOICES = [
        ('Electronics', 'Electronics'),
        ('Pets', 'Pets'),
        ('Documents', 'Documents'),
        ('Bags', 'Bags'),
        ('Wallet', 'Wallet'),
    ]

    ITEM_TYPE_CHOICES = [
        ('LOST', 'Lost'),
        ('FOUND', 'Found'),
    ]

    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('MATCHED', 'Matched'),
        ('RETURNED', 'Returned'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    item_type = models.CharField(max_length=10, choices=ITEM_TYPE_CHOICES)
    title = models.CharField(max_length=100)
    description = models.TextField()
    sub_category = models.CharField(max_length=100, blank=True, null=True)
    image = models.ImageField(upload_to='items/')
    image_hash = models.CharField(max_length=255, blank=True, null=True)
    color_vector = models.JSONField(blank=True, null=True)
    labels = models.JSONField(blank=True, null=True)
    # Full MobileNetV2 predictions: [{ 'label': str, 'score': float }, ...]
    # Used for weighted similarity calculation and frontend display.
    label_scores = models.JSONField(default=list, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='ACTIVE')
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    def __str__(self):
        return f"{self.get_item_type_display()} - {self.title}"


class Match(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('matched', 'Matched'),
        ('rejected', 'Rejected'),
    ]
    item = models.ForeignKey(Item, related_name='expected_matches', on_delete=models.CASCADE)
    matched_item = models.ForeignKey(Item, related_name='matched_to', on_delete=models.CASCADE)
    score = models.FloatField()
    color_score = models.FloatField(default=0.0)
    label_score = models.FloatField(default=0.0)
    location_score = models.FloatField(default=0.0)
    text_score = models.FloatField(default=0.0)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('item', 'matched_item')
        ordering = ['-score']

    def __str__(self):
        return f"Match: {self.item.title} <-> {self.matched_item.title} ({self.score})"


class Notification(models.Model):
    """
    Stores in-app notifications triggered by match events and KYC status changes.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    match = models.ForeignKey(Match, on_delete=models.CASCADE, null=True, blank=True)
    message = models.CharField(max_length=500)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Notification for {self.user.username}: {self.message[:50]}"


class KYCSubmission(models.Model):
    """
    KYC (Know Your Customer) verification for item claim eligibility.
    Users must be APPROVED before they can claim matched items.
    """
    DOCUMENT_TYPE_CHOICES = [
        ('LICENSE', 'Driver\'s License'),
        ('CITIZENSHIP', 'Citizenship Card'),
        ('NATIONAL_ID', 'National ID'),
    ]

    KYC_STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='kyc')
    phone_number = models.CharField(max_length=20)
    email = models.EmailField()
    live_photo = models.ImageField(upload_to='kyc/live_photos/')
    document_type = models.CharField(max_length=20, choices=DOCUMENT_TYPE_CHOICES)
    document_image = models.ImageField(upload_to='kyc/documents/')
    kyc_status = models.CharField(max_length=10, choices=KYC_STATUS_CHOICES, default='PENDING')
    admin_notes = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'KYC Submission'
        verbose_name_plural = 'KYC Submissions'

    def __str__(self):
        return f"KYC: {self.user.username} — {self.kyc_status}"


class UserProfile(models.Model):
    """
    Extended user profile with editable personal details and profile picture.
    Auto-created via post_save signal when a User is created.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    profile_picture = models.ImageField(upload_to='profiles/', null=True, blank=True)
    phone_number = models.CharField(max_length=20, blank=True)
    address = models.CharField(max_length=255, blank=True)
    bio = models.TextField(blank=True)
    full_name = models.CharField(max_length=150, blank=True)

    def __str__(self):
        return f"Profile: {self.user.username}"


# ── Verification System Models ────────────────────────────────────────────────

class ItemVerificationDetail(models.Model):
    """
    Unique descriptive detail about a FOUND item, entered by the finder.
    detail_text = the actual description (hidden from claimant)
    detail_hint = a neutral rephrasing shown to the claimant as a YES/NO question
    """
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='verification_details')
    detail_text = models.CharField(max_length=300)
    detail_hint = models.CharField(max_length=150)
    order = models.IntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"Detail #{self.order} for {self.item.title}"


class ClaimRequest(models.Model):
    """
    A claim submitted by a lost item owner against a matched found item.
    Goes through admin review before approval/rejection.
    """
    STATUS_CHOICES = [
        ('PENDING_REVIEW', 'Pending Review'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('INFO_REQUESTED', 'Info Requested'),
    ]

    match = models.OneToOneField(Match, on_delete=models.CASCADE, related_name='claim')
    claimant = models.ForeignKey(User, on_delete=models.CASCADE, related_name='claims')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING_REVIEW')
    admin_notes = models.TextField(blank=True)
    admin_reviewed_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reviewed_claims'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Claim by {self.claimant.username} — {self.status}"


class ClaimAnswer(models.Model):
    """
    The lost user's YES/NO response to a single verification detail.
    """
    claim_request = models.ForeignKey(ClaimRequest, on_delete=models.CASCADE, related_name='answers')
    verification_detail = models.ForeignKey(ItemVerificationDetail, on_delete=models.CASCADE)
    answer = models.BooleanField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('claim_request', 'verification_detail')

    def __str__(self):
        return f"{'YES' if self.answer else 'NO'} — {self.verification_detail.detail_hint}"


class MatchingConfiguration(models.Model):
    color_weight = models.FloatField(default=0.25, help_text="Weight for color similarity (0.0 to 1.0)")
    label_weight = models.FloatField(default=0.35, help_text="Weight for MobileNetV2 label similarity (0.0 to 1.0)")
    location_weight = models.FloatField(default=0.20, help_text="Weight for location proximity similarity (0.0 to 1.0)")
    text_weight = models.FloatField(default=0.20, help_text="Weight for title & description text similarity (0.0 to 1.0)")
    threshold = models.FloatField(default=0.70, help_text="Minimum aggregate score threshold (0.0 to 1.0) to register a match")

    class Meta:
        verbose_name = "Matching Configuration"
        verbose_name_plural = "Matching Configurations"

    def clean(self):
        total_weight = self.color_weight + self.label_weight + self.location_weight + self.text_weight
        if not math.isclose(total_weight, 1.0, rel_tol=1e-5):
            raise ValidationError(f"The sum of all weights must be exactly 1.0 (currently {total_weight}).")
        if not (0.0 <= self.threshold <= 1.0):
            raise ValidationError("Threshold must be between 0.0 and 1.0.")

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    @classmethod
    def get_config(cls):
        config, created = cls.objects.get_or_create(id=1)
        return config

    def __str__(self):
        return f"Weights: Color={self.color_weight}, Label={self.label_weight}, Loc={self.location_weight}, Text={self.text_weight} | Threshold={self.threshold}"


class LostElectronic(Item):
    ELECTRONIC_TYPE_CHOICES = [
        ('mobile_phone', 'Mobile Phone'),
        ('laptop', 'Laptop'),
        ('tablet', 'Tablet'),
        ('earbuds', 'Earbuds'),
        ('smartwatch', 'Smartwatch'),
        ('camera', 'Camera'),
        ('accessories', 'Accessories'),
    ]
    OS_CHOICES = [
        ('iOS', 'iOS'),
        ('Android', 'Android'),
    ]
    CONDITION_CHOICES = [
        ('good', 'Good'),
        ('screen_cracked', 'Screen Cracked'),
        ('damaged', 'Damaged'),
    ]

    electronic_type = models.CharField(max_length=50, choices=ELECTRONIC_TYPE_CHOICES, default='mobile_phone')
    brand = models.CharField(max_length=100)
    model_name = models.CharField(max_length=100)
    color = models.CharField(max_length=50)
    storage_capacity = models.CharField(max_length=20, null=True, blank=True)
    os_type = models.CharField(max_length=20, choices=OS_CHOICES, null=True, blank=True)
    imei_or_serial = EncryptedCharField(max_length=50, null=True, blank=True)
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES)
    lock_screen_message = models.CharField(max_length=255, null=True, blank=True)
    reward_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    def save(self, *args, **kwargs):
        self.category = 'Electronics'
        mapping = {
            'mobile_phone': 'Mobile Phone',
            'laptop': 'Laptop',
            'tablet': 'Tablet',
            'earbuds': 'Earbuds',
            'smartwatch': 'Smartwatch',
            'camera': 'Camera',
            'accessories': 'Accessories',
        }
        self.sub_category = mapping.get(self.electronic_type, 'Electronics')
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Lost {self.get_electronic_type_display()}: {self.brand} {self.model_name} ({self.color})"


class FoundElectronic(Item):
    ELECTRONIC_TYPE_CHOICES = [
        ('mobile_phone', 'Mobile Phone'),
        ('laptop', 'Laptop'),
        ('tablet', 'Tablet'),
        ('earbuds', 'Earbuds'),
        ('smartwatch', 'Smartwatch'),
        ('camera', 'Camera'),
        ('accessories', 'Accessories'),
    ]
    OS_CHOICES = [
        ('iOS', 'iOS'),
        ('Android', 'Android'),
    ]
    CONDITION_CHOICES = [
        ('good', 'Good'),
        ('screen_cracked', 'Screen Cracked'),
        ('damaged', 'Damaged'),
    ]
    IMEI_SOURCE_CHOICES = [
        ('emergency_dialer', 'Emergency Dialer'),
        ('sim_tray', 'SIM Tray'),
        ('back_of_phone', 'Back of Phone'),
        ('not_found', 'Not Found'),
    ]

    electronic_type = models.CharField(max_length=50, choices=ELECTRONIC_TYPE_CHOICES, default='mobile_phone')
    brand = models.CharField(max_length=100)
    model_name = models.CharField(max_length=100)
    color = models.CharField(max_length=50)
    os_type = models.CharField(max_length=20, choices=OS_CHOICES, null=True, blank=True)
    imei_or_serial = EncryptedCharField(max_length=50, null=True, blank=True)
    imei_or_serial_source = models.CharField(max_length=30, choices=IMEI_SOURCE_CHOICES, default='not_found')
    is_device_locked = models.BooleanField(default=True)
    lock_screen_message = models.CharField(max_length=255, null=True, blank=True)
    is_factory_reset = models.BooleanField(default=False)
    is_suspicious = models.BooleanField(default=False)
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES)

    def save(self, *args, **kwargs):
        self.category = 'Electronics'
        mapping = {
            'mobile_phone': 'Mobile Phone',
            'laptop': 'Laptop',
            'tablet': 'Tablet',
            'earbuds': 'Earbuds',
            'smartwatch': 'Smartwatch',
            'camera': 'Camera',
            'accessories': 'Accessories',
        }
        self.sub_category = mapping.get(self.electronic_type, 'Electronics')
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Found {self.get_electronic_type_display()}: {self.brand} {self.model_name} ({self.color})"


# ── Signal: auto-create UserProfile when a new User is created ────────────────
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.get_or_create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    if hasattr(instance, 'profile'):
        instance.profile.save()
