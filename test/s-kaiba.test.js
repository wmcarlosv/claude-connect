import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildVargasThunderSummary,
  isSKaibaSelectableProfile,
  isVargasThunderCandidateProfile,
  shouldFailoverOnProviderError
} from '../src/lib/s-kaiba.js';

test('isVargasThunderCandidateProfile accepts configured free-style profiles', () => {
  assert.equal(isVargasThunderCandidateProfile({
    provider: { id: 'openrouter', name: 'OpenRouter' },
    model: { id: 'openrouter-free', upstreamModelId: 'openrouter/free', isFreeTier: true },
    auth: { method: 'token' }
  }), true);

  assert.equal(isVargasThunderCandidateProfile({
    provider: { id: 'kilo-free', name: 'Kilo Code Models' },
    model: { id: 'z-ai/glm-5:free', upstreamModelId: 'z-ai/glm-5:free', supportsAnonymous: true },
    auth: { method: 'anonymous' }
  }), true);

  assert.equal(isVargasThunderCandidateProfile({
    provider: { id: 'deepseek', name: 'DeepSeek' },
    model: { id: 'deepseek-chat', upstreamModelId: 'deepseek-chat' },
    auth: { method: 'token' }
  }), false);

  assert.equal(isVargasThunderCandidateProfile({
    provider: { id: 'zen', name: 'OpenCode Zen' },
    model: {
      id: 'mimo-v2-pro-free',
      upstreamModelId: 'mimo-v2-pro-free',
      name: 'Mimo V2 Pro Free',
      transportMode: 'gateway',
      apiStyle: 'openai-chat'
    },
    auth: { method: 'token' }
  }), true);
});

test('isSKaibaSelectableProfile only accepts free profiles that use our gateway', () => {
  assert.equal(isSKaibaSelectableProfile({
    provider: { id: 'openrouter', name: 'OpenRouter' },
    model: {
      id: 'openrouter-free',
      upstreamModelId: 'openrouter/free',
      isFreeTier: true,
      transportMode: 'gateway',
      apiStyle: 'openai-chat'
    },
    auth: { method: 'token' }
  }), true);

  assert.equal(isSKaibaSelectableProfile({
    provider: { id: 'deepseek', name: 'DeepSeek' },
    model: {
      id: 'deepseek-chat',
      upstreamModelId: 'deepseek-chat',
      isFreeTier: true,
      transportMode: 'direct',
      apiStyle: 'anthropic'
    },
    auth: { method: 'token' }
  }), false);
});

test('shouldFailoverOnProviderError matches quota and rate limit conditions only', () => {
  assert.equal(shouldFailoverOnProviderError(new Error('Rate limit reached: input token limit exceeded')), true);
  assert.equal(shouldFailoverOnProviderError('OpenRouter devolvio un error: HTTP 429'), true);
  assert.equal(shouldFailoverOnProviderError('Modelo invalido para esta peticion'), false);
});

test('buildVargasThunderSummary describes configured candidates', () => {
  const summary = buildVargasThunderSummary([
    {
      provider: { name: 'OpenRouter' },
      model: { name: 'OpenRouter Free Router' }
    },
    {
      provider: { name: 'Kilo Code Models' },
      model: { name: 'GLM 5 Free' }
    }
  ]);

  assert.match(summary, /OpenRouter \/ OpenRouter Free Router/);
  assert.match(summary, /Kilo Code Models \/ GLM 5 Free/);
});
