"""
Views for the Findly Lost & Found API.

API Endpoints:
  Items:
    GET/POST   /api/items/                              — List/create items
    GET        /api/items/{id}/                          — Item detail
    GET        /api/items/my_matches/                    — User's matches
    GET        /api/items/{id}/matches/                  — Matches for item
    POST       /api/items/{id}/add_verification_details/ — Add verification details (found owner)
    GET        /api/items/{id}/verification_hints/       — Get hints (claimant)
    PATCH      /api/items/{id}/update_status/            — Update item status

  Claims:
    POST       /api/claims/submit/                       — Submit a claim
    GET        /api/claims/my_claims/                    — User's claims

  Notifications:
    GET        /api/notifications/                       — Unread notifications
    POST       /api/notifications/{id}/read/             — Mark read

  KYC:
    POST       /api/kyc/submit/                          — Submit KYC
    GET        /api/kyc/status/                          — KYC status

  Profile:
    GET/PATCH  /api/profile/                             — User profile

  Admin:
    GET        /api/admin/kyc/                           — List all KYC
    PATCH      /api/admin/kyc/{id}/review/               — Review KYC
    GET        /api/admin/claims/                        — Pending claims
    PATCH      /api/admin/claims/{id}/review/            — Review claim
    PATCH      /api/admin/items/{id}/set_status/         — Set item status
"""

