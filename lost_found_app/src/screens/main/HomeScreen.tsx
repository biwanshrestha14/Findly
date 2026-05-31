import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Modal, Pressable, ScrollView, Alert } from 'react-native';
import api, { getNotifications, getMyClaims, MEDIA_BASE, getProfile } from '../../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const COLORS = {
    primary: '#0F6E56',
    primaryLight: '#E1F5EE',
    accent: '#3498db',
    text: '#1A1A1A',
    gray: '#6B6B6B',
    lightGray: '#E5E5E0',
    bg: '#F8F7F2',
    white: '#ffffff',
    danger: '#ef4444',
    dangerLight: '#FFEBEE',
    success: '#0F6E56',
    successLight: '#E8F5E9',
    amber: '#BA7517',
    amberLight: '#FAEEDA',
};

const CLAIM_STATUS_STYLE: Record<string, { color: string; bg: string }> = {
    PENDING_REVIEW: { color: COLORS.amber, bg: COLORS.amberLight },
    APPROVED: { color: COLORS.success, bg: COLORS.successLight },
    REJECTED: { color: COLORS.danger, bg: COLORS.dangerLight },
    INFO_REQUESTED: { color: COLORS.amber, bg: COLORS.amberLight },
};

export default function HomeScreen({ navigation }: any) {
    const [reports, setReports] = useState<any[]>([]);
    const [matches, setMatches] = useState<any[]>([]);
    const [claims, setClaims] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'reports' | 'matches' | 'claims'>('reports');
    const [currentUsername, setCurrentUsername] = useState('');
    const [profilePicture, setProfilePicture] = useState<string | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);

    // Modern Modal Stepper states
    const [showModal, setShowModal] = useState(false);
    const [modalStep, setModalStep] = useState<'select_type' | 'select_electronic' | 'select_action'>('select_type');
    const [selectedType, setSelectedType] = useState<'general' | 'electronic'>('general');
    const [selectedElectronicCategory, setSelectedElectronicCategory] = useState<string | null>(null);

    const ELECTRONIC_TYPES = [
        { key: 'mobile_phone', label: 'Mobile Phone', icon: 'phone-portrait-outline', color: '#0F6E56' },
        { key: 'laptop', label: 'Laptop', icon: 'laptop-outline', color: '#3498db' },
        { key: 'tablet', label: 'Tablet', icon: 'tablet-portrait-outline', color: '#9b59b6' },
        { key: 'earbuds', label: 'Earbuds', icon: 'headset-outline', color: '#e67e22' },
        { key: 'smartwatch', label: 'Smartwatch', icon: 'watch-outline', color: '#e74c3c' },
        { key: 'camera', label: 'Camera', icon: 'camera-outline', color: '#1abc9c' },
        { key: 'accessories', label: 'Accessories', icon: 'extension-puzzle-outline', color: '#7f8fa6' },
    ];

    const handleSelectType = (type: 'general' | 'electronic') => {
        setSelectedType(type);
        if (type === 'general') {
            setModalStep('select_action');
        } else {
            setModalStep('select_electronic');
        }
    };

    const handleSelectElectronic = (eType: string) => {
        setSelectedElectronicCategory(eType);
        setModalStep('select_action');
    };

    const handleSelectAction = (action: 'LOST' | 'FOUND') => {
        setShowModal(false);
        if (selectedType === 'general') {
            navigation.navigate('AddItem', { type: action });
        } else {
            navigation.navigate('AddElectronic', { electronicType: selectedElectronicCategory, type: action });
        }
    };

    const resetModal = () => {
        setModalStep('select_type');
        setSelectedType('general');
        setSelectedElectronicCategory(null);
    };

    const handleDelete = (id: number) => {
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
                const profileData = await getProfile();
                if (profileData && profileData.profile_picture) {
                    setProfilePicture(profileData.profile_picture);
                }
            } catch (_) {}

            try {
                const notifs = await getNotifications();
                setUnreadCount(notifs.filter((n: any) => !n.is_read).length);
            } catch (_) {}
        } catch (error) {
            console.error(error);
        }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, [activeTab]);

    useEffect(() => {
        const unsub = navigation.addListener('focus', fetchData);
        return unsub;
    }, [navigation, activeTab]);

    const renderHeader = () => {
        const photoUri = profilePicture
            ? (profilePicture.startsWith('http') ? profilePicture : `${MEDIA_BASE}${profilePicture}`)
            : null;

        return (
            <View style={styles.headerContainer}>
                <View style={styles.topHeader}>
                    <View>
                        <Text style={styles.greetingText}>Hello, {currentUsername || 'User'}</Text>
                        <Text style={styles.headerSubtitle}>Manage your lost & found reports</Text>
                    </View>
                    <View style={styles.headerActions}>
                        <TouchableOpacity style={styles.bellBtn} onPress={() => navigation.navigate('Notifications')}>
                            <Ionicons name="notifications-outline" size={24} color="#1A1A1A" />
                            {unreadCount > 0 && (
                                <View style={styles.notifBadge}>
                                    <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        
                        <TouchableOpacity style={styles.avatarButton} onPress={() => navigation.navigate('Profile')}>
                            {photoUri ? (
                                <Image source={{ uri: photoUri }} style={styles.headerAvatar} />
                            ) : (
                                <View style={styles.headerAvatarPlaceholder}>
                                    <Text style={styles.headerAvatarText}>
                                        {(currentUsername || '?').charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* capsule Tab Selector */}
                <View style={styles.tabContainer}>
                    {(['reports', 'matches', 'claims'] as const).map(tab => (
                        <TouchableOpacity key={tab} style={[styles.tabBtn, activeTab === tab && styles.activeTab]} onPress={() => setActiveTab(tab)}>
                            <Text style={activeTab === tab ? styles.activeText : styles.tabText}>
                                {tab === 'reports' ? 'My Posts' : tab === 'matches' ? 'Matches' : 'Claims'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        );
    };

    const renderReportItem = ({ item }: any) => {
        const isLost = item.item_type === 'LOST';
        const imgUri = item.image
            ? (item.image.startsWith('http') ? item.image : `${MEDIA_BASE}${item.image}`)
            : null;
        
        return (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ItemDetail', { item })}>
                {imgUri ? (
                    <Image source={{ uri: imgUri }} style={styles.cardImage} />
                ) : (
                    <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                        <Ionicons name="image-outline" size={32} color="#ABABAB" />
                    </View>
                )}
                <View style={styles.cardBody}>
                    <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                        <View style={[styles.badge, isLost ? styles.lostBadge : styles.foundBadge]}>
                            <Text style={isLost ? styles.lostBadgeText : styles.foundBadgeText}>
                                {isLost ? 'Lost' : 'Found'}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
                    
                    <View style={styles.cardFooter}>
                        <View style={styles.categoryBadge}>
                            <Text style={styles.categoryText}>{item.category}</Text>
                        </View>
                        {item.status === 'ACTIVE' && (
                            <View style={styles.cardActions}>
                                <TouchableOpacity style={styles.actionIconBtn} onPress={() => navigation.navigate('AddItem', { editItem: item })}>
                                    <Ionicons name="create-outline" size={18} color={COLORS.accent} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.actionIconBtn} onPress={() => handleDelete(item.id)}>
                                    <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderMatchItem = ({ item: match }: any) => {
        const isOriginalOwner = match.item.user.username === currentUsername;
        const otherItem = isOriginalOwner ? match.matched_item : match.item;
        const myItem = isOriginalOwner ? match.item : match.matched_item;
        const imgUri = otherItem.image
            ? (otherItem.image.startsWith('http') ? otherItem.image : `${MEDIA_BASE}${otherItem.image}`)
            : null;

        return (
            <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('ItemDetail', { item: otherItem, matchId: match.id, matchResult: match })}>
                {imgUri ? (
                    <Image source={{ uri: imgUri }} style={styles.cardImage} />
                ) : (
                    <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                        <Ionicons name="image-outline" size={32} color="#ABABAB" />
                    </View>
                )}
                <View style={styles.cardBody}>
                    <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{otherItem.title}</Text>
                        <View style={styles.matchScoreBadge}>
                            <Text style={styles.matchScoreText}>{(match.score * 100).toFixed(0)}% Match</Text>
                        </View>
                    </View>
                    <Text style={styles.cardDesc} numberOfLines={1}>Matched against your: {myItem.title}</Text>
                    <View style={styles.cardFooter}>
                        <View style={styles.categoryBadge}>
                            <Text style={styles.categoryText}>{otherItem.category}</Text>
                        </View>
                        <View style={[styles.badge, match.status === 'matched' ? styles.foundBadge : styles.pendingBadge]}>
                            <Text style={match.status === 'matched' ? styles.foundBadgeText : styles.pendingBadgeText}>{match.status}</Text>
                        </View>
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
                {imgUri ? (
                    <Image source={{ uri: imgUri }} style={styles.cardImage} />
                ) : (
                    <View style={[styles.cardImage, styles.cardImagePlaceholder]}>
                        <Ionicons name="image-outline" size={32} color="#ABABAB" />
                    </View>
                )}
                <View style={styles.cardBody}>
                    <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{foundItem?.title || 'Unknown Item'}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                            <Text style={[styles.statusBadgeText, { color: st.color }]}>
                                {claim.status.replace(/_/g, ' ')}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.cardDesc} numberOfLines={1}>Claim request submitted</Text>
                    <View style={styles.cardFooter}>
                        <Text style={styles.dateText}>Filed on: {new Date(claim.created_at).toLocaleDateString()}</Text>
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
                <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
            ) : (
                <FlatList
                    data={getData()}
                    keyExtractor={i => i.id.toString()}
                    renderItem={getRenderer()}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListEmptyComponent={<Text style={styles.emptyText}>No {activeTab} found.</Text>}
                />
            )}

            {/* Stepper bottom-sheet Modal */}
            <Modal transparent visible={showModal} animationType="slide" onRequestClose={() => { setShowModal(false); resetModal(); }}>
                <Pressable style={styles.modalOverlay} onPress={() => { setShowModal(false); resetModal(); }}>
                    <View style={styles.modalSheet}>
                        <View style={styles.modalHeaderIndicator} />

                        {modalStep === 'select_type' && (
                            <View>
                                <Text style={styles.modalTitle}>Report Item</Text>
                                <Text style={styles.modalSubTitle}>Choose the category of item you want to report</Text>

                                <TouchableOpacity style={styles.stepperCard} onPress={() => handleSelectType('general')}>
                                    <View style={[styles.stepperIconBg, { backgroundColor: COLORS.accent + '15' }]}>
                                        <Ionicons name="cube-outline" size={24} color={COLORS.accent} />
                                    </View>
                                    <View style={styles.stepperCardContent}>
                                        <Text style={styles.stepperCardTitle}>General Item</Text>
                                        <Text style={styles.stepperCardDesc}>Keys, wallets, bags, documents, etc.</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color="#bdc3c7" />
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.stepperCard} onPress={() => handleSelectType('electronic')}>
                                    <View style={[styles.stepperIconBg, { backgroundColor: COLORS.primary + '15' }]}>
                                        <Ionicons name="laptop-outline" size={24} color={COLORS.primary} />
                                    </View>
                                    <View style={styles.stepperCardContent}>
                                        <Text style={styles.stepperCardTitle}>Electronic Device</Text>
                                        <Text style={styles.stepperCardDesc}>Mobiles, laptops, watches, earbuds, etc.</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={18} color="#bdc3c7" />
                                </TouchableOpacity>
                            </View>
                        )}

                        {modalStep === 'select_electronic' && (
                            <View>
                                <Text style={styles.modalTitle}>Select Device Type</Text>
                                <Text style={styles.modalSubTitle}>Choose the category that matches your device</Text>

                                <ScrollView style={{ maxHeight: 300 }}>
                                    <View style={styles.optionsContainer}>
                                        {ELECTRONIC_TYPES.map(et => (
                                            <TouchableOpacity key={et.key} style={styles.modalOption} onPress={() => handleSelectElectronic(et.key)}>
                                                <View style={[styles.iconWrapper, { backgroundColor: et.color + '15' }]}>
                                                    <Ionicons name={et.icon as any} size={20} color={et.color} />
                                                </View>
                                                <Text style={styles.modalOptionText}>{et.label}</Text>
                                                <Ionicons name="chevron-forward" size={18} color="#bdc3c7" style={{ marginLeft: 'auto' }} />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>

                                <TouchableOpacity style={styles.modalBack} onPress={() => setModalStep('select_type')}>
                                    <Text style={styles.modalBackText}>Back</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {modalStep === 'select_action' && (
                            <View>
                                <Text style={styles.modalTitle}>Report Status</Text>
                                <Text style={styles.modalSubTitle}>Is this device lost or did you find it?</Text>

                                <View style={styles.stepperRow}>
                                    <TouchableOpacity style={[styles.choiceActionCard, { borderColor: COLORS.danger }]} onPress={() => handleSelectAction('LOST')}>
                                        <LinearGradient colors={['#FFECEC', '#FFF0F0']} style={styles.choiceGradient}>
                                            <View style={[styles.actionIconBg, { backgroundColor: COLORS.danger + '15' }]}>
                                                <Ionicons name="search-outline" size={28} color={COLORS.danger} />
                                            </View>
                                            <Text style={[styles.choiceTitle, { color: COLORS.danger }]}>I Lost It</Text>
                                            <Text style={styles.choiceDesc}>Create a lost report to search found items</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={[styles.choiceActionCard, { borderColor: COLORS.success }]} onPress={() => handleSelectAction('FOUND')}>
                                        <LinearGradient colors={['#EFFEF8', '#E6FAF2']} style={styles.choiceGradient}>
                                            <View style={[styles.actionIconBg, { backgroundColor: COLORS.success + '15' }]}>
                                                <Ionicons name="checkmark-circle-outline" size={28} color={COLORS.success} />
                                            </View>
                                            <Text style={[styles.choiceTitle, { color: COLORS.success }]}>I Found It</Text>
                                            <Text style={styles.choiceDesc}>Create a found report to match owners</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity style={styles.modalBack} onPress={() => {
                                    if (selectedType === 'general') {
                                        setModalStep('select_type');
                                    } else {
                                        setModalStep('select_electronic');
                                    }
                                }}>
                                    <Text style={styles.modalBackText}>Back</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </Pressable>
            </Modal>

            <TouchableOpacity style={styles.fab} onPress={() => { resetModal(); setShowModal(true); }}>
                <LinearGradient colors={['#0F6E56', '#128C7E']} style={styles.fabGradient}>
                    <Ionicons name="add" size={32} color="#fff" />
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    // Header
    headerContainer: { backgroundColor: COLORS.white, paddingBottom: 10, borderBottomWidth: 1, borderColor: COLORS.lightGray },
    topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
    greetingText: { fontSize: 20, fontWeight: '800', color: COLORS.text },
    headerSubtitle: { fontSize: 13, color: COLORS.gray, fontWeight: '500', marginTop: 2 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    bellBtn: { padding: 6, position: 'relative' },
    notifBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: COLORS.danger, borderRadius: 9, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3 },
    notifBadgeText: { color: COLORS.white, fontSize: 9, fontWeight: 'bold' },
    avatarButton: { width: 38, height: 38, borderRadius: 19, overflow: 'hidden' },
    headerAvatar: { width: '100%', height: '100%' },
    headerAvatarPlaceholder: { width: '100%', height: '100%', backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
    headerAvatarText: { color: COLORS.white, fontWeight: 'bold', fontSize: 16 },

    // Tabs
    tabContainer: { flexDirection: 'row', backgroundColor: '#EBEBE6', borderRadius: 24, padding: 4, marginHorizontal: 16, marginTop: 12, marginBottom: 8 },
    tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    activeTab: { backgroundColor: COLORS.white, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    tabText: { color: COLORS.gray, fontWeight: '700', fontSize: 13 },
    activeText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 13 },

    // Card Layout
    card: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 16, marginHorizontal: 16, marginVertical: 6, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: '#F0F0ED' },
    cardImage: { width: 84, height: 84, borderRadius: 12, marginRight: 12, backgroundColor: '#F0F0ED' },
    cardImagePlaceholder: { justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E5E0', borderStyle: 'dashed' },
    cardBody: { flex: 1, justifyContent: 'space-between' },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 },
    cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
    cardDesc: { fontSize: 13, color: COLORS.gray, lineHeight: 18, marginVertical: 4 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
    categoryBadge: { backgroundColor: '#F0F0ED', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    categoryText: { color: COLORS.primary, fontSize: 11, fontWeight: '700' },
    cardActions: { flexDirection: 'row', gap: 12 },
    actionIconBtn: { padding: 4 },
    
    // Badges
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badgeText: { fontSize: 11, fontWeight: 'bold' },
    lostBadge: { backgroundColor: COLORS.dangerLight },
    lostBadgeText: { color: COLORS.danger, fontSize: 11, fontWeight: '800' },
    foundBadge: { backgroundColor: COLORS.successLight },
    foundBadgeText: { color: COLORS.success, fontSize: 11, fontWeight: '800' },
    pendingBadge: { backgroundColor: COLORS.amberLight },
    pendingBadgeText: { color: COLORS.amber, fontSize: 11, fontWeight: '800' },
    matchScoreBadge: { backgroundColor: '#EBF4FC', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    matchScoreText: { color: COLORS.accent, fontSize: 11, fontWeight: '800' },
    claimSubmittedText: { color: COLORS.amber, fontSize: 12, fontWeight: '700' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    statusBadgeText: { fontSize: 11, fontWeight: '700' },
    dateText: { fontSize: 11, color: COLORS.gray, fontWeight: '600' },
    matchStatusBadge: { fontSize: 11, color: COLORS.primary, fontWeight: '700', textTransform: 'capitalize' },

    fab: { position: 'absolute', bottom: 25, right: 25, width: 56, height: 56, borderRadius: 28, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 4 },
    fabGradient: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    emptyText: { textAlign: 'center', marginTop: 60, color: COLORS.gray, fontSize: 15, fontWeight: '600' },

    // Stepper bottom-sheet Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 20 },
    modalHeaderIndicator: { width: 40, height: 5, backgroundColor: COLORS.lightGray, borderRadius: 3, alignSelf: 'center', marginBottom: 18 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.text, textAlign: 'center' },
    modalSubTitle: { fontSize: 13, color: COLORS.gray, textAlign: 'center', marginTop: 6, marginBottom: 24, fontWeight: '500', lineHeight: 18 },
    
    stepperCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F7F2', borderWidth: 1, borderColor: COLORS.lightGray, borderRadius: 16, padding: 14, marginBottom: 12 },
    stepperIconBg: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    stepperCardContent: { flex: 1 },
    stepperCardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
    stepperCardDesc: { fontSize: 12, color: COLORS.gray, marginTop: 2, fontWeight: '500' },

    optionsContainer: { backgroundColor: '#F8F7F2', borderRadius: 16, padding: 6, borderWidth: 1, borderColor: COLORS.lightGray },
    modalOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 1, borderColor: '#E5E5E080' },
    iconWrapper: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    modalOptionText: { fontSize: 15, color: COLORS.text, fontWeight: '700' },
    modalBack: { marginTop: 16, padding: 15, borderRadius: 12, backgroundColor: '#F0F0ED', alignItems: 'center' },
    modalBackText: { fontSize: 15, color: COLORS.gray, fontWeight: '700' },

    stepperRow: { flexDirection: 'row', gap: 12, marginVertical: 8 },
    choiceActionCard: { flex: 1, height: 160, borderRadius: 18, overflow: 'hidden', borderWidth: 1.5 },
    choiceGradient: { flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center' },
    actionIconBg: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    choiceTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
    choiceDesc: { fontSize: 11, color: COLORS.gray, textAlign: 'center', fontWeight: '500', lineHeight: 15 },
});
