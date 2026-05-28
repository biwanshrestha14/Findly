from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    ItemViewSet, RegisterView, LoginView, CheckAdminView,
    NotificationListView, NotificationMarkReadView,
    KYCSubmitView, KYCStatusView,
    UserProfileView,
    AdminKYCListView, AdminKYCReviewView, AdminItemSetStatusView,
    ClaimSubmitView, MyClaimsView,
    AdminClaimListView, AdminClaimReviewView,
    LostElectronicViewSet, FoundElectronicViewSet,
)

router = DefaultRouter()
router.register(r'items', ItemViewSet)
router.register(r'electronics/lost', LostElectronicViewSet, basename='lost-electronic')
router.register(r'electronics/found', FoundElectronicViewSet, basename='found-electronic')

urlpatterns = [
    path('auth/register/', RegisterView.as_view(), name='register'),
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('auth/check_admin/', CheckAdminView.as_view(), name='check-admin'),

    # Notifications
    path('notifications/', NotificationListView.as_view(), name='notification-list'),
    path('notifications/<int:pk>/read/', NotificationMarkReadView.as_view(), name='notification-read'),

    # KYC
    path('kyc/submit/', KYCSubmitView.as_view(), name='kyc-submit'),
    path('kyc/status/', KYCStatusView.as_view(), name='kyc-status'),

    # User Profile
    path('profile/', UserProfileView.as_view(), name='user-profile'),

    # Claims
    path('claims/submit/', ClaimSubmitView.as_view(), name='claim-submit'),
    path('claims/my_claims/', MyClaimsView.as_view(), name='my-claims'),

    # Admin endpoints
    path('admin/kyc/', AdminKYCListView.as_view(), name='admin-kyc-list'),
    path('admin/kyc/<int:pk>/review/', AdminKYCReviewView.as_view(), name='admin-kyc-review'),
    path('admin/items/<int:pk>/set_status/', AdminItemSetStatusView.as_view(), name='admin-item-status'),
    path('admin/claims/', AdminClaimListView.as_view(), name='admin-claim-list'),
    path('admin/claims/<int:pk>/review/', AdminClaimReviewView.as_view(), name='admin-claim-review'),

    # Router (items CRUD + custom actions)
    path('', include(router.urls)),
]
