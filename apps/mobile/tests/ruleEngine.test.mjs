// Verifies that the shared rules.json behaves identically under the JS RegExp engine
// (same samples as apps/backend/analysis/tests.py). Run: npm run test --workspace @sentinel/mobile
import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const file = JSON.parse(readFileSync(new URL('../../../packages/contracts/rules.json', import.meta.url), 'utf8'));
const rules = file.rules.map((r) => ({ ...r, re: new RegExp(r.pattern, r.flags) }));
const score = (body) => Math.max(0, Math.min(100, rules.filter((r) => r.re.test(body)).reduce((s, r) => s + r.weight, 0)));

test('phishing with shortener + PIN request is danger', () => {
  const s = score('URGENT: Your bank account is suspended. Verify now at http://bit.ly/x9Kd2 and confirm your PIN within 24 hours.');
  assert.ok(s >= file.thresholds.danger, `score ${s}`);
});
test('genuine OTP with warning is safe', () => {
  assert.ok(score('123456 is your verification code. Never share this code with anyone.') < file.thresholds.caution);
});
test('French prize scam is danger', () => {
  assert.ok(score('Félicitations ! Vous avez gagné 500000 FRW. Cliquez ici https://claim-prize.xyz/go') >= file.thresholds.danger);
});
test('money sent by mistake is at least caution', () => {
  assert.ok(score('Hello, I sent you 20,000 RWF by mistake on MoMo. Please send it back urgently.') >= file.thresholds.caution);
});
test('normal chat scores 0', () => {
  assert.equal(score('See you at 6pm for dinner?'), 0);
});