from rest_framework import viewsets, generics, status, filters
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth.models import User
from django.utils import timezone
from .models import (
    Item, Match, Notification, KYCSubmission, UserProfile,
    ItemVerificationDetail, ClaimRequest, ClaimAnswer,
    LostElectronic, FoundElectronic,
)
from .serializers import (
    ItemSerializer, RegisterSerializer, UserSerializer, MatchSerializer,
    NotificationSerializer, KYCSubmitSerializer, KYCStatusSerializer,
    KYCAdminSerializer, UserProfileSerializer,
    VerificationDetailSerializer, VerificationHintSerializer,
    ClaimRequestSerializer, ClaimAnswerSerializer, AdminClaimSerializer,
    CustomTokenObtainPairSerializer,
    LostElectronicSerializer, FoundElectronicSerializer,
)
from services.matching_service import process_item_image, find_matches, find_electronic_matches


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class CheckAdminView(APIView):
    """GET /api/auth/check_admin/ — returns whether the user is an admin."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'is_admin': request.user.is_staff or request.user.is_superuser,
            'username': request.user.username,
        })


# ── Items ─────────────────────────────────────────────────────────────────────

class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.all()
    serializer_class = ItemSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['title', 'description', 'category']

    def get_permissions(self):
        permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    def perform_create(self, serializer):
        if self.request.user.email == 'biwanshrestha77@gmail.com' or self.request.user.username == 'biwanshrestha77@gmail.com':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("biwanshrestha77@gmail.com acts as an admin and cannot post items.")
        item = serializer.save(user=self.request.user)
        process_item_image(item)
        find_matches(item)

    def get_queryset(self):
        queryset = Item.objects.filter(user=self.request.user)
        category = self.request.query_params.get('category', None)
        item_type = self.request.query_params.get('item_type', None)
        item_status = self.request.query_params.get('status', None)

        if category:
            queryset = queryset.filter(category=category)
        if item_type:
            queryset = queryset.filter(item_type=item_type)
        if item_status:
            queryset = queryset.filter(status=item_status)
        return queryset

    @action(detail=False, methods=['get'])
    def my_matches(self, request):
        user = request.user
        matches_qs = Match.objects.filter(item__user=user).order_by('-score')
        serializer = MatchSerializer(matches_qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def matches(self, request, pk=None):
        item = self.get_object()
        matches_qs = Match.objects.filter(item=item).order_by('-score')
        serializer = MatchSerializer(matches_qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='matches/(?P<match_pk>[^/.]+)/reject')
    def reject_match(self, request, pk=None, match_pk=None):
        try:
            match = Match.objects.get(pk=match_pk, item__user=request.user)
            match.status = 'rejected'
            match.save()

            # Also update reciprocal match
            Match.objects.filter(
                item=match.matched_item,
                matched_item=match.item
            ).update(status='rejected')

            return Response({'status': 'Match rejected successfully'})
        except Match.DoesNotExist:
            return Response({'error': 'Match not found'}, status=404)

    @action(detail=True, methods=['post'], url_path='matches/(?P<match_pk>[^/.]+)/report_suspicious')
    def report_suspicious(self, request, pk=None, match_pk=None):
        try:
            match = Match.objects.get(pk=match_pk, item__user=request.user)
            matched_item = match.matched_item

            # Flag the found phone as suspicious if it is FoundPhone
            if hasattr(matched_item, 'foundphone'):
                found_phone = matched_item.foundphone
                found_phone.is_suspicious = True
                found_phone.save()

            match.status = 'rejected'
            match.save()

            # Reciprocal match
            Match.objects.filter(
                item=match.matched_item,
                matched_item=match.item
            ).update(status='rejected')

            return Response({'status': 'Match reported as suspicious and rejected'})
        except Match.DoesNotExist:
            return Response({'error': 'Match not found'}, status=404)


    @action(detail=True, methods=['post'])
    def add_verification_details(self, request, pk=None):
        """Found item owner adds 2-3 verification details."""
        item = self.get_object()

        if item.item_type != 'FOUND':
            return Response({'error': 'Verification details can only be added to FOUND items.'},
                            status=status.HTTP_400_BAD_REQUEST)
        if item.user != request.user:
            return Response({'error': 'Only the item owner can add verification details.'},
                            status=status.HTTP_403_FORBIDDEN)

        details = request.data.get('details', [])
        if not isinstance(details, list) or len(details) < 2 or len(details) > 3:
            return Response({'error': 'Provide 2 to 3 verification details.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Replace existing details
        item.verification_details.all().delete()

        created = []
        for i, d in enumerate(details, start=1):
            detail_text = d.get('detail_text', '').strip()
            detail_hint = d.get('detail_hint', '').strip()
            if not detail_text or not detail_hint:
                return Response({'error': f'Detail #{i} must have both detail_text and detail_hint.'},
                                status=status.HTTP_400_BAD_REQUEST)
            obj = ItemVerificationDetail.objects.create(
                item=item, detail_text=detail_text, detail_hint=detail_hint, order=i
            )
            created.append(obj)

        serializer = VerificationDetailSerializer(created, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def verification_hints(self, request, pk=None):
        """Returns only hint text (not actual details) for a found item.
        Only accessible when a pending match exists between requester's lost item and this found item."""
        try:
            found_item = Item.objects.get(pk=pk, item_type='FOUND')
        except Item.DoesNotExist:
            return Response({'error': 'Found item not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Check that requester has a pending match with this found item
        has_match = Match.objects.filter(
            item__user=request.user, item__item_type='LOST',
            matched_item=found_item, status='pending'
        ).exists()

        if not has_match:
            return Response({'error': 'No pending match exists between your item and this found item.'},
                            status=status.HTTP_403_FORBIDDEN)

        hints = found_item.verification_details.all()
        serializer = VerificationHintSerializer(hints, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        item = self.get_object()
        new_status = request.data.get('status')
        if new_status in dict(Item.STATUS_CHOICES):
            item.status = new_status
            item.save()
            return Response({'status': f'Status updated to {new_status}'})
        return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)


# ── Claims ────────────────────────────────────────────────────────────────────

class ClaimSubmitView(APIView):
    """POST /api/claims/submit/ — submit a claim with verification answers."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        match_id = request.data.get('match_id')
        answers = request.data.get('answers', [])

        if not match_id:
            return Response({'error': 'match_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            match = Match.objects.get(pk=match_id)
        except Match.DoesNotExist:
            return Response({'error': 'Match not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Verify claimant owns the lost item in this match
        lost_item = match.item if match.item.user == request.user else None
        if not lost_item or lost_item.item_type != 'LOST':
            return Response({'error': 'You can only claim matches for your own lost items.'},
                            status=status.HTTP_403_FORBIDDEN)

        # KYC gate
        try:
            kyc = request.user.kyc
            if kyc.kyc_status != 'APPROVED':
                return Response(
                    {'error': 'KYC verification required.', 'error_code': 'KYC_REQUIRED',
                     'kyc_status': kyc.kyc_status},
                    status=status.HTTP_403_FORBIDDEN
                )
        except KYCSubmission.DoesNotExist:
            return Response(
                {'error': 'KYC verification required.', 'error_code': 'KYC_REQUIRED', 'kyc_status': None},
                status=status.HTTP_403_FORBIDDEN
            )

        # Prevent duplicate claims
        if ClaimRequest.objects.filter(match=match).exists():
            return Response({'error': 'A claim already exists for this match.'},
                            status=status.HTTP_400_BAD_REQUEST)

        # Create claim
        claim = ClaimRequest.objects.create(match=match, claimant=request.user)

        # Create answers
        for ans in answers:
            detail_id = ans.get('verification_detail_id')
            answer_val = ans.get('answer')
            try:
                detail = ItemVerificationDetail.objects.get(pk=detail_id)
                ClaimAnswer.objects.create(
                    claim_request=claim, verification_detail=detail, answer=bool(answer_val)
                )
            except ItemVerificationDetail.DoesNotExist:
                pass

        # Notify both users
        found_item = match.matched_item if match.item.user == request.user else match.item
        Notification.objects.create(
            user=request.user, match=match,
            message=f'Your claim for "{found_item.title}" has been submitted and is under review.'
        )
        Notification.objects.create(
            user=found_item.user, match=match,
            message=f'Someone has submitted a claim for your found item "{found_item.title}". Admin will review.'
        )

        serializer = ClaimRequestSerializer(claim)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MyClaimsView(generics.ListAPIView):
    """GET /api/claims/my_claims/ — list user's claims."""
    serializer_class = ClaimRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ClaimRequest.objects.filter(claimant=self.request.user)


# ── Notifications ─────────────────────────────────────────────────────────────

class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user, is_read=False)


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            notif = Notification.objects.get(pk=pk, user=request.user)
            notif.is_read = True
            notif.save()
            return Response({'status': 'marked as read'})
        except Notification.DoesNotExist:
            return Response({'error': 'Notification not found'}, status=status.HTTP_404_NOT_FOUND)


# ── KYC ───────────────────────────────────────────────────────────────────────

class KYCSubmitView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        if hasattr(request.user, 'kyc'):
            return Response(
                {'error': 'KYC already submitted. Current status: ' + request.user.kyc.kyc_status},
                status=status.HTTP_400_BAD_REQUEST
            )
        serializer = KYCSubmitSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response({'status': 'KYC submitted successfully'}, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class KYCStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            kyc = request.user.kyc
            serializer = KYCStatusSerializer(kyc)
            return Response(serializer.data)
        except KYCSubmission.DoesNotExist:
            return Response({'kyc_status': None})


# ── User Profile ──────────────────────────────────────────────────────────────

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        serializer = UserProfileSerializer(profile)
        return Response(serializer.data)

    def patch(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        serializer = UserProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ── Admin Endpoints ───────────────────────────────────────────────────────────

class AdminKYCListView(generics.ListAPIView):
    queryset = KYCSubmission.objects.all().order_by('-submitted_at')
    serializer_class = KYCAdminSerializer
    permission_classes = [IsAdminUser]


class AdminKYCReviewView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        try:
            kyc = KYCSubmission.objects.get(pk=pk)
        except KYCSubmission.DoesNotExist:
            return Response({'error': 'KYC not found'}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('kyc_status')
        if new_status not in ('APPROVED', 'REJECTED'):
            return Response({'error': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)

        kyc.kyc_status = new_status
        kyc.admin_notes = request.data.get('admin_notes', kyc.admin_notes)
        kyc.reviewed_at = timezone.now()
        kyc.save()

        if new_status == 'APPROVED':
            msg = '✅ Your KYC verification has been approved! You can now claim matched items.'
        else:
            msg = '❌ Your KYC verification was rejected. Please re-submit with valid documents.'
        Notification.objects.create(user=kyc.user, message=msg)

        return Response({'status': f'KYC {new_status.lower()}', 'kyc_status': new_status})


class AdminItemSetStatusView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        try:
            item = Item.objects.get(pk=pk)
        except Item.DoesNotExist:
            return Response({'error': 'Item not found'}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status')
        if new_status not in dict(Item.STATUS_CHOICES):
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        item.status = new_status
        item.save()
        return Response({'status': f'Item status set to {new_status}'})


class AdminClaimListView(generics.ListAPIView):
    """GET /api/admin/claims/ — list claims for admin. Optional ?status=PENDING_REVIEW filter."""
    serializer_class = AdminClaimSerializer
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        qs = ClaimRequest.objects.all().order_by('-created_at')
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs


class AdminClaimReviewView(APIView):
    """PATCH /api/admin/claims/{id}/review/ — admin approves/rejects/requests info."""
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        try:
            claim = ClaimRequest.objects.get(pk=pk)
        except ClaimRequest.DoesNotExist:
            return Response({'error': 'Claim not found'}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status')
        admin_notes = request.data.get('admin_notes', '')

        if new_status not in ('APPROVED', 'REJECTED', 'INFO_REQUESTED'):
            return Response({'error': 'Invalid status.'}, status=status.HTTP_400_BAD_REQUEST)

        claim.status = new_status
        claim.admin_notes = admin_notes
        claim.admin_reviewed_by = request.user
        claim.reviewed_at = timezone.now()
        claim.save()

        match = claim.match
        lost_item = match.item if match.item.user == claim.claimant else match.matched_item
        found_item = match.matched_item if match.item.user == claim.claimant else match.item

        if new_status == 'APPROVED':
            match.status = 'matched'
            match.save()
            lost_item.status = 'RETURNED'
            lost_item.save()
            found_item.status = 'RETURNED'
            found_item.save()

            Notification.objects.create(
                user=claim.claimant, match=match,
                message=f'✅ Your claim for "{found_item.title}" has been approved! Contact the finder to arrange pickup.'
            )
            Notification.objects.create(
                user=found_item.user, match=match,
                message=f'✅ The claim for your found item "{found_item.title}" has been approved. The owner will contact you.'
            )

        elif new_status == 'REJECTED':
            Notification.objects.create(
                user=claim.claimant, match=match,
                message=f'❌ Your claim for "{found_item.title}" was rejected. Reason: {admin_notes}'
            )
            Notification.objects.create(
                user=found_item.user, match=match,
                message=f'A claim for your found item "{found_item.title}" was rejected by admin.'
            )

        elif new_status == 'INFO_REQUESTED':
            Notification.objects.create(
                user=claim.claimant, match=match,
                message=f'ℹ️ Admin requested more information about your claim: {admin_notes}'
            )

        return Response({'status': f'Claim {new_status.lower()}', 'claim_status': new_status})


# ── Electronic Views ──────────────────────────────────────────────────────────

class LostElectronicViewSet(viewsets.ModelViewSet):
    """CRUD for LostElectronic reports. Auto-runs image processing + electronic matching on create."""
    serializer_class = LostElectronicSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return LostElectronic.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        electronic = serializer.save(user=self.request.user)
        process_item_image(electronic)
        find_electronic_matches(electronic)

    @action(detail=False, methods=['get'])
    def my_matches(self, request):
        matches_qs = Match.objects.filter(
            item__user=request.user,
            item__category='Electronics'
        ).order_by('-score')
        serializer = MatchSerializer(matches_qs, many=True)
        return Response(serializer.data)


class FoundElectronicViewSet(viewsets.ModelViewSet):
    """CRUD for FoundElectronic reports. Auto-runs image processing + electronic matching on create."""
    serializer_class = FoundElectronicSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return FoundElectronic.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        electronic = serializer.save(user=self.request.user)
        process_item_image(electronic)
        find_electronic_matches(electronic)

    @action(detail=False, methods=['get'])
    def my_matches(self, request):
        matches_qs = Match.objects.filter(
            item__user=request.user,
            item__category='Electronics'
        ).order_by('-score')
        serializer = MatchSerializer(matches_qs, many=True)
        return Response(serializer.data)


