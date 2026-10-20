import rulesFile from '@sentinel/contracts/rules.json';
import { verdictFor, type RuleHit, type RulesFile } from '@sentinel/contracts';

const file = rulesFile as RulesFile;

interface CompiledRule {
  hit: RuleHit;
  re: RegExp;
}

/** Compile once. A broken pattern is skipped instead of crashing the app. */
const compiled: CompiledRule[] = file.rules.flatMap((r) => {
  try {
    return [{ hit: { id: r.id, label: r.label, category: r.category, weight: r.weight }, re: new RegExp(r.pattern, r.flags) }];
  } catch (e) {
    console.warn(`[ruleEngine] invalid rule ${r.id}`, e);
    return [];
  }
});

export interface OfflineResult {
  score: number;
  hits: RuleHit[];
}

/** Instant, internet-free analysis. Same algorithm as the Kotlin and Python engines. */
export function analyzeOffline(body: string): OfflineResult {
  const hits: RuleHit[] = [];
  let total = 0;
  for (const { hit, re } of compiled) {
    if (re.test(body)) {
      hits.push(hit);
      total += hit.weight;
    }
  }
  return { score: Math.max(0, Math.min(100, total)), hits };
}

export { verdictFor };
