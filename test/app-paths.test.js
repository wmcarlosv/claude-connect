import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildClaudeConnectHomeCandidates,
  buildClaudeAccountPathCandidates,
  buildClaudeCredentialsPathCandidates,
  buildClaudeSettingsPathCandidates
} from '../src/lib/app-paths.js';

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
