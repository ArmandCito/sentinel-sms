import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SmsRecord } from '@sentinel/contracts';
import { colors, verdictColor, verdictLabel } from '@/theme';
import { timeAgo } from '@/utils/format';
import { GlassCard } from './GlassCard';
import { ScoreBadge } from './ScoreBadge';

export function MessageRow({ record, onPress }: { record: SmsRecord; onPress: () => void }) {
  const c = verdictColor[record.verdict];
  return (
    <GlassCard onPress={onPress} style={styles.card}>
      <View style={[styles.bar, { backgroundColor: c }]} />
      <View style={styles.body}>
        <View style={styles.top}>
          <Text style={styles.sender} numberOfLines={1}>{record.sender}</Text>
          <ScoreBadge score={record.finalScore} verdict={record.verdict} />
        </View>
        <Text style={styles.preview} numberOfLines={2}>{record.body}</Text>
        <Text style={styles.meta}>
          <Text style={{ color: c }}>{verdictLabel[record.verdict]}</Text>
          {`  ·  ${timeAgo(record.receivedAt)}  ·  ${record.source === 'hybrid' ? 'AI checked' : 'on-device'}`}
        </Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', padding: 0 },
  bar: { width: 4 },
  body: { flex: 1, padding: 14, gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sender: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  preview: { color: colors.textDim, fontSize: 13, lineHeight: 18 },
  meta: { color: colors.textFaint, fontSize: 12 },
});
