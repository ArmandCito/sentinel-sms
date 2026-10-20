/**
 * Shared contracts between the mobile app and the Django backend.
 * The Python side mirrors these shapes in `apps/backend/analysis/serializers.py`.
 */

export type Verdict = 'safe' | 'caution' | 'danger';

/** Score thresholds (0-100). Must match packages/contracts/rules.json -> thresholds. */
export const THRESHOLDS = { caution: 35, danger: 65 } as const;

export function verdictFor(score: number): Verdict {
  if (score >= THRESHOLDS.danger) return 'danger';
  if (score >= THRESHOLDS.caution) return 'caution';
  return 'safe';
}

/** One rule from rules.json. */
export interface RuleDefinition {
  id: string;
  category: string;
  label: string;
  pattern: string;
  flags: string;
  /** Points added to the risk score. Negative weights are "protective" signals. */
  weight: number;
}

export interface RulesFile {
  version: number;
  thresholds: { caution: number; danger: number };
  rules: RuleDefinition[];
}

/** A rule that matched a message. */
export interface RuleHit {
  id: string;
  label: string;
  category: string;
  weight: number;
}

/** POST /api/v1/analyze/ request body. */
export interface AnalyzeRequest {
  device_id: string;
  sender: string;
  body: string;
  locale?: string;
}

/** POST /api/v1/analyze/ response body. */
export interface AnalyzeResponse {
  analysis_id: string;
  offline_score: number;
  /** null when no AI provider is configured or the provider failed. */
  ai_score: number | null;
  final_score: number;
  verdict: Verdict;
  /** "gemini" | "groq" | ... | "heuristics" (fallback). */
  provider: string;
  summary: string;
  reasons: string[];
  categories: string[];
  hits: RuleHit[];
  latency_ms: number;
}

export type RecordOrigin = 'sms' | 'manual' | 'import' | 'simulated';

/** A scanned message as stored on the device (and emitted by the native module). */
export interface SmsRecord {
  id: string;
  sender: string;
  body: string;
  receivedAt: number;
  offlineScore: number;
  aiScore: number | null;
  finalScore: number;
  verdict: Verdict;
  hits: RuleHit[];
  aiSummary: string | null;
  aiReasons: string[];
  source: 'offline' | 'hybrid';
  provider: string | null;
  origin: RecordOrigin;
}
