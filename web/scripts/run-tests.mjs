#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
let coverage = false;
const passthrough = [];

for (const arg of args) {
  if (arg === '--coverage') {
    coverage = true;
  } else {
    passthrough.push(arg);
  }
}

const env = { ...process.env };
const nodeArgs = ['--test'];

if (coverage) {
  const coverageDir = resolve(__dirname, '..', 'coverage');
  mkdirSync(coverageDir, { recursive: true });
  env.NODE_V8_COVERAGE = coverageDir;
  nodeArgs.push('--experimental-test-coverage');
}

nodeArgs.push(...passthrough);

const child = spawn(process.execPath, nodeArgs, {
  stdio: 'inherit',
  env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
