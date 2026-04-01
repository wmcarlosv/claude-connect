import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClaudeSettingsForProfile } from '../src/lib/claude-settings.js';
import { createCatalogStore } from '../src/data/catalog-store.js';
import { buildProfile } from '../src/lib/profile.js';

test('buildClaudeSettingsForProfile preserves base settings and injects switch env', () => {
  const store = createCatalogStore({ filename: ':memory:' });
  const provider = store.getProviderCatalog('qwen');
  const profile = buildProfile({
    provider,
    model: provider.models[0],
    authMethod: provider.authMethods[0],
    profileName: 'qwen-coder-token',
    apiKeyEnvVar: 'DASHSCOPE_API_KEY'
  });

  const baseSettings = {
    model: 'opus[1m]',
    env: {
      ANTHROPIC_AUTH_TOKEN: 'existing-token',
      API_TIMEOUT_MS: '3000000'
    }
  };

  const next = buildClaudeSettingsForProfile({
    baseSettings,
    profile,
    connectionBaseUrl: 'http://127.0.0.1:4310/anthropic',
    authToken: 'claude-connect-local',
    connectionMode: 'gateway'
  });

  assert.equal(next.model, 'qwen3-coder-plus');
  assert.equal(next.env.API_TIMEOUT_MS, '3000000');
  assert.equal(next.env.ANTHROPIC_BASE_URL, 'http://127.0.0.1:4310/anthropic');
  assert.equal(next.env.ANTHROPIC_AUTH_TOKEN, 'claude-connect-local');
  assert.equal(next.env.CLAUDE_CONNECT_CONNECTION_MODE, 'gateway');
  assert.equal(next.env.CLAUDE_CONNECT_ACTIVE_PROFILE, 'qwen-coder-token');
  assert.equal(next.env.CLAUDE_CONNECT_TOKEN_ENV_VAR, 'DASHSCOPE_API_KEY');

  store.close();
});

test('buildClaudeSettingsForProfile supports deepseek direct anthropic mode', () => {
  const store = createCatalogStore({ filename: ':memory:' });
  const provider = store.getProviderCatalog('deepseek');
  const profile = buildProfile({
    provider,
    model: provider.models[1],
    authMethod: provider.authMethods[0],
    profileName: 'deepseek-reasoner-token',
    apiKeyEnvVar: 'DEEPSEEK_API_KEY'
  });

  const next = buildClaudeSettingsForProfile({
    baseSettings: {
      env: {}
    },
    profile,
    connectionBaseUrl: 'https://api.deepseek.com/anthropic',
    authToken: 'deepseek-secret',
    connectionMode: 'direct'
  });

  assert.equal(next.model, 'deepseek-reasoner');
  assert.equal(next.env.ANTHROPIC_BASE_URL, 'https://api.deepseek.com/anthropic');
  assert.equal(next.env.ANTHROPIC_AUTH_TOKEN, 'deepseek-secret');
  assert.equal(next.env.ANTHROPIC_MODEL, 'deepseek-reasoner');
  assert.equal(next.env.ANTHROPIC_DEFAULT_HAIKU_MODEL, 'deepseek-reasoner');
  assert.equal(next.env.API_TIMEOUT_MS, '600000');
  assert.equal(next.env.CLAUDE_CONNECT_CONNECTION_MODE, 'direct');

  store.close();
});
