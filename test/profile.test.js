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
  store.close();
});
