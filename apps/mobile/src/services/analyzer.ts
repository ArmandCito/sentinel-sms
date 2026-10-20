import { verdictFor, type RecordOrigin, type SmsRecord } from '@sentinel/contracts';
import { analyzeOnline } from './api';
import { analyzeOffline } from './ruleEngine';
import { newId } from '@/utils/format';
import type { Settings } from './storage';

interface Input {
  sender: string;
  body: string;
  receivedAt: number;
  origin: RecordOrigin;
  settings: Settings;
  deviceId: string;
  /** Skip the network (used for bulk inbox imports). */
  offlineOnly?: boolean;
  id?: string;
}

/**
 * JS-side hybrid analysis, used for manual checks, imports and as a fallback when the native
 * engine is unavailable. Always returns a record: if the server is unreachable we keep the offline result.
 */
export async function analyzeHybrid(input: Input): Promise<SmsRecord> {
  const offline = analyzeOffline(input.body);
  const base: SmsRecord = {
    id: input.id ?? newId(),
    sender: input.sender,
    body: input.body,
    receivedAt: input.receivedAt,
    offlineScore: offline.score,
    aiScore: null,
    finalScore: offline.score,
    verdict: verdictFor(offline.score),
    hits: offline.hits,
    aiSummary: null,
    aiReasons: [],
    source: 'offline',
    provider: null,
    origin: input.origin,
  };

  const { settings } = input;
  if (input.offlineOnly || !settings.onlineEnabled || !settings.apiUrl) return base;

  try {
    const res = await analyzeOnline(
      { baseUrl: settings.apiUrl, apiKey: settings.apiKey },
      { device_id: input.deviceId, sender: input.sender, body: input.body },
    );
    return {
      ...base,
      aiScore: res.ai_score,
      finalScore: res.final_score,
      verdict: res.verdict,
      aiSummary: res.summary || null,
      aiReasons: res.reasons ?? [],
      source: 'hybrid',
      provider: res.provider,
    };
  } catch (e) {
    console.warn('[analyzer] online analysis failed, keeping offline result', e);
    return base;
  }
}
