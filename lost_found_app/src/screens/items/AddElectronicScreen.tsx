import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, Alert, Image, ActivityIndicator, Switch
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLostElectronic, createFoundElectronic, checkAdmin } from '../../api';

const COLORS = {
    primary: '#0F6E56', primaryLight: '#E1F5EE',
    accent: '#3498db', text: '#2f3640', gray: '#7f8fa6',
    lightGray: '#dcdde1', bg: '#f5f6fa', white: '#ffffff',
    danger: '#ef4444',
};

const ELECTRONICS_MAP: Record<string, { label: string; identifier: string | null; icon: string }> = {
    mobile_phone: { label: 'Mobile Phone', identifier: 'IMEI', icon: '📱' },
    laptop:       { label: 'Laptop',       identifier: 'Serial Number', icon: '💻' },
    tablet:       { label: 'Tablet',       identifier: 'Serial Number / IMEI', icon: '📟' },
    earbuds:      { label: 'Earbuds',      identifier: 'Serial Number', icon: '🎧' },
    smartwatch:   { label: 'Smartwatch',   identifier: 'Serial Number', icon: '⌚' },
    camera:       { label: 'Camera',       identifier: 'Serial Number', icon: '📷' },
    accessories:  { label: 'Accessories',  identifier: null, icon: '🔌' },
};

