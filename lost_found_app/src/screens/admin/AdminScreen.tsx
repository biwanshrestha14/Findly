import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
    ScrollView, Image, Alert, ActivityIndicator, TextInput, RefreshControl,
} from 'react-native';
import {
    adminGetKYCList, adminReviewKYC,
    adminGetClaims, adminReviewClaim, MEDIA_BASE,
} from '../../api';

const COLORS = {
    primary: '#0F6E56', primaryLight: '#E1F5EE',
    bg: '#F8F7F2', card: '#FFFFFF',
    text: '#1A1A1A', textSec: '#6B6B6B',
    amber: '#BA7517', amberLight: '#FAEEDA',
    red: '#A32D2D', redLight: '#FCEBEB',
    green: '#3B6D11', greenLight: '#EAF3DE',
    border: '#E5E5E0',
};

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
    PENDING: { color: COLORS.amber, bg: COLORS.amberLight },
    APPROVED: { color: COLORS.green, bg: COLORS.greenLight },
    REJECTED: { color: COLORS.red, bg: COLORS.redLight },
    PENDING_REVIEW: { color: COLORS.amber, bg: COLORS.amberLight },
    INFO_REQUESTED: { color: COLORS.amber, bg: COLORS.amberLight },
};

function imgUri(path: string | null | undefined): string | null {
    if (!path) return null;
    return path.startsWith('http') ? path : `${MEDIA_BASE}${path}`;
}

