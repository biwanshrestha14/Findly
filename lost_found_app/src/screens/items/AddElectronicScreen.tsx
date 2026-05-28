import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    ScrollView, Alert, Image, ActivityIndicator, Switch
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { createLostElectronic, createFoundElectronic, checkAdmin } from '../../api';

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
};

const ELECTRONICS_MAP: Record<string, { label: string; identifier: string | null; icon: string; iconColor: string }> = {
    mobile_phone: { label: 'Mobile Phone', identifier: 'IMEI', icon: 'phone-portrait-outline', iconColor: '#0F6E56' },
    laptop:       { label: 'Laptop',       identifier: 'Serial Number', icon: 'laptop-outline', iconColor: '#3498db' },
    tablet:       { label: 'Tablet',       identifier: 'Serial Number / IMEI', icon: 'tablet-portrait-outline', iconColor: '#9b59b6' },
    earbuds:      { label: 'Earbuds',      identifier: 'Serial Number', icon: 'headset-outline', iconColor: '#e67e22' },
    smartwatch:   { label: 'Smartwatch',   identifier: 'Serial Number', icon: 'watch-outline', iconColor: '#e74c3c' },
    camera:       { label: 'Camera',       identifier: 'Serial Number', icon: 'camera-outline', iconColor: '#1abc9c' },
    accessories:  { label: 'Accessories',  identifier: null, icon: 'extension-puzzle-outline', iconColor: '#7f8fa6' },
};

