import React, { useState, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    SafeAreaView, ScrollView, Image, Alert, ActivityIndicator,
    Animated, Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { submitKYC } from '../../api';

const { width } = Dimensions.get('window');

const COLORS = {
    primary: '#0F6E56',
    bg: '#F8F7F2',
    card: '#FFFFFF',
    textPrimary: '#1A1A1A',
    textSecondary: '#6B6B6B',
    amber: '#D4930D',
    red: '#C73E3E',
    border: '#E5E5E0',
};

const DOC_TYPES = [
    { value: 'LICENSE', label: "Driver's License" },
    { value: 'CITIZENSHIP', label: 'Citizenship Card' },
    { value: 'NATIONAL_ID', label: 'National ID' },
];

export default function KYCScreen({ navigation }: any) {
    const [step, setStep] = useState(1);
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [livePhoto, setLivePhoto] = useState<any>(null);
    const [docType, setDocType] = useState('');
    const [docImage, setDocImage] = useState<any>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Camera
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [showCamera, setShowCamera] = useState(false);
    const cameraRef = useRef<any>(null);

    const progressAnim = useRef(new Animated.Value(1)).current;

    const animateStep = (newStep: number) => {
        Animated.timing(progressAnim, {
            toValue: newStep,
            duration: 300,
            useNativeDriver: false,
        }).start();
        setStep(newStep);
    };

    // ── Step 1: Contact Info ──
    const renderStep1 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Contact Information</Text>
            <Text style={styles.stepSubtitle}>We need your contact details for verification</Text>

            <Text style={styles.label}>Phone Number</Text>
            <TextInput
                style={styles.input}
                placeholder="e.g. +977 98XXXXXXXX"
                placeholderTextColor="#ABABAB"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
            />

            <Text style={styles.label}>Email Address</Text>
            <TextInput
                style={styles.input}
                placeholder="your@email.com"
                placeholderTextColor="#ABABAB"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
            />

            <TouchableOpacity
                style={[styles.nextBtn, (!phone || !email) && styles.disabledBtn]}
                onPress={() => animateStep(2)}
                disabled={!phone || !email}
            >
                <Text style={styles.nextBtnText}>Continue</Text>
            </TouchableOpacity>
        </View>
    );

    // ── Step 2: Live Photo ──
    const handleTakePhoto = async () => {
        if (!cameraPermission?.granted) {
            const { granted } = await requestCameraPermission();
            if (!granted) {
                Alert.alert('Permission Denied', 'Camera access is required for KYC verification.');
                return;
            }
        }
        setShowCamera(true);
    };

    const capturePhoto = async () => {
        if (cameraRef.current) {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
            setLivePhoto(photo);
            setShowCamera(false);
        }
    };

    const renderStep2 = () => {
        if (showCamera) {
            return (
                <View style={styles.cameraContainer}>
                    <CameraView
                        ref={cameraRef}
                        style={styles.camera}
                        facing="front"
                    >
                        <View style={styles.cameraOverlay}>
                            <View style={styles.faceOutline} />
                            <Text style={styles.cameraHint}>Position your face within the circle</Text>
                        </View>
                    </CameraView>
                    <View style={styles.cameraActions}>
                        <TouchableOpacity style={styles.cancelCameraBtn} onPress={() => setShowCamera(false)}>
                            <Text style={styles.cancelCameraText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.captureBtn} onPress={capturePhoto}>
                            <View style={styles.captureBtnInner} />
                        </TouchableOpacity>
                        <View style={{ width: 60 }} />
                    </View>
                </View>
            );
        }

        return (
            <View style={styles.stepContainer}>
                <Text style={styles.stepTitle}>Take a Live Selfie</Text>
                <Text style={styles.stepSubtitle}>We need a clear photo of your face for identity verification</Text>

                {livePhoto ? (
                    <View style={styles.photoPreviewContainer}>
                        <Image source={{ uri: livePhoto.uri }} style={styles.photoPreview} />
                        <TouchableOpacity style={styles.retakeBtn} onPress={handleTakePhoto}>
                            <Text style={styles.retakeBtnText}>Retake Photo</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity style={styles.cameraPlaceholder} onPress={handleTakePhoto}>
                        <Text style={styles.cameraPlaceholderIcon}>📷</Text>
                        <Text style={styles.cameraPlaceholderText}>Tap to open camera</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.navRow}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => animateStep(1)}>
                        <Text style={styles.backBtnText}>← Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.nextBtn, { flex: 1 }, !livePhoto && styles.disabledBtn]}
                        onPress={() => animateStep(3)}
                        disabled={!livePhoto}
                    >
                        <Text style={styles.nextBtnText}>Continue</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    // ── Step 3: Document ──
    const pickDocument = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
        });
        if (!result.canceled) {
            setDocImage(result.assets[0]);
        }
    };

    const renderStep3 = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Identity Document</Text>
            <Text style={styles.stepSubtitle}>Select and upload your government-issued ID</Text>

            <Text style={styles.label}>Document Type</Text>
            <View style={styles.docTypeRow}>
                {DOC_TYPES.map(dt => (
                    <TouchableOpacity
                        key={dt.value}
                        style={[styles.docTypeBtn, docType === dt.value && styles.docTypeBtnActive]}
                        onPress={() => setDocType(dt.value)}
                    >
                        <Text style={[styles.docTypeText, docType === dt.value && styles.docTypeTextActive]}>
                            {dt.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {docImage ? (
                <View style={styles.photoPreviewContainer}>
                    <Image source={{ uri: docImage.uri }} style={styles.docPreview} />
                    <TouchableOpacity style={styles.retakeBtn} onPress={pickDocument}>
                        <Text style={styles.retakeBtnText}>Change Image</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity style={styles.cameraPlaceholder} onPress={pickDocument}>
                    <Text style={styles.cameraPlaceholderIcon}>🪪</Text>
                    <Text style={styles.cameraPlaceholderText}>Tap to select document image</Text>
                </TouchableOpacity>
            )}

            <View style={styles.navRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => animateStep(2)}>
                    <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.nextBtn, { flex: 1 }, (!docType || !docImage) && styles.disabledBtn]}
                    onPress={() => animateStep(4)}
                    disabled={!docType || !docImage}
                >
                    <Text style={styles.nextBtnText}>Review</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    // ── Step 4: Review & Submit ──
    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('phone_number', phone);
            formData.append('email', email);
            formData.append('document_type', docType);
            formData.append('live_photo', {
                uri: livePhoto.uri,
                type: 'image/jpeg',
                name: 'live_photo.jpg',
            } as any);
            formData.append('document_image', {
                uri: docImage.uri,
                type: 'image/jpeg',
                name: 'document.jpg',
            } as any);

            await submitKYC(formData);
            setSubmitted(true);
        } catch (err: any) {
            Alert.alert('Submission Failed', err?.response?.data?.error || 'Please try again.');
        }
        setSubmitting(false);
    };

    if (submitted) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.successContainer}>
                    <Text style={styles.successIcon}>⏳</Text>
                    <Text style={styles.successTitle}>Verification Under Review</Text>
                    <Text style={styles.successSubtitle}>
                        Your KYC documents have been submitted successfully.
                        Our team will review them within 24-48 hours.
                    </Text>
                    <Text style={styles.successNote}>
                        You'll receive a notification once your verification is complete.
                    </Text>
                    <TouchableOpacity
                        style={styles.doneBtn}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.doneBtnText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    const renderReview = () => (
        <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>Review Your Submission</Text>
            <Text style={styles.stepSubtitle}>Please confirm all details before submitting</Text>

            <View style={styles.reviewCard}>
                <Text style={styles.reviewLabel}>Phone</Text>
                <Text style={styles.reviewValue}>{phone}</Text>
            </View>
            <View style={styles.reviewCard}>
                <Text style={styles.reviewLabel}>Email</Text>
                <Text style={styles.reviewValue}>{email}</Text>
            </View>
            <View style={styles.reviewCard}>
                <Text style={styles.reviewLabel}>Document Type</Text>
                <Text style={styles.reviewValue}>{DOC_TYPES.find(d => d.value === docType)?.label}</Text>
            </View>
            <View style={styles.reviewImagesRow}>
                {livePhoto && <Image source={{ uri: livePhoto.uri }} style={styles.reviewThumb} />}
                {docImage && <Image source={{ uri: docImage.uri }} style={styles.reviewThumb} />}
            </View>

            <View style={styles.navRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => animateStep(3)}>
                    <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.submitBtn, { flex: 1 }]}
                    onPress={handleSubmit}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={styles.submitBtnText}>Submit for Verification</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );

    // ── Progress indicator ──
    const progressWidth = progressAnim.interpolate({
        inputRange: [1, 4],
        outputRange: ['25%', '100%'],
    });

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                    <Text style={styles.progressText}>Step {Math.min(step, 3)} of 3</Text>
                    <View style={styles.progressTrack}>
                        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
                    </View>
                </View>

                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderReview()}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    scrollContent: { flexGrow: 1 },
    progressContainer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
    progressText: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 8, fontWeight: '500' },
    progressTrack: { height: 6, backgroundColor: '#E5E5E0', borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },
    stepContainer: { padding: 20 },
    stepTitle: { fontSize: 22, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
    stepSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 24, lineHeight: 20 },
    label: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8, marginTop: 12 },
    input: {
        backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
        borderRadius: 12, padding: 14, fontSize: 16, color: COLORS.textPrimary,
    },
    nextBtn: {
        backgroundColor: COLORS.primary, paddingVertical: 16,
        borderRadius: 12, alignItems: 'center', marginTop: 24,
    },
    nextBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
    disabledBtn: { opacity: 0.4 },
    navRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
    backBtn: { paddingVertical: 16, paddingHorizontal: 16, justifyContent: 'center' },
    backBtnText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '500' },
    // Camera
    cameraContainer: { flex: 1 },
    camera: { flex: 1, minHeight: 500 },
    cameraOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    faceOutline: {
        width: 220, height: 280, borderRadius: 110,
        borderWidth: 3, borderColor: 'rgba(255,255,255,0.7)',
        borderStyle: 'dashed',
    },
    cameraHint: {
        color: '#FFF', fontSize: 14, marginTop: 20,
        textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    cameraActions: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', paddingHorizontal: 20, paddingVertical: 20,
        backgroundColor: '#000',
    },
    cancelCameraBtn: { width: 60 },
    cancelCameraText: { color: '#FFF', fontSize: 15 },
    captureBtn: {
        width: 72, height: 72, borderRadius: 36,
        borderWidth: 4, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center',
    },
    captureBtnInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF' },
    cameraPlaceholder: {
        backgroundColor: COLORS.card, borderWidth: 2, borderColor: COLORS.border,
        borderStyle: 'dashed', borderRadius: 16, paddingVertical: 50, alignItems: 'center',
        marginTop: 8,
    },
    cameraPlaceholderIcon: { fontSize: 40, marginBottom: 10 },
    cameraPlaceholderText: { fontSize: 15, color: COLORS.textSecondary },
    photoPreviewContainer: { alignItems: 'center', marginTop: 8 },
    photoPreview: { width: 200, height: 260, borderRadius: 16, marginBottom: 12 },
    docPreview: { width: '100%', height: 200, borderRadius: 16, marginBottom: 12, resizeMode: 'cover' },
    retakeBtn: { paddingVertical: 8, paddingHorizontal: 16 },
    retakeBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
    // Doc type
    docTypeRow: { gap: 8, marginTop: 4, marginBottom: 16 },
    docTypeBtn: {
        backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
        borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 4,
    },
    docTypeBtnActive: { borderColor: COLORS.primary, backgroundColor: '#E8F5E9' },
    docTypeText: { fontSize: 15, color: COLORS.textSecondary },
    docTypeTextActive: { color: COLORS.primary, fontWeight: '600' },
    // Review
    reviewCard: {
        backgroundColor: COLORS.card, borderRadius: 12, padding: 14,
        marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
    },
    reviewLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
    reviewValue: { fontSize: 16, color: COLORS.textPrimary },
    reviewImagesRow: { flexDirection: 'row', gap: 12, marginTop: 8, justifyContent: 'center' },
    reviewThumb: { width: 130, height: 160, borderRadius: 12 },
    submitBtn: {
        backgroundColor: COLORS.primary, paddingVertical: 16,
        borderRadius: 12, alignItems: 'center',
    },
    submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
    // Success
    successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
    successIcon: { fontSize: 56, marginBottom: 20 },
    successTitle: { fontSize: 24, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 12 },
    successSubtitle: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 16 },
    successNote: { fontSize: 13, color: COLORS.amber, textAlign: 'center', marginBottom: 30 },
    doneBtn: {
        backgroundColor: COLORS.primary, paddingVertical: 16, paddingHorizontal: 40,
        borderRadius: 12,
    },
    doneBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
