import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProfile, slugifyProfileName } from '../src/lib/profile.js';
import { createCatalogStore } from '../src/data/catalog-store.js';

test('slugifyProfileName normalizes human labels', () => {
  assert.equal(slugifyProfileName(' Qwen Plus / Prod '), 'qwen-plus-prod');
});

test('buildProfile returns openai-compatible config', () => {
  const store = createCatalogStore({ filename: ':memory:' });
  const provider = store.getProviderCatalog('qwen');
  const profile = buildProfile({
    provider,
    model: provider.models[0],
    authMethod: provider.authMethods[0],
    profileName: 'qwen-prod',
    apiKeyEnvVar: 'DASHSCOPE_API_KEY'
  });

  assert.equal(profile.provider.id, 'qwen');
  assert.equal(profile.model.id, 'qwen3-coder-plus');
  assert.equal(profile.auth.envVar, 'DASHSCOPE_API_KEY');
  assert.equal(profile.endpoint.baseUrl, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
  assert.equal(profile.integration.protocol, 'openai-compatible');
  assert.equal(profile.model.supportsVision, true);
  store.close();
});

test('buildProfile infers free tier metadata for OpenRouter free', () => {
  const store = createCatalogStore({ filename: ':memory:' });
  const provider = store.getProviderCatalog('openrouter');
  const profile = buildProfile({
    provider,
    model: provider.models[0],
    authMethod: provider.authMethods[0],
    profileName: 'openrouter-free',
    apiKeyEnvVar: 'OPENROUTER_API_KEY'
  });

  assert.equal(profile.model.isFreeTier, true);
  assert.equal(profile.model.upstreamModelId, 'openrouter/free');
  store.close();
});

test('buildProfile infers free tier metadata for dynamic OpenRouter :free models', () => {
  const store = createCatalogStore({ filename: ':memory:' });
  const provider = store.getProviderCatalog('openrouter');
  const profile = buildProfile({
    provider,
    model: {
      id: 'qwen-qwen-3-free',
      name: 'Qwen 3 Free',
      upstreamModelId: 'qwen/qwen-3:free',
      apiStyle: 'openai-chat',
      transportMode: 'gateway',
      apiBaseUrl: 'https://openrouter.ai/api/v1',
      apiPath: '/chat/completions'
    },
    authMethod: provider.authMethods[0],
    profileName: 'openrouter-qwen-free',
    apiKeyEnvVar: 'OPENROUTER_API_KEY'
  });

  assert.equal(profile.model.isFreeTier, true);
  assert.equal(profile.model.upstreamModelId, 'qwen/qwen-3:free');
  store.close();
});
