"""
Serializers for the Findly Lost & Found API.
"""
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import (
    Item, Match, Notification, KYCSubmission, UserProfile,
    ItemVerificationDetail, ClaimRequest, ClaimAnswer,
    LostElectronic, FoundElectronic,
)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Accepts either 'username' or 'email' for login."""

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password', '')

        if not username:
            raise serializers.ValidationError('Username or email is required.')

        # If the value looks like an email, try to find the user by email
        # and swap the username for the actual username field
        if '@' in username:
            try:
                user = User.objects.get(email=username)
                username = user.username
            except User.DoesNotExist:
                raise serializers.ValidationError('Invalid credentials.')

        attrs['username'] = username
        return super().validate(attrs)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email')


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'password')

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password']
        )
        return user


class ItemSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    has_verification_details = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = '__all__'
        read_only_fields = ('user', 'image_hash', 'color_vector', 'labels', 'label_scores')

    def get_has_verification_details(self, obj):
        return obj.verification_details.exists()


class MatchSerializer(serializers.ModelSerializer):
    item = ItemSerializer(read_only=True)
    matched_item = ItemSerializer(read_only=True)
    has_claim = serializers.SerializerMethodField()

    class Meta:
        model = Match
        fields = ('id', 'item', 'matched_item', 'score', 'color_score',
                  'label_score', 'location_score', 'text_score', 'status',
                  'created_at', 'has_claim')

    def get_has_claim(self, obj):
        return hasattr(obj, 'claim')


# ── Notification ──────────────────────────────────────────────────────────────

class NotificationSerializer(serializers.ModelSerializer):
    match = MatchSerializer(read_only=True)

    class Meta:
        model = Notification
        fields = ('id', 'user', 'match', 'message', 'is_read', 'created_at')
        read_only_fields = ('user', 'match', 'message', 'created_at')


# ── KYC ───────────────────────────────────────────────────────────────────────

class KYCSubmitSerializer(serializers.ModelSerializer):
    class Meta:
        model = KYCSubmission
        fields = ('phone_number', 'email', 'live_photo', 'document_type', 'document_image')


class KYCStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = KYCSubmission
        fields = ('id', 'phone_number', 'email', 'document_type', 'kyc_status',
                  'admin_notes', 'submitted_at', 'reviewed_at')
        read_only_fields = fields


class KYCAdminSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = KYCSubmission
        fields = ('id', 'username', 'user_email', 'phone_number', 'email',
                  'live_photo', 'document_type', 'document_image', 'kyc_status',
                  'admin_notes', 'submitted_at', 'reviewed_at')
        read_only_fields = ('id', 'username', 'user_email', 'phone_number', 'email',
                            'live_photo', 'document_type', 'document_image',
                            'submitted_at')


# ── UserProfile ───────────────────────────────────────────────────────────────

class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    kyc_status = serializers.SerializerMethodField()

    class Meta:
        model = UserProfile
        fields = ('id', 'username', 'email', 'full_name', 'phone_number',
                  'address', 'bio', 'profile_picture', 'kyc_status')

    def get_kyc_status(self, obj):
        try:
            return obj.user.kyc.kyc_status
        except KYCSubmission.DoesNotExist:
            return None


# ── Verification Details ──────────────────────────────────────────────────────

class VerificationDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemVerificationDetail
        fields = ('id', 'detail_text', 'detail_hint', 'order', 'created_at')
        read_only_fields = ('id', 'created_at')


class VerificationHintSerializer(serializers.ModelSerializer):
    """Only exposes the neutral hint, NOT the actual detail_text."""
    class Meta:
        model = ItemVerificationDetail
        fields = ('id', 'detail_hint', 'order')


# ── Claim System ──────────────────────────────────────────────────────────────

class ClaimAnswerSerializer(serializers.ModelSerializer):
    detail_hint = serializers.CharField(source='verification_detail.detail_hint', read_only=True)
    detail_text = serializers.CharField(source='verification_detail.detail_text', read_only=True)

    class Meta:
        model = ClaimAnswer
        fields = ('id', 'verification_detail', 'answer', 'detail_hint', 'detail_text', 'created_at')
        read_only_fields = ('id', 'created_at', 'detail_hint', 'detail_text')


class ClaimRequestSerializer(serializers.ModelSerializer):
    answers = ClaimAnswerSerializer(many=True, read_only=True)
    match = MatchSerializer(read_only=True)
    claimant_username = serializers.CharField(source='claimant.username', read_only=True)

    class Meta:
        model = ClaimRequest
        fields = ('id', 'match', 'claimant', 'claimant_username', 'status',
                  'admin_notes', 'admin_reviewed_by', 'reviewed_at',
                  'created_at', 'answers')
        read_only_fields = ('id', 'claimant', 'claimant_username', 'created_at',
                            'admin_reviewed_by', 'reviewed_at')


class AdminClaimSerializer(serializers.ModelSerializer):
    """Full claim detail for admin review including KYC data for both parties."""
    answers = ClaimAnswerSerializer(many=True, read_only=True)
    match = MatchSerializer(read_only=True)
    claimant_username = serializers.CharField(source='claimant.username', read_only=True)
    claimant_kyc = serializers.SerializerMethodField()
    found_user_kyc = serializers.SerializerMethodField()

    class Meta:
        model = ClaimRequest
        fields = ('id', 'match', 'claimant', 'claimant_username', 'status',
                  'admin_notes', 'admin_reviewed_by', 'reviewed_at',
                  'created_at', 'answers', 'claimant_kyc', 'found_user_kyc')

    def get_claimant_kyc(self, obj):
        try:
            return KYCAdminSerializer(obj.claimant.kyc).data
        except KYCSubmission.DoesNotExist:
            return None

    def get_found_user_kyc(self, obj):
        # The found item is the matched_item in the match (claimant owns the lost item)
        found_item = obj.match.matched_item if obj.match.item.user == obj.claimant else obj.match.item
        try:
            return KYCAdminSerializer(found_item.user.kyc).data
        except KYCSubmission.DoesNotExist:
            return None


# ── Phone Serializers ─────────────────────────────────────────────────────────

# ── Electronic Serializers ───────────────────────────────────────────────────

class LostElectronicSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    imei_or_serial_masked = serializers.SerializerMethodField()

    class Meta:
        model = LostElectronic
        fields = (
            'id', 'user', 'title', 'description', 'image', 'item_type',
            'category', 'sub_category', 'latitude', 'longitude', 'status',
            'electronic_type', 'brand', 'model_name', 'color', 'storage_capacity', 'os_type',
            'imei_or_serial', 'condition', 'lock_screen_message', 'reward_amount',
            'image_hash', 'color_vector', 'labels', 'label_scores',
            'created_at', 'imei_or_serial_masked',
        )
        read_only_fields = (
            'user', 'image_hash', 'color_vector', 'labels', 'label_scores',
            'category', 'sub_category', 'item_type', 'imei_or_serial_masked',
        )
        extra_kwargs = {
            'imei_or_serial': {'write_only': True, 'required': False},
        }

    def get_imei_or_serial_masked(self, obj):
        if obj.imei_or_serial:
            return f"***********{obj.imei_or_serial[-4:]}"
        return None

    def create(self, validated_data):
        validated_data['item_type'] = 'LOST'
        return super().create(validated_data)


class FoundElectronicSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    imei_or_serial_masked = serializers.SerializerMethodField()

    class Meta:
        model = FoundElectronic
        fields = (
            'id', 'user', 'title', 'description', 'image', 'item_type',
            'category', 'sub_category', 'latitude', 'longitude', 'status',
            'electronic_type', 'brand', 'model_name', 'color', 'os_type',
            'imei_or_serial', 'imei_or_serial_source', 'is_device_locked', 'lock_screen_message',
            'is_factory_reset', 'is_suspicious', 'condition',
            'image_hash', 'color_vector', 'labels', 'label_scores',
            'created_at', 'imei_or_serial_masked',
        )
        read_only_fields = (
            'user', 'image_hash', 'color_vector', 'labels', 'label_scores',
            'category', 'sub_category', 'item_type', 'imei_or_serial_masked',
        )
        extra_kwargs = {
            'imei_or_serial': {'write_only': True, 'required': False},
            'is_suspicious': {'required': False},
        }

    def get_imei_or_serial_masked(self, obj):
        if obj.imei_or_serial:
            return f"***********{obj.imei_or_serial[-4:]}"
        return None

    def create(self, validated_data):
        validated_data['item_type'] = 'FOUND'
        return super().create(validated_data)


