import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

function getPathModule(platform) {
  return platform === 'win32' ? path.win32 : path.posix;
}

function normalizePathCandidate(value, pathModule) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return null;
  }

  return pathModule.resolve(trimmed);
}

function uniqueCandidates(values, pathModule) {
  const seen = new Set();
  const candidates = [];

  for (const value of values) {
    const normalized = normalizePathCandidate(value, pathModule);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    candidates.push(normalized);
  }

  return candidates;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (_error) {
    return false;
  }
}

function pathExistsSync(targetPath) {
  try {
    return fsSync.existsSync(targetPath);
  } catch (_error) {
    return false;
  }
}

function defaultHomedir(env, fallbackHomedir) {
  const pathModule = getPathModule(process.platform);

  return normalizePathCandidate(env.USERPROFILE, pathModule)
    || normalizePathCandidate(env.HOME, pathModule)
    || normalizePathCandidate(fallbackHomedir, pathModule)
    || os.homedir();
}

export function buildClaudeConnectHomeCandidates({
  platform = process.platform,
  env = process.env,
  homedir = defaultHomedir(env, os.homedir())
} = {}) {
  const pathModule = getPathModule(platform);
  const home = normalizePathCandidate(env.USERPROFILE, pathModule)
    || normalizePathCandidate(env.HOME, pathModule)
    || normalizePathCandidate(homedir, pathModule)
    || defaultHomedir(env, os.homedir());

  if (platform === 'win32') {
    return uniqueCandidates([
      env.CLAUDE_CONNECT_HOME,
      env.APPDATA && pathModule.join(env.APPDATA, 'claude-connect'),
      env.LOCALAPPDATA && pathModule.join(env.LOCALAPPDATA, 'claude-connect'),
      home && pathModule.join(home, '.claude-connect')
    ], pathModule);
  }

  return uniqueCandidates([
    env.CLAUDE_CONNECT_HOME,
    env.XDG_CONFIG_HOME && pathModule.join(env.XDG_CONFIG_HOME, 'claude-connect'),
    home && pathModule.join(home, '.config', 'claude-connect'),
    home && pathModule.join(home, '.claude-connect')
  ], pathModule);
}

export function buildClaudeSettingsPathCandidates({
  platform = process.platform,
  env = process.env,
  homedir = defaultHomedir(env, os.homedir())
} = {}) {
  const pathModule = getPathModule(platform);
  const home = normalizePathCandidate(env.USERPROFILE, pathModule)
    || normalizePathCandidate(env.HOME, pathModule)
    || normalizePathCandidate(homedir, pathModule)
    || defaultHomedir(env, os.homedir());
  const explicitDir = normalizePathCandidate(
    env.CLAUDE_CONFIG_DIR || env.CLAUDE_CODE_CONFIG_DIR,
    pathModule
  );

  if (platform === 'win32') {
    return uniqueCandidates([
      env.CLAUDE_SETTINGS_PATH,
      explicitDir && pathModule.join(explicitDir, 'settings.json'),
      home && pathModule.join(home, '.claude', 'settings.json'),
      env.APPDATA && pathModule.join(env.APPDATA, 'Claude', 'settings.json'),
      env.LOCALAPPDATA && pathModule.join(env.LOCALAPPDATA, 'Claude', 'settings.json')
    ], pathModule);
  }

  return uniqueCandidates([
    env.CLAUDE_SETTINGS_PATH,
    explicitDir && pathModule.join(explicitDir, 'settings.json'),
    home && pathModule.join(home, '.claude', 'settings.json'),
    env.XDG_CONFIG_HOME && pathModule.join(env.XDG_CONFIG_HOME, 'claude', 'settings.json'),
    home && pathModule.join(home, '.config', 'claude', 'settings.json')
  ], pathModule);
}

