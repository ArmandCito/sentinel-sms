import { Platform } from 'react-native';
import type { Verdict } from '@sentinel/contracts';

export const colors = {
  bg: '#0B0F17',
  bgAlt: '#0F172A',
  card: 'rgba(255,255,255,0.04)',
  border: 'rgba(255,255,255,0.08)',
  text: '#E5E7EB',
  textDim: '#94A3B8',
  textFaint: '#64748B',
  safe: '#10B981',
  caution: '#F59E0B',
  danger: '#EF4444',
  accent: '#38BDF8',
} as const;

export const radius = 12;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** Monospace is reserved for scores, badges and raw SMS text. */
export const mono = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string;

export const verdictColor: Record<Verdict, string> = {
  safe: colors.safe,
  caution: colors.caution,
  danger: colors.danger,
};

export const verdictLabel: Record<Verdict, string> = {
  safe: 'Safe',
  caution: 'Caution',
  danger: 'Danger',
};

export const verdictAdvice: Record<Verdict, string> = {
  safe: 'No significant scam signals found. Stay alert anyway.',
  caution: 'Some warning signs. Do not click links; check with the sender through an official channel.',
  danger: 'Very likely a scam. Do not click, do not reply, do not share codes. Delete and block the sender.',
};
