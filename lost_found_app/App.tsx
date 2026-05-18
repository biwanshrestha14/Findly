import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import AuthScreen from './src/screens/auth/AuthScreen';
import HomeScreen from './src/screens/main/HomeScreen';
import AddItemScreen from './src/screens/items/AddItemScreen';
import ItemDetailScreen from './src/screens/items/ItemDetailScreen';
import ClaimItemScreen from './src/screens/claims/ClaimItemScreen';
import ProfileScreen from './src/screens/main/ProfileScreen';
import NotificationScreen from './src/screens/main/NotificationScreen';
import KYCScreen from './src/screens/admin/KYCScreen';
import VerificationSetupScreen from './src/screens/admin/VerificationSetupScreen';
import ClaimVerificationScreen from './src/screens/claims/ClaimVerificationScreen';
import ClaimStatusScreen from './src/screens/claims/ClaimStatusScreen';
import AdminScreen from './src/screens/admin/AdminScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    const checkToken = async () => {
      const token = await AsyncStorage.getItem('access_token');
      setInitialRoute(token ? 'Home' : 'Auth');
    };
    checkToken();
  }, []);

  if (!initialRoute) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute}>
        <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Findly' }} />
        <Stack.Screen name="AddItem" component={AddItemScreen} options={{ title: 'Report Item' }} />
        <Stack.Screen name="ItemDetail" component={ItemDetailScreen} options={{ title: 'Item Details' }} />
        <Stack.Screen name="ClaimItem" component={ClaimItemScreen} options={{ title: 'Claim Item' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
        <Stack.Screen name="Notifications" component={NotificationScreen} options={{ title: 'Notifications' }} />
        <Stack.Screen name="KYC" component={KYCScreen} options={{ title: 'KYC Verification' }} />
        <Stack.Screen name="VerificationSetup" component={VerificationSetupScreen} options={{ title: 'Verification Details' }} />
        <Stack.Screen name="ClaimVerification" component={ClaimVerificationScreen} options={{ title: 'Verify Claim' }} />
        <Stack.Screen name="ClaimStatus" component={ClaimStatusScreen} options={{ title: 'Claim Status' }} />
        <Stack.Screen name="Admin" component={AdminScreen} options={{ title: 'Admin Panel' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
