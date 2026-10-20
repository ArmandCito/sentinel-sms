import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'sentinel.lastCrash.v1';

export interface CrashInfo {
  message: string;
  stack: string;
  fatal: boolean;
  at: number;
}

/**
 * Records fatal JS errors so the NEXT launch can display them on screen
 * (no adb/logcat needed). Installed once, as early as possible.
 */
export function installCrashLogger(): void {
  const g = globalThis as unknown as {
    ErrorUtils?: { getGlobalHandler(): (e: Error, fatal?: boolean) => void; setGlobalHandler(h: (e: Error, fatal?: boolean) => void): void };
  };
  const utils = g.ErrorUtils;
  if (!utils) return;
  const previous = utils.getGlobalHandler();
  utils.setGlobalHandler((error, isFatal) => {
    try {
      const info: CrashInfo = {
        message: String(error?.message ?? error),
        stack: String(error?.stack ?? '').slice(0, 2500),
        fatal: !!isFatal,
        at: Date.now(),
      };
      void AsyncStorage.setItem(KEY, JSON.stringify(info));
    } catch {
      /* never let logging break error handling */
    }
    previous(error, isFatal);
  });
}

export async function readLastCrash(): Promise<CrashInfo | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CrashInfo) : null;
  } catch {
    return null;
  }
}

export async function clearLastCrash(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch { /* ignore */ }
}

export async function saveCrash(error: Error): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ message: error.message, stack: (error.stack ?? '').slice(0, 2500), fatal: false, at: Date.now() }));
  } catch { /* ignore */ }
}
