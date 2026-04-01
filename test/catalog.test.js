import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogStore } from '../src/data/catalog-store.js';

test('sqlite catalog seeds zen, kimi, deepseek and qwen providers with models and auth', () => {
  const store = createCatalogStore({ filename: ':memory:' });
  const providers = store.getProviders();

  assert.equal(providers.length, 4);

  const zen = store.getProviderCatalog('zen');
  assert.ok(zen);
  assert.equal(zen.baseUrl, 'https://opencode.ai/zen');
  assert.equal(zen.authMethods.length, 1);
  assert.equal(zen.authMethods[0].id, 'token');
  assert.equal(zen.oauth, null);
  assert.equal(zen.models.length, 17);
  assert.equal(zen.models[0].id, 'claude-sonnet-4-6');
  assert.equal(zen.models[0].transportMode, 'direct');
  assert.equal(zen.models[0].apiStyle, 'anthropic');
  assert.equal(zen.models[8].id, 'minimax-m2.5');
  assert.equal(zen.models[8].transportMode, 'gateway');
  assert.equal(zen.models[8].apiStyle, 'openai-chat');

  const kimi = store.getProviderCatalog('kimi');
  assert.ok(kimi);
  assert.equal(kimi.baseUrl, 'https://api.kimi.com/coding/');
  assert.equal(kimi.models.length, 1);
  assert.equal(kimi.models[0].id, 'kimi-for-coding');
  assert.equal(kimi.models[0].transportMode, 'direct');
  assert.equal(kimi.authMethods.length, 1);
  assert.equal(kimi.authMethods[0].id, 'token');
  assert.equal(kimi.oauth, null);

  const deepseek = store.getProviderCatalog('deepseek');
  assert.ok(deepseek);
  assert.equal(deepseek.baseUrl, 'https://api.deepseek.com');
  assert.equal(deepseek.models.length, 2);
  assert.equal(deepseek.authMethods.length, 1);
  assert.equal(deepseek.authMethods[0].id, 'token');
  assert.equal(deepseek.models[0].id, 'deepseek-chat');
  assert.equal(deepseek.models[1].id, 'deepseek-reasoner');
  assert.equal(deepseek.models[0].transportMode, 'direct');
  assert.equal(deepseek.oauth, null);

  const qwen = store.getProviderCatalog('qwen');
  assert.ok(qwen);
  assert.equal(qwen.models.length, 1);
  assert.equal(qwen.authMethods.length, 2);
  assert.equal(qwen.authMethods[0].id, 'token');
  assert.equal(qwen.authMethods[1].id, 'oauth');
  assert.equal(qwen.models[0].id, 'qwen3-coder-plus');
  assert.equal(qwen.models[0].transportMode, 'gateway');
  assert.equal(qwen.oauth.browserAuthUrl, 'https://chat.qwen.ai/auth');
  assert.equal(qwen.oauth.clientId, 'f0304373b74a44d2b584a3fb70ca9e56');

  store.close();
});
