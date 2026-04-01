import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  activateClaudeProfile,
  buildClaudeSettingsForProfile,
  detectExternalClaudeEnvConflicts,
  revertClaudeProfile
} from '../src/lib/claude-settings.js';
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
    connectionMode: 'direct',
    extraEnv: {
      API_TIMEOUT_MS: '600000',
      ANTHROPIC_MODEL: 'deepseek-reasoner',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'deepseek-reasoner'
    }
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

test('detectExternalClaudeEnvConflicts finds shell variables that can override Claude activation', () => {
  const conflicts = detectExternalClaudeEnvConflicts({
    ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
    ANTHROPIC_API_KEY: 'deepseek-secret',
    PATH: '/usr/bin'
  });

  assert.deepEqual(conflicts, [
    {
      key: 'ANTHROPIC_BASE_URL',
      value: 'https://api.deepseek.com/anthropic'
    },
    {
      key: 'ANTHROPIC_API_KEY',
      value: 'deep...'
    }
  ]);
});

test('buildClaudeSettingsForProfile supports kimi direct anthropic mode', () => {
  const store = createCatalogStore({ filename: ':memory:' });
  const provider = store.getProviderCatalog('kimi');
  const profile = buildProfile({
    provider,
    model: provider.models[0],
    authMethod: provider.authMethods[0],
    profileName: 'kimi-for-coding-token',
    apiKeyEnvVar: 'KIMI_API_KEY'
  });

  const next = buildClaudeSettingsForProfile({
    baseSettings: {
      env: {}
    },
    profile,
    connectionBaseUrl: 'https://api.kimi.com/coding/',
    authToken: 'kimi-secret',
    authEnvMode: 'api_key',
    connectionMode: 'direct',
    extraEnv: {
      ENABLE_TOOL_SEARCH: 'false'
    }
  });

  assert.equal(next.model, 'kimi-for-coding');
  assert.equal(next.env.ANTHROPIC_BASE_URL, 'https://api.kimi.com/coding/');
  assert.equal(next.env.ANTHROPIC_API_KEY, 'kimi-secret');
  assert.equal(next.env.ANTHROPIC_AUTH_TOKEN, undefined);
  assert.equal(next.env.ENABLE_TOOL_SEARCH, 'false');
  assert.equal(next.env.CLAUDE_CONNECT_CONNECTION_MODE, 'direct');

  store.close();
});

test('activateClaudeProfile snapshots and restores the Claude oauth session', async (t) => {
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-connect-session-'));
  const settingsPath = path.join(tempHome, '.claude', 'settings.json');
  const accountPath = path.join(tempHome, '.claude.json');
  const credentialsPath = path.join(tempHome, '.claude', '.credentials.json');
  const connectHome = path.join(tempHome, '.claude-connect');
  const previous = {
    CLAUDE_SETTINGS_PATH: process.env.CLAUDE_SETTINGS_PATH,
    CLAUDE_ACCOUNT_PATH: process.env.CLAUDE_ACCOUNT_PATH,
    CLAUDE_CREDENTIALS_PATH: process.env.CLAUDE_CREDENTIALS_PATH,
    CLAUDE_CONNECT_HOME: process.env.CLAUDE_CONNECT_HOME,
    KIMI_API_KEY: process.env.KIMI_API_KEY
  };

  process.env.CLAUDE_SETTINGS_PATH = settingsPath;
  process.env.CLAUDE_ACCOUNT_PATH = accountPath;
  process.env.CLAUDE_CREDENTIALS_PATH = credentialsPath;
  process.env.CLAUDE_CONNECT_HOME = connectHome;
  process.env.KIMI_API_KEY = 'kimi-secret';

  t.after(async () => {
    for (const [key, value] of Object.entries(previous)) {
      if (typeof value === 'string') {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }

    await fs.rm(tempHome, { recursive: true, force: true });
  });

  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify({
    model: 'opus',
    env: {}
  }, null, 2));
  await fs.writeFile(accountPath, JSON.stringify({
    oauthAccount: {
      emailAddress: 'test@example.com'
    },
    custom: true
  }, null, 2));
  await fs.writeFile(credentialsPath, JSON.stringify({
    claudeAiOauth: {
      accessToken: 'oauth-token',
      refreshToken: 'oauth-refresh'
    },
    organizationUuid: 'org-123'
  }, null, 2));

  const store = createCatalogStore({ filename: ':memory:' });
  const provider = store.getProviderCatalog('kimi');
  const profile = buildProfile({
    provider,
    model: provider.models[0],
    authMethod: provider.authMethods[0],
    profileName: 'kimi-for-coding-token',
    apiKeyEnvVar: 'KIMI_API_KEY'
  });

  const result = await activateClaudeProfile({ profile });
  const activatedAccount = JSON.parse(await fs.readFile(accountPath, 'utf8'));
  const activatedCredentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));

  assert.equal(result.claudeAccountPath, accountPath);
  assert.equal(result.claudeCredentialsPath, credentialsPath);
  assert.equal(activatedAccount.oauthAccount, undefined);
  assert.equal(activatedAccount.custom, true);
  assert.equal(activatedCredentials.claudeAiOauth, undefined);
  assert.equal(activatedCredentials.organizationUuid, 'org-123');

  await revertClaudeProfile();
  const restoredAccount = JSON.parse(await fs.readFile(accountPath, 'utf8'));
  const restoredCredentials = JSON.parse(await fs.readFile(credentialsPath, 'utf8'));

  assert.deepEqual(restoredAccount, {
    oauthAccount: {
      emailAddress: 'test@example.com'
    },
    custom: true
  });
  assert.deepEqual(restoredCredentials, {
    claudeAiOauth: {
      accessToken: 'oauth-token',
      refreshToken: 'oauth-refresh'
    },
    organizationUuid: 'org-123'
  });

  store.close();
});
