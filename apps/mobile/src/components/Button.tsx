import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius } from '@/theme';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

export function Button({ label, onPress, variant = 'primary', loading, disabled, compact }: Props) {
  const bg = variant === 'primary' ? colors.safe : variant === 'danger' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)';
  const fg = variant === 'primary' ? '#04130D' : variant === 'danger' ? colors.danger : colors.text;
  const border = variant === 'danger' ? 'rgba(239,68,68,0.5)' : variant === 'ghost' ? colors.border : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.btn, compact && styles.compact, { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 }]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.label, { color: fg }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: radius, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  compact: { paddingVertical: 8, minHeight: 36 },
  label: { fontSize: 14, fontWeight: '700' },
});