export function buildClaudeAccountPathCandidates({
  platform = process.platform,
  env = process.env,
  homedir = defaultHomedir(env, os.homedir())
} = {}) {
  const pathModule = getPathModule(platform);
  const home = normalizePathCandidate(env.USERPROFILE, pathModule)
    || normalizePathCandidate(env.HOME, pathModule)
    || normalizePathCandidate(homedir, pathModule)
    || defaultHomedir(env, os.homedir());

  return uniqueCandidates([
    env.CLAUDE_ACCOUNT_PATH,
    home && pathModule.join(home, '.claude.json')
  ], pathModule);
}

export function buildClaudeCredentialsPathCandidates({
  platform = process.platform,
  env = process.env,
  homedir = defaultHomedir(env, os.homedir())
} = {}) {
  const pathModule = getPathModule(platform);
  const home = normalizePathCandidate(env.USERPROFILE, pathModule)
    || normalizePathCandidate(env.HOME, pathModule)
    || normalizePathCandidate(homedir, pathModule)
    || defaultHomedir(env, os.homedir());
  const settingsCandidates = buildClaudeSettingsPathCandidates({
    platform,
    env,
    homedir
  });

  return uniqueCandidates([
    env.CLAUDE_CREDENTIALS_PATH,
    ...settingsCandidates.map((candidate) => pathModule.join(pathModule.dirname(candidate), '.credentials.json')),
    home && pathModule.join(home, '.claude', '.credentials.json')
  ], pathModule);
}

