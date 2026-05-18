"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
import os
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from dj_rest_auth.registration.views import SocialLoginView
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client


class GoogleLogin(SocialLoginView):
    adapter_class = GoogleOAuth2Adapter
    callback_url = os.environ.get(
        'GOOGLE_CALLBACK_URL',
        'http://127.0.0.1:8000/accounts/google/login/callback/'
    )
    client_class = OAuth2Client


from services.google_auth import google_mobile_login, google_mobile_callback


urlpatterns = [
    path('admin/', admin.site.urls),

    # allauth – handles the OAuth callback (/accounts/google/login/callback/)
    path('accounts/', include('allauth.urls')),

    # Our custom auth endpoints (must come before dj_rest_auth to take priority)
    path('api/', include('items.urls')),

    # dj-rest-auth standard endpoints (login, logout, password, etc.)
    path('api/auth/', include('dj_rest_auth.urls')),

    # dj-rest-auth registration + social-account endpoints
    path('api/auth/registration/', include('dj_rest_auth.registration.urls')),

    # Google social login entry-point (POST with authorization_code)
    path('api/auth/google/', GoogleLogin.as_view(), name='google_login'),

    # Backend-driven Google OAuth for mobile (no Expo proxy needed)
    path('api/auth/google/mobile-login/', google_mobile_login, name='google_mobile_login'),
    path('api/auth/google/mobile-callback/', google_mobile_callback, name='google_mobile_callback'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

