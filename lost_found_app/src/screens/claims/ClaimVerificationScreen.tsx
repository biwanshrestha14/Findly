import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    SafeAreaView, ScrollView, Animated, Alert, ActivityIndicator,
} from 'react-native';
import { getVerificationHints, submitClaim } from '../../api';

const COLORS = {
    primary: '#0F6E56', primaryLight: '#E1F5EE',
    bg: '#F8F7F2', card: '#FFFFFF',
    text: '#1A1A1A', textSec: '#6B6B6B',
    red: '#A32D2D', redLight: '#FCEBEB',
    green: '#3B6D11', greenLight: '#EAF3DE',
    border: '#E5E5E0',
};

interface Hint {
    id: number;
    detail_hint: string;
    order: number;
}

export default function ClaimVerificationScreen({ route, navigation }: any) {
    const { matchId, foundItemId } = route.params;
    const [hints, setHints] = useState<Hint[]>([]);
    const [answers, setAnswers] = useState<Record<number, boolean | null>>({});
    const [currentStep, setCurrentStep] = useState(0);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [showReview, setShowReview] = useState(false);

    const slideAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        (async () => {
            try {
                const data = await getVerificationHints(foundItemId);
                setHints(data);
                const initial: Record<number, boolean | null> = {};
                data.forEach((h: Hint) => { initial[h.id] = null; });
                setAnswers(initial);
            } catch (err: any) {
                Alert.alert('Error', err?.response?.data?.error || 'Could not load verification questions.');
                navigation.goBack();
            }
            setLoading(false);
        })();
    }, []);

    const animateTransition = (callback: () => void) => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: -30, duration: 150, useNativeDriver: true }),
        ]).start(() => {
            callback();
            slideAnim.setValue(30);
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
                Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
            ]).start();
        });
    };

    const handleAnswer = (answer: boolean) => {
        setAnswers(prev => ({ ...prev, [hints[currentStep].id]: answer }));
    };

    const handleNext = () => {
        if (currentStep < hints.length - 1) {
            animateTransition(() => setCurrentStep(prev => prev + 1));
        } else {
            setShowReview(true);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            animateTransition(() => setCurrentStep(prev => prev - 1));
        }
    };

    const goToQuestion = (index: number) => {
        setShowReview(false);
        setCurrentStep(index);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const answerPayload = hints.map(h => ({
                verification_detail_id: h.id,
                answer: answers[h.id] ?? false,
            }));
            await submitClaim(matchId, answerPayload);
            setSubmitted(true);
        } catch (err: any) {
            if (err?.response?.data?.error_code === 'KYC_REQUIRED') {
                Alert.alert('KYC Required', 'Complete identity verification before claiming.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Verify Now', onPress: () => navigation.navigate('KYC') },
                ]);
            } else {
                Alert.alert('Error', err?.response?.data?.error || 'Failed to submit claim.');
            }
        }
        setSubmitting(false);
    };

    if (loading) {
        return (
            <SafeAreaView style={s.container}>
                <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
            </SafeAreaView>
        );
    }

    if (hints.length === 0) {
        return (
            <SafeAreaView style={s.container}>
                <View style={s.center}>
                    <Text style={s.emptyIcon}>📋</Text>
                    <Text style={s.emptyTitle}>No verification questions</Text>
                    <Text style={s.emptySubtitle}>The finder hasn't set up verification details yet. Admin will verify manually.</Text>
                    <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={submitting}>
                        {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={s.submitBtnText}>Submit Claim Anyway</Text>}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // Submitted confirmation
    if (submitted) {
        return (
            <SafeAreaView style={s.container}>
                <View style={s.center}>
                    <Text style={s.successIcon}>⏳</Text>
                    <Text style={s.successTitle}>Claim Submitted</Text>
                    <Text style={s.successSubtitle}>
                        Our team will review your claim along with both parties' verification documents.
                        You'll be notified once a decision is made.
                    </Text>
                    <Text style={s.successNote}>Usually within 24–48 hours</Text>
                    <TouchableOpacity style={s.submitBtn} onPress={() => navigation.navigate('Home')}>
                        <Text style={s.submitBtnText}>Back to Home</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // Review screen
    if (showReview) {
        return (
            <SafeAreaView style={s.container}>
                <ScrollView contentContainerStyle={s.scroll}>
                    <Text style={s.reviewTitle}>Review Your Answers</Text>
                    <Text style={s.reviewSubtitle}>Confirm your responses before submitting</Text>

                    {hints.map((h, i) => (
                        <View key={h.id} style={s.reviewCard}>
                            <Text style={s.reviewQ}>{h.detail_hint}</Text>
                            <View style={s.reviewRow}>
                                <View style={[s.reviewBadge, answers[h.id] ? s.yesBadge : s.noBadge]}>
                                    <Text style={[s.reviewBadgeText, answers[h.id] ? s.yesText : s.noText]}>
                                        {answers[h.id] ? '✓ YES' : '✗ NO'}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => goToQuestion(i)}>
                                    <Text style={s.editLink}>Edit</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}

                    <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={submitting}>
                        {submitting ? <ActivityIndicator color="#FFF" /> : <Text style={s.submitBtnText}>Submit Claim</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity style={s.backLink} onPress={() => setShowReview(false)}>
                        <Text style={s.backLinkText}>← Go Back</Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        );
    }

    // Question step
    const hint = hints[currentStep];
    const currentAnswer = answers[hint.id];

    return (
        <SafeAreaView style={s.container}>
            <View style={s.scroll}>
                {/* Progress */}
                <View style={s.progressContainer}>
                    <Text style={s.progressText}>Question {currentStep + 1} of {hints.length}</Text>
                    <View style={s.progressTrack}>
                        <View style={[s.progressFill, { width: `${((currentStep + 1) / hints.length) * 100}%` }]} />
                    </View>
                </View>

                {/* Question card */}
                <Animated.View style={[s.questionCard, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
                    <Text style={s.questionText}>{hint.detail_hint}</Text>
                </Animated.View>

                {/* YES / NO buttons */}
                <View style={s.answerRow}>
                    <TouchableOpacity
                        style={[s.answerBtn, s.yesBtn, currentAnswer === true && s.yesBtnActive]}
                        onPress={() => handleAnswer(true)}
                    >
                        <Text style={[s.answerIcon, currentAnswer === true && { color: '#FFF' }]}>✓</Text>
                        <Text style={[s.answerLabel, currentAnswer === true && { color: '#FFF' }]}>YES</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[s.answerBtn, s.noBtn, currentAnswer === false && s.noBtnActive]}
                        onPress={() => handleAnswer(false)}
                    >
                        <Text style={[s.answerIcon, currentAnswer === false && { color: '#FFF' }]}>✗</Text>
                        <Text style={[s.answerLabel, currentAnswer === false && { color: '#FFF' }]}>NO</Text>
                    </TouchableOpacity>
                </View>

                {/* Navigation */}
                <View style={s.navRow}>
                    {currentStep > 0 && (
                        <TouchableOpacity style={s.navBack} onPress={handleBack}>
                            <Text style={s.navBackText}>← Back</Text>
                        </TouchableOpacity>
                    )}
                    <View style={{ flex: 1 }} />
                    {currentAnswer !== null && (
                        <TouchableOpacity style={s.nextBtn} onPress={handleNext}>
                            <Text style={s.nextBtnText}>
                                {currentStep < hints.length - 1 ? 'Next →' : 'Review →'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
    scroll: { flex: 1, padding: 20 },
    // Progress
    progressContainer: { marginBottom: 30 },
    progressText: { fontSize: 13, color: COLORS.textSec, marginBottom: 8, fontWeight: '500' },
    progressTrack: { height: 6, backgroundColor: COLORS.border, borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 3 },
    // Question
    questionCard: {
        backgroundColor: COLORS.card, borderRadius: 16, padding: 30,
        shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12,
        shadowOffset: { width: 0, height: 2 }, elevation: 3,
        marginBottom: 30, minHeight: 160, justifyContent: 'center', alignItems: 'center',
    },
    questionText: { fontSize: 20, fontWeight: '500', color: COLORS.text, textAlign: 'center', lineHeight: 28 },
    // Answer buttons
    answerRow: { flexDirection: 'row', gap: 14, marginBottom: 30 },
    answerBtn: {
        flex: 1, height: 64, borderRadius: 16, flexDirection: 'row',
        alignItems: 'center', justifyContent: 'center', gap: 10,
        borderWidth: 2,
    },
    yesBtn: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
    yesBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    noBtn: { borderColor: COLORS.red, backgroundColor: COLORS.redLight },
    noBtnActive: { backgroundColor: COLORS.red, borderColor: COLORS.red },
    answerIcon: { fontSize: 20, fontWeight: '700', color: COLORS.text },
    answerLabel: { fontSize: 16, fontWeight: '600', color: COLORS.text },
    // Nav
    navRow: { flexDirection: 'row', alignItems: 'center' },
    navBack: { paddingVertical: 12, paddingHorizontal: 4 },
    navBackText: { color: COLORS.textSec, fontSize: 15, fontWeight: '500' },
    nextBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12 },
    nextBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
    // Review
    reviewTitle: { fontSize: 22, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
    reviewSubtitle: { fontSize: 14, color: COLORS.textSec, marginBottom: 20 },
    reviewCard: {
        backgroundColor: COLORS.card, borderRadius: 16, padding: 16,
        marginBottom: 12, borderWidth: 1, borderColor: COLORS.border,
    },
    reviewQ: { fontSize: 15, color: COLORS.text, fontWeight: '500', marginBottom: 10 },
    reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    reviewBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    yesBadge: { backgroundColor: COLORS.greenLight },
    noBadge: { backgroundColor: COLORS.redLight },
    reviewBadgeText: { fontSize: 13, fontWeight: '600' },
    yesText: { color: COLORS.green },
    noText: { color: COLORS.red },
    editLink: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
    // Submit
    submitBtn: {
        backgroundColor: COLORS.primary, paddingVertical: 16,
        borderRadius: 12, alignItems: 'center', marginTop: 20,
    },
    submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
    backLink: { alignItems: 'center', paddingVertical: 14 },
    backLinkText: { color: COLORS.textSec, fontSize: 14 },
    // Success
    successIcon: { fontSize: 56, marginBottom: 20 },
    successTitle: { fontSize: 24, fontWeight: '600', color: COLORS.text, marginBottom: 12 },
    successSubtitle: { fontSize: 15, color: COLORS.textSec, textAlign: 'center', lineHeight: 22, marginBottom: 16 },
    successNote: { fontSize: 13, color: COLORS.primary, marginBottom: 30, fontWeight: '500' },
    // Empty
    emptyIcon: { fontSize: 48, marginBottom: 16 },
    emptyTitle: { fontSize: 20, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
    emptySubtitle: { fontSize: 14, color: COLORS.textSec, textAlign: 'center', marginBottom: 30, paddingHorizontal: 20 },
    green: COLORS.green as any,
});
