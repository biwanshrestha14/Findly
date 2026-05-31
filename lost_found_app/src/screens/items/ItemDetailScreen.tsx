import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, Image, ScrollView, TouchableOpacity,
    Alert, FlatList, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker } from 'react-native-maps';
import api, { getKYCStatus, getMyClaims, MEDIA_BASE } from '../../api';

const COLORS = {
    primary: '#0F6E56',
    primaryLight: '#E1F5EE',
    bg: '#F8F7F2',
    card: '#FFFFFF',
    text: '#1A1A1A',
    gray: '#6B6B6B',
    lightGray: '#E5E5E0',
    amber: '#BA7517',
    amberLight: '#FAEEDA',
    danger: '#ef4444',
    dangerLight: '#FFEBEE',
    success: '#0F6E56',
    successLight: '#E8F5E9',
    accent: '#3498db',
};

export default function ItemDetailScreen({ route, navigation }: any) {
    const { item, matchId, matchResult } = route.params;
    const [currentUsername, setCurrentUsername] = useState('');
    const [matches, setMatches] = useState<any[]>([]);
    const [existingClaim, setExistingClaim] = useState<any>(null);
    const [kycStatus, setKycStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const imgUri = item.image
        ? (item.image.startsWith('http') ? item.image : `${MEDIA_BASE}${item.image}`)
        : null;

    useEffect(() => {
        (async () => {
            const user = await AsyncStorage.getItem('username');
            setCurrentUsername(user || '');

            try {
                if (item.user?.username === user) {
                    const res = await api.get(`items/${item.id}/matches/`);
                    setMatches(res.data);
                }

                // Check KYC status
                try {
                    const kyc = await getKYCStatus();
                    setKycStatus(kyc.kyc_status);
                } catch (_) {}

                // Check existing claim for this match
                if (matchId) {
                    try {
                        const claims = await getMyClaims();
                        const found = claims.find((c: any) => c.match?.id === matchId);
                        if (found) setExistingClaim(found);
                    } catch (_) {}
                }
            } catch (err) {
                console.error("Error:", err);
            }
            setLoading(false);
        })();
    }, [item.id]);

    const isOwner = item.user?.username === currentUsername;
    const canClaim = !isOwner && item.status === 'ACTIVE';
    const isLost = item.item_type === 'LOST';

    const handleDelete = () => {
        Alert.alert('Confirm Delete', 'Are you sure you want to delete this item?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    try {
                        await api.delete(`items/${item.id}/`);
                        Alert.alert('Success', 'Item deleted.');
                        navigation.navigate('Home');
                    } catch (error) {
                        Alert.alert('Error', 'Could not delete item.');
                    }
                }
            }
        ]);
    };

    const handleClaimPress = () => {
        if (kycStatus !== 'APPROVED') {
            Alert.alert('Identity Verification Required',
                'You need to complete KYC verification before claiming items.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Verify Now', onPress: () => navigation.navigate('KYC') },
                ]
            );
            return;
        }
        // Determine which item is the found item
        const foundItemId = matchResult
            ? (matchResult.matched_item?.id || item.id)
            : item.id;
        navigation.navigate('ClaimVerification', { matchId, foundItemId });
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
            {/* Hero Image */}
            {imgUri ? (
                <View style={styles.heroContainer}>
                    <Image source={{ uri: imgUri }} style={styles.heroImage} />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.45)']} style={styles.heroOverlay} />
                    <View style={styles.heroContent}>
                        <View style={[styles.typeBadge, isLost ? styles.lostBadge : styles.foundBadge]}>
                            <Ionicons name={isLost ? 'search-outline' : 'checkmark-circle-outline'} size={13} color="#fff" style={{ marginRight: 4 }} />
                            <Text style={styles.typeBadgeText}>{isLost ? 'Lost' : 'Found'}</Text>
                        </View>
                    </View>
                </View>
            ) : (
                <View style={[styles.heroContainer, styles.heroPlaceholder]}>
                    <Ionicons name="image-outline" size={48} color="#ABABAB" />
                    <View style={[styles.typeBadge, isLost ? styles.lostBadge : styles.foundBadge, { marginTop: 12 }]}>
                        <Text style={styles.typeBadgeText}>{isLost ? 'Lost' : 'Found'}</Text>
                    </View>
                </View>
            )}

            {/* Content */}
            <View style={styles.contentArea}>
                {/* Title & Meta */}
                <View style={styles.card}>
                    <Text style={styles.title}>{item.title}</Text>
                    <View style={styles.metaRow}>
                        <View style={styles.metaChip}>
                            <Ionicons name="person-outline" size={13} color={COLORS.gray} style={{ marginRight: 4 }} />
                            <Text style={styles.metaChipText}>@{item.user?.username}</Text>
                        </View>
                        <View style={styles.metaChip}>
                            <Ionicons name="flag-outline" size={13} color={COLORS.gray} style={{ marginRight: 4 }} />
                            <Text style={styles.metaChipText}>{item.status}</Text>
                        </View>
                        {item.category && (
                            <View style={styles.metaChip}>
                                <Ionicons name="folder-outline" size={13} color={COLORS.gray} style={{ marginRight: 4 }} />
                                <Text style={styles.metaChipText}>{item.category}</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Description */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Ionicons name="document-text-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                        <Text style={styles.cardHeaderText}>Description</Text>
                    </View>
                    <Text style={styles.descText}>{item.description}</Text>
                </View>

                {/* Location */}
                {item.latitude && item.longitude && (
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="location-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                            <Text style={styles.cardHeaderText}>Location</Text>
                        </View>
                        <View style={styles.mapContainer}>
                            <MapView
                                style={styles.map}
                                initialRegion={{
                                    latitude: parseFloat(item.latitude),
                                    longitude: parseFloat(item.longitude),
                                    latitudeDelta: 0.01,
                                    longitudeDelta: 0.01,
                                }}
                            >
                                <Marker coordinate={{ latitude: parseFloat(item.latitude), longitude: parseFloat(item.longitude) }} />
                            </MapView>
                        </View>
                    </View>
                )}

                {/* Match breakdown */}
                {matchResult && (
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="analytics-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                            <Text style={styles.cardHeaderText}>Match Confidence: {(matchResult.score * 100).toFixed(0)}%</Text>
                        </View>
                        <View style={styles.progressBarBg}>
                            <LinearGradient colors={['#0F6E56', '#128C7E']} style={[styles.progressBar, { width: `${(matchResult.score * 100)}%` }]} />
                        </View>
                        {[
                            { label: 'Color', score: matchResult.color_score, icon: 'color-palette-outline' },
                            { label: 'Label', score: matchResult.label_score, icon: 'pricetag-outline' },
                            { label: 'Location', score: matchResult.location_score, icon: 'location-outline' },
                            { label: 'Text', score: matchResult.text_score, icon: 'document-text-outline' },
                        ].map(m => (
                            <View key={m.label} style={styles.scoreRow}>
                                <View style={styles.scoreRowLeft}>
                                    <Ionicons name={m.icon as any} size={14} color={COLORS.gray} style={{ marginRight: 8 }} />
                                    <Text style={styles.scoreLabel}>{m.label}</Text>
                                </View>
                                <Text style={styles.scoreValue}>{(m.score * 100).toFixed(0)}%</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Owner: Verification Details section */}
                {isOwner && item.item_type === 'FOUND' && (
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                            <Text style={styles.cardHeaderText}>Verification Details</Text>
                        </View>
                        {item.has_verification_details ? (
                            <View style={styles.verifiedCard}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
                                    <Text style={styles.verifiedText}>Verification details added</Text>
                                </View>
                                <TouchableOpacity onPress={() => navigation.navigate('VerificationSetup', { itemId: item.id })}>
                                    <Text style={styles.editDetailsLink}>Edit</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.warningCard}>
                                <Ionicons name="warning-outline" size={28} color={COLORS.amber} style={{ marginBottom: 8 }} />
                                <Text style={styles.warningText}>No verification details added. Add details to help verify ownership.</Text>
                                <TouchableOpacity
                                    style={styles.addDetailsBtn}
                                    onPress={() => navigation.navigate('VerificationSetup', { itemId: item.id })}
                                >
                                    <Text style={styles.addDetailsBtnText}>Add Details</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                )}

                {/* Owner: Possible matches */}
                {isOwner && item.status === 'ACTIVE' && matches.length > 0 && (
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="git-compare-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                            <Text style={styles.cardHeaderText}>Possible Matches ({matches.length})</Text>
                        </View>
                        <FlatList
                            horizontal
                            data={matches}
                            keyExtractor={(i) => i.id.toString()}
                            showsHorizontalScrollIndicator={false}
                            renderItem={({ item: matchTuple }) => {
                                const mImg = matchTuple.matched_item.image
                                    ? (matchTuple.matched_item.image.startsWith('http') ? matchTuple.matched_item.image : `${MEDIA_BASE}${matchTuple.matched_item.image}`)
                                    : null;
                                return (
                                    <TouchableOpacity
                                        style={styles.matchCard}
                                        onPress={() => navigation.navigate('ItemDetail', {
                                            item: matchTuple.matched_item,
                                            matchId: matchTuple.id,
                                            matchResult: matchTuple,
                                        })}
                                    >
                                        {mImg ? (
                                            <Image source={{ uri: mImg }} style={styles.matchImage} />
                                        ) : (
                                            <View style={[styles.matchImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F0F0ED' }]}>
                                                <Ionicons name="image-outline" size={24} color="#ABABAB" />
                                            </View>
                                        )}
                                        <View style={styles.matchBody}>
                                            <Text style={styles.matchTitle} numberOfLines={1}>{matchTuple.matched_item.title}</Text>
                                            <Text style={styles.matchScore}>{(matchTuple.score * 100).toFixed(0)}% Match</Text>
                                            {matchTuple.has_claim && (
                                                <View style={styles.claimSubmittedBadge}>
                                                    <Text style={styles.claimSubmittedText}>Claimed</Text>
                                                </View>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>
                )}

                {/* Claim button or status */}
                {canClaim && matchId && (
                    existingClaim ? (
                        <TouchableOpacity
                            style={[styles.claimBtn, { backgroundColor: COLORS.amberLight }]}
                            onPress={() => navigation.navigate('ClaimStatus', { claim: existingClaim })}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="time-outline" size={20} color={COLORS.amber} style={{ marginRight: 8 }} />
                                <Text style={[styles.claimText, { color: COLORS.amber }]}>
                                    View Claim Status ({existingClaim.status.replace('_', ' ')})
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.claimBtn} onPress={handleClaimPress}>
                            <LinearGradient colors={kycStatus !== 'APPROVED' ? ['#3498db', '#2980b9'] : ['#0F6E56', '#128C7E']} style={styles.claimGradient}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name={kycStatus !== 'APPROVED' ? 'card-outline' : 'hand-left-outline'} size={20} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={styles.claimText}>
                                        {kycStatus !== 'APPROVED' ? 'Verify Identity First' : 'Claim This Item'}
                                    </Text>
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    )
                )}

                {/* Owner actions */}
                {isOwner && item.status === 'ACTIVE' && (
                    <View style={styles.ownerActions}>
                        <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('AddItem', { editItem: item })}>
                            <Ionicons name="create-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.actionText}>Edit Item</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                            <Ionicons name="trash-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.actionText}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    
    // Hero image
    heroContainer: { width: '100%', height: 280, position: 'relative' },
    heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 },
    heroContent: { position: 'absolute', bottom: 16, left: 16 },
    heroPlaceholder: { backgroundColor: '#F0F0ED', justifyContent: 'center', alignItems: 'center' },
    typeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    typeBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
    lostBadge: { backgroundColor: COLORS.danger },
    foundBadge: { backgroundColor: COLORS.success },

    contentArea: { paddingHorizontal: 14, marginTop: -20 },
    
    // Cards
    card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F0F0ED', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    cardHeaderText: { fontSize: 15, fontWeight: '700', color: COLORS.text },
    
    title: { fontSize: 22, fontWeight: '800', color: COLORS.text, marginBottom: 12 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    metaChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0ED', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    metaChipText: { fontSize: 12, color: COLORS.gray, fontWeight: '600' },
    
    descText: { fontSize: 15, color: '#444', lineHeight: 23 },
    mapContainer: { height: 180, borderRadius: 14, overflow: 'hidden', backgroundColor: '#F0F0ED' },
    map: { flex: 1 },
    
    // Match breakdown
    progressBarBg: { height: 6, backgroundColor: '#EBEBE6', borderRadius: 3, overflow: 'hidden', marginBottom: 14 },
    progressBar: { height: '100%', borderRadius: 3 },
    scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#F0F0ED' },
    scoreRowLeft: { flexDirection: 'row', alignItems: 'center' },
    scoreLabel: { fontSize: 14, color: COLORS.gray, fontWeight: '600' },
    scoreValue: { fontSize: 14, color: COLORS.text, fontWeight: '800' },
    
    // Verification
    verifiedCard: { backgroundColor: COLORS.primaryLight, borderRadius: 12, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    verifiedText: { fontSize: 14, color: COLORS.primary, fontWeight: '600' },
    editDetailsLink: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
    warningCard: { backgroundColor: COLORS.amberLight, borderRadius: 12, padding: 16, alignItems: 'center' },
    warningText: { fontSize: 13, color: COLORS.amber, textAlign: 'center', marginBottom: 12, lineHeight: 19 },
    addDetailsBtn: { backgroundColor: COLORS.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
    addDetailsBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
    
    // Matches carousel
    matchCard: { width: 140, backgroundColor: COLORS.card, borderRadius: 14, marginRight: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#F0F0ED' },
    matchImage: { width: '100%', height: 90, resizeMode: 'cover' },
    matchBody: { padding: 10 },
    matchTitle: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
    matchScore: { fontSize: 11, color: COLORS.primary, fontWeight: '800' },
    claimSubmittedBadge: { backgroundColor: COLORS.amberLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4, alignSelf: 'flex-start' },
    claimSubmittedText: { fontSize: 10, color: COLORS.amber, fontWeight: '700' },
    
    // Claim button
    claimBtn: { marginTop: 8, borderRadius: 14, overflow: 'hidden' },
    claimGradient: { paddingVertical: 17, paddingHorizontal: 20 },
    claimText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    
    // Owner actions
    ownerActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
    editBtn: { flex: 1, flexDirection: 'row', backgroundColor: COLORS.accent, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    deleteBtn: { flex: 1, flexDirection: 'row', backgroundColor: COLORS.danger, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    actionText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
