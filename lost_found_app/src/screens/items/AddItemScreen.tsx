import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Image, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import api, { authApi } from '../../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

    const categories = ['Electronics', 'Pets', 'Documents', 'Bags', 'Wallet'];

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
                    { text: 'Skip', style: 'cancel', onPress: () => navigation.navigate('Home') },
                ]);
            } else {
                Alert.alert('Success', editItem ? 'Item updated!' : 'Item reported successfully!');
                navigation.navigate('Home');
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Could not submit item. Please try again.');
        }
        setLoading(false);
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={styles.label}>What did you {type === 'LOST' ? 'lose' : 'find'}?</Text>
            <TextInput style={styles.input} placeholder="Title e.g. iPhone 13 Pro" value={title} onChangeText={setTitle} />

            <View style={styles.row}>
                <TouchableOpacity style={[styles.typeBtn, type === 'LOST' && styles.activeLost]} onPress={() => setType('LOST')}>
                    <Text style={[styles.typeText, type === 'LOST' && styles.activeText]}>I Lost It</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.typeBtn, type === 'FOUND' && styles.activeFound]} onPress={() => setType('FOUND')}>
                    <Text style={[styles.typeText, type === 'FOUND' && styles.activeText]}>I Found It</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryContainer}>
                {categories.map(cat => (
                    <TouchableOpacity key={cat} style={[styles.catBtn, category === cat && styles.activeCat]} onPress={() => setCategory(cat)}>
                        <Text style={category === cat ? styles.activeText : styles.catText}>{cat}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Provide details like color, brand, condition..." value={description} onChangeText={setDescription} multiline numberOfLines={4} />

            <Text style={styles.label}>Location</Text>
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
                    <ActivityIndicator size="large" style={{ marginTop: 80 }} />
                )}
                {location && (
                    <View style={styles.fixedMarker} pointerEvents="none">
                        <Text style={styles.markerEmoji}>📍</Text>
                    </View>
                )}
            </View>

            <Text style={styles.label}>Add Item Photo</Text>
            <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                {image ? <Image source={{ uri: image.uri }} style={styles.preview} /> : <Text style={styles.imagePickerText}>Tap to select item image</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{editItem ? 'Save Changes' : 'Report Item'}</Text>}
            </TouchableOpacity>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f6fa', padding: 20 },
    label: { fontSize: 16, fontWeight: 'bold', color: '#2f3640', marginTop: 15, marginBottom: 8 },
    input: { backgroundColor: '#fff', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#dcdde1', marginBottom: 10 },
    textArea: { height: 100, textAlignVertical: 'top' },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    typeBtn: { flex: 1, padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#dcdde1', alignItems: 'center', marginHorizontal: 5 },
    activeLost: { backgroundColor: '#e84118', borderColor: '#e84118' },
    activeFound: { backgroundColor: '#4cd137', borderColor: '#4cd137' },
    typeText: { fontWeight: 'bold', color: '#7f8fa6' },
    activeText: { color: '#fff' },
    categoryContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
    catBtn: { padding: 10, borderRadius: 20, backgroundColor: '#dcdde1', marginHorizontal: 5, marginVertical: 5 },
    activeCat: { backgroundColor: '#3498db' },
    catText: { color: '#2f3640', fontWeight: '500' },
    imagePicker: { height: 150, backgroundColor: '#e1e2e6', borderRadius: 10, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 15 },
    imagePickerText: { color: '#7f8fa6', fontWeight: '500' },
    preview: { width: '100%', height: '100%', resizeMode: 'cover' },
    hintText: { fontSize: 13, color: '#7f8fa6', marginBottom: 10 },
    submitBtn: { backgroundColor: '#273c75', padding: 18, borderRadius: 10, alignItems: 'center', marginTop: 20 },
    submitText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    mapContainer: { height: 200, width: '100%', borderRadius: 10, overflow: 'hidden', marginBottom: 15, backgroundColor: '#e1e2e6' },
    map: { flex: 1 },
    fixedMarker: { position: 'absolute', top: '50%', left: '50%', marginLeft: -15, marginTop: -35 },
    markerEmoji: { fontSize: 30 },
});
