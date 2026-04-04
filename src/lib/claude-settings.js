import fs from 'node:fs/promises';
import path from 'node:path';
import { detectClaudeCodeInstallation, resolveClaudePaths } from './app-paths.js';
import { readManagedProviderTokenSecret, readManagedTokenSecret } from './secrets.js';

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const externalConflictKeys = [
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_AUTH_TOKEN',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ENABLE_TOOL_SEARCH',
  'API_TIMEOUT_MS'
];

function summarizeEnvValue(key, value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';

  if (trimmed.length === 0) {
    return null;
  }

  if (key.includes('TOKEN') || key.includes('KEY')) {
    return `${trimmed.slice(0, 4)}...`;
  }

  return trimmed;
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

async function writeJsonOrRemove(filePath, payload) {
  if (payload === null) {
    await fs.rm(filePath, { force: true });
    return;
  }

  await writeJson(filePath, payload);
}

export function detectExternalClaudeEnvConflicts(env = process.env) {
  return externalConflictKeys.flatMap((key) => {
    const value = summarizeEnvValue(key, env[key]);

    if (!value) {
      return [];
    }

    return [{
      key,
      value
    }];
  });
}

export async function readClaudeSettings() {
  const { claudeSettingsPath } = await resolveClaudePaths();
  const settings = await readJsonIfExists(claudeSettingsPath);
  return isObject(settings) ? settings : {};
}

export async function readClaudeAccount() {
  const { claudeAccountPath } = await resolveClaudePaths();
  const account = await readJsonIfExists(claudeAccountPath);
  return isObject(account) ? account : {};
}

export async function readClaudeCredentials() {
  const { claudeCredentialsPath } = await resolveClaudePaths();
  const credentials = await readJsonIfExists(claudeCredentialsPath);
  return isObject(credentials) ? credentials : {};
}

export async function readSwitchState() {
  const { claudeCodeDir } = await resolveClaudePaths();
  const stateFilePath = path.join(claudeCodeDir, 'switch-state.json');
  const state = await readJsonIfExists(stateFilePath);
  return isObject(state) ? state : null;
}

async function resolveTokenValueForProfile(profile) {
  if (profile?.provider?.id === 'ollama') {
    return 'ollama';
  }

  const envVar = profile?.auth?.envVar;
  const envToken = typeof envVar === 'string' ? process.env[envVar] : '';

  if (typeof envToken === 'string' && envToken.trim().length > 0) {
    return envToken.trim();
  }

  const providerSecretRecord = await readManagedProviderTokenSecret(profile?.provider?.id);
  const providerToken = typeof providerSecretRecord?.secret?.token === 'string'
    ? providerSecretRecord.secret.token
    : '';

  if (providerToken.trim().length > 0) {
    return providerToken.trim();
  }

  if (typeof profile?.auth?.secretFile === 'string') {
    const secret = await readManagedTokenSecret(profile.auth.secretFile);
    const secretToken = typeof secret?.token === 'string' ? secret.token : '';

    if (secretToken.trim().length > 0) {
      return secretToken.trim();
    }
  }

  throw new Error(`Falta la API key para ${profile.provider.name}. Guarda la API key en la conexion o exporta ${envVar}.`);
}

export async function resolveClaudeTransportForProfile({
  profile,
  gatewayBaseUrl = 'http://127.0.0.1:4310/anthropic'
}) {
  const authMethod = profile.auth.method === 'api_key' ? 'token' : profile.auth.method;
  const modelTransportMode = profile?.provider?.id === 'kimi'
    ? 'gateway'
    : profile?.model?.transportMode ?? 'gateway';
  const modelApiBaseUrl = typeof profile?.model?.apiBaseUrl === 'string' && profile.model.apiBaseUrl.length > 0
    ? profile.model.apiBaseUrl
    : profile?.endpoint?.baseUrl;
  const modelAuthEnvMode = profile?.model?.authEnvMode ?? 'auth_token';

  if (authMethod === 'token' && modelTransportMode === 'direct') {
    const token = await resolveTokenValueForProfile(profile);
    const extraEnv = {};

    if (profile.provider.id === 'deepseek') {
      extraEnv.API_TIMEOUT_MS = '600000';
      extraEnv.ANTHROPIC_MODEL = profile.model.id;
      extraEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL = profile.model.id;
    }

    if (profile.provider.id === 'zai') {
      extraEnv.API_TIMEOUT_MS = '3000000';
      extraEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL = profile.model.id;
      extraEnv.ANTHROPIC_DEFAULT_SONNET_MODEL = profile.model.id;
      extraEnv.ANTHROPIC_DEFAULT_OPUS_MODEL = profile.model.id;
    }

    if (profile.provider.id === 'kimi') {
      extraEnv.ENABLE_TOOL_SEARCH = 'false';
    }

    return {
      connectionMode: 'direct',
      connectionBaseUrl: modelApiBaseUrl,
      authToken: token,
      authEnvMode: modelAuthEnvMode,
      extraEnv
    };
  }

  if (authMethod === 'server') {
    return {
      connectionMode: 'gateway',
      connectionBaseUrl: gatewayBaseUrl,
      authToken: 'claude-connect-local',
      authEnvMode: 'auth_token',
      extraEnv: {}
    };
  }

  return {
    connectionMode: 'gateway',
    connectionBaseUrl: gatewayBaseUrl,
    authToken: 'claude-connect-local',
    authEnvMode: 'auth_token',
    extraEnv: {}
  };
}

export function buildClaudeSettingsForProfile({
  baseSettings,
  profile,
  connectionBaseUrl,
  authToken,
  authEnvMode = 'auth_token',
  connectionMode,
  extraEnv = {}
}) {
  const next = structuredClone(baseSettings);
  const env = isObject(next.env) ? { ...next.env } : {};
  const authMethod = profile.auth.method === 'api_key' ? 'token' : profile.auth.method;
  const configuredModelId = profile?.model?.upstreamModelId ?? profile.model.id;

  next.model = configuredModelId;
  env.ANTHROPIC_BASE_URL = connectionBaseUrl;
  delete env.ANTHROPIC_AUTH_TOKEN;
  delete env.ANTHROPIC_API_KEY;

  if (authEnvMode === 'api_key') {
    env.ANTHROPIC_API_KEY = authToken;
  } else {
    env.ANTHROPIC_AUTH_TOKEN = authToken;
  }

  env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = 1;
  env.CLAUDE_CONNECT_ACTIVE_PROFILE = profile.profileName;
  env.CLAUDE_CONNECT_PROVIDER = profile.provider.id;
  env.CLAUDE_CONNECT_MODEL = configuredModelId;
  env.CLAUDE_CONNECT_AUTH_METHOD = authMethod;
  env.CLAUDE_CONNECT_CONNECTION_MODE = connectionMode;
  delete env.ENABLE_TOOL_SEARCH;
  delete env.ANTHROPIC_MODEL;
  delete env.ANTHROPIC_DEFAULT_HAIKU_MODEL;
  delete env.ANTHROPIC_DEFAULT_SONNET_MODEL;
  delete env.ANTHROPIC_DEFAULT_OPUS_MODEL;

  Object.assign(env, extraEnv);

  if (authMethod === 'token') {
    env.CLAUDE_CONNECT_TOKEN_ENV_VAR = profile.auth.envVar;
    delete env.CLAUDE_CONNECT_TOKEN_FILE;
  } else if (authMethod === 'server') {
    delete env.CLAUDE_CONNECT_TOKEN_ENV_VAR;
    delete env.CLAUDE_CONNECT_TOKEN_FILE;
  } else if (authMethod === 'oauth' && profile.auth.oauth?.tokenFile) {
    env.CLAUDE_CONNECT_TOKEN_FILE = profile.auth.oauth.tokenFile;
    delete env.CLAUDE_CONNECT_TOKEN_ENV_VAR;
  }

  next.env = env;

  return next;
}

export async function activateClaudeProfile({ profile, gatewayBaseUrl = 'http://127.0.0.1:4310/anthropic' }) {
  const installation = await detectClaudeCodeInstallation();

  if (!installation.isInstalled) {
    throw new Error(
      'Claude Code no parece estar instalado en esta maquina. Instala o ejecuta Claude Code primero y luego vuelve a activar la conexion.'
    );
  }

  const {
    claudeSettingsPath,
    claudeAccountPath,
    claudeCredentialsPath,
    claudeCodeDir
  } = await resolveClaudePaths();
  const stateFilePath = path.join(claudeCodeDir, 'switch-state.json');
  const currentSettings = await readClaudeSettings();
  const currentAccount = await readClaudeAccount();
  const currentCredentials = await readJsonIfExists(claudeCredentialsPath);
  const currentState = await readSwitchState();
  const canReuseActiveSnapshot = currentState?.active === true;
  const originalSettings = canReuseActiveSnapshot
    ? currentState?.originalSettings ?? currentSettings
    : currentSettings;
  const originalAccount = canReuseActiveSnapshot
    ? currentState?.originalAccount ?? currentAccount
    : currentAccount;
  const originalCredentials = canReuseActiveSnapshot
    && currentState
    && Object.prototype.hasOwnProperty.call(currentState, 'originalCredentials')
    ? currentState.originalCredentials
    : currentCredentials;
  const transport = await resolveClaudeTransportForProfile({
    profile,
    gatewayBaseUrl
  });
  const nextSettings = buildClaudeSettingsForProfile({
    baseSettings: currentSettings,
    profile,
    connectionBaseUrl: transport.connectionBaseUrl,
    authToken: transport.authToken,
    authEnvMode: transport.authEnvMode,
    connectionMode: transport.connectionMode,
    extraEnv: transport.extraEnv
  });
  const nextAccount = {
    ...currentAccount
  };
  const nextCredentials = isObject(currentCredentials)
    ? { ...currentCredentials }
    : {};

  delete nextAccount.oauthAccount;
  delete nextAccount.accessToken;
  delete nextAccount.refreshToken;
  nextAccount.claudeConnectManaged = true;
  nextAccount.updatedAt = new Date().toISOString();

  delete nextCredentials.claudeAiOauth;
  delete nextCredentials.oauthAccount;
  delete nextCredentials.accessToken;
  delete nextCredentials.refreshToken;
  nextCredentials.claudeConnectManaged = true;
  nextCredentials.updatedAt = new Date().toISOString();

  await writeJson(claudeSettingsPath, nextSettings);
  await writeJson(claudeAccountPath, nextAccount);
  await writeJsonOrRemove(claudeCredentialsPath, nextCredentials);
  await writeJson(stateFilePath, {
    schemaVersion: 1,
    active: true,
    gatewayBaseUrl: transport.connectionMode === 'gateway' ? transport.connectionBaseUrl : null,
    connectionBaseUrl: transport.connectionBaseUrl,
    connectionMode: transport.connectionMode,
    profileName: profile.profileName,
    profilePath: profile.filePath,
    originalSettings,
    originalAccount,
    originalCredentials,
    activatedAt: new Date().toISOString()
  });

  return {
    claudeSettingsPath,
    claudeAccountPath,
    claudeCredentialsPath,
    stateFilePath,
    gatewayBaseUrl: transport.connectionMode === 'gateway' ? transport.connectionBaseUrl : null,
    connectionBaseUrl: transport.connectionBaseUrl,
    connectionMode: transport.connectionMode
  };
}

export async function revertClaudeProfile() {
  const {
    claudeSettingsPath,
    claudeAccountPath,
    claudeCredentialsPath,
    claudeCodeDir
  } = await resolveClaudePaths();
  const stateFilePath = path.join(claudeCodeDir, 'switch-state.json');
  const state = await readSwitchState();

  if (!state?.active) {
    return {
      reverted: false,
      claudeSettingsPath,
      claudeAccountPath,
      claudeCredentialsPath,
      stateFilePath
    };
  }

  await writeJson(claudeSettingsPath, state.originalSettings ?? {});
  await writeJson(claudeAccountPath, state.originalAccount ?? {});
  await writeJsonOrRemove(
    claudeCredentialsPath,
    Object.prototype.hasOwnProperty.call(state, 'originalCredentials')
      ? state.originalCredentials
      : null
  );
  await writeJson(stateFilePath, {
    ...state,
    active: false,
    revertedAt: new Date().toISOString()
  });

  return {
    reverted: true,
    claudeSettingsPath,
    claudeAccountPath,
    claudeCredentialsPath,
    stateFilePath
  };
}

export async function getClaudeSwitchStatus() {
  const {
    claudeSettingsPath,
    claudeAccountPath,
    claudeCredentialsPath,
    claudeCodeDir
  } = await resolveClaudePaths();
  const stateFilePath = path.join(claudeCodeDir, 'switch-state.json');
  const currentSettings = await readClaudeSettings();
  const currentAccount = await readClaudeAccount();
  const currentCredentials = await readClaudeCredentials();
  const state = await readSwitchState();
  const env = isObject(currentSettings.env) ? currentSettings.env : {};

  return {
    claudeSettingsPath,
    claudeAccountPath,
    claudeCredentialsPath,
    stateFilePath,
    active: Boolean(state?.active),
    gatewayBaseUrl: state?.gatewayBaseUrl ?? null,
    connectionBaseUrl: state?.connectionBaseUrl ?? null,
    connectionMode: state?.connectionMode ?? null,
    profileName: state?.profileName ?? null,
    currentModel: typeof currentSettings.model === 'string' ? currentSettings.model : null,
    anthropicBaseUrl: typeof env.ANTHROPIC_BASE_URL === 'string' ? env.ANTHROPIC_BASE_URL : null,
    hasOriginalSnapshot: Boolean(state?.originalSettings),
    hasOriginalAccountSnapshot: Boolean(state?.originalAccount),
    hasOriginalCredentialsSnapshot: Boolean(state && Object.prototype.hasOwnProperty.call(state, 'originalCredentials')),
    hasOauthAccount: Boolean(currentAccount.oauthAccount),
    hasClaudeAiOauthCredentials: Boolean(currentCredentials.claudeAiOauth),
    externalEnvConflicts: detectExternalClaudeEnvConflicts()
  };
}
