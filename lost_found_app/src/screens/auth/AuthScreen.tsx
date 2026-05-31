import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert, KeyboardAvoidingView, Platform,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { authApi, MEDIA_BASE } from '../../api';
import FindlyLogo from '../../components/FindlyLogo';

WebBrowser.maybeCompleteAuthSession();

// ─── Google OAuth config ──────────────────────────────────────────────────────
const BACKEND_URL = MEDIA_BASE;

const COLORS = {
    primary: '#0F6E56',
    primaryLight: '#E1F5EE',
    bg: '#F8F7F2',
    card: '#FFFFFF',
    text: '#1A1A1A',
    gray: '#6B6B6B',
    lightGray: '#E5E5E0',
    accent: '#3498db',
    white: '#ffffff',
};

export default function AuthScreen({ navigation }: any) {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    // ── Google Sign-In (backend-driven, no Expo proxy needed) ────────────────
    const handleGoogleSignIn = async () => {
        try {
            setGoogleLoading(true);

            // Get the correct redirect URL for the current environment (Expo Go vs Standalone)
            const redirectUrl = Linking.createURL('auth');
            const loginUrl = `${BACKEND_URL}/api/auth/google/mobile-login/?app_redirect=${encodeURIComponent(redirectUrl)}`;

            console.log('=== GOOGLE SIGN-IN START ===');
            console.log('Opening backend URL:', loginUrl);
            console.log('Expecting deep link return to:', redirectUrl);

            const result = await WebBrowser.openAuthSessionAsync(
                loginUrl,
                redirectUrl
            );

            console.log('=== AUTH RESULT ===');
            console.log('Result:', JSON.stringify(result, null, 2));

            if (result.type === 'success' && result.url) {
                // Parse tokens from the deep link URL
                const parsed = Linking.parse(result.url);
                const accessToken = parsed.queryParams?.access as string;
                const refreshToken = parsed.queryParams?.refresh as string;
                const uname = parsed.queryParams?.username as string;

                console.log('Got tokens, username:', uname);

                if (accessToken && refreshToken) {
                    await AsyncStorage.setItem('access_token', accessToken);
                    await AsyncStorage.setItem('refresh_token', refreshToken);
                    await AsyncStorage.setItem('username', uname || 'User');
                    navigation.replace('Home');
                } else {
                    Alert.alert('Sign-In Error', 'No tokens received from server.');
                }
            } else {
                console.log('Auth dismissed/cancelled:', result.type);
            }
        } catch (err: any) {
            console.error('=== GOOGLE SIGN-IN ERROR ===');
            console.error(err);
            Alert.alert('Google Sign-In Error', err.message || 'Something went wrong.');
        } finally {
            setGoogleLoading(false);
        }
    };

    // ── Manual login / register ───────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!username || !password || (!isLogin && !email)) {
            Alert.alert('Validation Error', 'Please fill in all fields.');
            return;
        }

        if (isLogin) {
            try {
                const res = await authApi.post('login/', { username, password });
                await AsyncStorage.setItem('access_token', res.data.access);
                await AsyncStorage.setItem('refresh_token', res.data.refresh);
                await AsyncStorage.setItem('username', username);
                navigation.replace('Home');
            } catch (err: any) {
                const msg = err.response?.data?.detail || err.response?.data?.non_field_errors?.join('\n') || 'Invalid username or password.';
                console.error('Login error:', JSON.stringify(err.response?.data, null, 2));
                Alert.alert('Login Failed', msg);
            }
        } else {
            try {
                await authApi.post('register/', { username, email, password });
                Alert.alert('Success', 'Registration complete. Please login now.');
                setIsLogin(true);
            } catch {
                Alert.alert('Registration Failed', 'This username may already be taken.');
            }
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            {/* Gradient Header with Logo */}
            <LinearGradient colors={['#0F6E56', '#128C7E', '#17a589']} style={styles.header}>
                <FindlyLogo size={80} />
                <Text style={styles.appName}>Findly</Text>
                <Text style={styles.tagline}>Smart Lost & Found</Text>
            </LinearGradient>

            {/* Bottom Sheet */}
            <ScrollView style={styles.bottomSheet} contentContainerStyle={styles.bottomSheetContent} keyboardShouldPersistTaps="handled">

                {/* ── Google Sign-In Button ── */}
                <TouchableOpacity
                    style={styles.googleBtn}
                    onPress={handleGoogleSignIn}
                    disabled={googleLoading}
                    activeOpacity={0.85}
                >
                    {googleLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <>
                            <Text style={styles.googleIcon}>G</Text>
                            <Text style={styles.googleBtnText}>Continue with Google</Text>
                        </>
                    )}
                </TouchableOpacity>

                {/* ── Divider ── */}
                <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or</Text>
                    <View style={styles.dividerLine} />
                </View>

                {/* ── Tabs ── */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        onPress={() => setIsLogin(true)}
                        style={[styles.tab, isLogin && styles.activeTab]}
                    >
                        <Text style={[styles.tabText, isLogin && styles.activeTabText]}>Login</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setIsLogin(false)}
                        style={[styles.tab, !isLogin && styles.activeTab]}
                    >
                        <Text style={[styles.tabText, !isLogin && styles.activeTabText]}>Register</Text>
                    </TouchableOpacity>
                </View>

                {/* ── Form ── */}
                <View style={styles.form}>
                    <Text style={styles.welcomeText}>
                        {isLogin ? 'Welcome back!' : 'Create an account'}
                    </Text>

                    <View style={styles.inputWrapper}>
                        <Ionicons name="person-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Username"
                            value={username}
                            onChangeText={setUsername}
                            autoCapitalize="none"
                            placeholderTextColor="#a4b0be"
                        />
                    </View>

                    {!isLogin && (
                        <View style={styles.inputWrapper}>
                            <Ionicons name="mail-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="Email"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                placeholderTextColor="#a4b0be"
                            />
                        </View>
                    )}

                    <View style={styles.inputWrapper}>
                        <Ionicons name="lock-closed-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                        <TextInput
                            style={[styles.input, { flex: 1 }]}
                            placeholder="Password"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                            placeholderTextColor="#a4b0be"
                        />
                        <TouchableOpacity
                            style={styles.eyeButton}
                            onPress={() => setShowPassword(!showPassword)}
                        >
                            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#a4b0be" />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
                        <LinearGradient colors={['#0F6E56', '#128C7E']} style={styles.submitGradient}>
                            <Text style={styles.submitText}>{isLogin ? 'Sign In' : 'Sign Up'}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F6E56' },
    header: { paddingTop: 60, paddingBottom: 35, alignItems: 'center', justifyContent: 'center' },
    appName: { fontSize: 36, fontWeight: '900', color: '#ffffff', letterSpacing: 2, marginTop: 12 },
    tagline: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 4, fontWeight: '600', letterSpacing: 1 },

    bottomSheet: {
        flex: 1,
        backgroundColor: COLORS.bg,
        borderTopLeftRadius: 30, borderTopRightRadius: 30,
    },
    bottomSheetContent: {
        padding: 28, paddingBottom: 50,
    },

    // Google button
    googleBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#4285F4',
        paddingVertical: 15, borderRadius: 14,
        elevation: 3, shadowColor: '#4285F4',
        shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
        marginBottom: 20,
    },
    googleIcon: {
        fontSize: 16, fontWeight: '900',
        backgroundColor: '#fff', color: '#4285F4',
        width: 24, height: 24, borderRadius: 12,
        textAlign: 'center', lineHeight: 24,
        marginRight: 12,
    },
    googleBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },

    // Divider
    divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.lightGray },
    dividerText: { marginHorizontal: 12, color: COLORS.gray, fontSize: 13, fontWeight: '600' },

    // Tabs
    tabContainer: {
        flexDirection: 'row', backgroundColor: '#EBEBE6',
        borderRadius: 22, padding: 4, marginBottom: 24,
    },
    tab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderRadius: 18 },
    activeTab: {
        backgroundColor: COLORS.white, elevation: 2, shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3,
    },
    tabText: { fontSize: 15, fontWeight: 'bold', color: COLORS.gray },
    activeTabText: { color: COLORS.primary },

    // Form
    form: { marginTop: 4 },
    welcomeText: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 22 },
    inputWrapper: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: COLORS.white, paddingHorizontal: 14,
        borderRadius: 14, marginBottom: 14,
        borderWidth: 1, borderColor: COLORS.lightGray,
    },
    inputIcon: { marginRight: 10 },
    input: {
        flex: 1, paddingVertical: 16, fontSize: 15, color: COLORS.text, fontWeight: '500',
    },
    eyeButton: {
        paddingHorizontal: 6, paddingVertical: 10,
    },
    submitBtn: {
        borderRadius: 14, overflow: 'hidden', marginTop: 16,
        elevation: 4, shadowColor: '#0F6E56',
        shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
    },
    submitGradient: {
        paddingVertical: 17, alignItems: 'center', justifyContent: 'center',
    },
    submitText: { color: '#fff', fontSize: 17, fontWeight: 'bold', letterSpacing: 0.5 },
});