export default function AdminScreen({ navigation }: any) {
    const [tab, setTab] = useState<'kyc' | 'claims'>('kyc');
    const [kycList, setKycList] = useState<any[]>([]);
    const [claims, setClaims] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [reviewNotes, setReviewNotes] = useState('');
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const fetchData = useCallback(async () => {
        try {
            if (tab === 'kyc') {
                const data = await adminGetKYCList();
                setKycList(data);
            } else {
                const data = await adminGetClaims();
                setClaims(data);
            }
        } catch (e: any) {
            if (e?.response?.status === 403) {
                Alert.alert('Access Denied', 'You are not an admin.');
                navigation.goBack();
            }
        }
        setLoading(false);
        setRefreshing(false);
    }, [tab]);

    useEffect(() => {
        setLoading(true);
        fetchData();
    }, [tab]);

    const onRefresh = () => { setRefreshing(true); fetchData(); };

    // ── KYC Actions ──
    const handleKYCAction = async (id: number, action: 'APPROVED' | 'REJECTED') => {
        const label = action === 'APPROVED' ? 'Approve' : 'Reject';
        Alert.alert(`${label} KYC?`, `Are you sure you want to ${label.toLowerCase()} this KYC submission?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: label, style: action === 'REJECTED' ? 'destructive' : 'default',
                onPress: async () => {
                    try {
                        await adminReviewKYC(id, action, reviewNotes);
                        Alert.alert('Done', `KYC ${action.toLowerCase()}.`);
                        setReviewNotes('');
                        setExpandedId(null);
                        fetchData();
                    } catch (e) {
                        Alert.alert('Error', 'Failed to update KYC.');
                    }
                }
            }
        ]);
    };

    // ── Claim Actions ──
    const handleClaimAction = async (id: number, action: 'APPROVED' | 'REJECTED' | 'INFO_REQUESTED') => {
        const labels: Record<string, string> = { APPROVED: 'Approve', REJECTED: 'Reject', INFO_REQUESTED: 'Request Info' };
        Alert.alert(`${labels[action]} Claim?`, 'Confirm this action.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: labels[action],
                style: action === 'REJECTED' ? 'destructive' : 'default',
                onPress: async () => {
                    try {
                        await adminReviewClaim(id, action, reviewNotes);
                        Alert.alert('Done', `Claim ${action.toLowerCase().replace('_', ' ')}.`);
                        setReviewNotes('');
                        setExpandedId(null);
                        fetchData();
                    } catch (e) {
                        Alert.alert('Error', 'Failed to update claim.');
                    }
                }
            }
        ]);
    };

    // ── KYC Card ──
    const renderKYCItem = (kyc: any) => {
        const st = STATUS_STYLE[kyc.kyc_status] || STATUS_STYLE.PENDING;
        const expanded = expandedId === kyc.id;

        return (
            <View key={kyc.id} style={s.card}>
                <TouchableOpacity onPress={() => setExpandedId(expanded ? null : kyc.id)} activeOpacity={0.7}>
                    <View style={s.cardHeader}>
                        <View>
                            <Text style={s.cardTitle}>{kyc.username}</Text>
                            <Text style={s.cardSubtitle}>{kyc.email || kyc.user_email}</Text>
                        </View>
                        <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                            <Text style={[s.statusText, { color: st.color }]}>{kyc.kyc_status}</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {expanded && (
                    <View style={s.expandedSection}>
                        <Text style={s.detailLabel}>Phone: <Text style={s.detailValue}>{kyc.phone_number}</Text></Text>
                        <Text style={s.detailLabel}>Document: <Text style={s.detailValue}>{kyc.document_type}</Text></Text>

                        <Text style={s.photoLabel}>Live Photo</Text>
                        {kyc.live_photo && <Image source={{ uri: imgUri(kyc.live_photo)! }} style={s.photo} />}

                        <Text style={s.photoLabel}>Document Photo</Text>
                        {kyc.document_image && <Image source={{ uri: imgUri(kyc.document_image)! }} style={s.photo} />}

                        {kyc.kyc_status === 'PENDING' && (
                            <>
                                <TextInput
                                    style={s.notesInput}
                                    placeholder="Admin notes (optional)"
                                    placeholderTextColor="#ABABAB"
                                    value={reviewNotes}
                                    onChangeText={setReviewNotes}
                                    multiline
                                />
                                <View style={s.actionRow}>
                                    <TouchableOpacity
                                        style={[s.actionBtn, { backgroundColor: COLORS.green }]}
                                        onPress={() => handleKYCAction(kyc.id, 'APPROVED')}
                                    >
                                        <Text style={s.actionBtnText}>✓ Approve</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[s.actionBtn, { backgroundColor: COLORS.red }]}
                                        onPress={() => handleKYCAction(kyc.id, 'REJECTED')}
                                    >
                                        <Text style={s.actionBtnText}>✗ Reject</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                )}
            </View>
        );
    };

    // ── Claim Card ──
    const renderClaimItem = (claim: any) => {
        const st = STATUS_STYLE[claim.status] || STATUS_STYLE.PENDING_REVIEW;
        const expanded = expandedId === claim.id;
        const match = claim.match;
        const lostItem = match?.item;
        const foundItem = match?.matched_item;

        return (
            <View key={claim.id} style={s.card}>
                <TouchableOpacity onPress={() => setExpandedId(expanded ? null : claim.id)} activeOpacity={0.7}>
                    <View style={s.cardHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.cardTitle}>Claim by @{claim.claimant_username}</Text>
                            <Text style={s.cardSubtitle}>
                                Score: {match ? `${(match.score * 100).toFixed(0)}%` : '—'}
                            </Text>
                        </View>
                        <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                            <Text style={[s.statusText, { color: st.color }]}>{claim.status.replace(/_/g, ' ')}</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                {expanded && (
                    <View style={s.expandedSection}>
                        {/* Item photos side by side */}
                        <View style={s.photoRow}>
                            <View style={s.photoCol}>
                                <Text style={s.photoLabel}>Lost Item</Text>
                                {lostItem?.image && <Image source={{ uri: imgUri(lostItem.image)! }} style={s.photoSmall} />}
                                <Text style={s.photoCaption}>{lostItem?.title}</Text>
                            </View>
                            <View style={s.photoCol}>
                                <Text style={s.photoLabel}>Found Item</Text>
                                {foundItem?.image && <Image source={{ uri: imgUri(foundItem.image)! }} style={s.photoSmall} />}
                                <Text style={s.photoCaption}>{foundItem?.title}</Text>
                            </View>
                        </View>

                        {/* Verification answers */}
                        {claim.answers && claim.answers.length > 0 && (
                            <View style={s.answersSection}>
                                <Text style={s.sectionLabel}>Verification Answers</Text>
                                {claim.answers.map((a: any, i: number) => (
                                    <View key={i} style={s.answerRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.answerDetail}>{a.detail_text}</Text>
                                            <Text style={s.answerHint}>Hint: {a.detail_hint}</Text>
                                        </View>
                                        <View style={[s.answerBadge, a.answer ? { backgroundColor: COLORS.greenLight } : { backgroundColor: COLORS.redLight }]}>
                                            <Text style={[s.answerBadgeText, { color: a.answer ? COLORS.green : COLORS.red }]}>
                                                {a.answer ? 'YES' : 'NO'}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* KYC info */}
                        {(claim.claimant_kyc || claim.found_user_kyc) && (
                            <View style={s.answersSection}>
                                <Text style={s.sectionLabel}>KYC Status</Text>
                                {claim.claimant_kyc && (
                                    <Text style={s.detailLabel}>
                                        Claimant: <Text style={s.detailValue}>{claim.claimant_kyc.kyc_status}</Text>
                                    </Text>
                                )}
                                {claim.found_user_kyc && (
                                    <Text style={s.detailLabel}>
                                        Finder: <Text style={s.detailValue}>{claim.found_user_kyc.kyc_status}</Text>
                                    </Text>
                                )}
                            </View>
                        )}

                        {claim.status === 'PENDING_REVIEW' && (
                            <>
                                <TextInput
                                    style={s.notesInput}
                                    placeholder="Admin notes / rejection reason"
                                    placeholderTextColor="#ABABAB"
                                    value={reviewNotes}
                                    onChangeText={setReviewNotes}
                                    multiline
                                />
                                <View style={s.actionRow}>
                                    <TouchableOpacity
                                        style={[s.actionBtn, { backgroundColor: COLORS.green }]}
                                        onPress={() => handleClaimAction(claim.id, 'APPROVED')}
                                    >
                                        <Text style={s.actionBtnText}>✓ Approve</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[s.actionBtn, { backgroundColor: COLORS.red }]}
                                        onPress={() => handleClaimAction(claim.id, 'REJECTED')}
                                    >
                                        <Text style={s.actionBtnText}>✗ Reject</Text>
                                    </TouchableOpacity>
                                </View>
                                <TouchableOpacity
                                    style={[s.actionBtn, { backgroundColor: COLORS.amber, marginTop: 8, alignSelf: 'stretch' }]}
                                    onPress={() => handleClaimAction(claim.id, 'INFO_REQUESTED')}
                                >
                                    <Text style={s.actionBtnText}>ℹ️ Request More Info</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={s.container}>
            {/* Tab bar */}
            <View style={s.tabBar}>
                <TouchableOpacity style={[s.tab, tab === 'kyc' && s.tabActive]} onPress={() => setTab('kyc')}>
                    <Text style={[s.tabText, tab === 'kyc' && s.tabTextActive]}>KYC Reviews</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.tab, tab === 'claims' && s.tabActive]} onPress={() => setTab('claims')}>
                    <Text style={[s.tabText, tab === 'claims' && s.tabTextActive]}>Claim Reviews</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={s.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
            >
                {loading ? (
                    <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
                ) : tab === 'kyc' ? (
                    kycList.length === 0 ? (
                        <Text style={s.emptyText}>No KYC submissions</Text>
                    ) : (
                        kycList.map(renderKYCItem)
                    )
                ) : (
                    claims.length === 0 ? (
                        <Text style={s.emptyText}>No claims to review</Text>
                    ) : (
                        claims.map(renderClaimItem)
                    )
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    tabBar: {
        flexDirection: 'row', backgroundColor: COLORS.card,
        borderBottomWidth: 1, borderColor: COLORS.border,
    },
    tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
    tabActive: { borderBottomWidth: 3, borderBottomColor: COLORS.primary },
    tabText: { fontSize: 15, fontWeight: '500', color: COLORS.textSec },
    tabTextActive: { color: COLORS.primary, fontWeight: '600' },
    scroll: { padding: 16, paddingBottom: 40 },
    // Card
    card: {
        backgroundColor: COLORS.card, borderRadius: 16, marginBottom: 12,
        shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12,
        shadowOffset: { width: 0, height: 2 }, elevation: 3,
        overflow: 'hidden',
    },
    cardHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', padding: 16,
    },
    cardTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
    cardSubtitle: { fontSize: 13, color: COLORS.textSec, marginTop: 2 },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    statusText: { fontSize: 12, fontWeight: '600' },
    // Expanded
    expandedSection: { padding: 16, paddingTop: 0, borderTopWidth: 1, borderColor: COLORS.border },
    detailLabel: { fontSize: 14, color: COLORS.textSec, marginTop: 8 },
    detailValue: { color: COLORS.text, fontWeight: '500' },
    photoLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSec, marginTop: 12, marginBottom: 6 },
    photo: { width: '100%', height: 200, borderRadius: 12, resizeMode: 'cover' },
    photoRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
    photoCol: { flex: 1, alignItems: 'center' },
    photoSmall: { width: '100%', height: 120, borderRadius: 10, resizeMode: 'cover' },
    photoCaption: { fontSize: 12, color: COLORS.textSec, marginTop: 4, textAlign: 'center' },
    // Answers
    answersSection: { marginTop: 12 },
    sectionLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
    answerRow: {
        flexDirection: 'row', alignItems: 'center', marginBottom: 8,
        backgroundColor: COLORS.bg, borderRadius: 10, padding: 10,
    },
    answerDetail: { fontSize: 13, color: COLORS.text, fontWeight: '500' },
    answerHint: { fontSize: 12, color: COLORS.textSec, marginTop: 2 },
    answerBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
    answerBadgeText: { fontSize: 12, fontWeight: '600' },
    // Actions
    notesInput: {
        backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
        borderRadius: 12, padding: 12, fontSize: 14, color: COLORS.text,
        marginTop: 12, minHeight: 50, textAlignVertical: 'top',
    },
    actionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
    actionBtn: {
        flex: 1, paddingVertical: 14, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
    },
    actionBtnText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
    emptyText: { textAlign: 'center', marginTop: 60, color: COLORS.textSec, fontSize: 16 },
});
