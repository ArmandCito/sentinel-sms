import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Verdict } from '@sentinel/contracts';
import { mono, verdictColor, verdictLabel } from '@/theme';

/** Monospace pill: "87/100". */
export function ScoreBadge({ score, verdict, showLabel = false }: { score: number; verdict: Verdict; showLabel?: boolean }) {
  const c = verdictColor[verdict];
  return (
    <View style={[styles.pill, { borderColor: `${c}88`, backgroundColor: `${c}1F` }]}>
      <Text style={[styles.text, { color: c }]}>{showLabel ? `${verdictLabel[verdict]} ${score}` : `${score}/100`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontFamily: mono, fontSize: 12, fontWeight: '700' },
});
