import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    Alert, ActivityIndicator, SafeAreaView,
} from 'react-native';
import api, { getKYCStatus } from '../../api';

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

export default function ClaimItemScreen({ route, navigation }: any) {
    const { item, matchId } = route.params;
    const [answer, setAnswer] = useState('');
    const [loading, setLoading] = useState(false);
    const [kycStatus, setKycStatus] = useState<string | null | undefined>(undefined);
    const [checkingKYC, setCheckingKYC] = useState(true);

    // ── KYC Gate: Check on mount ──
    useEffect(() => {
        const checkKYC = async () => {
            try {
                const data = await getKYCStatus();
                setKycStatus(data.kyc_status);
            } catch (e) {
                setKycStatus(null);
            }
            setCheckingKYC(false);
        };
        checkKYC();
    }, []);

    const handleClaim = async () => {
        if (!answer.trim()) {
            Alert.alert('Error', 'Please provide an answer to claim.');
            return;
        }

        setLoading(true);
        try {
            await api.post(`items/${item.id}/verify_claim/`, { answer, match_id: matchId });
            Alert.alert('Success!', 'Item claimed successfully. Status updated to MATCHED.', [
                { text: 'OK', onPress: () => navigation.popToTop() }
            ]);
        } catch (error: any) {
            if (error.response?.data?.error_code === 'KYC_REQUIRED') {
                Alert.alert(
                    'KYC Required',
                    'You need to complete identity verification before claiming items.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Verify Now', onPress: () => navigation.navigate('KYC') },
                    ]
                );
            } else if (error.response?.status === 400) {
                Alert.alert('Incorrect Answer', error.response.data.error || 'The secret answer is incorrect.');
            } else {
                Alert.alert('Error', 'Something went wrong. Please try again.');
            }
        }
        setLoading(false);
    };

    // Loading state
    if (checkingKYC) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            </SafeAreaView>
        );
    }

    // KYC not submitted or rejected → redirect to KYC
    if (kycStatus === null || kycStatus === 'REJECTED') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.gateContainer}>
                    <Text style={styles.gateIcon}>{kycStatus === 'REJECTED' ? '❌' : '🪪'}</Text>
                    <Text style={styles.gateTitle}>
                        {kycStatus === 'REJECTED' ? 'Verification Rejected' : 'Identity Verification Required'}
                    </Text>
                    <Text style={styles.gateSubtitle}>
                        {kycStatus === 'REJECTED'
                            ? 'Your previous KYC submission was rejected. Please re-submit with valid documents.'
                            : 'You need to complete KYC verification before you can claim items.'}
                    </Text>
                    <TouchableOpacity style={styles.gateBtn} onPress={() => navigation.navigate('KYC')}>
                        <Text style={styles.gateBtnText}>
                            {kycStatus === 'REJECTED' ? 'Re-submit KYC' : 'Start Verification'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // KYC pending → show waiting screen
    if (kycStatus === 'PENDING') {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.gateContainer}>
                    <Text style={styles.gateIcon}>⏳</Text>
                    <Text style={styles.gateTitle}>Verification Under Review</Text>
                    <Text style={styles.gateSubtitle}>
                        Your KYC documents are being reviewed. This usually takes 24-48 hours.
                        You'll receive a notification once approved.
                    </Text>
                    <TouchableOpacity style={[styles.gateBtn, { backgroundColor: COLORS.amber }]} onPress={() => navigation.goBack()}>
                        <Text style={styles.gateBtnText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    // KYC Approved → show claim form
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.title}>Secure Verification</Text>
                <Text style={styles.subtitle}>
                    {item.item_type === 'FOUND'
                        ? 'To claim this found item, please enter the secret key provided by the finder.'
                        : 'To claim this item, please answer the secret question provided by the owner.'}
                </Text>

                {item.secret_question ? (
                    <View style={styles.questionBox}>
                        <Text style={styles.qLabel}>Question:</Text>
                        <Text style={styles.question}>{item.secret_question}</Text>
                    </View>
                ) : (
                    <View style={styles.questionBox}>
                        <Text style={[styles.qLabel, { color: COLORS.primary }]}>Verification required:</Text>
                        <Text style={styles.question}>Please enter the Secret Key</Text>
                    </View>
                )}

                <TextInput
                    style={styles.input}
                    placeholder={item.item_type === 'FOUND' ? "Secret Key" : "Your Answer"}
                    placeholderTextColor="#ABABAB"
                    value={answer}
                    onChangeText={setAnswer}
                    autoCapitalize="none"
                />

                <TouchableOpacity style={styles.btn} onPress={handleClaim} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify and Claim</Text>}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', padding: 20 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    card: {
        backgroundColor: COLORS.card, padding: 25, borderRadius: 16,
        shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12,
        shadowOffset: { width: 0, height: 2 }, elevation: 5,
    },
    title: { fontSize: 22, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 10, textAlign: 'center' },
    subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 30, lineHeight: 20 },
    questionBox: {
        backgroundColor: COLORS.bg, padding: 15, borderRadius: 12, marginBottom: 20,
        borderWidth: 1, borderColor: COLORS.border,
    },
    qLabel: { fontSize: 12, fontWeight: '600', color: COLORS.red, textTransform: 'uppercase', marginBottom: 5 },
    question: { fontSize: 16, color: COLORS.textPrimary, fontWeight: '500' },
    input: {
        backgroundColor: COLORS.card, padding: 15, borderRadius: 12,
        borderWidth: 1, borderColor: COLORS.border, marginBottom: 20, fontSize: 16,
        color: COLORS.textPrimary,
    },
    btn: {
        backgroundColor: COLORS.primary, padding: 18, borderRadius: 12, alignItems: 'center',
    },
    btnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
    // KYC Gate screens
    gateContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
    gateIcon: { fontSize: 56, marginBottom: 20 },
    gateTitle: { fontSize: 22, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 12, textAlign: 'center' },
    gateSubtitle: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 30 },
    gateBtn: {
        backgroundColor: COLORS.primary, paddingVertical: 16, paddingHorizontal: 40,
        borderRadius: 12,
    },
    gateBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
