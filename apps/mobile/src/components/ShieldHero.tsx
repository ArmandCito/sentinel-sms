import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '@/theme';

export type ShieldStatus = 'active' | 'paused' | 'attention' | 'preview';

const SIZE = 236;
const C = SIZE / 2;

const CONFIG: Record<ShieldStatus, { color: string; icon: keyof typeof Ionicons.glyphMap; title: string }> = {
  active: { color: colors.safe, icon: 'shield-checkmark', title: 'Protection active' },
  paused: { color: colors.textDim, icon: 'shield-outline', title: 'Protection paused' },
  attention: { color: colors.caution, icon: 'alert-circle', title: 'Action needed' },
  preview: { color: colors.accent, icon: 'flask', title: 'Preview mode' },
};

/** Central status shield: glowing backdrop, slow rotating tick ring, calm breathing pulse. */
export function ShieldHero({ status, subtitle }: { status: ShieldStatus; subtitle: string }) {
  const { color, icon, title } = CONFIG[status];
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const rotate = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 40000, easing: Easing.linear, useNativeDriver: true }));
    if (status === 'active' || status === 'preview') breathe.start();
    rotate.start();
    return () => { breathe.stop(); rotate.stop(); };
  }, [status, pulse, spin]);

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] });
  const rotation = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={styles.wrap} accessibilityRole="summary" accessibilityLabel={`${title}. ${subtitle}`}>
      <View style={styles.stage}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}>
          <Svg width={SIZE} height={SIZE}>
            <Defs>
              <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={color} stopOpacity={0.42} />
                <Stop offset="65%" stopColor={color} stopOpacity={0.1} />
                <Stop offset="100%" stopColor={color} stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={C} cy={C} r={C} fill="url(#glow)" />
          </Svg>
        </Animated.View>

        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: rotation }] }]}>
          <Svg width={SIZE} height={SIZE}>
            <Circle cx={C} cy={C} r={96} stroke={color} strokeOpacity={0.55} strokeWidth={2} strokeDasharray="2 9" strokeLinecap="round" fill="none" />
          </Svg>
        </Animated.View>

        <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
          <Circle cx={C} cy={C} r={78} stroke={color} strokeOpacity={0.9} strokeWidth={2} fill="rgba(15,23,42,0.85)" />
          <Circle cx={C} cy={C} r={66} stroke="rgba(255,255,255,0.08)" strokeWidth={1} fill="none" />
        </Svg>
        <Ionicons name={icon} size={64} color={color} />
      </View>
      <Text style={[styles.title, { color }]}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: 4 },
  stage: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', marginTop: 2, letterSpacing: 0.3 },
  subtitle: { color: colors.textDim, fontSize: 14, marginTop: 4, textAlign: 'center', maxWidth: 300, lineHeight: 20 },
});
