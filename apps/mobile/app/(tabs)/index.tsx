import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { SmsRecord } from '@sentinel/contracts';
import { Button } from '@/components/Button';
import { GlassCard } from '@/components/GlassCard';
import { MessageRow } from '@/components/MessageRow';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { ShieldHero, type ShieldStatus } from '@/components/ShieldHero';
import { SAMPLE_SAFE, SAMPLE_SCAM } from '@/constants/samples';
import { native } from '@/services/native';
import { useSentinel } from '@/state/SentinelContext';
import { colors, mono, radius } from '@/theme';

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <GlassCard style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </GlassCard>
  );
}

function CheckRow({ ok, label, hint, action, onPress }: { ok: boolean; label: string; hint: string; action: string; onPress: () => void }) {
  return (
    <View style={styles.checkRow}>
      <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={ok ? colors.safe : colors.caution} />
      <View style={{ flex: 1 }}>
        <Text style={styles.checkLabel}>{label}</Text>
        {!ok && <Text style={styles.checkHint}>{hint}</Text>}
      </View>
      {!ok && <Button label={action} onPress={onPress} variant="ghost" compact />}
    </View>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const { records, stats, settings, permissions, nativeAvailable, requestPermissions, analyzeText, simulateIncomingSms } = useSentinel();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<SmsRecord | null>(null);

  const permsOk = permissions.sms && permissions.notifications;
  let status: ShieldStatus = 'active';
  let subtitle = stats.threats24h > 0 ? `${stats.threats24h} suspicious message${stats.threats24h > 1 ? 's' : ''} flagged in the last 24 h.` : 'Watching every incoming SMS, even when your phone is locked.';
  if (!nativeAvailable) { status = 'preview'; subtitle = 'Live SMS interception needs the Sentinel build. You can still test messages below.'; }
  else if (!settings.protectionEnabled) { status = 'paused'; subtitle = 'Turn protection back on in Settings.'; }
  else if (!permsOk) { status = 'attention'; subtitle = 'Allow SMS and notification access so Sentinel can protect you.'; }

  const run = async (fn: () => Promise<SmsRecord>) => {
    setBusy(true);
    try { setLast(await fn()); } catch (e) { Alert.alert('Analysis failed', e instanceof Error ? e.message : 'Unknown error'); } finally { setBusy(false); }
  };

  const recent = records.slice(0, 3);

  return (
    <Screen>
      <View>
        <Text style={styles.brand}>SMS Sentinel</Text>
        <Text style={styles.slogan}>Spot suspicious SMS before you click</Text>
      </View>

      <ShieldHero status={status} subtitle={subtitle} />

      <View style={styles.statsRow}>
        <Stat label="Scanned" value={stats.total} color={colors.text} />
        <Stat label="Caution" value={stats.caution} color={colors.caution} />
        <Stat label="Danger" value={stats.danger} color={colors.danger} />
      </View>

      {nativeAvailable && (!permsOk || !permissions.battery) && (
        <GlassCard accent={colors.caution}>
          <Text style={styles.cardTitle}>Finish setup</Text>
          <CheckRow ok={permissions.sms} label="Read incoming SMS" hint="Required to scan messages." action="Allow" onPress={requestPermissions} />
          <CheckRow ok={permissions.notifications} label="Show alerts" hint="So you are warned instantly." action="Allow" onPress={requestPermissions} />
          <CheckRow ok={permissions.battery} label="Run in background" hint="Disable battery optimisation so alerts are never delayed." action="Open" onPress={() => native.openBatterySettings()} />
        </GlassCard>
      )}

      <GlassCard>
        <Text style={styles.cardTitle}>Check a message</Text>
        <Text style={styles.cardText}>Paste any suspicious text. Works offline; adds AI when connected.</Text>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Paste the SMS here..."
          placeholderTextColor={colors.textFaint}
          multiline
          style={styles.input}
          maxLength={1600}
        />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Button label="Analyze" loading={busy} disabled={!text.trim()} onPress={() => run(() => analyzeText('Manual check', text.trim()))} />
          </View>
          <Button label="Scam example" variant="ghost" onPress={() => setText(SAMPLE_SCAM.body)} />
          <Button label="Safe example" variant="ghost" onPress={() => setText(SAMPLE_SAFE.body)} />
        </View>
        {last && (
          <View style={{ marginTop: 12 }}>
            <MessageRow record={last} onPress={() => router.push({ pathname: '/message/[id]', params: { id: last.id } })} />
          </View>
        )}
      </GlassCard>

      {nativeAvailable && (
        <GlassCard>
          <Text style={styles.cardTitle}>Test the real alert</Text>
          <Text style={styles.cardText}>Runs a fake SMS through the native engine and posts a real notification.</Text>
          <View style={{ marginTop: 10 }}>
            <Button label="Simulate incoming scam SMS" variant="danger" loading={busy} onPress={() => run(() => simulateIncomingSms(SAMPLE_SCAM.sender, SAMPLE_SCAM.body))} />
          </View>
        </GlassCard>
      )}

      <SectionTitle title="Recent" right={recent.length ? <Text style={styles.link} onPress={() => router.push('/history')}>See all</Text> : undefined} />
      {recent.length === 0 ? (
        <GlassCard><Text style={styles.cardText}>Nothing scanned yet. New SMS will appear here automatically.</Text></GlassCard>
      ) : (
        recent.map((r) => <MessageRow key={r.id} record={r} onPress={() => router.push({ pathname: '/message/[id]', params: { id: r.id } })} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: 0.2 },
  slogan: { color: colors.textDim, fontSize: 14, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 14 },
  statValue: { fontFamily: mono, fontSize: 26, fontWeight: '800' },
  statLabel: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  cardText: { color: colors.textDim, fontSize: 13, lineHeight: 19 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  checkLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  checkHint: { color: colors.textDim, fontSize: 12, marginTop: 1 },
  input: {
    marginTop: 12, minHeight: 90, maxHeight: 180, textAlignVertical: 'top', color: colors.text, fontFamily: mono, fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: 12,
  },
  row: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
  link: { color: colors.accent, fontSize: 13, fontWeight: '600' },
});