export default function AddElectronicScreen({ route, navigation }: any) {
    const type = route.params?.type || 'LOST';
    const electronicType: string = route.params?.electronicType || 'mobile_phone';
    const config = ELECTRONICS_MAP[electronicType] || ELECTRONICS_MAP.mobile_phone;
    const isPhone = electronicType === 'mobile_phone';
    const hasIdentifier = !!config.identifier;

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
    const [isLockedQuery, setIsLockedQuery] = useState<boolean | null>(null);

    const showOsType = isPhone || electronicType === 'tablet';
    const showStorage = isPhone && type === 'LOST';

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
                let loc = await Location.getCurrentPositionAsync({});
                setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            } else {
                setLocation({ latitude: 27.7172, longitude: 85.3240 }); // Kathmandu default coords
            }
        })();
        checkAdmin().then((res) => setIsAdmin(!!res.is_admin)).catch(() => setIsAdmin(false));
    }, []);

    const pickImage = async (target: 'lost' | 'front') => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8,
        });
        if (!result.canceled) {
            const selected = result.assets[0];
            if (target === 'lost') setImage(selected);
            else if (target === 'front') setImageFront(selected);
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
            <Text style={styles.cardTitle}>Device Details</Text>
            
            <Text style={styles.label}>Brand *</Text>
            <View style={styles.inputWrapper}>
                <Ionicons name="pricetag-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                <TextInput style={styles.textInputStyle} placeholder="e.g. Apple, Samsung, Sony" value={brand} onChangeText={setBrand} placeholderTextColor="#A0A0A0" />
            </View>

            <Text style={styles.label}>Model Name *</Text>
            <View style={styles.inputWrapper}>
                <Ionicons name="hardware-chip-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                <TextInput style={styles.textInputStyle} placeholder={`e.g. ${isPhone ? 'iPhone 14 Pro' : config.label + ' model'}`} value={modelName} onChangeText={setModelName} placeholderTextColor="#A0A0A0" />
            </View>

            <Text style={styles.label}>Color *</Text>
            <View style={styles.inputWrapper}>
                <Ionicons name="color-palette-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                <TextInput style={styles.textInputStyle} placeholder="e.g. Space Gray, Silver" value={color} onChangeText={setColor} placeholderTextColor="#A0A0A0" />
            </View>

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
            return (
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Guided {idLabel} Finder</Text>
                    <Text style={styles.infoText}>Let's extract the {idLabel} for exact owner matching.</Text>
                    
                    <Text style={styles.questionText}>Is the phone currently locked?</Text>
                    <View style={styles.row}>
                        <TouchableOpacity style={[styles.choiceBtn, isLockedQuery === true && styles.choiceBtnActive]} onPress={() => setIsLockedQuery(true)}>
                            <Ionicons name="lock-closed-outline" size={16} color={isLockedQuery === true ? COLORS.primary : COLORS.gray} style={{ marginRight: 6 }} />
                            <Text style={isLockedQuery === true ? styles.choiceTextActive : styles.choiceText}>Yes, locked</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.choiceBtn, isLockedQuery === false && styles.choiceBtnActive]} onPress={() => setIsLockedQuery(false)}>
                            <Ionicons name="lock-open-outline" size={16} color={isLockedQuery === false ? COLORS.primary : COLORS.gray} style={{ marginRight: 6 }} />
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
                            <Text style={styles.guideStep}>1. Open the phone's <Text style={{ fontWeight: 'bold' }}>Settings</Text>.</Text>
                            <Text style={styles.guideStep}>2. Go to <Text style={{ fontWeight: 'bold' }}>About Phone</Text> or status section.</Text>
                            <Text style={styles.guideStep}>3. Locate the <Text style={{ fontWeight: 'bold' }}>{idLabel}</Text> and enter it below:</Text>
                        </View>
                    )}

                    {isLockedQuery !== null && (
                        <>
                            <View style={styles.inputWrapper}>
                                <Ionicons name="keypad-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                                <TextInput style={styles.textInputStyle} placeholder={`Enter 15-digit ${idLabel}`} keyboardType="numeric" value={identifier} onChangeText={setIdentifier} maxLength={15} placeholderTextColor="#A0A0A0" />
                            </View>

                            <Text style={styles.label}>{idLabel} Source Location</Text>
                            <View style={[styles.row, { flexWrap: 'wrap' }]}>
                                {[
                                    { val: 'emergency_dialer', label: 'Dialer (*#06#)' },
                                    { val: 'sim_tray', label: 'SIM Tray' },
                                    { val: 'back_of_phone', label: 'Back Cover' }
                                ].map(src => (
                                    <TouchableOpacity key={src.val} style={[styles.choiceBtn, identifierSource === src.val && styles.choiceBtnActive, { marginVertical: 4, minWidth: '45%' }]} onPress={() => setIdentifierSource(src.val)}>
                                        <Text style={identifierSource === src.val ? styles.choiceTextActive : styles.choiceText}>{src.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </>
                    )}

                    <TouchableOpacity style={styles.skipBtn} onPress={() => { setIdentifier(''); setIdentifierSource('not_found'); handleNext(); }}>
                        <Text style={styles.skipBtnText}>Skip (Fall back to AI matching)</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.card}>
                <Text style={styles.cardTitle}>{idLabel} Verification</Text>
                <Text style={styles.infoText}>
                    {type === 'LOST'
                        ? `Enter your device's ${idLabel} from the invoice, packaging box, or original configuration panel.`
                        : `If visible, enter the device's ${idLabel} to ensure immediate verified matching.`}
                </Text>
                <View style={styles.inputWrapper}>
                    <Ionicons name="qr-code-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                    <TextInput style={styles.textInputStyle} placeholder={`Enter ${idLabel}`} keyboardType={isPhone ? 'numeric' : 'default'} value={identifier} onChangeText={setIdentifier} maxLength={isPhone ? 15 : 50} placeholderTextColor="#A0A0A0" />
                </View>
                <TouchableOpacity style={styles.skipBtn} onPress={() => { setIdentifier(''); handleNext(); }}>
                    <Text style={styles.skipBtnText}>Skip / Don't Know {idLabel}</Text>
                </TouchableOpacity>
            </View>
        );
    };

    const renderPhotoStep = (stepNum: number) => {
        const hasPhoto = type === 'LOST' ? !!image : !!imageFront;
        return (
            <View style={styles.card}>
                <Text style={styles.cardTitle}>Reference Image</Text>
                <Text style={styles.infoText}>
                    {type === 'LOST'
                        ? 'Upload a reference photo of the item to help match its visual features.'
                        : 'Upload a clear, well-lit photo of the found electronic device.'}
                </Text>
                <TouchableOpacity style={styles.imagePicker} onPress={() => pickImage(type === 'LOST' ? 'lost' : 'front')}>
                    {hasPhoto ? (
                        <Image source={{ uri: type === 'LOST' ? image.uri : imageFront.uri }} style={styles.preview} />
                    ) : (
                        <View style={styles.imagePickerInner}>
                            <Ionicons name="cloud-upload-outline" size={42} color={COLORS.primary} style={{ marginBottom: 10 }} />
                            <Text style={styles.imagePickerText}>Select Photo from Gallery</Text>
                            <Text style={styles.imagePickerSubText}>Supports JPG, PNG formats</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>
        );
    };

    const renderLocationStep = (stepNum: number) => (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Specify Location</Text>
            <Text style={styles.infoText}>
                {type === 'LOST' ? 'Drag map to pin where you last had the device.' : 'Pin where you discovered the device.'}
            </Text>
            <View style={styles.mapContainer}>
                {location ? (
                    <MapView style={styles.map} initialRegion={{ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
                        showsUserLocation={true} onRegionChangeComplete={(r) => setLocation({ latitude: r.latitude, longitude: r.longitude })} />
                ) : <ActivityIndicator size="large" style={{ marginTop: 80 }} color={COLORS.primary} />}
                {location && <View style={styles.fixedMarker} pointerEvents="none"><Ionicons name="location" size={36} color={COLORS.danger} /></View>}
            </View>
        </View>
    );

    const renderDescriptionStep = (stepNum: number) => (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>Condition & Notes</Text>
            
            <Text style={styles.label}>Physical State</Text>
            <View style={styles.row}>
                {[
                    { val: 'good', label: 'Good' },
                    { val: 'screen_cracked', label: 'Cracked / Scratched' },
                    { val: 'damaged', label: 'Damaged' }
                ].map(c => (
                    <TouchableOpacity key={c.val} style={[styles.choiceBtn, condition === c.val && styles.choiceBtnActive]} onPress={() => setCondition(c.val as any)}>
                        <Text style={condition === c.val ? styles.choiceTextActive : styles.choiceText}>{c.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {type === 'FOUND' && (
                <View style={styles.switchGroup}>
                    <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Is the device locked?</Text>
                        <Switch value={isDeviceLocked} onValueChange={setIsDeviceLocked} trackColor={{ true: COLORS.primary }} />
                    </View>
                    <View style={styles.switchRow}>
                        <Text style={styles.switchLabel}>Is it factory reset?</Text>
                        <Switch value={isFactoryReset} onValueChange={setIsFactoryReset} trackColor={{ true: COLORS.primary }} />
                    </View>
                </View>
            )}

            {type === 'FOUND' && isDeviceLocked && (
                <>
                    <Text style={styles.label}>Lock Screen Message (if any)</Text>
                    <View style={styles.inputWrapper}>
                        <Ionicons name="chatbox-ellipses-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                        <TextInput style={styles.textInputStyle} placeholder="e.g. Owner name, contact phone displayed" value={lockScreenMessage} onChangeText={setLockScreenMessage} placeholderTextColor="#A0A0A0" />
                    </View>
                </>
            )}

            <Text style={styles.label}>Additional Description</Text>
            <View style={[styles.inputWrapper, { height: 100, alignItems: 'flex-start', paddingTop: 8 }]}>
                <Ionicons name="document-text-outline" size={18} color={COLORS.gray} style={[styles.inputIcon, { marginTop: 4 }]} />
                <TextInput style={styles.textAreaInputStyle} placeholder="Stickers, scratches, case cover details..." value={description} onChangeText={setDescription} multiline numberOfLines={4} placeholderTextColor="#A0A0A0" />
            </View>
        </View>
    );

    const renderFinalStep = (stepNum: number) => (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>{type === 'LOST' ? 'Incentivize Finder' : 'Finish Report'}</Text>
            {type === 'LOST' ? (
                <>
                    <Text style={styles.infoText}>Specify a cash reward (optional) to motivate search and returns.</Text>
                    <View style={styles.inputWrapper}>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: COLORS.primary, marginRight: 8 }}>Rs.</Text>
                        <TextInput style={styles.textInputStyle} placeholder="Reward amount in Rupees" keyboardType="numeric" value={rewardAmount} onChangeText={setRewardAmount} placeholderTextColor="#A0A0A0" />
                    </View>
                </>
            ) : (
                <>
                    <Text style={styles.infoText}>Review details and click submit to generate matches immediately.</Text>
                    {isAdmin && (
                        <View style={[styles.switchRow, { marginTop: 20 }]}>
                            <Text style={[styles.switchLabel, { color: COLORS.danger, fontWeight: 'bold' }]}>Flag as Suspicious</Text>
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
                <View style={styles.progressHeader}>
                    <View style={[styles.headerIconWrapper, { backgroundColor: config.iconColor + '15' }]}>
                        <Ionicons name={config.icon as any} size={20} color={config.iconColor} />
                    </View>
                    <Text style={styles.progressTitle}>{config.label}</Text>
                    <Text style={styles.stepIndicatorText}>Step {step} of {steps.length}</Text>
                </View>
                <View style={styles.progressBarBg}>
                    <LinearGradient
                        colors={['#0F6E56', '#128C7E']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.progressBar, { width: `${(step / steps.length) * 100}%` }]}
                    />
                </View>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
                {steps[step - 1]?.()}
                
                <View style={styles.buttonRow}>
                    {step > 1 && (
                        <TouchableOpacity style={styles.backBtn} onPress={() => setStep(step - 1)}>
                            <Text style={styles.backBtnText}>Back</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity style={styles.nextBtn} onPress={isLastStep ? handleSubmit : handleNext} disabled={loading}>
                        <LinearGradient colors={isLastStep ? ['#3498db', '#2980b9'] : ['#0F6E56', '#128C7E']} style={styles.btnGradient}>
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.nextBtnText}>{isLastStep ? 'Submit Report' : 'Continue'}</Text>}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    progressContainer: { padding: 20, backgroundColor: COLORS.white, borderBottomWidth: 1, borderColor: COLORS.lightGray },
    progressHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    headerIconWrapper: { width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    progressTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, flex: 1 },
    stepIndicatorText: { fontSize: 13, color: COLORS.gray, fontWeight: '600' },
    progressBarBg: { height: 6, backgroundColor: '#E0E0DB', borderRadius: 3, overflow: 'hidden' },
    progressBar: { height: '100%', borderRadius: 3 },
    
    card: { backgroundColor: COLORS.white, margin: 15, padding: 20, borderRadius: 16, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
    cardTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, marginBottom: 15 },
    label: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginTop: 12, marginBottom: 8 },
    
    inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0ED', borderWidth: 1, borderColor: COLORS.lightGray, borderRadius: 12, paddingHorizontal: 12, marginBottom: 16, overflow: 'hidden' },
    inputIcon: { marginRight: 8 },
    textInputStyle: { flex: 1, height: 48, color: COLORS.text, fontSize: 15, fontWeight: '500' },
    textAreaInputStyle: { flex: 1, height: 80, color: COLORS.text, fontSize: 15, fontWeight: '500', textAlignVertical: 'top', paddingTop: 4 },
    
    row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    choiceBtn: { flex: 1, flexDirection: 'row', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },
    choiceBtnActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
    choiceText: { color: COLORS.gray, fontWeight: '600', fontSize: 14 },
    choiceTextActive: { color: COLORS.primary, fontWeight: 'bold', fontSize: 14 },
    
    infoText: { fontSize: 14, color: COLORS.gray, marginBottom: 18, lineHeight: 20 },
    skipBtn: { padding: 12, alignItems: 'center', marginTop: 10 },
    skipBtnText: { color: COLORS.accent, fontWeight: 'bold', fontSize: 15 },
    
    imagePicker: { height: 180, backgroundColor: '#F0F0ED', borderRadius: 14, borderStyle: 'dashed', borderWidth: 2, borderColor: COLORS.gray, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    imagePickerInner: { alignItems: 'center' },
    imagePickerText: { color: COLORS.primary, fontWeight: '700', fontSize: 15 },
    imagePickerSubText: { color: COLORS.gray, fontSize: 12, marginTop: 4 },
    preview: { width: '100%', height: '100%', resizeMode: 'cover' },
    
    mapContainer: { height: 220, width: '100%', borderRadius: 14, overflow: 'hidden', backgroundColor: COLORS.lightGray, marginTop: 10 },
    map: { flex: 1 },
    fixedMarker: { position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -36 },
    
    switchGroup: { marginVertical: 10, backgroundColor: '#F0F0ED', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4 },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#E5E5E080' },
    switchLabel: { fontSize: 15, color: COLORS.text, fontWeight: '600' },
    questionText: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: 12 },
    guideContainer: { backgroundColor: COLORS.primaryLight, padding: 15, borderRadius: 12, marginBottom: 15 },
    guideStep: { fontSize: 13, color: COLORS.primary, marginBottom: 6, lineHeight: 18 },
    
    buttonRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 15, gap: 10, marginTop: 10 },
    backBtn: { flex: 1, padding: 15, backgroundColor: COLORS.white, borderRadius: 12, borderWidth: 1, borderColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center' },
    backBtnText: { color: COLORS.gray, fontWeight: 'bold', fontSize: 16 },
    nextBtn: { flex: 2, borderRadius: 12, overflow: 'hidden', height: 50 },
    btnGradient: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    nextBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 16 },
});
