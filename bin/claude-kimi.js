#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { run } from '../src/index.js';

const alreadyRestarted = process.env.CLAUDE_CONNECT_NO_WARNINGS === '1';

if (!alreadyRestarted && !process.execArgv.includes('--no-warnings=ExperimentalWarning')) {
  const scriptPath = fileURLToPath(import.meta.url);
  const child = spawn(
    process.execPath,
    ['--no-warnings=ExperimentalWarning', scriptPath, ...process.argv.slice(2)],
    {
      env: {
        ...process.env,
        CLAUDE_CONNECT_NO_WARNINGS: '1'
      },
      stdio: 'inherit'
    }
  );

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on('error', (error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nclaude-kimi: ${message}`);
    process.exit(1);
  });
} else {
  run(['launch-provider', 'kimi', ...process.argv.slice(2)]).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nclaude-kimi: ${message}`);
    process.exitCode = 1;
  });
}
