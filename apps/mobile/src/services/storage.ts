import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SmsRecord } from '@sentinel/contracts';
import { ENV, MAX_RECORDS } from '@/config';

export interface Settings {
  protectionEnabled: boolean;
  /** Also alert for "caution" messages (default: danger only). */
  alertOnCaution: boolean;
  onlineEnabled: boolean;
  apiUrl: string;
  apiKey: string;
}

export const DEFAULT_SETTINGS: Settings = {
  protectionEnabled: true,
  alertOnCaution: false,
  onlineEnabled: true,
  apiUrl: ENV.apiUrl,
  apiKey: ENV.apiKey,
};

const SETTINGS_KEY = 'sentinel.settings.v1';
const RECORDS_KEY = 'sentinel.records.v1';
const DEVICE_KEY = 'sentinel.deviceId.v1';

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  try { await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { console.warn('[storage] settings', e); }
}

export async function loadRecords(): Promise<SmsRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(RECORDS_KEY);
    const arr = raw ? (JSON.parse(raw) as SmsRecord[]) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function saveRecords(records: SmsRecord[]): Promise<void> {
  try { await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(records.slice(0, MAX_RECORDS))); } catch (e) { console.warn('[storage] records', e); }
}

/** Fallback anonymous id when the native module is missing. */
export async function jsDeviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = `js-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    await AsyncStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return 'js-unknown';
  }
}
