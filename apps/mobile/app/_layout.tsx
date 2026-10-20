import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SentinelProvider, useSentinel } from '@/state/SentinelContext';
import { colors } from '@/theme';

function Gate() {
  const { ready } = useSentinel();
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.safe} />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade_from_bottom' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="message/[id]" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SentinelProvider>
        <Gate />
      </SentinelProvider>
    </SafeAreaProvider>
  );
}
