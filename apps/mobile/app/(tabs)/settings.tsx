import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { GlassCard } from '@/components/GlassCard';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { APP_VERSION } from '@/config';
import { checkHealth } from '@/services/api';
import { native } from '@/services/native';
import { useSentinel } from '@/state/SentinelContext';
import { colors, mono, radius } from '@/theme';

function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ false: '#334155', true: 'rgba(16,185,129,0.5)' }} thumbColor={value ? colors.safe : '#94A3B8'} />
    </View>
  );
}

export default function Settings() {
  const { settings, updateSettings, permissions, requestPermissions, clearAll, nativeAvailable } = useSentinel();
  const [url, setUrl] = useState(settings.apiUrl);
  const [key, setKey] = useState(settings.apiKey);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => { setUrl(settings.apiUrl); setKey(settings.apiKey); }, [settings.apiUrl, settings.apiKey]);

  const saveBackend = async () => {
    await updateSettings({ apiUrl: url.trim().replace(/\/+$/, ''), apiKey: key.trim() });
    setResult({ ok: true, text: 'Saved.' });
  };

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const { info, ms } = await checkHealth({ baseUrl: url, apiKey: key });
      setResult({ ok: true, text: `Connected in ${ms} ms. Database ${info.database}. AI: ${info.ai_configured ? info.ai_provider : 'not configured (rules only)'}.` });
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>Settings</Text>

      <GlassCard>
        <ToggleRow label="Protection" hint="Scan every incoming SMS." value={settings.protectionEnabled} onChange={(v) => updateSettings({ protectionEnabled: v })} />
        <ToggleRow label="Alert on suspicious too" hint="Off: alert only for high-risk (65+). On: also for caution (35+)." value={settings.alertOnCaution} onChange={(v) => updateSettings({ alertOnCaution: v })} />
        <ToggleRow label="Online AI analysis" hint="Sends the SMS text to your backend for a deeper check when internet is available." value={settings.onlineEnabled} onChange={(v) => updateSettings({ onlineEnabled: v })} />
      </GlassCard>

      <SectionTitle title="Backend" />
      <GlassCard>
        <Text style={styles.label}>Server URL</Text>
        <TextInput value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://your-api.onrender.com" placeholderTextColor={colors.textFaint} style={styles.input} />
        <Text style={[styles.label, { marginTop: 12 }]}>API key (optional)</Text>
        <TextInput value={key} onChangeText={setKey} autoCapitalize="none" autoCorrect={false} secureTextEntry placeholder="matches APP_API_KEY" placeholderTextColor={colors.textFaint} style={styles.input} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}><Button label="Save" onPress={saveBackend} /></View>
          <View style={{ flex: 1 }}><Button label="Test connection" variant="ghost" loading={testing} onPress={test} /></View>
        </View>
        {result && <Text style={[styles.result, { color: result.ok ? colors.safe : colors.danger }]}>{result.text}</Text>}
      </GlassCard>

      {nativeAvailable && (
        <>
          <SectionTitle title="Device" />
          <GlassCard>
            <Text style={styles.hint}>SMS access: {permissions.sms ? 'granted' : 'missing'}  ·  Notifications: {permissions.notifications ? 'granted' : 'missing'}  ·  Battery: {permissions.battery ? 'unrestricted' : 'optimised'}</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}><Button label="Grant permissions" variant="ghost" onPress={requestPermissions} /></View>
              <View style={{ flex: 1 }}><Button label="Battery settings" variant="ghost" onPress={() => native.openBatterySettings()} /></View>
            </View>
            <View style={{ marginTop: 8 }}><Button label="Open app settings" variant="ghost" onPress={() => native.openAppSettings()} /></View>
            <Text style={[styles.hint, { marginTop: 10 }]}>Android 13+ and the SMS permission not showing? Open app settings, tap the ⋮ menu, choose "Allow restricted settings", then grant again.</Text>
          </GlassCard>
        </>
      )}

      <SectionTitle title="Data" />
      <GlassCard>
        <Button label="Clear history" variant="danger" onPress={() => Alert.alert('Clear history?', 'This removes all scanned messages from this phone.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: clearAll }])} />
        <Text style={[styles.hint, { marginTop: 10 }]}>Privacy: messages stay on your phone. With online analysis on, only the text of each new SMS is sent to your own backend; the server stores a hash, not the text, by default.</Text>
      </GlassCard>

      <Text style={styles.version}>SMS Sentinel v{APP_VERSION}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  label: { color: colors.text, fontSize: 14, fontWeight: '700' },
  hint: { color: colors.textDim, fontSize: 12, lineHeight: 18, marginTop: 2 },
  input: { marginTop: 6, color: colors.text, fontFamily: mono, fontSize: 13, backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: radius, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10 },
  row: { flexDirection: 'row', gap: 8, marginTop: 14 },
  result: { marginTop: 10, fontSize: 13, lineHeight: 19 },
  version: { color: colors.textFaint, fontSize: 12, textAlign: 'center', fontFamily: mono, marginTop: 8 },
});
