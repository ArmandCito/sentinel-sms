import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { RecordOrigin, SmsRecord } from '@sentinel/contracts';
import { MAX_RECORDS } from '@/config';
import { analyzeHybrid } from '@/services/analyzer';
import { native } from '@/services/native';
import { checkPermissions, requestPermissions as askPermissions, type PermissionState } from '@/services/permissions';
import { DEFAULT_SETTINGS, jsDeviceId, loadRecords, loadSettings, saveRecords, saveSettings, type Settings } from '@/services/storage';
import { hashString } from '@/utils/format';

export interface Stats {
  total: number;
  danger: number;
  caution: number;
  safe: number;
  last24h: number;
  threats24h: number;
}

interface Ctx {
  ready: boolean;
  nativeAvailable: boolean;
  records: SmsRecord[];
  settings: Settings;
  permissions: PermissionState;
  stats: Stats;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  requestPermissions(): Promise<void>;
  refreshPermissions(): Promise<void>;
  /** Analyse any text (manual check). */
  analyzeText(sender: string, body: string): Promise<SmsRecord>;
  /** Push a fake SMS through the real native pipeline (alert included). */
  simulateIncomingSms(sender: string, body: string): Promise<SmsRecord>;
  importInbox(limit?: number): Promise<number>;
  removeRecord(id: string): void;
  clearAll(): void;
}

const SentinelContext = createContext<Ctx | null>(null);

const EMPTY_PERMS: PermissionState = { sms: false, readSms: false, notifications: false, battery: false };

function mergeRecords(current: SmsRecord[], incoming: SmsRecord[]): SmsRecord[] {
  const map = new Map(current.map((r) => [r.id, r]));
  for (const r of incoming) map.set(r.id, r);
  return [...map.values()].sort((a, b) => b.receivedAt - a.receivedAt).slice(0, MAX_RECORDS);
}

export function SentinelProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [records, setRecords] = useState<SmsRecord[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [permissions, setPermissions] = useState<PermissionState>(EMPTY_PERMS);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const deviceIdRef = useRef<string>('js-unknown');

  const merge = useCallback((incoming: SmsRecord[]) => {
    if (incoming.length) setRecords((cur) => mergeRecords(cur, incoming));
  }, []);

  const drainNative = useCallback(() => {
    merge(native.drainPending());
  }, [merge]);

  const refreshPermissions = useCallback(async () => {
    setPermissions(await checkPermissions());
  }, []);

  // ---- boot ----
  useEffect(() => {
    (async () => {
      const [s, r] = await Promise.all([loadSettings(), loadRecords()]);
      setSettings(s);
      setRecords(r);
      deviceIdRef.current = native.getDeviceId() ?? (await jsDeviceId());
      drainNative();
      await refreshPermissions();
      setReady(true);
    })();
  }, [drainNative, refreshPermissions]);

  // ---- persist ----
  useEffect(() => { if (ready) void saveRecords(records); }, [records, ready]);
  useEffect(() => { if (ready) void saveSettings(settings); }, [settings, ready]);

  // ---- keep the native engine in sync with the settings ----
  useEffect(() => {
    if (!ready) return;
    native.configure(
      settings.protectionEnabled,
      settings.onlineEnabled && settings.apiUrl.trim().length > 0,
      settings.apiUrl.trim(),
      settings.apiKey.trim(),
      settings.alertOnCaution ? 35 : 65,
    );
  }, [ready, settings]);

  // ---- live events + app foreground ----
  useEffect(() => {
    const unsubscribe = native.onSmsAnalyzed((rec) => merge([rec]));
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        drainNative();
        void refreshPermissions();
      }
    });
    return () => { unsubscribe(); sub.remove(); };
  }, [merge, drainNative, refreshPermissions]);

  const updateSettings = useCallback(async (patch: Partial<Settings>) => {
    setSettings((cur) => ({ ...cur, ...patch }));
  }, []);

  const requestPermissions = useCallback(async () => {
    setPermissions(await askPermissions());
  }, []);

  const analyzeText = useCallback(async (sender: string, body: string) => {
    const rec = await analyzeHybrid({
      sender, body, receivedAt: Date.now(), origin: 'manual' as RecordOrigin,
      settings: settingsRef.current, deviceId: deviceIdRef.current,
    });
    merge([rec]);
    return rec;
  }, [merge]);

  const simulateIncomingSms = useCallback(async (sender: string, body: string) => {
    const viaNative = await native.simulateSms(sender, body);
    if (viaNative) { merge([viaNative]); return viaNative; }
    const rec = await analyzeHybrid({
      sender, body, receivedAt: Date.now(), origin: 'simulated',
      settings: settingsRef.current, deviceId: deviceIdRef.current,
    });
    merge([rec]);
    return rec;
  }, [merge]);

  const importInbox = useCallback(async (limit = 30) => {
    const items = native.readInbox(limit);
    const recs = await Promise.all(items.map((m) => analyzeHybrid({
      id: `import-${m.date}-${hashString(m.sender + m.body)}`,
      sender: m.sender, body: m.body, receivedAt: m.date, origin: 'import',
      settings: settingsRef.current, deviceId: deviceIdRef.current, offlineOnly: true,
    })));
    merge(recs);
    return recs.length;
  }, [merge]);

  const removeRecord = useCallback((id: string) => setRecords((cur) => cur.filter((r) => r.id !== id)), []);
  const clearAll = useCallback(() => setRecords([]), []);

  const stats = useMemo<Stats>(() => {
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    const s: Stats = { total: records.length, danger: 0, caution: 0, safe: 0, last24h: 0, threats24h: 0 };
    for (const r of records) {
      s[r.verdict] += 1;
      if (r.receivedAt >= dayAgo) {
        s.last24h += 1;
        if (r.verdict !== 'safe') s.threats24h += 1;
      }
    }
    return s;
  }, [records]);

  const value: Ctx = {
    ready, nativeAvailable: native.available, records, settings, permissions, stats,
    updateSettings, requestPermissions, refreshPermissions, analyzeText, simulateIncomingSms,
    importInbox, removeRecord, clearAll,
  };
  return <SentinelContext.Provider value={value}>{children}</SentinelContext.Provider>;
}

export function useSentinel(): Ctx {
  const ctx = useContext(SentinelContext);
  if (!ctx) throw new Error('useSentinel must be used inside <SentinelProvider>');
  return ctx;
}
