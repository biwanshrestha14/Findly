import React from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView, Image, TouchableOpacity,
} from 'react-native';
import { MEDIA_BASE } from '../../api';

const COLORS = {
    primary: '#0F6E56', primaryLight: '#E1F5EE',
    bg: '#F8F7F2', card: '#FFFFFF',
    text: '#1A1A1A', textSec: '#6B6B6B',
    amber: '#BA7517', amberLight: '#FAEEDA',
    red: '#A32D2D', redLight: '#FCEBEB',
    green: '#3B6D11', greenLight: '#EAF3DE',
    border: '#E5E5E0',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    PENDING_REVIEW: { label: 'Pending Review', color: COLORS.amber, bg: COLORS.amberLight, icon: '⏳' },
    APPROVED: { label: 'Approved', color: COLORS.green, bg: COLORS.greenLight, icon: '✅' },
    REJECTED: { label: 'Rejected', color: COLORS.red, bg: COLORS.redLight, icon: '❌' },
    INFO_REQUESTED: { label: 'Info Requested', color: COLORS.amber, bg: COLORS.amberLight, icon: 'ℹ️' },
};

function timeAgo(dateStr: string) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ClaimStatusScreen({ route, navigation }: any) {
    const { claim } = route.params;
    const statusCfg = STATUS_CONFIG[claim.status] || STATUS_CONFIG.PENDING_REVIEW;

    const match = claim.match;
    const foundItem = match?.matched_item || match?.item;
    const imageUri = foundItem?.image
        ? (foundItem.image.startsWith('http') ? foundItem.image : `${MEDIA_BASE}${foundItem.image}`)
        : null;

    // Timeline stages
    const stages = [
        { label: 'Claim Submitted', time: claim.created_at, completed: true },
        { label: 'Under Admin Review', time: claim.status !== 'PENDING_REVIEW' ? claim.reviewed_at : null, completed: claim.status !== 'PENDING_REVIEW' },
        { label: 'Decision Made', time: claim.reviewed_at, completed: ['APPROVED', 'REJECTED'].includes(claim.status) },
    ];

    return (
        <SafeAreaView style={s.container}>
            <ScrollView contentContainerStyle={s.scroll}>
                {/* Item photo */}
                {imageUri && <Image source={{ uri: imageUri }} style={s.itemImage} />}

                {/* Status badge */}
                <View style={s.statusRow}>
                    <View style={[s.statusBadge, { backgroundColor: statusCfg.bg }]}>
                        <Text style={[s.statusText, { color: statusCfg.color }]}>
                            {statusCfg.icon} {statusCfg.label}
                        </Text>
                    </View>
                </View>

                {/* Timeline */}
                <View style={s.timeline}>
                    {stages.map((stage, i) => (
                        <View key={i} style={s.timelineItem}>
                            <View style={s.timelineLeft}>
                                <View style={[s.timelineDot, stage.completed ? s.dotFilled : s.dotEmpty]} />
                                {i < stages.length - 1 && (
                                    <View style={[s.timelineLine, stage.completed ? s.lineFilled : s.lineEmpty]} />
                                )}
                            </View>
                            <View style={s.timelineRight}>
                                <Text style={[s.timelineLabel, stage.completed && s.timelineLabelActive]}>{stage.label}</Text>
                                {stage.time && <Text style={s.timelineTime}>{timeAgo(stage.time)}</Text>}
                            </View>
                        </View>
                    ))}
                </View>

                {/* Answers */}
                {claim.answers && claim.answers.length > 0 && (
                    <View style={s.section}>
                        <Text style={s.sectionTitle}>Your Responses</Text>
                        {claim.answers.map((a: any, i: number) => (
                            <View key={i} style={s.answerCard}>
                                <Text style={s.answerHint}>{a.detail_hint}</Text>
                                <View style={[s.answerBadge, a.answer ? { backgroundColor: COLORS.greenLight } : { backgroundColor: COLORS.redLight }]}>
                                    <Text style={[s.answerBadgeText, a.answer ? { color: COLORS.green } : { color: COLORS.red }]}>
                                        {a.answer ? '✓ YES' : '✗ NO'}
                                    </Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* Rejected reason */}
                {claim.status === 'REJECTED' && claim.admin_notes && (
                    <View style={[s.infoCard, { backgroundColor: COLORS.redLight, borderColor: COLORS.red }]}>
                        <Text style={[s.infoCardTitle, { color: COLORS.red }]}>Rejection Reason</Text>
                        <Text style={s.infoCardText}>{claim.admin_notes}</Text>
                    </View>
                )}

                {/* Info requested */}
                {claim.status === 'INFO_REQUESTED' && claim.admin_notes && (
                    <View style={[s.infoCard, { backgroundColor: COLORS.amberLight, borderColor: COLORS.amber }]}>
                        <Text style={[s.infoCardTitle, { color: COLORS.amber }]}>Admin Message</Text>
                        <Text style={s.infoCardText}>{claim.admin_notes}</Text>
                    </View>
                )}

                {/* Approved success */}
                {claim.status === 'APPROVED' && (
                    <View style={[s.infoCard, { backgroundColor: COLORS.greenLight, borderColor: COLORS.green }]}>
                        <Text style={[s.infoCardTitle, { color: COLORS.green }]}>Ownership Confirmed!</Text>
                        <Text style={s.infoCardText}>
                            Contact the finder to arrange pickup of your item.
                        </Text>
                    </View>
                )}

                <TouchableOpacity style={s.homeBtn} onPress={() => navigation.navigate('Home')}>
                    <Text style={s.homeBtnText}>Back to Home</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    scroll: { padding: 20, paddingBottom: 40 },
    itemImage: { width: '100%', height: 200, borderRadius: 16, marginBottom: 16, resizeMode: 'cover' },
    statusRow: { alignItems: 'center', marginBottom: 24 },
    statusBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
    statusText: { fontSize: 14, fontWeight: '600' },
    // Timeline
    timeline: { marginBottom: 24 },
    timelineItem: { flexDirection: 'row', minHeight: 60 },
    timelineLeft: { width: 30, alignItems: 'center' },
    timelineDot: { width: 14, height: 14, borderRadius: 7 },
    dotFilled: { backgroundColor: COLORS.primary },
    dotEmpty: { borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.card },
    timelineLine: { width: 2, flex: 1, marginVertical: 4 },
    lineFilled: { backgroundColor: COLORS.primary },
    lineEmpty: { backgroundColor: COLORS.border },
    timelineRight: { flex: 1, paddingLeft: 10, paddingBottom: 16 },
    timelineLabel: { fontSize: 15, color: COLORS.textSec, fontWeight: '500' },
    timelineLabelActive: { color: COLORS.text, fontWeight: '600' },
    timelineTime: { fontSize: 12, color: COLORS.textSec, marginTop: 2 },
    // Section
    section: { marginBottom: 20 },
    sectionTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginBottom: 12 },
    answerCard: {
        backgroundColor: COLORS.card, borderRadius: 14, padding: 14,
        marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    answerHint: { fontSize: 14, color: COLORS.text, flex: 1, marginRight: 10 },
    answerBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    answerBadgeText: { fontSize: 12, fontWeight: '600' },
    // Info cards
    infoCard: {
        borderRadius: 16, padding: 16, marginBottom: 16,
        borderWidth: 1,
    },
    infoCardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
    infoCardText: { fontSize: 14, color: COLORS.text, lineHeight: 20 },
    // Button
    homeBtn: {
        backgroundColor: COLORS.primary, paddingVertical: 16,
        borderRadius: 12, alignItems: 'center',
    },
    homeBtnText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