export default function AddElectronicScreen({ route, navigation }: any) {
    const type = route.params?.type || 'LOST';
    const electronicType: string = route.params?.electronicType || 'mobile_phone';
    const config = ELECTRONICS_MAP[electronicType];
    const isPhone = electronicType === 'mobile_phone';
    const hasIdentifier = !!config?.identifier;

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    // Common fields
    const [brand, setBrand] = useState('');
    const [modelName, setModelName] = useState('');
    const [color, setColor] = useState('');
    const [osType, setOsType] = useState<'iOS' | 'Android'>('iOS');
    const [identifier, setIdentifier] = useState('');
    const [condition, setCondition] = useState<'good' | 'screen_cracked' | 'damaged'>('good');
    const [lockScreenMessage, setLockScreenMessage] = useState('');
    const [location, setLocation] = useState<any>(null);
    const [description, setDescription] = useState('');

    // Lost-only
    const [storageCapacity, setStorageCapacity] = useState('128GB');
    const [rewardAmount, setRewardAmount] = useState('');
    const [image, setImage] = useState<any>(null);

    // Found-only
    const [identifierSource, setIdentifierSource] = useState<string>('not_found');
    const [isDeviceLocked, setIsDeviceLocked] = useState(true);
    const [isFactoryReset, setIsFactoryReset] = useState(false);
    const [isSuspicious, setIsSuspicious] = useState(false);
    const [imageFront, setImageFront] = useState<any>(null);
    const [imageBack, setImageBack] = useState<any>(null);
    const [isLockedQuery, setIsLockedQuery] = useState<boolean | null>(null);

    const showOsType = isPhone || electronicType === 'tablet';
    const showStorage = isPhone && type === 'LOST';
    const totalSteps = type === 'LOST' ? (hasIdentifier ? 6 : 5) : (hasIdentifier ? 6 : 5);

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                let loc = await Location.getCurrentPositionAsync({});
                setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            } else {
                setLocation({ latitude: 37.78825, longitude: -122.4324 });
            }
        })();
        checkAdmin().then((res) => setIsAdmin(!!res.is_admin)).catch(() => setIsAdmin(false));
    }, []);

    const pickImage = async (target: 'lost' | 'front' | 'back') => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8,
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
        formData.append(fieldName, { uri: img.uri, name: filename, type: typeValue } as any);
    };

    const handleNext = () => {
        if (step === 1 && (!brand || !modelName || !color)) {
            Alert.alert('Required Fields', 'Please enter brand, model, and color.');
            return;
        }
        setStep(step + 1);
    };

    const handleSubmit = async () => {
        if (type === 'LOST' && !image) {
            Alert.alert('Required', 'Please select a reference photo.'); return;
        }
        if (type === 'FOUND' && !imageFront) {
            Alert.alert('Required', 'A photo is required.'); return;
        }
        if (!location) {
            Alert.alert('Required', 'Please pin the location.'); return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('title', `${type === 'LOST' ? 'Lost' : 'Found'} ${brand} ${modelName}`);
            formData.append('electronic_type', electronicType);
            formData.append('brand', brand);
            formData.append('model_name', modelName);
            formData.append('color', color);
            formData.append('condition', condition);
            formData.append('description', description);
            formData.append('latitude', location.latitude.toFixed(6));
            formData.append('longitude', location.longitude.toFixed(6));

            if (showOsType) formData.append('os_type', osType);
            if (identifier) formData.append('imei_or_serial', identifier);
            if (lockScreenMessage) formData.append('lock_screen_message', lockScreenMessage);

            if (type === 'LOST') {
                if (showStorage) formData.append('storage_capacity', storageCapacity);
                if (rewardAmount) formData.append('reward_amount', rewardAmount);
                appendImageToForm(formData, 'image', image);
                await createLostElectronic(formData);
                Alert.alert('Success', `Lost ${config.label} reported successfully!`);
                navigation.navigate('Home');
            } else {
                formData.append('imei_or_serial_source', identifierSource);
                formData.append('is_device_locked', String(isDeviceLocked));
                formData.append('is_factory_reset', String(isFactoryReset));
                if (isAdmin) formData.append('is_suspicious', String(isSuspicious));
                appendImageToForm(formData, 'image', imageFront);
                const data = await createFoundElectronic(formData);
                Alert.alert('Reported!', 'Now add verification details to help verify the owner.', [
                    { text: 'Add Details', onPress: () => navigation.replace('VerificationSetup', { itemId: data.id }) },
                    { text: 'Skip', style: 'cancel', onPress: () => navigation.navigate('Home') },
                ]);
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to submit. Please try again.');
        }
        setLoading(false);
    };

    // ── Step renderers ───────────────────────────────────────────────────────

    const renderStep1 = () => (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Step 1: {config.label} Details</Text>
            <Text style={styles.label}>Brand *</Text>
            <TextInput style={styles.input} placeholder="e.g. Apple, Samsung, Sony" value={brand} onChangeText={setBrand} />
            <Text style={styles.label}>Model Name *</Text>
            <TextInput style={styles.input} placeholder={`e.g. ${isPhone ? 'iPhone 14 Pro' : config.label + ' model'}`} value={modelName} onChangeText={setModelName} />
            <Text style={styles.label}>Color *</Text>
            <TextInput style={styles.input} placeholder="e.g. Black, Silver" value={color} onChangeText={setColor} />

            {showStorage && (
                <>
                    <Text style={styles.label}>Storage Capacity</Text>
                    <View style={styles.row}>
                        {['64GB', '128GB', '256GB', '512GB'].map(cap => (
                            <TouchableOpacity key={cap} style={[styles.choiceBtn, storageCapacity === cap && styles.choiceBtnActive]} onPress={() => setStorageCapacity(cap)}>
                                <Text style={storageCapacity === cap ? styles.choiceTextActive : styles.choiceText}>{cap}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </>
            )}

            {showOsType && (
                <>
                    <Text style={styles.label}>OS Type</Text>
                    <View style={styles.row}>
                        {['iOS', 'Android'].map(os => (
                            <TouchableOpacity key={os} style={[styles.choiceBtn, osType === os && styles.choiceBtnActive]} onPress={() => setOsType(os as any)}>
                                <Text style={osType === os ? styles.choiceTextActive : styles.choiceText}>{os}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </>
            )}
        </View>
    );

    const renderIdentifierStep = () => {
        if (!hasIdentifier) return null;
        const idLabel = config.identifier!;

        if (type === 'FOUND' && isPhone) {
            // Guided IMEI finder for found phones
            return (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Step 2: Guided {idLabel} Finder</Text>
                    <Text style={styles.infoText}>Let's try to extract the {idLabel} for secure matching.</Text>
                    <Text style={styles.questionText}>Is the device locked?</Text>
                    <View style={styles.row}>
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
                            <Text style={styles.guideStep}>3. Enter the 15-digit {idLabel} shown below:</Text>
                        </View>
                    )}
                    {isLockedQuery === false && (
                        <View style={styles.guideContainer}>
                            <Text style={styles.guideStep}>1. Open <Text style={{ fontWeight: 'bold' }}>Settings</Text>.</Text>
                            <Text style={styles.guideStep}>2. Go to <Text style={{ fontWeight: 'bold' }}>About Phone</Text>.</Text>
                            <Text style={styles.guideStep}>3. Locate the <Text style={{ fontWeight: 'bold' }}>{idLabel}</Text> and enter it below:</Text>
                        </View>
                    )}
                    {isLockedQuery !== null && (
                        <>
                            <TextInput style={styles.input} placeholder={`${idLabel}`} keyboardType={isPhone ? 'numeric' : 'default'} value={identifier} onChangeText={setIdentifier} maxLength={isPhone ? 15 : 50} />
                            <Text style={styles.label}>{idLabel} Source</Text>
                            <View style={[styles.row, { flexWrap: 'wrap' }]}>
                                {[{ val: 'emergency_dialer', label: 'Dialer (*#06#)' }, { val: 'sim_tray', label: 'SIM Tray' }, { val: 'back_of_phone', label: 'Back Cover' }].map(src => (
                                    <TouchableOpacity key={src.val} style={[styles.choiceBtn, identifierSource === src.val && styles.choiceBtnActive, { marginVertical: 4 }]} onPress={() => setIdentifierSource(src.val)}>
                                        <Text style={identifierSource === src.val ? styles.choiceTextActive : styles.choiceText}>{src.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </>
                    )}
                    <TouchableOpacity style={styles.skipBtn} onPress={() => { setIdentifier(''); setIdentifierSource('not_found'); handleNext(); }}>
                        <Text style={styles.skipBtnText}>Skip (Falls back to AI matching)</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        // Generic identifier step for lost items and non-phone found items
        return (
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Step 2: {idLabel}</Text>
                <Text style={styles.infoText}>
                    {type === 'LOST'
                        ? `Enter your device's ${idLabel} — find it on your original box, invoice, or device settings.`
                        : `If you can find the ${idLabel}, enter it below for accurate matching.`}
                </Text>
                <TextInput style={styles.input} placeholder={idLabel} keyboardType={isPhone ? 'numeric' : 'default'} value={identifier} onChangeText={setIdentifier} maxLength={isPhone ? 15 : 50} />
                <TouchableOpacity style={styles.skipBtn} onPress={() => { setIdentifier(''); handleNext(); }}>
                    <Text style={styles.skipBtnText}>Skip / Don't Know</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderPhotoStep = (stepNum: number) => {
        if (type === 'LOST') {
            return (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Step {stepNum}: Reference Photo</Text>
                    <Text style={styles.infoText}>Upload a reference photo of the device.</Text>
                    <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage('lost')}>
                        {image ? <Image source={{ uri: image.uri }} style={styles.preview} /> : <Text style={styles.imagePickerText}>Tap to select image</Text>}
                    </TouchableOpacity>
                </View>
            );
        }
        return (
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Step {stepNum}: Device Photos</Text>
                <Text style={styles.infoText}>Upload a photo of the found device.</Text>
                <Text style={styles.label}>Photo *</Text>
                <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage('front')}>
                    {imageFront ? <Image source={{ uri: imageFront.uri }} style={styles.preview} /> : <Text style={styles.imagePickerText}>Tap to select image</Text>}
                </TouchableOpacity>
            </View>
        );
    };

    const renderLocationStep = (stepNum: number) => (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Step {stepNum}: Pin Location</Text>
            <Text style={styles.infoText}>{type === 'LOST' ? 'Where did you last have it?' : 'Where did you find it?'}</Text>
            <View style={styles.mapContainer}>
                {location ? (
                    <MapView style={styles.map} initialRegion={{ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
                        showsUserLocation={true} onRegionChangeComplete={(r) => setLocation({ latitude: r.latitude, longitude: r.longitude })} />
                ) : <ActivityIndicator size="large" style={{ marginTop: 80 }} />}
                {location && <View style={styles.fixedMarker} pointerEvents="none"><Text style={styles.markerEmoji}>📍</Text></View>}
            </View>
        </View>
    );

    const renderDescriptionStep = (stepNum: number) => (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Step {stepNum}: Description & Condition</Text>
            <Text style={styles.label}>Condition</Text>
            <View style={styles.row}>
                {[{ val: 'good', label: 'Good' }, { val: 'screen_cracked', label: 'Cracked/Scratched' }, { val: 'damaged', label: 'Damaged' }].map(c => (
                    <TouchableOpacity key={c.val} style={[styles.choiceBtn, condition === c.val && styles.choiceBtnActive]} onPress={() => setCondition(c.val as any)}>
                        <Text style={condition === c.val ? styles.choiceTextActive : styles.choiceText}>{c.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            {type === 'FOUND' && (
                <>
                    <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Is device locked?</Text>
                        <Switch value={isDeviceLocked} onValueChange={setIsDeviceLocked} trackColor={{ true: COLORS.primary }} />
                    </View>
                    <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Is factory reset?</Text>
                        <Switch value={isFactoryReset} onValueChange={setIsFactoryReset} trackColor={{ true: COLORS.primary }} />
                    </View>
                </>
            )}
            <Text style={styles.label}>Description</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Any distinguishing details..." value={description} onChangeText={setDescription} multiline numberOfLines={4} />
        </View>
    );

    const renderFinalStep = (stepNum: number) => (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Step {stepNum}: {type === 'LOST' ? 'Optional Reward' : 'Final Review'}</Text>
            {type === 'LOST' ? (
                <>
                    <Text style={styles.infoText}>Optionally set a reward to incentivize finders.</Text>
                    <TextInput style={styles.input} placeholder="Reward amount in Rs." keyboardType="numeric" value={rewardAmount} onChangeText={setRewardAmount} />
                </>
            ) : (
                <>
                    <Text style={styles.infoText}>Ready to submit your found {config.label.toLowerCase()} report.</Text>
                    {isAdmin && (
                        <View style={[styles.switchRow, { marginTop: 20 }]}>
                            <Text style={[styles.switchLabel, { color: COLORS.danger, fontWeight: 'bold' }]}>Report as Suspicious</Text>
                            <Switch value={isSuspicious} onValueChange={setIsSuspicious} trackColor={{ true: COLORS.danger }} />
                        </View>
                    )}
                </>
            )}
        </View>
    );

    // Build dynamic step list
    const steps: (() => React.ReactNode)[] = [];
    steps.push(renderStep1);                                       // Step 1
    if (hasIdentifier) steps.push(renderIdentifierStep);           // Step 2 (optional)
    const photoIdx = steps.length + 1;
    steps.push(() => renderPhotoStep(photoIdx));
    const locIdx = steps.length + 1;
    steps.push(() => renderLocationStep(locIdx));
    const descIdx = steps.length + 1;
    steps.push(() => renderDescriptionStep(descIdx));
    const finalIdx = steps.length + 1;
    steps.push(() => renderFinalStep(finalIdx));

    const isLastStep = step === steps.length;

    return (
        <View style={styles.container}>
            <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { width: `${(step / steps.length) * 100}%` }]} />
                <Text style={styles.progressText}>{config.icon} {config.label} — Step {step} of {steps.length}</Text>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
                {steps[step - 1]?.()}
                <View style={styles.buttonRow}>
                    {step > 1 && (
                        <TouchableOpacity style={styles.backBtn} onPress={() => setStep(step - 1)}>
                            <Text style={styles.backBtnText}>Back</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.nextBtn, isLastStep && styles.submitBtnStyle]} onPress={isLastStep ? handleSubmit : handleNext} disabled={loading}>
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
    row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    choiceBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.lightGray, alignItems: 'center', backgroundColor: COLORS.white },
    choiceBtnActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
    choiceText: { color: COLORS.gray, fontWeight: 'bold' },
    choiceTextActive: { color: COLORS.primary, fontWeight: 'bold' },
    infoText: { fontSize: 14, color: COLORS.gray, marginBottom: 15, lineHeight: 20 },
    skipBtn: { padding: 12, alignItems: 'center', marginTop: 10 },
    skipBtnText: { color: COLORS.accent, fontWeight: 'bold' },
    imagePicker: { height: 180, backgroundColor: COLORS.bg, borderRadius: 8, borderStyle: 'dashed', borderWidth: 2, borderColor: COLORS.gray, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
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
    submitBtnStyle: { backgroundColor: COLORS.accent },
    nextBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 16 },
});
