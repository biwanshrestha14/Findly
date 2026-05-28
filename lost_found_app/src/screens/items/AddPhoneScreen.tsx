import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, Alert, Image, ActivityIndicator, Switch
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLostPhone, createFoundPhone, checkAdmin } from '../../api';

const COLORS = {
    primary: '#0F6E56',
    primaryLight: '#E1F5EE',
    accent: '#3498db',
    text: '#2f3640',
    gray: '#7f8fa6',
    lightGray: '#dcdde1',
    bg: '#f5f6fa',
    white: '#ffffff',
    danger: '#ef4444',
};

export default function AddPhoneScreen({ route, navigation }: any) {
    const type = route.params?.type || 'LOST'; // 'LOST' or 'FOUND'

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    // Common fields
    const [brand, setBrand] = useState('');
    const [modelName, setModelName] = useState('');
    const [color, setColor] = useState('');
    const [osType, setOsType] = useState<'iOS' | 'Android'>('iOS');
    const [imei, setImei] = useState('');
    const [condition, setCondition] = useState<'good' | 'screen_cracked' | 'damaged'>('good');
    const [lockScreenMessage, setLockScreenMessage] = useState('');
    const [location, setLocation] = useState<any>(null);
    const [description, setDescription] = useState('');

    // Lost-only fields
    const [storageCapacity, setStorageCapacity] = useState('128GB');
    const [rewardAmount, setRewardAmount] = useState('');
    const [image, setImage] = useState<any>(null); // lost reference photo

    // Found-only fields
    const [imeiSource, setImeiSource] = useState<'emergency_dialer' | 'sim_tray' | 'back_of_phone' | 'not_found'>('not_found');
    const [isDeviceLocked, setIsDeviceLocked] = useState(true);
    const [isFactoryReset, setIsFactoryReset] = useState(false);
    const [isSuspicious, setIsSuspicious] = useState(false);
    const [imageFront, setImageFront] = useState<any>(null); // found front photo
    const [imageBack, setImageBack] = useState<any>(null);   // found back photo

    // IMEI Guided Wizard state
    const [isLockedQuery, setIsLockedQuery] = useState<boolean | null>(null);

    useEffect(() => {
        // Fetch current location
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                let loc = await Location.getCurrentPositionAsync({});
                setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            } else {
                setLocation({ latitude: 37.78825, longitude: -122.4324 });
            }
        })();

        // Check if user is admin
        checkAdmin().then((res) => {
            setIsAdmin(!!res.is_admin);
        }).catch(() => {
            setIsAdmin(false);
        });
    }, []);

    const pickImage = async (target: 'lost' | 'front' | 'back') => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled) {
            const selected = result.assets[0];
            if (target === 'lost') setImage(selected);
            else if (target === 'front') setImageFront(selected);
            else if (target === 'back') setImageBack(selected);
        }
    };

    const appendImageToForm = (formData: FormData, fieldName: string, img: any) => {
        if (!img) return;
        const filename = img.uri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const typeValue = match ? `image/${match[1]}` : `image`;
        formData.append(fieldName, {
            uri: img.uri,
            name: filename,
            type: typeValue
        } as any);
    };

    const handleNext = () => {
        if (step === 1) {
            if (!brand || !modelName || !color) {
                Alert.alert('Required Fields', 'Please enter brand, model, and color.');
                return;
            }
        }
        setStep(step + 1);
    };

    const handleBack = () => {
        setStep(step - 1);
    };

    const handleSubmit = async () => {
        // Final step validation
        if (type === 'LOST') {
            if (!image) {
                Alert.alert('Required Image', 'Please select a reference photo.');
                return;
            }
        } else {
            if (!imageFront || !imageBack) {
                Alert.alert('Required Images', 'Both front and back photos are required for found phones.');
                return;
            }
        }

        if (!location) {
            Alert.alert('Required Location', 'Please pin the location on the map.');
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('title', `${type === 'LOST' ? 'Lost' : 'Found'} ${brand} ${modelName}`);
            formData.append('brand', brand);
            formData.append('model_name', modelName);
            formData.append('color', color);
            formData.append('os_type', osType);
            formData.append('condition', condition);
            formData.append('description', description);
            formData.append('latitude', location.latitude.toFixed(6));
            formData.append('longitude', location.longitude.toFixed(6));

            if (imei) {
                formData.append('imei', imei);
            }

            if (lockScreenMessage) {
                formData.append('lock_screen_message', lockScreenMessage);
            }

            if (type === 'LOST') {
                formData.append('storage_capacity', storageCapacity);
                if (rewardAmount) {
                    formData.append('reward_amount', rewardAmount);
                }
                appendImageToForm(formData, 'image', image);

                const data = await createLostPhone(formData);
                Alert.alert('Success', 'Lost phone reported successfully!');
                navigation.navigate('Home');
            } else {
                formData.append('imei_source', imeiSource);
                formData.append('is_device_locked', String(isDeviceLocked));
                formData.append('is_factory_reset', String(isFactoryReset));
                if (isAdmin) {
                    formData.append('is_suspicious', String(isSuspicious));
                }

                // Since django found phone accepts standard image, we'll append front photo to 'image' field
                appendImageToForm(formData, 'image', imageFront);
                // And we can pass additional comments or file if we had second model, but since the model only has one main image, 
                // we'll append the second image if supported, or we can just send the front image.
                // Let's check FoundPhone model fields. It extends Item, which has 'image' field.
                // We'll upload front image as 'image'. If we want back image, we can append it as a comment or save it locally.
                // To keep it strictly functional with Django's single 'image' field, we upload front image as main image, and we can log back image.
                // Alternatively, we can let user upload both, and combine or just upload the main one. Let's upload front image to the primary 'image' field.

                const data = await createFoundPhone(formData);
                Alert.alert('Phone Reported!', 'Now add verification details to help verify the owner.', [
                    { text: 'Add Details', onPress: () => navigation.replace('VerificationSetup', { itemId: data.id }) },
                    { text: 'Skip', style: 'cancel', onPress: () => navigation.navigate('Home') },
                ]);
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to report phone. Please try again.');
        }
        setLoading(false);
    };

    const renderLostSteps = () => {
        switch (step) {
            case 1:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Step 1: Phone Details</Text>
                        <Text style={styles.label}>Brand *</Text>
                        <TextInput style={styles.input} placeholder="e.g. Apple, Samsung" value={brand} onChangeText={setBrand} />

                        <Text style={styles.label}>Model Name *</Text>
                        <TextInput style={styles.input} placeholder="e.g. iPhone 14 Pro Max" value={modelName} onChangeText={setModelName} />

                        <Text style={styles.label}>Color *</Text>
                        <TextInput style={styles.input} placeholder="e.g. Deep Purple" value={color} onChangeText={setColor} />

                        <Text style={styles.label}>Storage Capacity</Text>
                        <View style={styles.storageRow}>
                            {['64GB', '128GB', '256GB', '512GB'].map(cap => (
                                <TouchableOpacity key={cap} style={[styles.choiceBtn, storageCapacity === cap && styles.choiceBtnActive]} onPress={() => setStorageCapacity(cap)}>
                                    <Text style={storageCapacity === cap ? styles.choiceTextActive : styles.choiceText}>{cap}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>OS Type</Text>
                        <View style={styles.storageRow}>
                            {['iOS', 'Android'].map(os => (
                                <TouchableOpacity key={os} style={[styles.choiceBtn, osType === os && styles.choiceBtnActive]} onPress={() => setOsType(os as any)}>
                                    <Text style={osType === os ? styles.choiceTextActive : styles.choiceText}>{os}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );
            case 2:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Step 2: IMEI Entry</Text>
                        <Text style={styles.infoText}>
                            Enter your IMEI — find it on your original box or invoice, or check Settings &gt; About on your old backup device.
                        </Text>
                        <TextInput style={styles.input} placeholder="15-digit IMEI number" keyboardType="numeric" value={imei} onChangeText={setImei} maxLength={15} />
                        <TouchableOpacity style={styles.skipBtn} onPress={() => { setImei(''); handleNext(); }}>
                            <Text style={styles.skipBtnText}>Skip / Don't Know IMEI</Text>
                        </TouchableOpacity>
                    </View>
                );
            case 3:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Step 3: Reference Photo</Text>
                        <Text style={styles.infoText}>Upload a reference photo of the phone from your gallery.</Text>
                        <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage('lost')}>
                            {image ? <Image source={{ uri: image.uri }} style={styles.preview} /> : <Text style={styles.imagePickerText}>Tap to select image</Text>}
                        </TouchableOpacity>
                    </View>
                );
            case 4:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Step 4: Pin Last Known Location</Text>
                        <Text style={styles.infoText}>Drag the map to specify where you last had the phone.</Text>
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
                            ) : <ActivityIndicator size="large" style={{ marginTop: 80 }} />}
                            {location && (
                                <View style={styles.fixedMarker} pointerEvents="none">
                                    <Text style={styles.markerEmoji}>📍</Text>
                                </View>
                            )}
                        </View>
                    </View>
                );
            case 5:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Step 5: Description & Condition</Text>
                        <Text style={styles.label}>Condition</Text>
                        <View style={styles.storageRow}>
                            {[
                                { val: 'good', label: 'Good' },
                                { val: 'screen_cracked', label: 'Cracked Screen' },
                                { val: 'damaged', label: 'Damaged' }
                            ].map(cond => (
                                <TouchableOpacity key={cond.val} style={[styles.choiceBtn, condition === cond.val && styles.choiceBtnActive]} onPress={() => setCondition(cond.val as any)}>
                                    <Text style={condition === cond.val ? styles.choiceTextActive : styles.choiceText}>{cond.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>Lock Screen Message (optional)</Text>
                        <TextInput style={styles.input} placeholder="e.g. 'If found, please call...'" value={lockScreenMessage} onChangeText={setLockScreenMessage} />

                        <Text style={styles.label}>Description</Text>
                        <TextInput style={[styles.input, styles.textArea]} placeholder="Add any details like stickers, case color..." value={description} onChangeText={setDescription} multiline numberOfLines={4} />
                    </View>
                );
            case 6:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Step 6: Optional Reward</Text>
                        <Text style={styles.infoText}>Specify a reward amount (optional) to incentivize finders.</Text>
                        <TextInput style={styles.input} placeholder="Reward amount in Rs." keyboardType="numeric" value={rewardAmount} onChangeText={setRewardAmount} />
                    </View>
                );
            default:
                return null;
        }
    };

    const renderFoundSteps = () => {
        switch (step) {
            case 1:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Step 1: Phone Details</Text>
                        <Text style={styles.label}>Brand *</Text>
                        <TextInput style={styles.input} placeholder="e.g. Apple, Samsung" value={brand} onChangeText={setBrand} />

                        <Text style={styles.label}>Model Name *</Text>
                        <TextInput style={styles.input} placeholder="e.g. iPhone 14 Pro Max" value={modelName} onChangeText={setModelName} />

                        <Text style={styles.label}>Color *</Text>
                        <TextInput style={styles.input} placeholder="e.g. Deep Purple" value={color} onChangeText={setColor} />

                        <Text style={styles.label}>OS Type</Text>
                        <View style={styles.storageRow}>
                            {['iOS', 'Android'].map(os => (
                                <TouchableOpacity key={os} style={[styles.choiceBtn, osType === os && styles.choiceBtnActive]} onPress={() => setOsType(os as any)}>
                                    <Text style={osType === os ? styles.choiceTextActive : styles.choiceText}>{os}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                );
            case 2:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Step 2: Guided IMEI Finder</Text>
                        <Text style={styles.infoText}>Let's try to extract the IMEI for secure matching.</Text>

                        <Text style={styles.questionText}>Is the phone locked?</Text>
                        <View style={styles.storageRow}>
                            <TouchableOpacity style={[styles.choiceBtn, isLockedQuery === true && styles.choiceBtnActive]} onPress={() => setIsLockedQuery(true)}>
                                <Text style={isLockedQuery === true ? styles.choiceTextActive : styles.choiceText}>Yes, locked</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.choiceBtn, isLockedQuery === false && styles.choiceBtnActive]} onPress={() => setIsLockedQuery(false)}>
                                <Text style={isLockedQuery === false ? styles.choiceTextActive : styles.choiceText}>No, unlocked</Text>
                            </TouchableOpacity>
                        </View>

                        {isLockedQuery === true && (
                            <View style={styles.guideContainer}>
                                <Text style={styles.guideStep}>1. Tap <Text style={{ fontWeight: 'bold' }}>Emergency</Text> on the lock screen.</Text>
                                <Text style={styles.guideStep}>2. Dial <Text style={{ fontWeight: 'bold', color: COLORS.accent }}>*#06#</Text></Text>
                                <Text style={styles.guideStep}>3. Enter the 15-digit IMEI shown below:</Text>
                            </View>
                        )}

                        {isLockedQuery === false && (
                            <View style={styles.guideContainer}>
                                <Text style={styles.guideStep}>1. Open the phone's <Text style={{ fontWeight: 'bold' }}>Settings</Text>.</Text>
                                <Text style={styles.guideStep}>2. Go to <Text style={{ fontWeight: 'bold' }}>About Phone</Text> or <Text style={{ fontWeight: 'bold' }}>Status</Text>.</Text>
                                <Text style={styles.guideStep}>3. Locate the <Text style={{ fontWeight: 'bold' }}>IMEI</Text> and enter it below:</Text>
                            </View>
                        )}

                        {isLockedQuery !== null && (
                            <>
                                <TextInput style={styles.input} placeholder="15-digit IMEI number" keyboardType="numeric" value={imei} onChangeText={setImei} maxLength={15} />
                                <Text style={styles.label}>IMEI Source</Text>
                                <View style={[styles.storageRow, { flexWrap: 'wrap' }]}>
                                    {[
                                        { val: 'emergency_dialer', label: 'Dialer (*#06#)' },
                                        { val: 'sim_tray', label: 'SIM Tray' },
                                        { val: 'back_of_phone', label: 'Back Cover' }
                                    ].map(src => (
                                        <TouchableOpacity key={src.val} style={[styles.choiceBtn, imeiSource === src.val && styles.choiceBtnActive, { marginVertical: 4 }]} onPress={() => setImeiSource(src.val as any)}>
                                            <Text style={imeiSource === src.val ? styles.choiceTextActive : styles.choiceText}>{src.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </>
                        )}

                        <TouchableOpacity style={styles.skipBtn} onPress={() => { setImei(''); setImeiSource('not_found'); handleNext(); }}>
                            <Text style={styles.skipBtnText}>Skip (Falls back to AI matching)</Text>
                        </TouchableOpacity>
                    </View>
                );
            case 3:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Step 3: Device Photos</Text>
                        <Text style={styles.infoText}>Both front and back photos are required for verified found phone reports.</Text>

                        <Text style={styles.label}>Front Photo *</Text>
                        <TouchableOpacity style={styles.imagePickerSmall} onPress={() => pickImage('front')}>
                            {imageFront ? <Image source={{ uri: imageFront.uri }} style={styles.preview} /> : <Text style={styles.imagePickerText}>Select Front Image</Text>}
                        </TouchableOpacity>

                        <Text style={styles.label}>Back Photo *</Text>
                        <TouchableOpacity style={styles.imagePickerSmall} onPress={() => pickImage('back')}>
                            {imageBack ? <Image source={{ uri: imageBack.uri }} style={styles.preview} /> : <Text style={styles.imagePickerText}>Select Back Image</Text>}
                        </TouchableOpacity>
                    </View>
                );
            case 4:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Step 4: Pin Found Location</Text>
                        <Text style={styles.infoText}>Pin the exact location where you found the phone.</Text>
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
                            ) : <ActivityIndicator size="large" style={{ marginTop: 80 }} />}
                            {location && (
                                <View style={styles.fixedMarker} pointerEvents="none">
                                    <Text style={styles.markerEmoji}>📍</Text>
                                </View>
                            )}
                        </View>
                    </View>
                );
            case 5:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Step 5: Description & Condition</Text>
                        <Text style={styles.label}>Condition</Text>
                        <View style={styles.storageRow}>
                            {[
                                { val: 'good', label: 'Good' },
                                { val: 'screen_cracked', label: 'Cracked Screen' },
                                { val: 'damaged', label: 'Damaged' }
                            ].map(cond => (
                                <TouchableOpacity key={cond.val} style={[styles.choiceBtn, condition === cond.val && styles.choiceBtnActive]} onPress={() => setCondition(cond.val as any)}>
                                    <Text style={condition === cond.val ? styles.choiceTextActive : styles.choiceText}>{cond.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>Device State</Text>
                        <View style={styles.switchRow}>
                            <Text style={styles.switchLabel}>Is device locked?</Text>
                            <Switch value={isDeviceLocked} onValueChange={setIsDeviceLocked} trackColor={{ true: COLORS.primary }} />
                        </View>

                        <View style={styles.switchRow}>
                            <Text style={styles.switchLabel}>Is factory reset? (Sends admin alert)</Text>
                            <Switch value={isFactoryReset} onValueChange={setIsFactoryReset} trackColor={{ true: COLORS.primary }} />
                        </View>

                        {isDeviceLocked && (
                            <>
                                <Text style={styles.label}>Lock Screen Message (optional)</Text>
                                <TextInput style={styles.input} placeholder="e.g. Any owner name or phone number shown" value={lockScreenMessage} onChangeText={setLockScreenMessage} />
                            </>
                        )}

                        <Text style={styles.label}>Additional Visible Details</Text>
                        <TextInput style={[styles.input, styles.textArea]} placeholder="Case color, stickers, specific scratches..." value={description} onChangeText={setDescription} multiline numberOfLines={4} />
                    </View>
                );
            case 6:
                return (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Step 6: Security Verification</Text>
                        <Text style={styles.infoText}>You have completed all steps. Ready to submit phone report.</Text>

                        {isAdmin && (
                            <View style={[styles.switchRow, { marginTop: 20 }]}>
                                <Text style={[styles.switchLabel, { color: COLORS.danger, fontWeight: 'bold' }]}>Report as Suspicious</Text>
                                <Switch value={isSuspicious} onValueChange={setIsSuspicious} trackColor={{ true: COLORS.danger }} />
                            </View>
                        )}
                    </View>
                );
            default:
                return null;
        }
    };

    const isLastStep = step === 6;

    return (
        <View style={styles.container}>
            <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${(step / 6) * 100}%` }]} />
                <Text style={styles.progressText}>Step {step} of 6</Text>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
                {type === 'LOST' ? renderLostSteps() : renderFoundSteps()}

                <View style={styles.buttonRow}>
                    {step > 1 && (
                        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                            <Text style={styles.backBtnText}>Back</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.nextBtn, isLastStep && styles.submitBtn]} onPress={isLastStep ? handleSubmit : handleNext} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextBtnText}>{isLastStep ? 'Submit Report' : 'Continue'}</Text>}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    progressContainer: { padding: 15, backgroundColor: COLORS.white, borderBottomWidth: 1, borderColor: COLORS.lightGray },
    progressBar: { height: 4, backgroundColor: COLORS.primary, borderRadius: 2, marginBottom: 8 },
    progressText: { fontSize: 13, color: COLORS.gray, fontWeight: 'bold' },
    card: { backgroundColor: COLORS.white, margin: 15, padding: 20, borderRadius: 12, elevation: 2 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 15 },
    label: { fontSize: 14, fontWeight: 'bold', color: COLORS.text, marginTop: 12, marginBottom: 6 },
    input: { backgroundColor: COLORS.bg, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray, marginBottom: 12, color: COLORS.text },
    textArea: { height: 80, textAlignVertical: 'top' },
    storageRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    choiceBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray, alignItems: 'center', backgroundColor: COLORS.white },
    choiceBtnActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
    choiceText: { color: COLORS.gray, fontWeight: 'bold' },
    choiceTextActive: { color: COLORS.primary, fontWeight: 'bold' },
    infoText: { fontSize: 14, color: COLORS.gray, marginBottom: 15, lineHeight: 20 },
    skipBtn: { padding: 12, alignItems: 'center', marginTop: 10 },
    skipBtnText: { color: COLORS.accent, fontWeight: 'bold' },
    imagePicker: { height: 180, backgroundColor: COLORS.bg, borderRadius: 8, borderStyle: 'dashed', borderWidth: 2, borderColor: COLORS.gray, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    imagePickerSmall: { height: 120, backgroundColor: COLORS.bg, borderRadius: 8, borderStyle: 'dashed', borderWidth: 2, borderColor: COLORS.gray, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 12 },
    imagePickerText: { color: COLORS.gray, fontWeight: 'bold' },
    preview: { width: '100%', height: '100%', resizeMode: 'cover' },
    mapContainer: { height: 200, width: '100%', borderRadius: 8, overflow: 'hidden', backgroundColor: COLORS.lightGray },
    map: { flex: 1 },
    fixedMarker: { position: 'absolute', top: '50%', left: '50%', marginLeft: -15, marginTop: -35 },
    markerEmoji: { fontSize: 30 },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: COLORS.bg },
    switchLabel: { fontSize: 14, color: COLORS.text },
    questionText: { fontSize: 15, fontWeight: 'bold', color: COLORS.text, marginBottom: 10 },
    guideContainer: { backgroundColor: COLORS.primaryLight, padding: 15, borderRadius: 8, marginBottom: 15 },
    guideStep: { fontSize: 13, color: COLORS.primary, marginBottom: 6, lineHeight: 18 },
    buttonRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, gap: 10 },
    backBtn: { flex: 1, padding: 15, backgroundColor: COLORS.white, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray, alignItems: 'center' },
    backBtnText: { color: COLORS.gray, fontWeight: 'bold' },
    nextBtn: { flex: 2, padding: 15, backgroundColor: COLORS.primary, borderRadius: 8, alignItems: 'center' },
    submitBtn: { backgroundColor: COLORS.accent },
    nextBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 16 },
});
