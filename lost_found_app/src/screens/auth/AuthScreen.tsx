import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert, KeyboardAvoidingView, Platform,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View,
} from 'react-native';
import { authApi, MEDIA_BASE } from '../../api';

WebBrowser.maybeCompleteAuthSession();

// ─── Google OAuth config ──────────────────────────────────────────────────────
const BACKEND_URL = MEDIA_BASE;

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
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.iconPlaceholder}>
                    <Text style={styles.iconText}>🔍</Text>
                </View>
                <Text style={styles.appName}>Findly</Text>
                <Text style={styles.tagline}>Smart Lost & Found</Text>
            </View>

            {/* Bottom Sheet */}
            <View style={styles.bottomSheet}>

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

                    <TextInput
                        style={styles.input}
                        placeholder="Username"
                        value={username}
                        onChangeText={setUsername}
                        autoCapitalize="none"
                        placeholderTextColor="#a4b0be"
                    />

                    {!isLogin && (
                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            placeholderTextColor="#a4b0be"
                        />
                    )}

                    <View style={styles.passwordContainer}>
                        <TextInput
                            style={styles.passwordInput}
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
                            <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁'}</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
                        <Text style={styles.submitText}>{isLogin ? 'Sign In' : 'Sign Up'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#2f3640' },
    header: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2f3640' },
    iconPlaceholder: {
        width: 80, height: 80, borderRadius: 40, backgroundColor: '#3498db',
        justifyContent: 'center', alignItems: 'center', marginBottom: 20,
        elevation: 10, shadowColor: '#3498db', shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.5, shadowRadius: 10,
    },
    iconText: { fontSize: 40 },
    appName: { fontSize: 42, fontWeight: '900', color: '#f5f6fa', letterSpacing: 2 },
    tagline: { fontSize: 16, color: '#a4b0be', marginTop: 5, fontWeight: '500', letterSpacing: 1 },

    bottomSheet: {
        backgroundColor: '#f1f2f6',
        borderTopLeftRadius: 35, borderTopRightRadius: 35,
        padding: 30, paddingBottom: 50,
        elevation: 20, shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.2, shadowRadius: 15,
    },

    // Google button
    googleBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#4285F4',
        paddingVertical: 16, borderRadius: 15,
        elevation: 4, shadowColor: '#4285F4',
        shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
        marginBottom: 20,
    },
    googleIcon: {
        fontSize: 18, fontWeight: '900',
        backgroundColor: '#fff', color: '#4285F4',
        width: 26, height: 26, borderRadius: 13,
        textAlign: 'center', lineHeight: 26,
        marginRight: 12,
    },
    googleBtnText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },

    // Divider
    divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#dcdde1' },
    dividerText: { marginHorizontal: 12, color: '#7f8fa6', fontSize: 14, fontWeight: '600' },

    // Tabs
    tabContainer: {
        flexDirection: 'row', backgroundColor: '#dcdde1',
        borderRadius: 25, padding: 5, marginBottom: 25,
    },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 20 },
    activeTab: {
        backgroundColor: '#fff', elevation: 2, shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
    },
    tabText: { fontSize: 16, fontWeight: 'bold', color: '#7f8fa6' },
    activeTabText: { color: '#2f3640' },

    // Form
    form: { marginTop: 10 },
    welcomeText: { fontSize: 24, fontWeight: 'bold', color: '#2f3640', marginBottom: 25 },
    input: {
        backgroundColor: '#fff', padding: 18, borderRadius: 15,
        marginBottom: 15, fontSize: 16, color: '#2f3640',
        borderWidth: 1, borderColor: '#dcdde1',
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 15,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#dcdde1',
    },
    passwordInput: {
        flex: 1,
        padding: 18,
        fontSize: 16,
        color: '#2f3640',
    },
    eyeButton: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    eyeText: {
        fontSize: 22,
    },
    submitBtn: {
        backgroundColor: '#3498db', padding: 18, borderRadius: 15,
        alignItems: 'center', marginTop: 15, elevation: 5,
        shadowColor: '#3498db', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4, shadowRadius: 8,
    },
    submitText: { color: '#fff', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
});
