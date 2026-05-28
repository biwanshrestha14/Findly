import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, Image, ScrollView, TouchableOpacity,
    Alert, FlatList, ActivityIndicator, Modal, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker } from 'react-native-maps';
import api, { getKYCStatus, getMyClaims } from '../../api';

const COLORS = {
    primary: '#0F6E56', primaryLight: '#E1F5EE',
    bg: '#F8F7F2', card: '#FFFFFF',
    text: '#1A1A1A', textSec: '#6B6B6B',
    amber: '#BA7517', amberLight: '#FAEEDA',
    red: '#A32D2D', redLight: '#FCEBEB',
    border: '#E5E5E0',
};

export default function ItemDetailScreen({ route, navigation }: any) {
    const { item, matchId, matchResult } = route.params;
    const [currentUsername, setCurrentUsername] = useState('');
    const [matches, setMatches] = useState<any[]>([]);
    const [existingClaim, setExistingClaim] = useState<any>(null);
    const [kycStatus, setKycStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

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
        <ScrollView style={styles.container}>
            {item.image && <Image source={{ uri: item.image }} style={styles.image} />}
            <View style={styles.content}>
                <View style={styles.headerRow}>
                    <Text style={styles.title}>{item.title}</Text>
                    <Text style={[styles.badge, item.item_type === 'LOST' ? styles.lostBadge : styles.foundBadge]}>
                        {item.item_type}
                    </Text>
                </View>

                <Text style={styles.metaText}>Status: <Text style={styles.bold}>{item.status}</Text></Text>
                <Text style={styles.metaText}>Category: <Text style={styles.bold}>{item.category}</Text></Text>
                <Text style={styles.metaText}>Posted by: <Text style={styles.bold}>@{item.user?.username}</Text></Text>

                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.descText}>{item.description}</Text>



                {item.latitude && item.longitude && (
                    <>
                        <Text style={styles.sectionTitle}>Location</Text>
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
                    </>
                )}

                {/* Match breakdown */}
                {matchResult && (
                    <View style={styles.breakdownCard}>
                        <Text style={styles.sectionTitle}>Match Confidence: {(matchResult.score * 100).toFixed(0)}%</Text>
                        <View style={styles.scoreLineRow}>
                            <Ionicons name="color-palette-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                            <Text style={styles.scoreLine}>Color Match: {(matchResult.color_score * 100).toFixed(0)}%</Text>
                        </View>
                        <View style={styles.scoreLineRow}>
                            <Ionicons name="pricetag-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                            <Text style={styles.scoreLine}>Label Match: {(matchResult.label_score * 100).toFixed(0)}%</Text>
                        </View>
                        <View style={styles.scoreLineRow}>
                            <Ionicons name="location-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                            <Text style={styles.scoreLine}>Location Match: {(matchResult.location_score * 100).toFixed(0)}%</Text>
                        </View>
                        <View style={styles.scoreLineRow}>
                            <Ionicons name="document-text-outline" size={16} color={COLORS.primary} style={{ marginRight: 8 }} />
                            <Text style={styles.scoreLine}>Text Match: {(matchResult.text_score * 100).toFixed(0)}%</Text>
                        </View>
                    </View>
                )}

                {/* Owner: Verification Details section */}
                {isOwner && item.item_type === 'FOUND' && (
                    <View style={styles.verificationSection}>
                        <Text style={styles.sectionTitle}>Verification Details</Text>
                        {item.has_verification_details ? (
                            <View style={styles.verifiedCard}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
                                    <Text style={styles.verifiedText}>Verification details added</Text>
                                </View>
                                <TouchableOpacity onPress={() => navigation.navigate('VerificationSetup', { itemId: item.id })}>
                                    <Text style={styles.editDetailsLink}>Edit Details</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.warningCard}>
                                <Ionicons name="warning-outline" size={32} color={COLORS.amber} style={{ marginBottom: 8 }} />
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
                    <>
                        <Text style={styles.sectionTitle}>Possible Matches</Text>
                        <FlatList
                            horizontal
                            data={matches}
                            keyExtractor={(i) => i.id.toString()}
                            showsHorizontalScrollIndicator={false}
                            renderItem={({ item: matchTuple }) => (
                                <TouchableOpacity
                                    style={styles.matchCard}
                                    onPress={() => navigation.navigate('ItemDetail', {
                                        item: matchTuple.matched_item,
                                        matchId: matchTuple.id,
                                        matchResult: matchTuple,
                                    })}
                                >
                                    {matchTuple.matched_item.image && <Image source={{ uri: matchTuple.matched_item.image }} style={styles.matchImage} />}
                                    <View style={styles.matchBody}>
                                        <Text style={styles.matchTitle} numberOfLines={1}>{matchTuple.matched_item.title}</Text>
                                        <Text style={styles.matchScore}>Score: {(matchTuple.score * 100).toFixed(0)}%</Text>
                                        {matchTuple.has_claim && <Text style={styles.claimBadge}>Claim Submitted</Text>}
                                    </View>
                                </TouchableOpacity>
                            )}
                        />
                    </>
                )}

                {/* Claim button or status */}
                {canClaim && matchId && (
                    existingClaim ? (
                        <TouchableOpacity
                            style={[styles.claimBtn, { backgroundColor: COLORS.amberLight }]}
                            onPress={() => navigation.navigate('ClaimStatus', { claim: existingClaim })}
                        >
                            <Text style={[styles.claimText, { color: COLORS.amber }]}>
                                View Claim Status ({existingClaim.status.replace('_', ' ')})
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.claimBtn} onPress={handleClaimPress}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                                {kycStatus !== 'APPROVED' && <Ionicons name="card-outline" size={22} color="#fff" style={{ marginRight: 8 }} />}
                                <Text style={styles.claimText}>
                                    {kycStatus !== 'APPROVED' ? 'Verify Identity First' : 'Claim This Item'}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    )
                )}

                {/* Owner actions */}
                {isOwner && item.status === 'ACTIVE' && (
                    <View style={styles.ownerActions}>
                        <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('AddItem', { editItem: item })}>
                            <Text style={styles.actionText}>Edit Item</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                            <Text style={styles.actionText}>Delete Item</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    image: { width: '100%', height: 250, resizeMode: 'cover' },
    content: { padding: 20 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#2f3640', flex: 1 },
    badge: { paddingHorizontal: 15, paddingVertical: 5, borderRadius: 15, overflow: 'hidden', fontWeight: 'bold', color: '#fff' },
    lostBadge: { backgroundColor: '#e84118' },
    foundBadge: { backgroundColor: '#4cd137' },
    metaText: { fontSize: 15, color: '#7f8fa6', marginBottom: 5 },
    bold: { color: '#2f3640', fontWeight: 'bold' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#2f3640', marginTop: 20, marginBottom: 10 },
    descText: { fontSize: 16, color: '#444', lineHeight: 24 },
    mapContainer: { height: 200, borderRadius: 10, overflow: 'hidden', marginTop: 10 },
    map: { flex: 1 },
    claimBtn: { backgroundColor: COLORS.primary, padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 30 },
    claimText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    matchCard: { width: 150, backgroundColor: '#f1f2f6', borderRadius: 10, marginRight: 15, overflow: 'hidden' },
    matchImage: { width: '100%', height: 100, resizeMode: 'cover' },
    matchBody: { padding: 10 },
    matchTitle: { fontSize: 14, fontWeight: 'bold', color: '#2f3640', marginBottom: 5 },
    matchScore: { fontSize: 12, color: COLORS.primary, fontWeight: 'bold' },
    claimBadge: { fontSize: 11, color: COLORS.amber, fontWeight: '600', marginTop: 4 },
    breakdownCard: { backgroundColor: '#f5f6fa', padding: 15, borderRadius: 10, marginTop: 20, borderWidth: 1, borderColor: '#dcdde1' },
    scoreLineRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
    scoreLine: { fontSize: 15, color: '#444', fontWeight: '500' },
    ownerActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 },
    editBtn: { flex: 1, backgroundColor: '#f39c12', padding: 15, borderRadius: 10, alignItems: 'center', marginRight: 10 },
    deleteBtn: { flex: 1, backgroundColor: '#e74c3c', padding: 15, borderRadius: 10, alignItems: 'center', marginLeft: 10 },
    actionText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    // Verification section
    verificationSection: { marginTop: 10 },
    verifiedCard: {
        backgroundColor: COLORS.primaryLight, borderRadius: 12, padding: 14,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    verifiedText: { fontSize: 14, color: COLORS.primary, fontWeight: '500' },
    editDetailsLink: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
    warningCard: {
        backgroundColor: COLORS.amberLight, borderRadius: 12, padding: 16, alignItems: 'center',
    },
    warningIcon: { fontSize: 28, marginBottom: 8 },
    warningText: { fontSize: 14, color: COLORS.amber, textAlign: 'center', marginBottom: 12, lineHeight: 20 },
    addDetailsBtn: {
        backgroundColor: COLORS.primary, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10,
    },
    addDetailsBtnText: { color: '#FFF', fontSize: 14, fontWeight: '600' },

});
