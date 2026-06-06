import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import api, { authApi } from '../../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const COLORS = {
    primary: '#0F6E56',
    primaryLight: '#E1F5EE',
    text: '#1A1A1A',
    gray: '#6B6B6B',
    lightGray: '#E5E5E0',
    bg: '#F8F7F2',
    white: '#ffffff',
    danger: '#ef4444',
    accent: '#3498db',
};

export default function AddItemScreen({ route, navigation }: any) {
    const editItem = route.params?.editItem;

    const [title, setTitle] = useState(editItem?.title || '');
    const [description, setDescription] = useState(editItem?.description || '');
    const [type, setType] = useState(editItem?.item_type || 'LOST');
    const [category, setCategory] = useState(editItem?.category || 'Electronics');
    const [image, setImage] = useState<any>(editItem?.image ? { uri: editItem.image } : null);
    const [loading, setLoading] = useState(false);
    const [location, setLocation] = useState<any>(editItem ? { latitude: parseFloat(editItem.latitude), longitude: parseFloat(editItem.longitude) } : null);

    React.useEffect(() => {
        if (!editItem) {
            (async () => {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    let loc = await Location.getCurrentPositionAsync({});
                    setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                } else {
                    setLocation({ latitude: 37.78825, longitude: -122.4324 });
                }
            })();
        }
    }, []);

    const categories = [
        { key: 'Electronics', icon: 'laptop-outline' },
        { key: 'Pets', icon: 'paw-outline' },
        { key: 'Documents', icon: 'document-outline' },
        { key: 'Bags', icon: 'briefcase-outline' },
        { key: 'Wallet', icon: 'wallet-outline' },
    ];

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });
        if (!result.canceled) {
            setImage(result.assets[0]);
        }
    };

    const handleSubmit = async () => {
        if (!title || !description || !location || !image) {
            Alert.alert('Error', 'Please fill all required fields including title, description, location, and photo.');
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            formData.append('item_type', type);
            formData.append('category', category);
            formData.append('latitude', location.latitude.toFixed(6));
            formData.append('longitude', location.longitude.toFixed(6));

            if (!image.uri.startsWith('http')) {
                const filename = image.uri.split('/').pop();
                const match = /\.(\w+)$/.exec(filename);
                const typeValue = match ? `image/${match[1]}` : `image`;
                formData.append('image', {
                    uri: image.uri,
                    name: filename,
                    type: typeValue
                } as any);
            }

            const method = editItem ? 'PATCH' : 'POST';
            const url = editItem ? `${api.defaults.baseURL}items/${editItem.id}/` : `${api.defaults.baseURL}items/`;

            const token = await AsyncStorage.getItem('access_token');
            const response = await fetch(url, {
                method: method,
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.text();
                console.error("Upload failed:", response.status, errData);
                throw new Error('Upload failed');
            }

            const data = await response.json();

            if (!editItem && type === 'FOUND') {
                // Redirect to verification setup for new found items
                Alert.alert('Item Reported!', 'Now add verification details to help verify the owner.', [
                    { text: 'Add Details', onPress: () => navigation.replace('VerificationSetup', { itemId: data.id }) },
                    { text: 'Skip', style: 'cancel', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Home' }] }) },
                ]);
            } else {
                Alert.alert('Success', editItem ? 'Item updated!' : 'Item reported successfully!');
                navigation.reset({
                    index: 0,
                    routes: [{ name: 'Home' }],
                });
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Could not submit item. Please try again.');
        }
        setLoading(false);
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {/* Item Title */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Item Information</Text>

                <Text style={styles.label}>What did you {type === 'LOST' ? 'lose' : 'find'}? *</Text>
                <View style={styles.inputWrapper}>
                    <Ionicons name="create-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                    <TextInput style={styles.input} placeholder="Title e.g. iPhone 13 Pro" value={title} onChangeText={setTitle} placeholderTextColor="#A0A0A0" />
                </View>

                {/* Type Toggle */}
                <Text style={styles.label}>Report Type</Text>
                <View style={styles.typeRow}>
                    <TouchableOpacity style={[styles.typeBtn, type === 'LOST' && styles.activeLost]} onPress={() => setType('LOST')}>
                        <Ionicons name="search-outline" size={16} color={type === 'LOST' ? '#fff' : COLORS.gray} style={{ marginRight: 6 }} />
                        <Text style={[styles.typeText, type === 'LOST' && styles.activeTypeText]}>I Lost It</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.typeBtn, type === 'FOUND' && styles.activeFound]} onPress={() => setType('FOUND')}>
                        <Ionicons name="checkmark-circle-outline" size={16} color={type === 'FOUND' ? '#fff' : COLORS.gray} style={{ marginRight: 6 }} />
                        <Text style={[styles.typeText, type === 'FOUND' && styles.activeTypeText]}>I Found It</Text>
                    </TouchableOpacity>
                </View>

                {/* Category */}
                <Text style={styles.label}>Category</Text>
                <View style={styles.categoryContainer}>
                    {categories.map(cat => (
                        <TouchableOpacity key={cat.key} style={[styles.catBtn, category === cat.key && styles.activeCat]} onPress={() => setCategory(cat.key)}>
                            <Ionicons name={cat.icon as any} size={14} color={category === cat.key ? '#fff' : COLORS.gray} style={{ marginRight: 4 }} />
                            <Text style={category === cat.key ? styles.activeCatText : styles.catText}>{cat.key}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Description */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Description</Text>
                <View style={[styles.inputWrapper, { height: 110, alignItems: 'flex-start', paddingTop: 10 }]}>
                    <Ionicons name="document-text-outline" size={18} color={COLORS.gray} style={[styles.inputIcon, { marginTop: 4 }]} />
                    <TextInput style={[styles.input, { height: 90, textAlignVertical: 'top' }]} placeholder="Provide details like color, brand, condition..." value={description} onChangeText={setDescription} multiline numberOfLines={4} placeholderTextColor="#A0A0A0" />
                </View>
            </View>

            {/* Location */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Pin Location</Text>
                <Text style={styles.hintText}>Drag the map to pin the exact location</Text>
                <View style={styles.mapContainer}>
                    {location ? (
                        <MapView
                            style={styles.map}
                            initialRegion={{
                                latitude: location.latitude,
                                longitude: location.longitude,
                                latitudeDelta: 0.005,
                                longitudeDelta: 0.005,
                            }}
                            showsUserLocation={true}
                            onRegionChangeComplete={(r) => setLocation({ latitude: r.latitude, longitude: r.longitude })}
                        />
                    ) : (
                        <ActivityIndicator size="large" style={{ marginTop: 80 }} color={COLORS.primary} />
                    )}
                    {location && (
                        <View style={styles.fixedMarker} pointerEvents="none">
                            <Ionicons name="location" size={36} color={COLORS.danger} />
                        </View>
                    )}
                </View>
            </View>

            {/* Photo */}
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Item Photo *</Text>
                <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                    {image ? (
                        <Image source={{ uri: image.uri }} style={styles.preview} />
                    ) : (
                        <View style={styles.imagePickerInner}>
                            <Ionicons name="cloud-upload-outline" size={38} color={COLORS.primary} style={{ marginBottom: 8 }} />
                            <Text style={styles.imagePickerText}>Select Photo from Gallery</Text>
                            <Text style={styles.imagePickerSubText}>Supports JPG, PNG formats</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Submit */}
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
                <LinearGradient colors={['#0F6E56', '#128C7E']} style={styles.submitGradient}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{editItem ? 'Save Changes' : 'Report Item'}</Text>}
                </LinearGradient>
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    card: { backgroundColor: COLORS.white, margin: 14, marginBottom: 6, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#F0F0ED', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
    cardTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text, marginBottom: 14 },
    label: { fontSize: 13, fontWeight: '700', color: COLORS.text, marginTop: 10, marginBottom: 8 },
    
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0ED', borderWidth: 1, borderColor: COLORS.lightGray, borderRadius: 12, paddingHorizontal: 12, overflow: 'hidden' },
    inputIcon: { marginRight: 8 },
    input: { flex: 1, height: 48, color: COLORS.text, fontSize: 15, fontWeight: '500' },
    
    typeRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
    typeBtn: { flex: 1, flexDirection: 'row', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },
    activeLost: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
    activeFound: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    typeText: { fontWeight: '700', color: COLORS.gray, fontSize: 14 },
    activeTypeText: { color: '#fff' },
    
    categoryContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    catBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, backgroundColor: '#F0F0ED', borderWidth: 1, borderColor: COLORS.lightGray },
    activeCat: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
    catText: { color: COLORS.gray, fontWeight: '600', fontSize: 13 },
    activeCatText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    
    hintText: { fontSize: 13, color: COLORS.gray, marginBottom: 10, fontWeight: '500' },
    mapContainer: { height: 200, width: '100%', borderRadius: 14, overflow: 'hidden', backgroundColor: '#F0F0ED' },
    map: { flex: 1 },
    fixedMarker: { position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -36 },
    
    imagePicker: { height: 160, backgroundColor: '#F0F0ED', borderRadius: 14, borderStyle: 'dashed', borderWidth: 2, borderColor: COLORS.lightGray, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    imagePickerInner: { alignItems: 'center' },
    imagePickerText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
    imagePickerSubText: { color: COLORS.gray, fontSize: 11, marginTop: 3 },
    preview: { width: '100%', height: '100%', resizeMode: 'cover' },
    
    submitBtn: { marginHorizontal: 14, marginTop: 14, borderRadius: 14, overflow: 'hidden', elevation: 3, shadowColor: '#0F6E56', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5 },
    submitGradient: { paddingVertical: 17, alignItems: 'center', justifyContent: 'center' },
    submitText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
