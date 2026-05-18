import os
import requests as http_requests
from urllib.parse import urlencode, quote
from django.http import HttpResponseRedirect, HttpResponse
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

CALLBACK_PATH = '/api/auth/google/mobile-callback/'


def google_mobile_login(request):
    """Redirect user to Google's OAuth consent screen."""
    app_redirect = request.GET.get('app_redirect', 'lostfoundapp://auth')
    device_id = request.GET.get('device_id', 'unknown')
    device_name = request.GET.get('device_name', 'unknown')
    callback_url = request.build_absolute_uri(CALLBACK_PATH)
    if any(ip in callback_url for ip in ['192.168.', '10.', '172.']):
        callback_url = f'http://127.0.0.1:8000{CALLBACK_PATH}'
    
    # Encode device info into state parameter
    state_data = urlencode({
        'app_redirect': app_redirect,
        'device_id': device_id,
        'device_name': device_name,
    })
    
    params = urlencode({
        'client_id': os.environ.get('GOOGLE_CLIENT_ID'),
        'redirect_uri': callback_url,
        'response_type': 'code',
        'scope': 'openid profile email',
        'prompt': 'select_account',
        'state': state_data,
    })
    return HttpResponseRedirect(
        f'https://accounts.google.com/o/oauth2/v2/auth?{params}'
    )


def google_mobile_callback(request):
    """Handle Google's redirect, exchange code, create user, deep-link back."""
    code = request.GET.get('code')
    error = request.GET.get('error')
    state = request.GET.get('state', '')
    
    # Parse state parameter to extract app_redirect, device_id, and device_name
    from urllib.parse import parse_qs
    state_params = parse_qs(state)
    app_redirect = state_params.get('app_redirect', ['lostfoundapp://auth'])[0]
    device_id = state_params.get('device_id', ['unknown'])[0]
    device_name = state_params.get('device_name', ['unknown'])[0]
    
    # Validate device_id and device_name for private IP addresses
    host = request.get_host()
    if '192.168.' in host or '10.' in host or '172.' in host:
        if not device_id or device_id == 'unknown' or not device_name or device_name == 'unknown':
            return HttpResponse('device_id and device_name are required for private IP', status=400)

    if error:
        return HttpResponse(f'Google error: {error}', status=400)
    if not code:
        return HttpResponse('No code received', status=400)

    # Exchange code for Google tokens
    callback_url = request.build_absolute_uri(CALLBACK_PATH)
    if any(ip in callback_url for ip in ['192.168.', '10.', '172.']):
        callback_url = f'http://127.0.0.1:8000{CALLBACK_PATH}'
    token_resp = http_requests.post(
        'https://oauth2.googleapis.com/token',
        data={
            'code': code,
            'client_id': os.environ.get('GOOGLE_CLIENT_ID'),
            'client_secret': os.environ.get('GOOGLE_CLIENT_SECRET'),
            'redirect_uri': callback_url,
            'grant_type': 'authorization_code',
        },
    )
    if token_resp.status_code != 200:
        return HttpResponse(f'Token exchange failed: {token_resp.text}', status=400)

    # Get user info from Google
    access_token = token_resp.json().get('access_token')
    info_resp = http_requests.get(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        headers={'Authorization': f'Bearer {access_token}'},
    )
    if info_resp.status_code != 200:
        return HttpResponse('Failed to fetch user info', status=400)

    info = info_resp.json()
    g_email = info.get('email', '')
    g_name = info.get('name', '')

    # Find or create Django user
    user = User.objects.filter(email=g_email).first()
    if not user:
        base = g_email.split('@')[0]
        uname = base
        n = 1
        while User.objects.filter(username=uname).exists():
            uname = f'{base}{n}'
            n += 1
        user = User.objects.create_user(
            username=uname,
            email=g_email,
            first_name=g_name.split(' ')[0] if g_name else '',
            last_name=' '.join(g_name.split(' ')[1:]) if g_name else '',
        )

    # Generate JWT
    refresh = RefreshToken.for_user(user)
    refresh['username'] = user.username
    refresh['email'] = user.email

    # Deep-link back into the app
    delimiter = '&' if '?' in app_redirect else '?'
    app_url = (
        f'{app_redirect}'
        f'{delimiter}access={str(refresh.access_token)}'
        f'&refresh={str(refresh)}'
        f'&username={quote(user.username)}'
    )
    response = HttpResponse('', status=302)
    response['Location'] = app_url
    return response
