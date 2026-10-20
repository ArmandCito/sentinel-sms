import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radius } from '@/theme';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Tints the border, e.g. with a verdict colour. */
  accent?: string;
  onPress?: () => void;
}

/** Glass surface: translucent gradient, 12px radius, 1px hairline border. */
export function GlassCard({ children, style, accent, onPress }: Props) {
  const card = (
    <LinearGradient
      colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0.02)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, accent ? { borderColor: `${accent}66` } : null, style]}
    >
      {children}
    </LinearGradient>
  );
  if (!onPress) return card;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })} android_ripple={{ color: 'rgba(255,255,255,0.06)' }}>
      {card}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    overflow: 'hidden',
  },
});
