#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
let coverage = false;
const nodePassthrough = [];
let jestArgs = [];
let collectingJestArgs = false;

for (const arg of args) {
  if (arg === '--coverage') {
    coverage = true;
    continue;
  }

  if (arg === '--') {
    collectingJestArgs = true;
    continue;
  }

  if (collectingJestArgs) {
    jestArgs.push(arg);
  } else {
    nodePassthrough.push(arg);
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

nodeArgs.push(...nodePassthrough);

const run = (command, commandArgs) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      stdio: 'inherit',
      env,
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });

const main = async () => {
  await run(process.execPath, nodeArgs);

  const jestBin = resolve(__dirname, '..', 'node_modules', 'jest', 'bin', 'jest.js');
  const finalJestArgs = ['--runInBand'];

  if (coverage && !jestArgs.includes('--coverage')) {
    finalJestArgs.push('--coverage');
  }

  finalJestArgs.push(...jestArgs);

  await run(process.execPath, [jestBin, ...finalJestArgs]);
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
