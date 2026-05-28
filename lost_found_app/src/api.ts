import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Detect the dev server's LAN IP so the phone can reach Django over WiFi
let HOST = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
if (Constants.expoConfig?.hostUri) {
    HOST = Constants.expoConfig.hostUri.split(':')[0];
}

const API_HOST = `http://${HOST}:8000`;

const BASE_URL = `${API_HOST}/api/`;
export const AUTH_URL = `${API_HOST}/api/auth/`;
export const BACKEND_HOST = HOST;
export const MEDIA_BASE = API_HOST;

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem('access_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const authApi = axios.create({ baseURL: AUTH_URL });

export const googleLogin = async (code: string, redirectUri: string) => {
    const response = await authApi.post('google/', { code, redirect_uri: redirectUri });
    return response.data;
};

// ── Notifications ────────────────────────────────────────────────────────────

export const getNotifications = async () => {
    const res = await api.get('notifications/');
    return res.data;
};

export const markNotificationRead = async (id: number) => {
    const res = await api.post(`notifications/${id}/read/`);
    return res.data;
};

// ── KYC ──────────────────────────────────────────────────────────────────────

export const getKYCStatus = async () => {
    const res = await api.get('kyc/status/');
    return res.data;
};

export const submitKYC = async (formData: FormData) => {
    const res = await api.post('kyc/submit/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
};

// ── User Profile ─────────────────────────────────────────────────────────────

export const getProfile = async () => {
    const res = await api.get('profile/');
    return res.data;
};

export const updateProfile = async (formData: FormData) => {
    const res = await api.patch('profile/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
};

// ── Verification Details ─────────────────────────────────────────────────────

export const addVerificationDetails = async (itemId: number, details: any[]) => {
    const res = await api.post(`items/${itemId}/add_verification_details/`, { details });
    return res.data;
};

export const getVerificationHints = async (itemId: number) => {
    const res = await api.get(`items/${itemId}/verification_hints/`);
    return res.data;
};

// ── Claims ───────────────────────────────────────────────────────────────────

export const submitClaim = async (matchId: number, answers: any[]) => {
    const res = await api.post('claims/submit/', { match_id: matchId, answers });
    return res.data;
};

export const getMyClaims = async () => {
    const res = await api.get('claims/my_claims/');
    return res.data;
};

// ── Admin ────────────────────────────────────────────────────────────────────

export const checkAdmin = async () => {
    const res = await api.get('auth/check_admin/');
    return res.data;
};

export const adminGetKYCList = async () => {
    const res = await api.get('admin/kyc/');
    return res.data;
};

export const adminReviewKYC = async (id: number, kycStatus: string, adminNotes: string = '') => {
    const res = await api.patch(`admin/kyc/${id}/review/`, { kyc_status: kycStatus, admin_notes: adminNotes });
    return res.data;
};

export const adminGetClaims = async (statusFilter?: string) => {
    const url = statusFilter ? `admin/claims/?status=${statusFilter}` : 'admin/claims/';
    const res = await api.get(url);
    return res.data;
};

export const adminReviewClaim = async (id: number, status: string, adminNotes: string = '') => {
    const res = await api.patch(`admin/claims/${id}/review/`, { status, admin_notes: adminNotes });
    return res.data;
};

// ── Electronics API ──────────────────────────────────────────────────────────

export const createLostElectronic = async (formData: FormData) => {
    const token = await AsyncStorage.getItem('access_token');
    const response = await fetch(`${API_HOST}/api/electronics/lost/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
    });
    if (!response.ok) throw new Error('Failed to report lost electronic');
    return response.json();
};

export const createFoundElectronic = async (formData: FormData) => {
    const token = await AsyncStorage.getItem('access_token');
    const response = await fetch(`${API_HOST}/api/electronics/found/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
    });
    if (!response.ok) throw new Error('Failed to report found electronic');
    return response.json();
};

export default api;

