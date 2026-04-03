import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildClaudeConnectHomeCandidates,
  buildClaudeAccountPathCandidates,
  buildClaudeCredentialsPathCandidates,
  buildClaudeSettingsPathCandidates,
  detectClaudeCodeInstallation,
  findExecutableOnPath
} from '../src/lib/app-paths.js';
import { getDefaultCatalogDbPath } from '../src/data/catalog-store.js';

test('buildClaudeSettingsPathCandidates prioritizes linux defaults and overrides', () => {
  const candidates = buildClaudeSettingsPathCandidates({
    platform: 'linux',
    homedir: '/home/tester',
    env: {
      HOME: '/home/tester',
      XDG_CONFIG_HOME: '/home/tester/.config',
      CLAUDE_SETTINGS_PATH: '/tmp/custom-settings.json'
    }
  });

  assert.deepEqual(candidates, [
    '/tmp/custom-settings.json',
    '/home/tester/.claude/settings.json',
    '/home/tester/.config/claude/settings.json'
  ]);
});

test('buildClaudeSettingsPathCandidates prioritizes the official windows home path first', () => {
  const candidates = buildClaudeSettingsPathCandidates({
    platform: 'win32',
    homedir: 'C:\\Users\\Tester',
    env: {
      USERPROFILE: 'C:\\Users\\Tester',
      APPDATA: 'C:\\Users\\Tester\\AppData\\Roaming',
      LOCALAPPDATA: 'C:\\Users\\Tester\\AppData\\Local'
    }
  });

  assert.deepEqual(candidates, [
    'C:\\Users\\Tester\\.claude\\settings.json',
    'C:\\Users\\Tester\\AppData\\Roaming\\Claude\\settings.json',
    'C:\\Users\\Tester\\AppData\\Local\\Claude\\settings.json'
  ]);
});

test('buildClaudeConnectHomeCandidates supports windows and linux storage roots', () => {
  const linuxCandidates = buildClaudeConnectHomeCandidates({
    platform: 'linux',
    homedir: '/home/tester',
    env: {
      HOME: '/home/tester',
      XDG_CONFIG_HOME: '/home/tester/.config'
    }
  });
  const windowsCandidates = buildClaudeConnectHomeCandidates({
    platform: 'win32',
    homedir: 'C:\\Users\\Tester',
    env: {
      USERPROFILE: 'C:\\Users\\Tester',
      APPDATA: 'C:\\Users\\Tester\\AppData\\Roaming'
    }
  });

  assert.deepEqual(linuxCandidates, [
    '/home/tester/.config/claude-connect',
    '/home/tester/.claude-connect'
  ]);
  assert.deepEqual(windowsCandidates, [
    'C:\\Users\\Tester\\AppData\\Roaming\\claude-connect',
    'C:\\Users\\Tester\\.claude-connect'
  ]);
});

test('getDefaultCatalogDbPath stores sqlite under the claude-connect home instead of cwd', () => {
  const linuxDbPath = getDefaultCatalogDbPath({
    platform: 'linux',
    homedir: '/home/tester',
    env: {
      HOME: '/home/tester',
      XDG_CONFIG_HOME: '/home/tester/.config'
    }
  });
  const windowsDbPath = getDefaultCatalogDbPath({
    platform: 'win32',
    homedir: 'C:\\Users\\Tester',
    env: {
      USERPROFILE: 'C:\\Users\\Tester',
      APPDATA: 'C:\\Users\\Tester\\AppData\\Roaming'
    }
  });

  assert.equal(linuxDbPath, '/home/tester/.config/claude-connect/storage/claude-connect.sqlite');
  assert.equal(windowsDbPath, 'C:\\Users\\Tester\\AppData\\Roaming\\claude-connect\\storage\\claude-connect.sqlite');
});

test('buildClaudeAccountPathCandidates resolves the Claude account snapshot path', () => {
  const linuxCandidates = buildClaudeAccountPathCandidates({
    platform: 'linux',
    homedir: '/home/tester',
    env: {
      HOME: '/home/tester'
    }
  });
  const windowsCandidates = buildClaudeAccountPathCandidates({
    platform: 'win32',
    homedir: 'C:\\Users\\Tester',
    env: {
      USERPROFILE: 'C:\\Users\\Tester'
    }
  });

  assert.deepEqual(linuxCandidates, [
    '/home/tester/.claude.json'
  ]);
  assert.deepEqual(windowsCandidates, [
    'C:\\Users\\Tester\\.claude.json'
  ]);
});

test('buildClaudeCredentialsPathCandidates resolves the Claude credentials path', () => {
  const linuxCandidates = buildClaudeCredentialsPathCandidates({
    platform: 'linux',
    homedir: '/home/tester',
    env: {
      HOME: '/home/tester',
      XDG_CONFIG_HOME: '/home/tester/.config'
    }
  });
  const windowsCandidates = buildClaudeCredentialsPathCandidates({
    platform: 'win32',
    homedir: 'C:\\Users\\Tester',
    env: {
      USERPROFILE: 'C:\\Users\\Tester',
      APPDATA: 'C:\\Users\\Tester\\AppData\\Roaming',
      LOCALAPPDATA: 'C:\\Users\\Tester\\AppData\\Local'
    }
  });

  assert.deepEqual(linuxCandidates, [
    '/home/tester/.claude/.credentials.json',
    '/home/tester/.config/claude/.credentials.json'
  ]);
  assert.deepEqual(windowsCandidates, [
    'C:\\Users\\Tester\\.claude\\.credentials.json',
    'C:\\Users\\Tester\\AppData\\Roaming\\Claude\\.credentials.json',
    'C:\\Users\\Tester\\AppData\\Local\\Claude\\.credentials.json'
  ]);
});

test('findExecutableOnPath resolves claude when it exists on PATH', async () => {
  const executablePath = await findExecutableOnPath('claude', {
    platform: 'linux',
    env: {
      PATH: '/opt/bin:/usr/local/bin'
    }
  });

  assert.equal(executablePath, null);
});

test('detectClaudeCodeInstallation reports installed when a settings file exists', async () => {
  const tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-connect-install-'));
  const settingsPath = path.join(tempHome, '.claude', 'settings.json');

  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  await fs.writeFile(settingsPath, '{}\n');

  const result = await detectClaudeCodeInstallation({
    platform: 'linux',
    homedir: tempHome,
    env: {
      HOME: tempHome,
      PATH: ''
    }
  });

  assert.equal(result.isInstalled, true);
  assert.equal(result.existingSettingsPath, settingsPath);
});
