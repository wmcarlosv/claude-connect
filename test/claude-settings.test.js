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
    gatewayBaseUrl: 'http://127.0.0.1:4310/anthropic'
  });

  assert.equal(next.model, 'qwen3-coder-plus');
  assert.equal(next.env.API_TIMEOUT_MS, '3000000');
  assert.equal(next.env.ANTHROPIC_BASE_URL, 'http://127.0.0.1:4310/anthropic');
  assert.equal(next.env.ANTHROPIC_AUTH_TOKEN, 'claude-connect-local');
  assert.equal(next.env.CLAUDE_CONNECT_ACTIVE_PROFILE, 'qwen-coder-token');
  assert.equal(next.env.CLAUDE_CONNECT_TOKEN_ENV_VAR, 'DASHSCOPE_API_KEY');

  store.close();
});
