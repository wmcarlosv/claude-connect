import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reserveProviderInputTokens,
  resetProviderRateLimitState
} from '../src/lib/provider-rate-limit.js';

test('reserveProviderInputTokens ignores providers without configured TPM limit', async () => {
  resetProviderRateLimitState();

  await assert.doesNotReject(() => reserveProviderInputTokens({
    profile: {
      provider: { id: 'openai', name: 'OpenAI' }
    },
    inputTokens: 999999
  }));
});

test('reserveProviderInputTokens throws when a single inception request exceeds TPM', async () => {
  resetProviderRateLimitState();

  await assert.rejects(() => reserveProviderInputTokens({
    profile: {
      provider: { id: 'inception', name: 'Inception Labs' }
    },
    inputTokens: 450000
  }), /400,000 tokens por minuto/);
});

test('reserveProviderInputTokens waits for the rolling minute window before admitting more inception tokens', async () => {
  resetProviderRateLimitState();

  let currentTime = 0;
  const sleeps = [];
  const profile = {
    provider: { id: 'inception', name: 'Inception Labs' }
  };

  const now = () => currentTime;
  const sleep = async (ms) => {
    sleeps.push(ms);
    currentTime += ms;
  };

  await reserveProviderInputTokens({
    profile,
    inputTokens: 250000,
    now,
    sleep
  });

  await reserveProviderInputTokens({
    profile,
    inputTokens: 100000,
    now,
    sleep
  });

  await reserveProviderInputTokens({
    profile,
    inputTokens: 100000,
    now,
    sleep
  });

  assert.ok(sleeps.length >= 1);
  assert.ok(sleeps[0] >= 59000);
});
