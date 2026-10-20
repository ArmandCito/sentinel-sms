import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { GlassCard } from '@/components/GlassCard';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { useSentinel } from '@/state/SentinelContext';
import { colors, mono, radius, verdictAdvice, verdictColor, verdictLabel } from '@/theme';
import { fullDate } from '@/utils/format';

function Bar({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <View style={{ marginTop: 10 }}>
      <View style={styles.barHead}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={[styles.mono, { color }]}>{value === null ? 'n/a' : `${value}/100`}</Text>
      </View>
      <View style={styles.track}><View style={[styles.fill, { width: `${value ?? 0}%`, backgroundColor: color }]} /></View>
    </View>
  );
}

export default function MessageDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { records, removeRecord } = useSentinel();
  const rec = records.find((r) => r.id === id);

  if (!rec) {
    return (
      <Screen>
        <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={22} color={colors.text} /><Text style={styles.backText}>Back</Text></Pressable>
        <GlassCard><Text style={styles.body}>This message is no longer in your history.</Text></GlassCard>
      </Screen>
    );
  }

  const c = verdictColor[rec.verdict];
  const positives = rec.hits.filter((h) => h.weight > 0);
  const protective = rec.hits.filter((h) => h.weight < 0);

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={22} color={colors.text} /><Text style={styles.backText}>Back</Text></Pressable>

      <GlassCard accent={c} style={{ alignItems: 'center', gap: 6 }}>
        <Text style={[styles.score, { color: c }]}>{rec.finalScore}</Text>
        <Text style={[styles.verdict, { color: c }]}>{verdictLabel[rec.verdict]}</Text>
        <Text style={styles.advice}>{rec.aiSummary || verdictAdvice[rec.verdict]}</Text>
      </GlassCard>

      <GlassCard>
        <Text style={styles.meta}>From</Text>
        <Text style={styles.sender}>{rec.sender}</Text>
        <Text style={[styles.meta, { marginTop: 10 }]}>Received</Text>
        <Text style={styles.body}>{fullDate(rec.receivedAt)}</Text>
        <Text style={[styles.meta, { marginTop: 10 }]}>Message</Text>
        <View style={styles.raw}><Text selectable style={styles.rawText}>{rec.body}</Text></View>
      </GlassCard>

      <SectionTitle title="Threat score breakdown" />
      <GlassCard>
        <Bar label="On-device rules" value={rec.offlineScore} color={colors.accent} />
        <Bar label={`AI analysis${rec.provider ? ` (${rec.provider})` : ''}`} value={rec.aiScore} color={colors.caution} />
        <Bar label="Final score" value={rec.finalScore} color={c} />
        <Text style={styles.note}>
          {rec.source === 'hybrid' ? 'Combined: rules 35% + AI 65%, with safeguards against both false alarms and missed scams.' : 'Offline result. The AI check runs automatically when you are online and a backend is set.'}
        </Text>
      </GlassCard>

      {positives.length > 0 && (
        <>
          <SectionTitle title="Warning signs" />
          <GlassCard>
            {positives.map((h) => (
              <View key={h.id} style={styles.hit}>
                <Ionicons name="warning" size={16} color={colors.caution} style={{ marginTop: 2 }} />
                <Text style={styles.hitLabel}>{h.label}</Text>
                <Text style={[styles.mono, { color: colors.caution }]}>+{h.weight}</Text>
              </View>
            ))}
          </GlassCard>
        </>
      )}

      {protective.length > 0 && (
        <GlassCard>
          {protective.map((h) => (
            <View key={h.id} style={styles.hit}>
              <Ionicons name="shield-checkmark" size={16} color={colors.safe} style={{ marginTop: 2 }} />
              <Text style={styles.hitLabel}>{h.label}</Text>
              <Text style={[styles.mono, { color: colors.safe }]}>{h.weight}</Text>
            </View>
          ))}
        </GlassCard>
      )}

      {rec.aiReasons.length > 0 && (
        <>
          <SectionTitle title="AI notes" />
          <GlassCard>
            {rec.aiReasons.map((r, i) => (
              <View key={i} style={styles.hit}>
                <Ionicons name="sparkles" size={16} color={colors.accent} style={{ marginTop: 2 }} />
                <Text style={styles.hitLabel}>{r}</Text>
              </View>
            ))}
          </GlassCard>
        </>
      )}

      <Button
        label="Delete from history"
        variant="danger"
        onPress={() => Alert.alert('Delete message?', 'It will be removed from this app only.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => { removeRecord(rec.id); router.back(); } },
        ])}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  backText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  score: { fontFamily: mono, fontSize: 64, fontWeight: '800', lineHeight: 70 },
  verdict: { fontSize: 18, fontWeight: '800' },
  advice: { color: colors.textDim, fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  meta: { color: colors.textFaint, fontSize: 12 },
  sender: { color: colors.text, fontSize: 17, fontWeight: '700', marginTop: 2 },
  body: { color: colors.text, fontSize: 14, marginTop: 2 },
  raw: { marginTop: 6, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: 12 },
  rawText: { color: colors.text, fontFamily: mono, fontSize: 13, lineHeight: 19 },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barLabel: { color: colors.textDim, fontSize: 13 },
  mono: { fontFamily: mono, fontSize: 13, fontWeight: '700' },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  note: { color: colors.textFaint, fontSize: 12, lineHeight: 18, marginTop: 14 },
  hit: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 6 },
  hitLabel: { flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 },
});
