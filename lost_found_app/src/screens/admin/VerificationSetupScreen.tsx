import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    SafeAreaView, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { addVerificationDetails } from '../../api';

const COLORS = {
    primary: '#0F6E56', primaryLight: '#E1F5EE',
    bg: '#F8F7F2', card: '#FFFFFF',
    text: '#1A1A1A', textSec: '#6B6B6B',
    amber: '#BA7517', amberLight: '#FAEEDA',
    border: '#E5E5E0',
};

const EXAMPLE_CHIPS = [
    { text: 'Has a crack or chip', hint: 'Does your item have any visible damage or cracks?' },
    { text: 'Has stickers or markings', hint: 'Does your item have any stickers or decorations?' },
    { text: 'Has an engraving or personalization', hint: 'Does your item have any engravings or personalization?' },
    { text: 'Has a unique case or cover', hint: 'Does your item have a distinctive case or cover?' },
    { text: 'Has something inside', hint: 'Does your item contain any specific contents?' },
];

interface DetailEntry {
    detail_text: string;
    detail_hint: string;
}

export default function VerificationSetupScreen({ route, navigation }: any) {
    const { itemId } = route.params;
    const [details, setDetails] = useState<DetailEntry[]>([
        { detail_text: '', detail_hint: '' },
        { detail_text: '', detail_hint: '' },
        { detail_text: '', detail_hint: '' },
    ]);
    const [submitting, setSubmitting] = useState(false);

    const updateDetail = (index: number, field: keyof DetailEntry, value: string) => {
        const updated = [...details];
        updated[index] = { ...updated[index], [field]: value };

        // Auto-suggest hint when user types detail_text
        if (field === 'detail_text' && value.length > 10 && !updated[index].detail_hint) {
            const lower = value.toLowerCase();
            if (lower.includes('crack') || lower.includes('chip') || lower.includes('scratch'))
                updated[index].detail_hint = 'Does your item have any visible damage or marks?';
            else if (lower.includes('sticker') || lower.includes('mark'))
                updated[index].detail_hint = 'Does your item have any stickers or markings?';
            else if (lower.includes('engrav') || lower.includes('initial'))
                updated[index].detail_hint = 'Does your item have any engravings or personalization?';
            else if (lower.includes('case') || lower.includes('cover'))
                updated[index].detail_hint = 'Does your item have a distinctive case or cover?';
            else
                updated[index].detail_hint = 'Does your item have a distinguishing physical feature?';
        }
        setDetails(updated);
    };

    const applyChip = (chip: typeof EXAMPLE_CHIPS[0]) => {
        const emptyIdx = details.findIndex(d => !d.detail_text);
        if (emptyIdx !== -1) {
            const updated = [...details];
            updated[emptyIdx] = { detail_text: chip.text, detail_hint: chip.hint };
            setDetails(updated);
        }
    };

    const handleSubmit = async () => {
        const valid = details.filter(d => d.detail_text.trim() && d.detail_hint.trim());
        if (valid.length < 2) {
            Alert.alert('Error', 'Please add at least 2 verification details.');
            return;
        }
        setSubmitting(true);
        try {
            await addVerificationDetails(itemId, valid);
            Alert.alert('Success', 'Verification details saved!', [
                { text: 'OK', onPress: () => navigation.navigate('Home') }
            ]);
        } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.error || 'Failed to save details.');
        }
        setSubmitting(false);
    };

    const handleSkip = () => {
        Alert.alert(
            'Skip Verification?',
            'Without details, the admin must verify claims manually. This may slow down the process.',
            [
                { text: 'Add Details', style: 'cancel' },
                { text: 'Skip Anyway', style: 'destructive', onPress: () => navigation.navigate('Home') },
            ]
        );
    };

    const filledCount = details.filter(d => d.detail_text.trim()).length;

    return (
        <SafeAreaView style={s.container}>
            <ScrollView contentContainerStyle={s.scroll}>
                <Text style={s.title}>Help verify the owner</Text>
                <Text style={s.subtitle}>
                    Describe 2–3 specific details only the true owner would know.
                    These will be used to verify any claim.
                </Text>

                {/* Example chips */}
                <Text style={s.chipLabel}>Tap for inspiration:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll}>
                    {EXAMPLE_CHIPS.map((chip, i) => (
                        <TouchableOpacity key={i} style={s.chip} onPress={() => applyChip(chip)}>
                            <Text style={s.chipText}>{chip.text}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Detail cards */}
                {details.map((d, i) => (
                    <View key={i} style={[s.detailCard, i === 2 && !d.detail_text && s.optionalCard]}>
                        <View style={s.detailHeader}>
                            <Text style={s.detailNum}>Detail {i + 1}</Text>
                            {i < 2 ? (
                                <Text style={s.required}>Required</Text>
                            ) : (
                                <Text style={s.optional}>Optional</Text>
                            )}
                        </View>

                        <Text style={s.inputLabel}>Describe the detail</Text>
                        <TextInput
                            style={s.textArea}
                            placeholder="e.g. Has a crack on the bottom-left corner"
                            placeholderTextColor="#ABABAB"
                            value={d.detail_text}
                            onChangeText={v => updateDetail(i, 'detail_text', v)}
                            multiline
                            maxLength={300}
                        />
                        <Text style={s.charCount}>{d.detail_text.length}/300</Text>

                        <Text style={s.inputLabel}>Neutral hint for claimant</Text>
                        <TextInput
                            style={s.input}
                            placeholder="e.g. Does your item have any visible damage?"
                            placeholderTextColor="#ABABAB"
                            value={d.detail_hint}
                            onChangeText={v => updateDetail(i, 'detail_hint', v)}
                            maxLength={150}
                        />
                        <Text style={s.charCount}>{d.detail_hint.length}/150</Text>
                    </View>
                ))}

                {/* Preview */}
                {filledCount > 0 && (
                    <View style={s.previewSection}>
                        <Text style={s.previewTitle}>👁️ How claimants will see your hints:</Text>
                        {details.filter(d => d.detail_hint.trim()).map((d, i) => (
                            <View key={i} style={s.previewItem}>
                                <Text style={s.previewQ}>Q{i + 1}: {d.detail_hint}</Text>
                                <Text style={s.previewA}>Answer: YES / NO</Text>
                            </View>
                        ))}
                    </View>
                )}

                <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={submitting}>
                    {submitting ? (
                        <ActivityIndicator color="#FFF" />
                    ) : (
                        <Text style={s.submitText}>Save Verification Details</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity style={s.skipBtn} onPress={handleSkip}>
                    <Text style={s.skipText}>Skip for now</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    scroll: { padding: 20, paddingBottom: 40 },
    title: { fontSize: 24, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
    subtitle: { fontSize: 14, color: COLORS.textSec, lineHeight: 21, marginBottom: 20 },
    chipLabel: { fontSize: 13, color: COLORS.textSec, marginBottom: 8 },
    chipScroll: { marginBottom: 20 },
    chip: {
        backgroundColor: COLORS.primaryLight, paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 20, marginRight: 8,
    },
    chipText: { color: COLORS.primary, fontSize: 13, fontWeight: '500' },
    detailCard: {
        backgroundColor: COLORS.card, borderRadius: 16, padding: 18,
        marginBottom: 14, borderWidth: 1, borderColor: COLORS.border,
        shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12,
        shadowOffset: { width: 0, height: 2 }, elevation: 3,
    },
    optionalCard: { borderStyle: 'dashed', opacity: 0.8 },
    detailHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    detailNum: { fontSize: 15, fontWeight: '600', color: COLORS.text },
    required: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
    optional: { fontSize: 12, color: COLORS.textSec },
    inputLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSec, marginBottom: 6 },
    textArea: {
        backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
        borderRadius: 12, padding: 12, fontSize: 15, color: COLORS.text,
        minHeight: 70, textAlignVertical: 'top',
    },
    input: {
        backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border,
        borderRadius: 12, padding: 12, fontSize: 15, color: COLORS.text,
    },
    charCount: { fontSize: 11, color: COLORS.textSec, textAlign: 'right', marginTop: 4, marginBottom: 8 },
    previewSection: {
        backgroundColor: COLORS.primaryLight, borderRadius: 16, padding: 16, marginBottom: 20,
    },
    previewTitle: { fontSize: 14, fontWeight: '600', color: COLORS.primary, marginBottom: 10 },
    previewItem: { marginBottom: 8 },
    previewQ: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
    previewA: { fontSize: 12, color: COLORS.textSec, marginTop: 2 },
    submitBtn: {
        backgroundColor: COLORS.primary, paddingVertical: 16,
        borderRadius: 12, alignItems: 'center',
    },
    submitText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
    skipBtn: { alignItems: 'center', paddingVertical: 16 },
    skipText: { color: COLORS.textSec, fontSize: 14, fontWeight: '500' },
});
