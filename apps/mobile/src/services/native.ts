import { Platform } from 'react-native';
import { requireNativeModule } from 'expo';
import type { SmsRecord } from '@sentinel/contracts';

/**
 * Typed wrapper around the Kotlin module (modules/sentinel-sms).
 * Every call is safe when the module is absent (Expo Go, iOS, web): `available` is false and
 * calls become no-ops, so the UI still works for testing the analysis engine.
 */
interface NativeShape {
  configure(protectionEnabled: boolean, onlineEnabled: boolean, apiUrl: string, apiKey: string, notifyMin: number): void;
  getDeviceId(): string;
  drainPending(): string;
  readInbox(limit: number): string;
  simulateSms(sender: string, body: string): Promise<string>;
  isIgnoringBatteryOptimizations(): boolean;
  openBatterySettings(): void;
  openAppSettings(): void;
  addListener(event: 'onSmsAnalyzed', cb: (e: { json: string }) => void): { remove(): void };
}

let mod: NativeShape | null = null;
if (Platform.OS === 'android') {
  try {
    mod = requireNativeModule<NativeShape>('SentinelSms');
  } catch {
    mod = null; // running in Expo Go or a build without the module
  }
}

function parseRecords(json: string): SmsRecord[] {
  try {
    const arr = JSON.parse(json) as SmsRecord[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export const native = {
  available: mod !== null,

  configure(protectionEnabled: boolean, onlineEnabled: boolean, apiUrl: string, apiKey: string, notifyMin: number): void {
    try { mod?.configure(protectionEnabled, onlineEnabled, apiUrl, apiKey, notifyMin); } catch (e) { console.warn('[native] configure', e); }
  },
  getDeviceId(): string | null {
    try { return mod?.getDeviceId() ?? null; } catch { return null; }
  },
  drainPending(): SmsRecord[] {
    try { return mod ? parseRecords(mod.drainPending()) : []; } catch { return []; }
  },
  readInbox(limit: number): { sender: string; body: string; date: number }[] {
    try { return mod ? JSON.parse(mod.readInbox(limit)) : []; } catch { return []; }
  },
  async simulateSms(sender: string, body: string): Promise<SmsRecord | null> {
    if (!mod) return null;
    try { return JSON.parse(await mod.simulateSms(sender, body)) as SmsRecord; } catch (e) { console.warn('[native] simulate', e); return null; }
  },
  isIgnoringBatteryOptimizations(): boolean {
    try { return mod?.isIgnoringBatteryOptimizations() ?? false; } catch { return false; }
  },
  openBatterySettings(): void { try { mod?.openBatterySettings(); } catch { /* ignore */ } },
  openAppSettings(): void { try { mod?.openAppSettings(); } catch { /* ignore */ } },

  /** Subscribe to messages analysed natively while the JS app is alive. Returns an unsubscribe fn. */
  onSmsAnalyzed(cb: (record: SmsRecord) => void): () => void {
    if (!mod) return () => undefined;
    try {
      const sub = mod.addListener('onSmsAnalyzed', (e) => {
        try { cb(JSON.parse(e.json) as SmsRecord); } catch { /* ignore malformed event */ }
      });
      return () => { try { sub.remove(); } catch { /* ignore */ } };
    } catch (e) {
      console.warn('[native] addListener failed', e);
      return () => undefined;
    }
  },
};
