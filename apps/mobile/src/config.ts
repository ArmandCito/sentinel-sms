/** Build-time configuration. EXPO_PUBLIC_* values are inlined by Metro. */
export const ENV = {
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? '').trim(),
  apiKey: (process.env.EXPO_PUBLIC_API_KEY ?? '').trim(),
};

export const APP_VERSION = '1.0.0';
export const MAX_RECORDS = 500;
