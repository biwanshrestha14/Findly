import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    SafeAreaView, Animated, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getNotifications, markNotificationRead } from '../../api';

const COLORS = {
    primary: '#0F6E56',
    primaryLight: '#E2F3EC',
    bg: '#F8FAFC',
    card: '#FFFFFF',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    accent: '#059669',
    border: '#E2E8F0',
};

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

const NotificationItem = ({ item, onPress }: { item: any, onPress: () => void }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.97,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 4,
            useNativeDriver: true,
        }).start();
    };

    const confidence = item.match ? `${(item.match.score * 100).toFixed(0)}%` : null;

    return (
        <Animated.View style={[styles.cardWrapper, { transform: [{ scale: scaleAnim }] }]}>
            <TouchableOpacity
                style={styles.card}
                activeOpacity={1}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={onPress}
            >
                <View style={styles.cardIndicator} />
                <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="sparkles" size={20} color={COLORS.primary} />
                        </View>
                        <Text style={styles.timeAgo}>{timeAgo(item.created_at)}</Text>
                    </View>
                    <Text style={styles.message}>{item.message}</Text>
                    
                    {confidence && (
                        <View style={styles.confidenceRow}>
                            <View style={styles.confidenceBadge}>
                                <Ionicons name="analytics-outline" size={14} color={COLORS.accent} style={{ marginRight: 6 }} />
                                <Text style={styles.confidenceText}>{confidence} Match</Text>
                            </View>
                        </View>
                    )}
                    
                    {item.match && (
                        <View style={styles.reviewBtn}>
                            <Text style={styles.reviewBtnText}>Review Details</Text>
                            <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

export default function NotificationScreen({ navigation }: any) {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getNotifications();
            setNotifications(data);
        } catch (e) {
            console.error('Failed to fetch notifications:', e);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, []);

    useEffect(() => {
        const unsub = navigation.addListener('focus', fetchNotifications);
        return unsub;
    }, [navigation]);

    const handlePress = async (notif: any) => {
        try {
            await markNotificationRead(notif.id);
        } catch (e) { /* ignore */ }

        if (notif.match) {
            const otherItem = notif.match.matched_item;
            navigation.navigate('ItemDetail', {
                item: otherItem,
                matchId: notif.match.id,
                matchResult: notif.match,
            });
        } else {
            // Re-fetch to update read status visually if no match
            fetchNotifications();
        }
    };

    const renderSkeleton = () => (
        <View style={styles.skeletonContainer}>
            {[1, 2, 3, 4].map(i => (
                <View key={i} style={styles.skeletonCard}>
                    <View style={styles.skeletonHeader}>
                        <View style={styles.skeletonAvatar} />
                        <View style={[styles.skeletonLine, { width: 40 }]} />
                    </View>
                    <View style={[styles.skeletonLine, { width: '85%', marginBottom: 8 }]} />
                    <View style={[styles.skeletonLine, { width: '60%' }]} />
                </View>
            ))}
        </View>
    );

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
                <Ionicons name="sparkles" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>You're all caught up!</Text>
            <Text style={styles.emptySubtitle}>
                We'll notify you the moment a new match is found or an update occurs.
            </Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
            <View style={styles.headerBar}>
                <Text style={styles.headerTitle}>Updates</Text>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{notifications.length}</Text>
                </View>
            </View>
            {loading ? renderSkeleton() : (
                <FlatList
                    data={notifications}
                    keyExtractor={i => i.id.toString()}
                    renderItem={({ item }) => (
                        <NotificationItem item={item} onPress={() => handlePress(item)} />
                    )}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={renderEmpty}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    headerBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 24,
    },
    headerTitle: { 
        fontSize: 32, 
        fontWeight: '700', 
        color: COLORS.textPrimary,
        letterSpacing: -0.5,
    },
    badge: {
        backgroundColor: COLORS.primaryLight,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    badgeText: {
        color: COLORS.primary,
        fontSize: 14,
        fontWeight: '700',
    },
    listContent: { 
        paddingHorizontal: 20, 
        paddingBottom: 40 
    },
    cardWrapper: {
        marginBottom: 16,
    },
    card: {
        backgroundColor: COLORS.card,
        borderRadius: 24,
        flexDirection: 'row',
        overflow: 'hidden',
        shadowColor: '#64748B',
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cardIndicator: {
        width: 4,
        backgroundColor: COLORS.primary,
    },
    cardContent: {
        flex: 1,
        padding: 20,
    },
    cardHeader: {
        flexDirection: 'row', 
        justifyContent: 'space-between',
        alignItems: 'center', 
        marginBottom: 12,
    },
    iconCircle: {
        width: 44, 
        height: 44, 
        borderRadius: 22,
        backgroundColor: COLORS.primaryLight, 
        justifyContent: 'center', 
        alignItems: 'center',
    },
    iconText: { fontSize: 20 },
    timeAgo: { 
        fontSize: 13, 
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    message: { 
        fontSize: 16, 
        color: COLORS.textPrimary, 
        lineHeight: 24, 
        marginBottom: 16,
        fontWeight: '500',
    },
    confidenceRow: { 
        flexDirection: 'row', 
        marginBottom: 16 
    },
    confidenceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0FDF4', 
        paddingHorizontal: 12, 
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#DCFCE7',
    },
    confidenceIcon: {
        fontSize: 14,
        marginRight: 6,
    },
    confidenceText: { 
        color: COLORS.accent, 
        fontSize: 13, 
        fontWeight: '700' 
    },
    reviewBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.bg,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 16,
    },
    reviewBtnText: { 
        color: COLORS.textPrimary, 
        fontSize: 14, 
        fontWeight: '600' 
    },
    reviewBtnArrow: {
        color: COLORS.primary,
        fontSize: 18,
        fontWeight: '600',
    },
    emptyContainer: { 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        paddingTop: 100,
        paddingHorizontal: 32,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: COLORS.card,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        shadowColor: '#64748B',
        shadowOpacity: 0.1,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 10 },
        elevation: 5,
    },
    emptyIcon: { fontSize: 32 },
    emptyTitle: { 
        fontSize: 22, 
        fontWeight: '700', 
        color: COLORS.textPrimary, 
        marginBottom: 12,
        textAlign: 'center',
    },
    emptySubtitle: { 
        fontSize: 15, 
        color: COLORS.textSecondary, 
        textAlign: 'center', 
        lineHeight: 22,
    },
    skeletonContainer: { paddingHorizontal: 20 },
    skeletonCard: {
        backgroundColor: COLORS.card, 
        borderRadius: 24, 
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    skeletonHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    skeletonAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: COLORS.border,
    },
    skeletonLine: {
        height: 12, 
        borderRadius: 6, 
        backgroundColor: COLORS.border,
    },
});
