import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import FindlyLogo from '../components/FindlyLogo';

export default function SplashLoading() {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.92)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 900,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 40,
                friction: 7,
                useNativeDriver: true,
            })
        ]).start();
    }, []);

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
                <FindlyLogo size={150} />
                <Text style={styles.title}>Findly</Text>
                <Text style={styles.subtitle}>Lost it. Found it. Reconnected.</Text>
            </Animated.View>
            <View style={styles.loaderContainer}>
                <ActivityIndicator size="small" color="#0F6E56" style={{ marginBottom: 12 }} />
                <Text style={styles.loadingText}>Loading Findly Services...</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F7F2',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 80,
    },
    title: {
        fontSize: 34,
        fontWeight: '900',
        color: '#0F6E56',
        marginTop: 20,
        letterSpacing: 1.5,
    },
    subtitle: {
        fontSize: 14,
        color: '#6B6B6B',
        marginTop: 8,
        fontWeight: '600',
        textAlign: 'center',
    },
    loaderContainer: {
        position: 'absolute',
        bottom: 60,
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 12,
        color: '#8A8A85',
        fontWeight: '600',
        letterSpacing: 0.5,
        textAlign: 'center',
    },
});
