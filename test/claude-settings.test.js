import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  activateClaudeProfile,
  buildClaudeSettingsForProfile,
  detectExternalClaudeEnvConflicts,
  resolveClaudeTransportForProfile,
  revertClaudeProfile
} from '../src/lib/claude-settings.js';
import { createCatalogStore } from '../src/data/catalog-store.js';
import { buildProfile } from '../src/lib/profile.js';
import { saveManagedProviderTokenSecret } from '../src/lib/secrets.js';

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

test('activateClaudeProfile fails when Claude Code is not installed', async () => {
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-connect-no-claude-'));
  const previousEnv = {
    HOME: process.env.HOME,
    PATH: process.env.PATH,
    CLAUDE_SETTINGS_PATH: process.env.CLAUDE_SETTINGS_PATH,
    CLAUDE_ACCOUNT_PATH: process.env.CLAUDE_ACCOUNT_PATH,
    CLAUDE_CREDENTIALS_PATH: process.env.CLAUDE_CREDENTIALS_PATH
  };
  const store = createCatalogStore({ filename: ':memory:' });
  const provider = store.getProviderCatalog('openai');
  const profile = buildProfile({
    provider,
    model: provider.models[0],
    authMethod: provider.authMethods[0],
    profileName: 'openai-gpt-5-4-token',
    apiKeyEnvVar: 'OPENAI_API_KEY'
  });

  process.env.HOME = tempHome;
  process.env.PATH = '';
  delete process.env.CLAUDE_SETTINGS_PATH;
  delete process.env.CLAUDE_ACCOUNT_PATH;
  delete process.env.CLAUDE_CREDENTIALS_PATH;

  try {
    await assert.rejects(
      activateClaudeProfile({ profile }),
      /Claude Code no parece estar instalado/
    );
  } finally {
    if (typeof previousEnv.HOME === 'string') {
      process.env.HOME = previousEnv.HOME;
    } else {
      delete process.env.HOME;
    }

    if (typeof previousEnv.PATH === 'string') {
      process.env.PATH = previousEnv.PATH;
    } else {
      delete process.env.PATH;
    }

    if (typeof previousEnv.CLAUDE_SETTINGS_PATH === 'string') {
      process.env.CLAUDE_SETTINGS_PATH = previousEnv.CLAUDE_SETTINGS_PATH;
    } else {
      delete process.env.CLAUDE_SETTINGS_PATH;
    }

    if (typeof previousEnv.CLAUDE_ACCOUNT_PATH === 'string') {
      process.env.CLAUDE_ACCOUNT_PATH = previousEnv.CLAUDE_ACCOUNT_PATH;
    } else {
      delete process.env.CLAUDE_ACCOUNT_PATH;
    }

    if (typeof previousEnv.CLAUDE_CREDENTIALS_PATH === 'string') {
      process.env.CLAUDE_CREDENTIALS_PATH = previousEnv.CLAUDE_CREDENTIALS_PATH;
    } else {
      delete process.env.CLAUDE_CREDENTIALS_PATH;
    }
  }

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

test('buildClaudeSettingsForProfile supports zai direct anthropic mode', () => {
  const store = createCatalogStore({ filename: ':memory:' });
  const provider = store.getProviderCatalog('zai');
  const profile = buildProfile({
    provider,
    model: provider.models[0],
    authMethod: provider.authMethods[0],
    profileName: 'zai-glm-5-1-token',
    apiKeyEnvVar: 'ZAI_API_KEY'
  });

  const next = buildClaudeSettingsForProfile({
    baseSettings: {
      env: {}
    },
    profile,
    connectionBaseUrl: 'https://api.z.ai/api/anthropic',
    authToken: 'zai-secret',
    connectionMode: 'direct',
    extraEnv: {
      API_TIMEOUT_MS: '3000000',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: 'glm-5.1',
      ANTHROPIC_DEFAULT_SONNET_MODEL: 'glm-5.1',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'glm-5.1'
    }
  });

  assert.equal(next.model, 'glm-5.1');
  assert.equal(next.env.ANTHROPIC_BASE_URL, 'https://api.z.ai/api/anthropic');
  assert.equal(next.env.ANTHROPIC_AUTH_TOKEN, 'zai-secret');
  assert.equal(next.env.API_TIMEOUT_MS, '3000000');
  assert.equal(next.env.ANTHROPIC_DEFAULT_HAIKU_MODEL, 'glm-5.1');
  assert.equal(next.env.ANTHROPIC_DEFAULT_SONNET_MODEL, 'glm-5.1');
  assert.equal(next.env.ANTHROPIC_DEFAULT_OPUS_MODEL, 'glm-5.1');

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

test('resolveClaudeTransportForProfile forces kimi through the gateway', async () => {
  const store = createCatalogStore({ filename: ':memory:' });
  const provider = store.getProviderCatalog('kimi');
  const profile = buildProfile({
    provider,
    model: provider.models[0],
    authMethod: provider.authMethods[0],
    profileName: 'kimi-for-coding-token',
    apiKeyEnvVar: 'KIMI_API_KEY'
  });
  const transport = await resolveClaudeTransportForProfile({ profile });

  assert.equal(transport.connectionMode, 'gateway');
  assert.equal(transport.connectionBaseUrl, 'http://127.0.0.1:4310/anthropic');
  assert.equal(transport.authToken, 'claude-connect-local');

  store.close();
});

test('resolveClaudeTransportForProfile supports zen direct anthropic models', async () => {
  const store = createCatalogStore({ filename: ':memory:' });
  const provider = store.getProviderCatalog('zen');
  const profile = buildProfile({
    provider,
    model: provider.models.find((model) => model.id === 'claude-sonnet-4-6'),
    authMethod: provider.authMethods[0],
    profileName: 'zen-claude-sonnet-4-6-token',
    apiKeyEnvVar: 'OPENCODE_API_KEY'
  });
  const previous = process.env.OPENCODE_API_KEY;
  process.env.OPENCODE_API_KEY = 'zen-secret';

  try {
    const transport = await resolveClaudeTransportForProfile({ profile });

    assert.equal(transport.connectionMode, 'direct');
    assert.equal(transport.connectionBaseUrl, 'https://opencode.ai/zen');
    assert.equal(transport.authEnvMode, 'api_key');
    assert.equal(transport.authToken, 'zen-secret');
  } finally {
    if (typeof previous === 'string') {
      process.env.OPENCODE_API_KEY = previous;
    } else {
      delete process.env.OPENCODE_API_KEY;
    }

    store.close();
  }
});

test('resolveClaudeTransportForProfile supports zen gateway models', async () => {
  const store = createCatalogStore({ filename: ':memory:' });
  const provider = store.getProviderCatalog('zen');
  const profile = buildProfile({
    provider,
    model: provider.models.find((model) => model.id === 'kimi-k2.5'),
    authMethod: provider.authMethods[0],
    profileName: 'zen-kimi-k2-5-token',
    apiKeyEnvVar: 'OPENCODE_API_KEY'
  });
  const transport = await resolveClaudeTransportForProfile({ profile });

  assert.equal(transport.connectionMode, 'gateway');
  assert.equal(transport.connectionBaseUrl, 'http://127.0.0.1:4310/anthropic');
  assert.equal(transport.authEnvMode, 'auth_token');
  assert.equal(transport.authToken, 'claude-connect-local');

  store.close();
});

test('resolveClaudeTransportForProfile supports openai gateway models', async () => {
  const store = createCatalogStore({ filename: ':memory:' });
  const provider = store.getProviderCatalog('openai');
  const profile = buildProfile({
    provider,
    model: provider.models.find((model) => model.id === 'gpt-5.4'),
    authMethod: provider.authMethods[0],
    profileName: 'openai-gpt-5-4-token',
    apiKeyEnvVar: 'OPENAI_API_KEY'
  });
  const transport = await resolveClaudeTransportForProfile({ profile });

  assert.equal(transport.connectionMode, 'gateway');
  assert.equal(transport.connectionBaseUrl, 'http://127.0.0.1:4310/anthropic');
  assert.equal(transport.authEnvMode, 'auth_token');
  assert.equal(transport.authToken, 'claude-connect-local');

  store.close();
});

test('resolveClaudeTransportForProfile supports nvidia gateway models', async () => {
  const store = createCatalogStore({ filename: ':memory:' });
  const provider = store.getProviderCatalog('nvidia');
  const profile = buildProfile({
    provider,
    model: {
      id: 'moonshotai-kimi-k2.5',
      name: 'Kimi K2.5',
      category: 'NVIDIA NIM Coding',
      contextWindow: '256K',
      summary: 'Modelo descubierto desde /models',
      upstreamModelId: 'moonshotai/kimi-k2.5',
      transportMode: 'gateway',
      apiStyle: 'openai-chat',
      apiBaseUrl: 'https://integrate.api.nvidia.com/v1',
      apiPath: '/chat/completions',
      authEnvMode: 'auth_token',
      supportsVision: true
    },
    authMethod: provider.authMethods[0],
    profileName: 'nvidia-kimi-k2-5-token',
    apiKeyEnvVar: 'NVIDIA_API_KEY'
  });
  const transport = await resolveClaudeTransportForProfile({ profile });

  assert.equal(transport.connectionMode, 'gateway');
  assert.equal(transport.connectionBaseUrl, 'http://127.0.0.1:4310/anthropic');
  assert.equal(transport.authEnvMode, 'auth_token');
  assert.equal(transport.authToken, 'claude-connect-local');

  store.close();
});

test('resolveClaudeTransportForProfile supports zai direct anthropic models', async () => {
  const store = createCatalogStore({ filename: ':memory:' });
  const provider = store.getProviderCatalog('zai');
  const profile = buildProfile({
    provider,
    model: provider.models.find((model) => model.id === 'glm-5.1'),
    authMethod: provider.authMethods[0],
    profileName: 'zai-glm-5-1-token',
    apiKeyEnvVar: 'ZAI_API_KEY'
  });
  const previous = process.env.ZAI_API_KEY;
  process.env.ZAI_API_KEY = 'zai-secret';

  try {
    const transport = await resolveClaudeTransportForProfile({ profile });

    assert.equal(transport.connectionMode, 'direct');
    assert.equal(transport.connectionBaseUrl, 'https://api.z.ai/api/anthropic');
    assert.equal(transport.authEnvMode, 'auth_token');
    assert.equal(transport.authToken, 'zai-secret');
    assert.equal(transport.extraEnv.API_TIMEOUT_MS, '3000000');
    assert.equal(transport.extraEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL, 'glm-5.1');
    assert.equal(transport.extraEnv.ANTHROPIC_DEFAULT_SONNET_MODEL, 'glm-5.1');
    assert.equal(transport.extraEnv.ANTHROPIC_DEFAULT_OPUS_MODEL, 'glm-5.1');
  } finally {
    if (typeof previous === 'string') {
      process.env.ZAI_API_KEY = previous;
    } else {
      delete process.env.ZAI_API_KEY;
    }

    store.close();
  }
});

test('resolveClaudeTransportForProfile supports kilo free anonymous gateway models', async () => {
  const store = createCatalogStore({ filename: ':memory:' });
  const provider = store.getProviderCatalog('kilo-free');
  const profile = buildProfile({
    provider,
    model: {
      id: 'z-ai/glm-5:free',
      upstreamModelId: 'z-ai/glm-5:free',
      name: 'GLM-5 Free',
      contextWindow: '128000',
      transportMode: 'gateway',
      apiStyle: 'openai-chat',
      apiBaseUrl: 'https://api.kilo.ai/api/gateway',
      apiPath: '/chat/completions',
      authEnvMode: 'auth_token'
    },
    authMethod: provider.authMethods.find((authMethod) => authMethod.id === 'anonymous'),
    profileName: 'kilo-free-glm-5-anonymous',
    apiKeyEnvVar: 'KILO_API_KEY'
  });
  const transport = await resolveClaudeTransportForProfile({ profile });

  assert.equal(transport.connectionMode, 'gateway');
  assert.equal(transport.connectionBaseUrl, 'http://127.0.0.1:4310/anthropic');
  assert.equal(transport.authEnvMode, 'auth_token');
  assert.equal(transport.authToken, 'claude-connect-local');

  store.close();
});

test('resolveClaudeTransportForProfile supports ollama cloud token gateway models', async () => {
  const store = createCatalogStore({ filename: ':memory:' });
  const provider = store.getProviderCatalog('ollama-cloud');
  const profile = buildProfile({
    provider,
    model: {
      id: 'glm-4.7:cloud',
      upstreamModelId: 'glm-4.7:cloud',
      name: 'GLM-4.7 Cloud',
      contextWindow: 'Auto',
      transportMode: 'gateway',
      apiStyle: 'ollama-chat',
      apiBaseUrl: 'https://ollama.com',
      apiPath: '/api/chat',
      authEnvMode: 'auth_token'
    },
    authMethod: provider.authMethods[0],
    profileName: 'ollama-cloud-glm-4-7-token',
    apiKeyEnvVar: 'OLLAMA_API_KEY'
  });
  const transport = await resolveClaudeTransportForProfile({ profile });

  assert.equal(transport.connectionMode, 'gateway');
  assert.equal(transport.connectionBaseUrl, 'http://127.0.0.1:4310/anthropic');
  assert.equal(transport.authEnvMode, 'auth_token');
  assert.equal(transport.authToken, 'claude-connect-local');

  store.close();
});
test('resolveClaudeTransportForProfile supports inception gateway models', async () => {
  const store = createCatalogStore({ filename: ':memory:' });
  const provider = store.getProviderCatalog('inception');
  const profile = buildProfile({
    provider,
    model: provider.models.find((model) => model.id === 'mercury-2'),
    authMethod: provider.authMethods[0],
    profileName: 'inception-mercury-2-token',
    apiKeyEnvVar: 'INCEPTION_API_KEY'
  });
  const transport = await resolveClaudeTransportForProfile({ profile });

  assert.equal(transport.connectionMode, 'gateway');
  assert.equal(transport.connectionBaseUrl, 'http://127.0.0.1:4310/anthropic');
  assert.equal(transport.authEnvMode, 'auth_token');
  assert.equal(transport.authToken, 'claude-connect-local');

  store.close();
});

test('resolveClaudeTransportForProfile supports ollama server profiles', async () => {
  const store = createCatalogStore({ filename: ':memory:' });
  const provider = store.getProviderCatalog('ollama');
  const profile = buildProfile({
    provider: {
      ...provider,
      baseUrl: 'http://127.0.0.1:11434'
    },
    model: {
      id: 'qwen2.5-coder:7b',
      name: 'qwen2.5-coder:7b',
      category: 'Ollama OpenAI-compatible',
      contextWindow: 'Auto',
      summary: 'Modelo descubierto desde /api/tags',
      upstreamModelId: 'qwen2.5-coder:7b',
      transportMode: 'gateway',
      apiStyle: 'openai-chat',
      apiBaseUrl: 'http://127.0.0.1:11434',
      apiPath: '/v1/chat/completions',
      authEnvMode: 'auth_token'
    },
    authMethod: provider.authMethods[0],
    profileName: 'ollama-qwen2-5-coder-7b-server',
    apiKeyEnvVar: 'OLLAMA_API_KEY'
  });
  const transport = await resolveClaudeTransportForProfile({ profile });

  assert.equal(transport.connectionMode, 'gateway');
  assert.equal(transport.connectionBaseUrl, 'http://127.0.0.1:4310/anthropic');
  assert.equal(transport.authEnvMode, 'auth_token');
  assert.equal(transport.authToken, 'claude-connect-local');

  store.close();
});

test('resolveClaudeTransportForProfile falls back to provider-level API key', async () => {
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-connect-provider-secret-'));
  const previous = {
    CLAUDE_CONNECT_HOME: process.env.CLAUDE_CONNECT_HOME,
    OPENCODE_API_KEY: process.env.OPENCODE_API_KEY
  };
  const store = createCatalogStore({ filename: ':memory:' });
  const provider = store.getProviderCatalog('zen');
  const profile = buildProfile({
    provider,
    model: provider.models.find((model) => model.id === 'claude-sonnet-4-6'),
    authMethod: provider.authMethods[0],
    profileName: 'zen-provider-secret-test',
    apiKeyEnvVar: 'OPENCODE_API_KEY'
  });

  process.env.CLAUDE_CONNECT_HOME = tempHome;
  delete process.env.OPENCODE_API_KEY;

  try {
    await saveManagedProviderTokenSecret({
      providerId: provider.id,
      providerName: provider.name,
      envVar: 'OPENCODE_API_KEY',
      token: 'provider-secret'
    });

    const transport = await resolveClaudeTransportForProfile({ profile });

    assert.equal(transport.connectionMode, 'direct');
    assert.equal(transport.authEnvMode, 'api_key');
    assert.equal(transport.authToken, 'provider-secret');
  } finally {
    if (typeof previous.CLAUDE_CONNECT_HOME === 'string') {
      process.env.CLAUDE_CONNECT_HOME = previous.CLAUDE_CONNECT_HOME;
    } else {
      delete process.env.CLAUDE_CONNECT_HOME;
    }

    if (typeof previous.OPENCODE_API_KEY === 'string') {
      process.env.OPENCODE_API_KEY = previous.OPENCODE_API_KEY;
    } else {
      delete process.env.OPENCODE_API_KEY;
    }

    store.close();
    await fs.rm(tempHome, { recursive: true, force: true });
  }
});

test('resolveClaudeTransportForProfile supports opencode-go direct anthropic models', async () => {
  const store = createCatalogStore({ filename: ':memory:' });
  const provider = store.getProviderCatalog('opencode-go');
  const profile = buildProfile({
    provider,
    model: provider.models.find((model) => model.id === 'opencode-go-minimax-m2.5'),
    authMethod: provider.authMethods[0],
    profileName: 'opencode-go-minimax-m2-5-token',
    apiKeyEnvVar: 'OPENCODE_API_KEY'
  });
  const previous = process.env.OPENCODE_API_KEY;
  process.env.OPENCODE_API_KEY = 'opencode-secret';

  try {
    const transport = await resolveClaudeTransportForProfile({ profile });

    assert.equal(transport.connectionMode, 'direct');
    assert.equal(transport.connectionBaseUrl, 'https://opencode.ai/zen/go');
    assert.equal(transport.authEnvMode, 'api_key');
    assert.equal(transport.authToken, 'opencode-secret');
  } finally {
    if (typeof previous === 'string') {
      process.env.OPENCODE_API_KEY = previous;
    } else {
      delete process.env.OPENCODE_API_KEY;
    }

    store.close();
  }
});

test('resolveClaudeTransportForProfile supports opencode-go gateway models', async () => {
  const store = createCatalogStore({ filename: ':memory:' });
  const provider = store.getProviderCatalog('opencode-go');
  const profile = buildProfile({
    provider,
    model: provider.models.find((model) => model.id === 'opencode-go-kimi-k2.5'),
    authMethod: provider.authMethods[0],
    profileName: 'opencode-go-kimi-k2-5-token',
    apiKeyEnvVar: 'OPENCODE_API_KEY'
  });
  const transport = await resolveClaudeTransportForProfile({ profile });

  assert.equal(transport.connectionMode, 'gateway');
  assert.equal(transport.connectionBaseUrl, 'http://127.0.0.1:4310/anthropic');
  assert.equal(transport.authEnvMode, 'auth_token');
  assert.equal(transport.authToken, 'claude-connect-local');

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

test('activateClaudeProfile refreshes stale inactive snapshots with the current Claude state', async (t) => {
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-connect-stale-snapshot-'));
  const settingsPath = path.join(tempHome, '.claude', 'settings.json');
  const accountPath = path.join(tempHome, '.claude.json');
  const credentialsPath = path.join(tempHome, '.claude', '.credentials.json');
  const connectHome = path.join(tempHome, '.claude-connect');
  const statePath = path.join(connectHome, 'claude-code', 'switch-state.json');
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
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(settingsPath, JSON.stringify({
    model: 'claude-opus-4-6[1m]',
    env: {}
  }, null, 2));
  await fs.writeFile(accountPath, JSON.stringify({
    oauthAccount: {
      emailAddress: 'max@example.com',
      subscriptionType: 'max'
    }
  }, null, 2));
  await fs.writeFile(credentialsPath, JSON.stringify({
    claudeAiOauth: {
      accessToken: 'max-token',
      refreshToken: 'max-refresh'
    }
  }, null, 2));
  await fs.writeFile(statePath, JSON.stringify({
    schemaVersion: 1,
    active: false,
    originalSettings: {
      model: 'opus[1m]',
      env: {
        ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic'
      }
    },
    originalAccount: {
      customApiKeyResponses: {
        approved: []
      }
    },
    originalCredentials: null
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

  await activateClaudeProfile({ profile });
  const state = JSON.parse(await fs.readFile(statePath, 'utf8'));

  assert.deepEqual(state.originalSettings, {
    model: 'claude-opus-4-6[1m]',
    env: {}
  });
  assert.deepEqual(state.originalAccount, {
    oauthAccount: {
      emailAddress: 'max@example.com',
      subscriptionType: 'max'
    }
  });
  assert.deepEqual(state.originalCredentials, {
    claudeAiOauth: {
      accessToken: 'max-token',
      refreshToken: 'max-refresh'
    }
  });

  store.close();
});
