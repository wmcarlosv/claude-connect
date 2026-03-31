#!/usr/bin/env node

import { run } from '../src/index.js';

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nclaude-connect: ${message}`);
  process.exitCode = 1;
});
