import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCatalogStore } from '../src/data/catalog-store.js';
import { prepareIsolatedClaudeRuntime, supportsIsolatedClaudeRuntime } from '../src/lib/isolated-claude.js';
import { buildProfile } from '../src/lib/profile.js';
import { saveManagedTokenSecret } from '../src/lib/secrets.js';

test('prepareIsolatedClaudeRuntime writes a dedicated kimi runtime without oauth session', async (t) => {
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-connect-kimi-'));
  const previousHome = process.env.CLAUDE_CONNECT_HOME;
  process.env.CLAUDE_CONNECT_HOME = tempHome;

  t.after(async () => {
    if (typeof previousHome === 'string') {
      process.env.CLAUDE_CONNECT_HOME = previousHome;
    } else {
      delete process.env.CLAUDE_CONNECT_HOME;
    }

    await fs.rm(tempHome, { recursive: true, force: true });
  });

  const store = createCatalogStore({ filename: ':memory:' });
  const kimi = store.getProviderCatalog('kimi');
  const qwen = store.getProviderCatalog('qwen');
  const kimiProfile = buildProfile({
    provider: kimi,
    model: kimi.models[0],
    authMethod: kimi.authMethods[0],
    profileName: 'kimi-kimi-for-coding-token',
    apiKeyEnvVar: 'KIMI_API_KEY'
  });

  kimiProfile.auth.secretFile = await saveManagedTokenSecret({
    profileName: kimiProfile.profileName,
    providerId: kimiProfile.provider.id,
    modelId: kimiProfile.model.id,
    envVar: kimiProfile.auth.envVar,
    token: 'kimi-secret'
  });

  assert.equal(supportsIsolatedClaudeRuntime(kimiProfile), true);
  assert.equal(supportsIsolatedClaudeRuntime({
    provider: {
      id: qwen.id
    }
  }), false);

  const runtime = await prepareIsolatedClaudeRuntime({ profile: kimiProfile });
  const settings = JSON.parse(await fs.readFile(runtime.claudeSettingsPath, 'utf8'));
  const account = JSON.parse(await fs.readFile(runtime.claudeAccountPath, 'utf8'));

  assert.equal(runtime.command, 'claude-kimi');
  assert.equal(settings.env.ANTHROPIC_BASE_URL, 'https://api.kimi.com/coding/');
  assert.equal(settings.env.ANTHROPIC_API_KEY, 'kimi-secret');
  assert.equal(settings.env.ANTHROPIC_AUTH_TOKEN, undefined);
  assert.equal(settings.env.ENABLE_TOOL_SEARCH, 'false');
  assert.equal(account.oauthAccount, undefined);
  assert.equal(account.hasCompletedOnboarding, true);

  store.close();
});
