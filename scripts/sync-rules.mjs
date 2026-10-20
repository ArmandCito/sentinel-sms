// Copies the single source of truth (packages/contracts/rules.json) to the
// places that cannot import it directly: the Kotlin module assets and Django.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'packages/contracts/rules.json');
const targets = [
  resolve(root, 'apps/mobile/modules/sentinel-sms/android/src/main/assets/sentinel_rules.json'),
  resolve(root, 'apps/backend/analysis/data/rules.json'),
];
for (const t of targets) {
  mkdirSync(dirname(t), { recursive: true });
  copyFileSync(source, t);
  console.log('synced ->', t.replace(root, '.'));
}
