import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

export function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' },
});
