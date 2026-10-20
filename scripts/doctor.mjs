// Quick environment check: `npm run doctor`
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const run = (cmd) => { try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split('\n')[0]; } catch { return null; } };
const rows = [
  ['Node.js (>= 20)', run('node -v')],
  ['npm', run('npm -v')],
  ['Python (>= 3.10)', run('python --version') ?? run('python3 --version')],
  ['Java (JDK 17, only for local Android builds)', run('java -version 2>&1')],
  ['adb (optional, Android platform-tools)', run('adb --version')],
  ['EAS CLI (npm i -g eas-cli)', run('eas --version')],
  ['apps/backend/.env', existsSync('apps/backend/.env') ? 'found' : null],
  ['apps/mobile/.env', existsSync('apps/mobile/.env') ? 'found' : null],
];
for (const [name, value] of rows) console.log(`${value ? 'OK     ' : 'MISSING'}  ${name}${value ? '  ->  ' + value : ''}`);
