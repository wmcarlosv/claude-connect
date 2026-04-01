import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogStore } from '../src/data/catalog-store.js';

test('sqlite catalog seeds deepseek and qwen providers with models and auth', () => {
  const store = createCatalogStore({ filename: ':memory:' });
  const providers = store.getProviders();

  assert.equal(providers.length, 2);

  const deepseek = store.getProviderCatalog('deepseek');
  assert.ok(deepseek);
  assert.equal(deepseek.baseUrl, 'https://api.deepseek.com');
  assert.equal(deepseek.models.length, 2);
  assert.equal(deepseek.authMethods.length, 1);
  assert.equal(deepseek.authMethods[0].id, 'token');
  assert.equal(deepseek.models[0].id, 'deepseek-chat');
  assert.equal(deepseek.models[1].id, 'deepseek-reasoner');
  assert.equal(deepseek.oauth, null);

  const qwen = store.getProviderCatalog('qwen');
  assert.ok(qwen);
  assert.equal(qwen.models.length, 1);
  assert.equal(qwen.authMethods.length, 2);
  assert.equal(qwen.authMethods[0].id, 'token');
  assert.equal(qwen.authMethods[1].id, 'oauth');
  assert.equal(qwen.models[0].id, 'qwen3-coder-plus');
  assert.equal(qwen.oauth.browserAuthUrl, 'https://chat.qwen.ai/auth');
  assert.equal(qwen.oauth.clientId, 'f0304373b74a44d2b584a3fb70ca9e56');

  store.close();
});
