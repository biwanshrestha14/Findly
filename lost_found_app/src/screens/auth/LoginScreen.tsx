import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { authApi } from '../../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen({ navigation }: any) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async () => {
        try {
            const res = await authApi.post('login/', { username, password });
            await AsyncStorage.setItem('access_token', res.data.access);
            await AsyncStorage.setItem('refresh_token', res.data.refresh);
            await AsyncStorage.setItem('username', username);
            navigation.replace('Home');
        } catch (error) {
            Alert.alert('Login Failed', 'Invalid credentials');
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Welcome Back</Text>
            <TextInput style={styles.input} placeholder="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
            <View style={styles.passwordContainer}>
                <TextInput
                    style={styles.passwordInput}
                    placeholder="Password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                />
                <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                    <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.button} onPress={handleLogin}>
                <Text style={styles.buttonText}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.link}>Don't have an account? Register</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f5f6fa' },
    title: { fontSize: 28, fontWeight: 'bold', marginBottom: 30, textAlign: 'center', color: '#2f3640' },
    input: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#dcdde1' },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 10,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#dcdde1',
    },
    passwordInput: {
        flex: 1,
        padding: 15,
    },
    eyeButton: {
        paddingHorizontal: 15,
        paddingVertical: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    eyeText: {
        fontSize: 20,
    },
    button: { backgroundColor: '#3498db', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 10 },
    buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    link: { marginTop: 20, textAlign: 'center', color: '#3498db', fontWeight: '500' }
});
