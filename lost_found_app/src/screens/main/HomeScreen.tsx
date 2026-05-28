import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Modal, Pressable, Alert } from 'react-native';
import api, { getNotifications, getMyClaims, MEDIA_BASE } from '../../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COLORS = {
    primary: '#0F6E56', primaryLight: '#E1F5EE',
    amber: '#BA7517', amberLight: '#FAEEDA',
    red: '#A32D2D', redLight: '#FCEBEB',
    green: '#3B6D11', greenLight: '#EAF3DE',
};

const CLAIM_STATUS_STYLE: Record<string, { color: string; bg: string }> = {
    PENDING_REVIEW: { color: COLORS.amber, bg: COLORS.amberLight },
    APPROVED: { color: COLORS.green, bg: COLORS.greenLight },
    REJECTED: { color: COLORS.red, bg: COLORS.redLight },
    INFO_REQUESTED: { color: COLORS.amber, bg: COLORS.amberLight },
};

export default function HomeScreen({ navigation }: any) {
    const [reports, setReports] = useState<any[]>([]);
    const [matches, setMatches] = useState<any[]>([]);
    const [claims, setClaims] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'reports' | 'matches' | 'claims'>('reports');
    const [currentUsername, setCurrentUsername] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);
    const [showElectronicsPicker, setShowElectronicsPicker] = useState(false);

    const ELECTRONIC_TYPES = [
        { key: 'mobile_phone', label: 'Mobile Phone', icon: '📱' },
        { key: 'laptop', label: 'Laptop', icon: '💻' },
        { key: 'tablet', label: 'Tablet', icon: '📟' },
        { key: 'earbuds', label: 'Earbuds', icon: '🎧' },
        { key: 'smartwatch', label: 'Smartwatch', icon: '⌚' },
        { key: 'camera', label: 'Camera', icon: '📷' },
        { key: 'accessories', label: 'Accessories', icon: '🔌' },
    ];

    const handleElectronicSelect = (eType: string) => {
        setShowElectronicsPicker(false);
        Alert.alert('Lost or Found?', 'Is this a lost or found report?', [
            { text: 'I Lost It', onPress: () => navigation.navigate('AddElectronic', { electronicType: eType, type: 'LOST' }) },
            { text: 'I Found It', onPress: () => navigation.navigate('AddElectronic', { electronicType: eType, type: 'FOUND' }) },
            { text: 'Cancel', style: 'cancel' },
        ], { cancelable: true });
    };

    const handleDelete = (id: number) => {
        import('react-native').then(({ Alert }) => {
            Alert.alert('Confirm Delete', 'Are you sure you want to delete this report?', [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.delete(`items/${id}/`);
                            Alert.alert('Success', 'Item deleted.');
                            fetchData();
                        } catch (error) {
                            Alert.alert('Error', 'Could not delete item.');
                        }
                    }
                }
            ]);
        });
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const user = await AsyncStorage.getItem('username');
            setCurrentUsername(user || '');

            if (activeTab === 'reports') {
                const res = await api.get('items/');
                setReports(res.data);
            } else if (activeTab === 'matches') {
                const res = await api.get('items/my_matches/');
                setMatches(res.data);
            } else {
                const data = await getMyClaims();
                setClaims(data);
            }

            try {
                const notifs = await getNotifications();
                setUnreadCount(notifs.length);
            } catch (_) {}
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, [activeTab]);

    useEffect(() => {
        const unsub = navigation.addListener('focus', fetchData);
        return unsub;
    }, [navigation, activeTab]);

    const renderHeader = () => (
        <View style={styles.header}>
            <View style={styles.tabRow}>
                {(['reports', 'matches', 'claims'] as const).map(tab => (
                    <TouchableOpacity key={tab} style={[styles.tabBtn, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)}>
                        <Text style={activeTab === tab ? styles.activeText : styles.tabText}>
                            {tab === 'reports' ? 'Reports' : tab === 'matches' ? 'Matches' : 'Claims'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
            <View style={styles.headerActions}>
                <TouchableOpacity style={styles.bellBtn} onPress={() => navigation.navigate('Notifications')}>
                    <Text style={styles.bellIcon}>🔔</Text>
                    {unreadCount > 0 && (
                        <View style={styles.notifBadge}>
                            <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                        </View>
                    )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
                    <Text style={styles.profileText}>Profile</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderReportItem = ({ item }: any) => (
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ItemDetail', { item })}>
            {item.image && <Image source={{ uri: item.image }} style={styles.cardImage} />}
            <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={styles.statusRow}>
                    <Text style={[styles.badge, item.item_type === 'LOST' ? styles.lostBadge : styles.foundBadge]}>
                        {item.item_type}
                    </Text>
                    <Text style={styles.categoryText}>State: {item.status}</Text>
                </View>
                {item.status === 'ACTIVE' && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('AddItem', { editItem: item })}>
                            <Text style={styles.actionText}>Edit Post</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                            <Text style={styles.actionText}>Delete Post</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );

    const renderMatchItem = ({ item: match }: any) => {
        const isOriginalOwner = match.item.user.username === currentUsername;
        const otherItem = isOriginalOwner ? match.matched_item : match.item;
        const myItem = isOriginalOwner ? match.item : match.matched_item;

        return (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ItemDetail', { item: otherItem, matchId: match.id, matchResult: match })}>
                {otherItem.image && <Image source={{ uri: otherItem.image }} style={styles.cardImage} />}
                <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>Match found for your: {myItem.title}</Text>
                    <Text style={styles.matchScore}>Similarity: {(match.score * 100).toFixed(0)}%</Text>
                    <View style={styles.statusRow}>
                        <Text style={[styles.badge, match.status === 'matched' ? styles.foundBadge : styles.pendingBadge]}>
                            {match.status.toUpperCase()}
                        </Text>
                        {match.has_claim && <Text style={styles.claimLabel}>Claim Submitted</Text>}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderClaimItem = ({ item: claim }: any) => {
        const st = CLAIM_STATUS_STYLE[claim.status] || CLAIM_STATUS_STYLE.PENDING_REVIEW;
        const foundItem = claim.match?.matched_item || claim.match?.item;
        const imgUri = foundItem?.image
            ? (foundItem.image.startsWith('http') ? foundItem.image : `${MEDIA_BASE}${foundItem.image}`)
            : null;

        return (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ClaimStatus', { claim })}>
                {imgUri && <Image source={{ uri: imgUri }} style={styles.cardImage} />}
                <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{foundItem?.title || 'Unknown Item'}</Text>
                    <View style={styles.statusRow}>
                        <View style={[styles.claimStatusBadge, { backgroundColor: st.bg }]}>
                            <Text style={[styles.claimStatusText, { color: st.color }]}>
                                {claim.status.replace(/_/g, ' ')}
                            </Text>
                        </View>
                        <Text style={styles.categoryText}>
                            {new Date(claim.created_at).toLocaleDateString()}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const getRenderer = () => {
        if (activeTab === 'reports') return renderReportItem;
        if (activeTab === 'matches') return renderMatchItem;
        return renderClaimItem;
    };

    const getData = () => {
        if (activeTab === 'reports') return reports;
        if (activeTab === 'matches') return matches;
        return claims;
    };

    return (
        <View style={styles.container}>
            {renderHeader()}
            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" /></View>
            ) : (
                <FlatList
                    data={getData()}
                    keyExtractor={i => i.id.toString()}
                    renderItem={getRenderer()}
                    contentContainerStyle={{ padding: 15 }}
                    ListEmptyComponent={<Text style={styles.emptyText}>No {activeTab} found.</Text>}
                />
            )}
            {/* Electronics Picker Modal */}
            <Modal transparent visible={showElectronicsPicker} animationType="slide" onRequestClose={() => setShowElectronicsPicker(false)}>
                <Pressable style={styles.modalOverlay} onPress={() => setShowElectronicsPicker(false)}>
                    <View style={styles.modalSheet}>
                        <Text style={styles.modalTitle}>Select Electronic Type</Text>
                        {ELECTRONIC_TYPES.map(et => (
                            <TouchableOpacity key={et.key} style={styles.modalOption} onPress={() => handleElectronicSelect(et.key)}>
                                <Text style={styles.modalOptionIcon}>{et.icon}</Text>
                                <Text style={styles.modalOptionText}>{et.label}</Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.modalCancel} onPress={() => setShowElectronicsPicker(false)}>
                            <Text style={styles.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>

            <TouchableOpacity style={styles.fab} onPress={() => {
                Alert.alert(
                    'Report Lost or Found',
                    'What type of item?',
                    [
                        { text: 'General Item', onPress: () => navigation.navigate('AddItem') },
                        { text: 'Electronics', onPress: () => setShowElectronicsPicker(true) },
                        { text: 'Cancel', style: 'cancel' },
                    ],
                    { cancelable: true }
                );
            }}>
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f2f6' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { padding: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    tabRow: { flexDirection: 'row', gap: 6 },
    tabBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#f1f2f6' },
    activeTab: { backgroundColor: '#2f3640' },
    tabText: { color: '#7f8fa6', fontWeight: 'bold', fontSize: 13 },
    activeText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    bellBtn: { position: 'relative', padding: 6 },
    bellIcon: { fontSize: 22 },
    notifBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: '#e74c3c', borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
    notifBadgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    profileBtn: { paddingVertical: 8, paddingHorizontal: 15, backgroundColor: '#3498db', borderRadius: 8 },
    profileText: { color: '#fff', fontWeight: 'bold' },
    card: { backgroundColor: '#fff', borderRadius: 10, marginVertical: 8, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3 },
    cardImage: { width: '100%', height: 180, resizeMode: 'cover' },
    cardBody: { padding: 15 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#2f3640', marginBottom: 8 },
    matchScore: { fontSize: 14, color: COLORS.primary, fontWeight: 'bold', marginBottom: 8 },
    statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden', fontWeight: 'bold', fontSize: 12, color: '#fff' },
    lostBadge: { backgroundColor: '#e84118' },
    foundBadge: { backgroundColor: '#4cd137' },
    pendingBadge: { backgroundColor: '#f39c12' },
    categoryText: { color: '#3498db', fontSize: 14, fontWeight: 'bold' },
    claimLabel: { color: COLORS.amber, fontSize: 12, fontWeight: '600' },
    claimStatusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    claimStatusText: { fontSize: 12, fontWeight: '600' },
    fab: { position: 'absolute', bottom: 25, right: 25, width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
    fabText: { fontSize: 30, color: '#fff', fontWeight: 'bold' },
    emptyText: { textAlign: 'center', marginTop: 50, color: '#7f8fa6', fontSize: 16 },
    actionRow: { flexDirection: 'row', justifyContent: 'flex-start', marginTop: 15, borderTopWidth: 1, borderColor: '#f1f2f6', paddingTop: 10, gap: 10 },
    editBtn: { backgroundColor: '#f39c12', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 5 },
    deleteBtn: { backgroundColor: '#e74c3c', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 5 },
    actionText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },
    // Electronics picker modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#2f3640', textAlign: 'center', marginBottom: 15 },
    modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 10, borderBottomWidth: 1, borderColor: '#f1f2f6' },
    modalOptionIcon: { fontSize: 24, marginRight: 15 },
    modalOptionText: { fontSize: 16, color: '#2f3640', fontWeight: '500' },
    modalCancel: { marginTop: 15, padding: 14, borderRadius: 10, backgroundColor: '#f1f2f6', alignItems: 'center' },
    modalCancelText: { fontSize: 16, color: '#7f8fa6', fontWeight: 'bold' },
});
