import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveClaudePaths } from './app-paths.js';

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
}

export async function readClaudeSettings() {
  const { claudeSettingsPath } = await resolveClaudePaths();
  const settings = await readJsonIfExists(claudeSettingsPath);
  return isObject(settings) ? settings : {};
}

export async function readSwitchState() {
  const { claudeCodeDir } = await resolveClaudePaths();
  const stateFilePath = path.join(claudeCodeDir, 'switch-state.json');
  const state = await readJsonIfExists(stateFilePath);
  return isObject(state) ? state : null;
}

export function buildClaudeSettingsForProfile({ baseSettings, profile, gatewayBaseUrl }) {
  const next = structuredClone(baseSettings);
  const env = isObject(next.env) ? { ...next.env } : {};
  const authMethod = profile.auth.method === 'api_key' ? 'token' : profile.auth.method;

  next.model = profile.model.id;
  env.ANTHROPIC_BASE_URL = gatewayBaseUrl;
  env.ANTHROPIC_AUTH_TOKEN = 'claude-connect-local';
  env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = 1;
  env.CLAUDE_CONNECT_ACTIVE_PROFILE = profile.profileName;
  env.CLAUDE_CONNECT_PROVIDER = profile.provider.id;
  env.CLAUDE_CONNECT_MODEL = profile.model.id;
  env.CLAUDE_CONNECT_AUTH_METHOD = authMethod;

  if (authMethod === 'token') {
    env.CLAUDE_CONNECT_TOKEN_ENV_VAR = profile.auth.envVar;
    delete env.CLAUDE_CONNECT_TOKEN_FILE;
  } else if (authMethod === 'oauth' && profile.auth.oauth?.tokenFile) {
    env.CLAUDE_CONNECT_TOKEN_FILE = profile.auth.oauth.tokenFile;
    delete env.CLAUDE_CONNECT_TOKEN_ENV_VAR;
  }

  next.env = env;

  return next;
}

export async function activateClaudeProfile({ profile, gatewayBaseUrl = 'http://127.0.0.1:4310/anthropic' }) {
  const { claudeSettingsPath, claudeCodeDir } = await resolveClaudePaths();
  const stateFilePath = path.join(claudeCodeDir, 'switch-state.json');
  const currentSettings = await readClaudeSettings();
  const currentState = await readSwitchState();
  const originalSettings = currentState?.originalSettings ?? currentSettings;
  const nextSettings = buildClaudeSettingsForProfile({
    baseSettings: currentSettings,
    profile,
    gatewayBaseUrl
  });

  await writeJson(claudeSettingsPath, nextSettings);
  await writeJson(stateFilePath, {
    schemaVersion: 1,
    active: true,
    gatewayBaseUrl,
    profileName: profile.profileName,
    profilePath: profile.filePath,
    originalSettings,
    activatedAt: new Date().toISOString()
  });

  return {
    claudeSettingsPath,
    stateFilePath,
    gatewayBaseUrl
  };
}

export async function revertClaudeProfile() {
  const { claudeSettingsPath, claudeCodeDir } = await resolveClaudePaths();
  const stateFilePath = path.join(claudeCodeDir, 'switch-state.json');
  const state = await readSwitchState();

  if (!state?.active) {
    return {
      reverted: false,
      claudeSettingsPath,
      stateFilePath
    };
  }

  await writeJson(claudeSettingsPath, state.originalSettings ?? {});
  await writeJson(stateFilePath, {
    ...state,
    active: false,
    revertedAt: new Date().toISOString()
  });

  return {
    reverted: true,
    claudeSettingsPath,
    stateFilePath
  };
}

export async function getClaudeSwitchStatus() {
  const { claudeSettingsPath, claudeCodeDir } = await resolveClaudePaths();
  const stateFilePath = path.join(claudeCodeDir, 'switch-state.json');
  const currentSettings = await readClaudeSettings();
  const state = await readSwitchState();
  const env = isObject(currentSettings.env) ? currentSettings.env : {};

  return {
    claudeSettingsPath,
    stateFilePath,
    active: Boolean(state?.active),
    gatewayBaseUrl: state?.gatewayBaseUrl ?? null,
    profileName: state?.profileName ?? null,
    currentModel: typeof currentSettings.model === 'string' ? currentSettings.model : null,
    anthropicBaseUrl: typeof env.ANTHROPIC_BASE_URL === 'string' ? env.ANTHROPIC_BASE_URL : null,
    hasOriginalSnapshot: Boolean(state?.originalSettings)
  };
}
