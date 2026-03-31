import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatalogStore } from '../src/data/catalog-store.js';

test('sqlite catalog seeds qwen provider with base url, models and auth', () => {
  const store = createCatalogStore({ filename: ':memory:' });
  const providers = store.getProviders();

  assert.equal(providers.length, 1);
  assert.equal(providers[0].id, 'qwen');
  assert.equal(providers[0].baseUrl, 'https://dashscope.aliyuncs.com/compatible-mode/v1');

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
