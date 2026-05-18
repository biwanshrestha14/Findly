import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    SafeAreaView, ScrollView, Image, Alert, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { getProfile, updateProfile, getKYCStatus, MEDIA_BASE, checkAdmin } from '../../api';

const COLORS = {
    primary: '#0F6E56',
    bg: '#F8F7F2',
    card: '#FFFFFF',
    textPrimary: '#1A1A1A',
    textSecondary: '#6B6B6B',
    border: '#E5E5E0',
    green: '#0F6E56',
    amber: '#D4930D',
    red: '#C73E3E',
};

export default function ProfileScreen({ navigation }: any) {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(false);

    // Editable fields
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [bio, setBio] = useState('');
    const [newPhoto, setNewPhoto] = useState<any>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    const fetchProfile = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getProfile();
            setProfile(data);
            setFullName(data.full_name || '');
            setPhone(data.phone_number || '');
            setAddress(data.address || '');
            setBio(data.bio || '');
        } catch (e) {
            console.error('Failed to load profile:', e);
        }
        // Check admin status
        try {
            const adminData = await checkAdmin();
            setIsAdmin(adminData.is_admin);
        } catch (_) {}
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchProfile();
    }, []);

    useEffect(() => {
        const unsub = navigation.addListener('focus', fetchProfile);
        return unsub;
    }, [navigation]);

    const handlePickPhoto = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!result.canceled) {
            setNewPhoto(result.assets[0]);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const formData = new FormData();
            formData.append('full_name', fullName);
            formData.append('phone_number', phone);
            formData.append('address', address);
            formData.append('bio', bio);
            if (newPhoto) {
                formData.append('profile_picture', {
                    uri: newPhoto.uri,
                    type: 'image/jpeg',
                    name: 'profile.jpg',
                } as any);
            }
            const updated = await updateProfile(formData);
            setProfile(updated);
            setNewPhoto(null);
            setEditing(false);
            Alert.alert('Success', 'Profile updated successfully!');
        } catch (err: any) {
            Alert.alert('Error', 'Failed to update profile.');
        }
        setSaving(false);
    };

    const handleLogout = async () => {
        Alert.alert('Logout', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Logout',
                style: 'destructive',
                onPress: async () => {
                    await AsyncStorage.clear();
                    navigation.replace('Auth');
                },
            },
        ]);
    };

    const getKYCBadge = () => {
        const status = profile?.kyc_status;
        if (status === 'APPROVED') return { text: '✓ Verified', color: COLORS.green, bg: '#E8F5E9' };
        if (status === 'PENDING') return { text: '⏳ Pending', color: COLORS.amber, bg: '#FFF8E1' };
        return { text: '✗ Unverified', color: COLORS.red, bg: '#FFEBEE' };
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            </SafeAreaView>
        );
    }

    const photoUri = newPhoto
        ? newPhoto.uri
        : profile?.profile_picture
            ? (profile.profile_picture.startsWith('http') ? profile.profile_picture : `${MEDIA_BASE}${profile.profile_picture}`)
            : null;

    const kycBadge = getKYCBadge();

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Avatar */}
                <View style={styles.avatarSection}>
                    <TouchableOpacity onPress={editing ? handlePickPhoto : undefined} activeOpacity={editing ? 0.7 : 1}>
                        {photoUri ? (
                            <Image source={{ uri: photoUri }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Text style={styles.avatarInitial}>
                                    {(profile?.full_name || profile?.username || '?').charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}
                        {editing && (
                            <View style={styles.cameraOverlay}>
                                <Text style={styles.cameraIcon}>📷</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <Text style={styles.displayName}>{profile?.full_name || profile?.username}</Text>
                    <Text style={styles.username}>@{profile?.username}</Text>

                    {/* KYC Badge */}
                    <TouchableOpacity
                        style={[styles.kycBadge, { backgroundColor: kycBadge.bg }]}
                        onPress={() => {
                            if (profile?.kyc_status !== 'APPROVED') {
                                navigation.navigate('KYC');
                            }
                        }}
                    >
                        <Text style={[styles.kycBadgeText, { color: kycBadge.color }]}>{kycBadge.text}</Text>
                    </TouchableOpacity>
                </View>

                {/* Fields */}
                <View style={styles.fieldsSection}>
                    <View style={styles.fieldCard}>
                        <Text style={styles.fieldLabel}>Full Name</Text>
                        {editing ? (
                            <TextInput style={styles.fieldInput} value={fullName} onChangeText={setFullName} placeholder="Your full name" placeholderTextColor="#ABABAB" />
                        ) : (
                            <Text style={styles.fieldValue}>{fullName || '—'}</Text>
                        )}
                    </View>

                    <View style={styles.fieldCard}>
                        <Text style={styles.fieldLabel}>Email</Text>
                        <Text style={[styles.fieldValue, styles.readOnly]}>{profile?.email || '—'}</Text>
                    </View>

                    <View style={styles.fieldCard}>
                        <Text style={styles.fieldLabel}>Phone Number</Text>
                        {editing ? (
                            <TextInput style={styles.fieldInput} value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" placeholderTextColor="#ABABAB" />
                        ) : (
                            <Text style={styles.fieldValue}>{phone || '—'}</Text>
                        )}
                    </View>

                    <View style={styles.fieldCard}>
                        <Text style={styles.fieldLabel}>Address</Text>
                        {editing ? (
                            <TextInput style={styles.fieldInput} value={address} onChangeText={setAddress} placeholder="Your address" placeholderTextColor="#ABABAB" />
                        ) : (
                            <Text style={styles.fieldValue}>{address || '—'}</Text>
                        )}
                    </View>

                    <View style={styles.fieldCard}>
                        <Text style={styles.fieldLabel}>Bio</Text>
                        {editing ? (
                            <TextInput
                                style={[styles.fieldInput, { minHeight: 80, textAlignVertical: 'top' }]}
                                value={bio}
                                onChangeText={setBio}
                                placeholder="Tell us about yourself..."
                                placeholderTextColor="#ABABAB"
                                multiline
                            />
                        ) : (
                            <Text style={styles.fieldValue}>{bio || '—'}</Text>
                        )}
                    </View>
                </View>

                {/* Actions */}
                <View style={styles.actionsSection}>
                    {editing ? (
                        <View style={{ gap: 10 }}>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditing(false); setNewPhoto(null); }}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View style={styles.actionRow}>
                            <TouchableOpacity style={[styles.editBtn, { flex: 1 }]} onPress={() => setEditing(true)}>
                                <Text style={styles.editBtnText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.logoutBtn, { flex: 1 }]} onPress={handleLogout}>
                                <Text style={styles.logoutBtnText}>Logout</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {isAdmin && (
                        <TouchableOpacity
                            style={styles.adminBtn}
                            onPress={() => navigation.navigate('Admin')}
                        >
                            <Text style={styles.adminBtnText}>🛡️ Admin Panel</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { paddingBottom: 40 },
    // Avatar
    avatarSection: { alignItems: 'center', paddingTop: 30, paddingBottom: 20 },
    avatar: { width: 110, height: 110, borderRadius: 55 },
    avatarPlaceholder: { backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
    avatarInitial: { fontSize: 44, color: '#FFF', fontWeight: '600' },
    cameraOverlay: {
        position: 'absolute', bottom: 0, right: 0,
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 }, elevation: 3,
    },
    cameraIcon: { fontSize: 16 },
    displayName: { fontSize: 22, fontWeight: '600', color: COLORS.textPrimary, marginTop: 14, textAlign: 'center' },
    username: { fontSize: 15, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center' },
    kycBadge: {
        marginTop: 12, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20,
    },
    kycBadgeText: { fontSize: 13, fontWeight: '600' },
    // Fields
    fieldsSection: { paddingHorizontal: 20, gap: 10 },
    fieldCard: {
        backgroundColor: COLORS.card, borderRadius: 14, padding: 16,
        borderWidth: 1, borderColor: COLORS.border,
    },
    fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: 6 },
    fieldValue: { fontSize: 16, color: COLORS.textPrimary },
    fieldInput: {
        fontSize: 16, color: COLORS.textPrimary, borderBottomWidth: 1,
        borderColor: COLORS.primary, paddingVertical: 4,
    },
    readOnly: { color: '#ABABAB' },
    // Actions
    actionsSection: { paddingHorizontal: 20, marginTop: 24, gap: 12 },
    actionRow: { flexDirection: 'row', gap: 12 },
    editBtn: {
        backgroundColor: COLORS.primary, paddingVertical: 16,
        borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    },
    editBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
    saveBtn: {
        backgroundColor: COLORS.primary, paddingVertical: 16,
        borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    },
    saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
    cancelBtn: {
        backgroundColor: COLORS.card, paddingVertical: 16,
        borderRadius: 12, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: COLORS.border,
    },
    cancelBtnText: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '500' },
    logoutBtn: {
        backgroundColor: '#FFEBEE', paddingVertical: 16,
        borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    },
    logoutBtnText: { color: COLORS.red, fontSize: 16, fontWeight: '600' },
    adminBtn: {
        backgroundColor: '#2f3640', paddingVertical: 16,
        borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8,
    },
    adminBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
