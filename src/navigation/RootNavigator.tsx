import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { RootStackParamList } from '../types';
import { colors } from '../utils/theme';
import ErrorBoundary from '../components/ErrorBoundary';

import OnboardingScreen, { ONBOARDING_KEY } from '../screens/Auth/OnboardingScreen';
import PhoneLoginScreen from '../screens/Auth/PhoneLoginScreen';
import EmailAuthScreen from '../screens/Auth/EmailAuthScreen';
import EmailVerifyScreen from '../screens/Auth/EmailVerifyScreen';
import ProfileSetupScreen from '../screens/Auth/ProfileSetupScreen';
import MainTabs from './MainTabs';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { firebaseUser, userProfile, isLoading, onboardingDone, setOnboardingDone } = useAuthStore();

  // Read onboarding flag once on mount — stored in authStore so any screen can update it
  useEffect(() => {
    const timer = setTimeout(() => {
      // Safety fallback: if AsyncStorage hangs, assume onboarding done
      setOnboardingDone(true);
    }, 2000);

    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((val) => {
        clearTimeout(timer);
        setOnboardingDone(val === '1');
      })
      .catch(() => {
        clearTimeout(timer);
        setOnboardingDone(true);
      });

    return () => clearTimeout(timer);
  }, []);

  // Show spinner until auth state AND onboarding flag are both known
  if (isLoading || onboardingDone === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!onboardingDone ? (
          // First launch — show onboarding slides
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : !firebaseUser ? (
          // Not signed in — phone + email auth screens available
          <>
            <Stack.Screen name="PhoneLogin"  component={PhoneLoginScreen} />
            <Stack.Screen name="EmailAuth"   component={EmailAuthScreen} />
            <Stack.Screen name="EmailVerify" component={EmailVerifyScreen} />
          </>
        ) : (firebaseUser.email && !firebaseUser.emailVerified) ? (
          // Email user who hasn't verified yet
          <Stack.Screen name="EmailVerify" component={EmailVerifyScreen} />
        ) : !userProfile ? (
          // Signed in but no profile yet
          <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        ) : (
          // Fully set up — main app
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
