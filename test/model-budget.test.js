import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceModelTokenBudget, getModelTokenLimits } from '../src/lib/model-budget.js';

test('getModelTokenLimits returns known limits for mercury-2', () => {
  const limits = getModelTokenLimits({
    provider: { id: 'inception' },
    model: { id: 'mercury-2', upstreamModelId: 'mercury-2' }
  });

  assert.deepEqual(limits, {
    contextWindowTokens: 128000,
    defaultOutputTokens: 8192,
    maxOutputTokens: 16384
  });
});

test('getModelTokenLimits returns known limits for deepseek v4 flash', () => {
  const limits = getModelTokenLimits({
    provider: { id: 'deepseek' },
    model: { id: 'deepseek-v4-flash', upstreamModelId: 'deepseek-v4-flash' }
  });

  assert.deepEqual(limits, {
    contextWindowTokens: 1000000,
    defaultOutputTokens: 8192,
    maxOutputTokens: 384000
  });
});

test('getModelTokenLimits returns known limits for nvidia kimi k2.5', () => {
  const limits = getModelTokenLimits({
    provider: { id: 'nvidia' },
    model: { id: 'nvidia-kimi-k2.5', upstreamModelId: 'moonshotai/kimi-k2.5' }
  });

  assert.deepEqual(limits, {
    contextWindowTokens: 256000,
    defaultOutputTokens: 8192,
    maxOutputTokens: 16384
  });
});

test('getModelTokenLimits returns known limits for nvidia gemma 4', () => {
  const limits = getModelTokenLimits({
    provider: { id: 'nvidia' },
    model: { id: 'google-gemma-4-31b-it', upstreamModelId: 'google/gemma-4-31b-it' }
  });

  assert.deepEqual(limits, {
    contextWindowTokens: 256000,
    defaultOutputTokens: 8192,
    maxOutputTokens: 16384
  });
});

test('getModelTokenLimits returns known limits for gemini thinking models', () => {
  const limits = getModelTokenLimits({
    provider: { id: 'gemini' },
    model: { id: 'gemini-3-pro-preview', upstreamModelId: 'gemini-3-pro-preview' }
  });

  assert.deepEqual(limits, {
    contextWindowTokens: 1048576,
    defaultOutputTokens: 8192,
    maxOutputTokens: 65536
  });
});

test('enforceModelTokenBudget clamps mercury-2 output budget to the model maximum', () => {
  const body = enforceModelTokenBudget({
    profile: {
      provider: { id: 'inception' },
      model: { id: 'mercury-2', upstreamModelId: 'mercury-2', name: 'Mercury 2' }
    },
    body: {
      max_tokens: 50000,
      messages: [
        {
          role: 'user',
          content: 'Hola'
        }
      ]
    }
  });

  assert.equal(body.max_tokens, 16384);
});

test('enforceModelTokenBudget throws when deepseek-chat has no practical output room left', () => {
  const longText = 'x'.repeat(4500000);

  assert.throws(() => enforceModelTokenBudget({
    profile: {
      provider: { id: 'deepseek' },
      model: { id: 'deepseek-chat', upstreamModelId: 'deepseek-chat', name: 'DeepSeek Chat' }
    },
    body: {
      messages: [
        {
          role: 'user',
          content: longText
        }
      ]
    }
  }), /\/compact|\/clear/);
});