export async function resolveClaudeConnectHome(options = {}) {
  if (typeof options.env?.CLAUDE_CONNECT_HOME === 'string' && options.env.CLAUDE_CONNECT_HOME.trim().length > 0) {
    return buildClaudeConnectHomeCandidates(options)[0];
  }

  if (typeof process.env.CLAUDE_CONNECT_HOME === 'string' && process.env.CLAUDE_CONNECT_HOME.trim().length > 0) {
    return buildClaudeConnectHomeCandidates(options)[0];
  }

  const candidates = buildClaudeConnectHomeCandidates(options);

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

export function resolveClaudeConnectHomeSync(options = {}) {
  const candidates = buildClaudeConnectHomeCandidates(options);

  for (const candidate of candidates) {
    if (pathExistsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

export async function resolveClaudeSettingsPath(options = {}) {
  if (typeof options.env?.CLAUDE_SETTINGS_PATH === 'string' && options.env.CLAUDE_SETTINGS_PATH.trim().length > 0) {
    return buildClaudeSettingsPathCandidates(options)[0];
  }

  if (typeof process.env.CLAUDE_SETTINGS_PATH === 'string' && process.env.CLAUDE_SETTINGS_PATH.trim().length > 0) {
    return buildClaudeSettingsPathCandidates(options)[0];
  }

  const candidates = buildClaudeSettingsPathCandidates(options);

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

export async function resolveClaudeAccountPath(options = {}) {
  if (typeof options.env?.CLAUDE_ACCOUNT_PATH === 'string' && options.env.CLAUDE_ACCOUNT_PATH.trim().length > 0) {
    return buildClaudeAccountPathCandidates(options)[0];
  }

  if (typeof process.env.CLAUDE_ACCOUNT_PATH === 'string' && process.env.CLAUDE_ACCOUNT_PATH.trim().length > 0) {
    return buildClaudeAccountPathCandidates(options)[0];
  }

  const candidates = buildClaudeAccountPathCandidates(options);

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

export async function resolveClaudeCredentialsPath(options = {}) {
  if (typeof options.env?.CLAUDE_CREDENTIALS_PATH === 'string' && options.env.CLAUDE_CREDENTIALS_PATH.trim().length > 0) {
    return buildClaudeCredentialsPathCandidates(options)[0];
  }

  if (typeof process.env.CLAUDE_CREDENTIALS_PATH === 'string' && process.env.CLAUDE_CREDENTIALS_PATH.trim().length > 0) {
    return buildClaudeCredentialsPathCandidates(options)[0];
  }

  const candidates = buildClaudeCredentialsPathCandidates(options);

  for (const candidate of candidates) {
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

export async function resolveClaudeConnectPaths(options = {}) {
  const claudeConnectHome = await resolveClaudeConnectHome(options);

  return {
    claudeConnectHome,
    storageDir: path.join(claudeConnectHome, 'storage'),
    catalogDataPath: path.join(claudeConnectHome, 'storage', 'catalog.json'),
    catalogDbPath: path.join(claudeConnectHome, 'storage', 'catalog.json'),
    profilesDir: path.join(claudeConnectHome, 'profiles'),
    tokensDir: path.join(claudeConnectHome, 'tokens'),
    secretsDir: path.join(claudeConnectHome, 'secrets'),
    providerSecretsDir: path.join(claudeConnectHome, 'secrets', 'providers'),
    claudeCodeDir: path.join(claudeConnectHome, 'claude-code'),
    gatewayDir: path.join(claudeConnectHome, 'gateway'),
    gatewayStatePath: path.join(claudeConnectHome, 'gateway', 'state.json'),
    gatewayLogPath: path.join(claudeConnectHome, 'gateway', 'gateway.log')
  };
}

export async function resolveClaudePaths(options = {}) {
  const claudeSettingsPath = await resolveClaudeSettingsPath(options);
  const claudeAccountPath = await resolveClaudeAccountPath(options);
  const claudeCredentialsPath = await resolveClaudeCredentialsPath(options);
  const claudeConnectPaths = await resolveClaudeConnectPaths(options);

  return {
    claudeSettingsPath,
    claudeAccountPath,
    claudeCredentialsPath,
    claudeConfigDir: path.dirname(claudeSettingsPath),
    ...claudeConnectPaths
  };
}

function buildExecutableNames(command, platform = process.platform, env = process.env) {
  if (platform !== 'win32') {
    return [command];
  }

  const pathext = typeof env.PATHEXT === 'string' && env.PATHEXT.length > 0
    ? env.PATHEXT.split(';').filter(Boolean)
    : ['.EXE', '.CMD', '.BAT', '.COM'];
  const hasExt = path.win32.extname(command).length > 0;

  if (hasExt) {
    return [command];
  }

  return pathext.map((ext) => `${command}${ext.toLowerCase()}`);
}

export async function findExecutableOnPath(command, {
  platform = process.platform,
  env = process.env
} = {}) {
  const pathModule = getPathModule(platform);
  const pathValue = typeof env.PATH === 'string' ? env.PATH : '';
  const pathEntries = pathValue.split(path.delimiter).filter(Boolean);
  const commandNames = buildExecutableNames(command, platform, env);

  for (const directory of pathEntries) {
    for (const commandName of commandNames) {
      const candidate = pathModule.join(directory, commandName);

      if (await pathExists(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

export async function detectClaudeCodeInstallation(options = {}) {
  const settingsCandidates = buildClaudeSettingsPathCandidates(options);
  const accountCandidates = buildClaudeAccountPathCandidates(options);
  const credentialsCandidates = buildClaudeCredentialsPathCandidates(options);
  const executablePath = await findExecutableOnPath('claude', options);

  const [existingSettingsPath, existingAccountPath, existingCredentialsPath] = await Promise.all([
    (async () => {
      for (const candidate of settingsCandidates) {
        if (await pathExists(candidate)) {
          return candidate;
        }
      }

      return null;
    })(),
    (async () => {
      for (const candidate of accountCandidates) {
        if (await pathExists(candidate)) {
          return candidate;
        }
      }

      return null;
    })(),
    (async () => {
      for (const candidate of credentialsCandidates) {
        if (await pathExists(candidate)) {
          return candidate;
        }
      }

      return null;
    })()
  ]);

  return {
    isInstalled: Boolean(executablePath || existingSettingsPath || existingAccountPath || existingCredentialsPath),
    executablePath,
    existingSettingsPath,
    existingAccountPath,
    existingCredentialsPath,
    settingsCandidates,
    accountCandidates,
    credentialsCandidates
  };
}
