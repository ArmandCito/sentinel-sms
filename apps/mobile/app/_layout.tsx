import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { clearLastCrash, installCrashLogger, readLastCrash, type CrashInfo } from '@/services/crashLog';
import { SentinelProvider, useSentinel } from '@/state/SentinelContext';
import { colors } from '@/theme';

installCrashLogger();

/** If the previous launch crashed, show why before continuing. */
function CrashReport({ crash, onContinue }: { crash: CrashInfo; onContinue: () => void }) {
  return (
    <View style={styles.crashRoot}>
      <ScrollView contentContainerStyle={styles.crashContent}>
        <Text style={styles.crashTitle}>The app crashed last time</Text>
        <Text style={styles.crashHint}>Send a screenshot of this screen to the developer, then tap Continue.</Text>
        <Text selectable style={styles.crashMsg}>{crash.message}</Text>
        <Text selectable style={styles.crashStack}>{crash.stack}</Text>
        <Button label="Continue" onPress={onContinue} />
      </ScrollView>
    </View>
  );
}

function Gate() {
  const { ready } = useSentinel();
  const [crash, setCrash] = useState<CrashInfo | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    readLastCrash().then((c) => { setCrash(c); setChecked(true); });
  }, []);

  if (!ready || !checked) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.safe} />
      </View>
    );
  }
  if (crash) {
    return <CrashReport crash={crash} onContinue={() => { void clearLastCrash(); setCrash(null); }} />;
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
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <SentinelProvider>
          <Gate />
        </SentinelProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  crashRoot: { flex: 1, backgroundColor: colors.bg },
  crashContent: { padding: 24, paddingTop: 64, gap: 12 },
  crashTitle: { color: colors.danger, fontSize: 20, fontWeight: '800' },
  crashHint: { color: colors.textDim, fontSize: 13 },
  crashMsg: { color: colors.text, fontSize: 14, fontFamily: 'monospace' },
  crashStack: { color: colors.textFaint, fontSize: 11, fontFamily: 'monospace', marginBottom: 12 },
});
