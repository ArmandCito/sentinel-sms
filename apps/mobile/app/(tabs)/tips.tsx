import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/GlassCard';
import { Screen } from '@/components/Screen';
import { SAFETY_TIPS } from '@/constants/samples';
import { colors } from '@/theme';

export default function Tips() {
  return (
    <Screen>
      <Text style={styles.title}>Safety tips</Text>
      <Text style={styles.lead}>Scammers copy banks, mobile-money providers and couriers. These habits beat them.</Text>
      {SAFETY_TIPS.map((t) => (
        <GlassCard key={t.title} style={styles.card}>
          <View style={styles.icon}><Ionicons name={t.icon} size={22} color={colors.safe} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tipTitle}>{t.title}</Text>
            <Text style={styles.tipText}>{t.text}</Text>
          </View>
        </GlassCard>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  lead: { color: colors.textDim, fontSize: 14, lineHeight: 20 },
  card: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  icon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(16,185,129,0.12)', alignItems: 'center', justifyContent: 'center' },
  tipTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  tipText: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 3 },
});
