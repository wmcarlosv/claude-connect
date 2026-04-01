import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  buildClaudeSettingsForProfile,
  resolveClaudeTransportForProfile
} from './claude-settings.js';
import { resolveClaudeConnectPaths } from './app-paths.js';
import { slugifyProfileName } from './profile.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cliEntryPath = path.join(projectRoot, 'bin', 'claude-connect.js');

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

function buildRuntimeId(profile) {
  return slugifyProfileName(profile.profileName || `${profile.provider.id}-${profile.model.id}`);
}

export function supportsIsolatedClaudeRuntime(profile) {
  return profile?.provider?.id === 'kimi';
}

export function getIsolatedClaudeCommand(profile) {
  if (profile?.provider?.id === 'kimi') {
    return 'claude-kimi';
  }

  return `claude-connect launch-profile ${profile.profileName}`;
}

function getLauncherBaseName(profile) {
  if (profile?.provider?.id === 'kimi') {
    return 'claude-kimi';
  }

  return slugifyProfileName(`claude-${profile.profileName || profile?.provider?.id || 'runtime'}`);
}

function buildWindowsLauncherContent({ profileName }) {
  return [
    '@echo off',
    'setlocal',
    `node --no-warnings=ExperimentalWarning "${cliEntryPath}" launch-profile "${profileName}" %*`
  ].join('\r\n').concat('\r\n');
}

function buildPosixLauncherContent({ profileName }) {
  return [
    '#!/usr/bin/env bash',
    `node --no-warnings=ExperimentalWarning "${cliEntryPath}" launch-profile "${profileName}" "$@"`
  ].join('\n').concat('\n');
}

export async function ensureIsolatedLauncher(profile) {
  const { claudeConnectHome } = await resolveClaudeConnectPaths();
  const launcherDir = path.join(claudeConnectHome, 'bin');
  const baseName = getLauncherBaseName(profile);
  const extension = process.platform === 'win32' ? '.cmd' : '';
  const launcherPath = path.join(launcherDir, `${baseName}${extension}`);
  const content = process.platform === 'win32'
    ? buildWindowsLauncherContent({ profileName: profile.profileName })
    : buildPosixLauncherContent({ profileName: profile.profileName });

  await fs.mkdir(launcherDir, { recursive: true });
  await fs.writeFile(launcherPath, content, { mode: 0o755 });

  if (process.platform !== 'win32') {
    await fs.chmod(launcherPath, 0o755);
  }

  return launcherPath;
}

function buildLaunchEnv(runtimeHome) {
  const env = {
    ...process.env,
    HOME: runtimeHome,
    USERPROFILE: runtimeHome,
    XDG_CONFIG_HOME: path.join(runtimeHome, '.config'),
    XDG_CACHE_HOME: path.join(runtimeHome, '.cache'),
    XDG_DATA_HOME: path.join(runtimeHome, '.local', 'share'),
    CLAUDE_SETTINGS_PATH: path.join(runtimeHome, '.claude', 'settings.json'),
    CLAUDE_CONFIG_DIR: path.join(runtimeHome, '.claude'),
    CLAUDE_CODE_CONFIG_DIR: path.join(runtimeHome, '.claude'),
    CLAUDE_CONNECT_RUNTIME_HOME: runtimeHome
  };

  if (process.platform === 'win32') {
    env.APPDATA = path.join(runtimeHome, 'AppData', 'Roaming');
    env.LOCALAPPDATA = path.join(runtimeHome, 'AppData', 'Local');
  }

  return env;
}

async function launchClaudeProcess({ env = process.env, args = [] }) {
  const command = process.platform === 'win32' ? 'claude.cmd' : 'claude';

  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: 'inherit'
    });

    child.on('error', (error) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        reject(new Error('No encontre el binario `claude` en PATH. Instala @anthropic-ai/claude-code antes de lanzar este runtime.'));
        return;
      }

      reject(error);
    });

    child.on('exit', (code, signal) => {
      if (typeof code === 'number' && code !== 0) {
        reject(new Error(`Claude termino con codigo ${code}.`));
        return;
      }

      if (signal) {
        reject(new Error(`Claude termino por la senal ${signal}.`));
        return;
      }

      resolve(null);
    });
  });
}

export async function launchConfiguredClaude(args = []) {
  await launchClaudeProcess({ args });
}

export async function prepareIsolatedClaudeRuntime({
  profile,
  gatewayBaseUrl = 'http://127.0.0.1:4310/anthropic'
}) {
  if (!supportsIsolatedClaudeRuntime(profile)) {
    throw new Error(`El proveedor ${profile?.provider?.name ?? 'desconocido'} no usa runtime aislado.`);
  }

  const { claudeConnectHome } = await resolveClaudeConnectPaths();
  const runtimeHome = path.join(claudeConnectHome, 'runtimes', buildRuntimeId(profile));
  const claudeDir = path.join(runtimeHome, '.claude');
  const claudeSettingsPath = path.join(claudeDir, 'settings.json');
  const claudeAccountPath = path.join(runtimeHome, '.claude.json');
  const runtimeInfoPath = path.join(runtimeHome, 'runtime.json');
  const existingSettings = await readJsonIfExists(claudeSettingsPath);
  const existingAccount = await readJsonIfExists(claudeAccountPath);
  const account = isObject(existingAccount) ? existingAccount : {};
  const { oauthAccount: _oauthAccount, ...accountWithoutOAuth } = account;
  const transport = await resolveClaudeTransportForProfile({
    profile,
    gatewayBaseUrl
  });
  const nextSettings = buildClaudeSettingsForProfile({
    baseSettings: isObject(existingSettings) ? existingSettings : {},
    profile,
    connectionBaseUrl: transport.connectionBaseUrl,
    authToken: transport.authToken,
    authEnvMode: transport.authEnvMode,
    connectionMode: transport.connectionMode,
    extraEnv: transport.extraEnv
  });

  await fs.mkdir(path.join(runtimeHome, '.config'), { recursive: true });
  await fs.mkdir(path.join(runtimeHome, '.cache'), { recursive: true });
  await fs.mkdir(path.join(runtimeHome, '.local', 'share'), { recursive: true });
  await writeJson(claudeSettingsPath, nextSettings);
  await writeJson(claudeAccountPath, {
    ...accountWithoutOAuth,
    hasCompletedOnboarding: true,
    claudeConnectManaged: true,
    updatedAt: new Date().toISOString()
  });
  await writeJson(runtimeInfoPath, {
    schemaVersion: 1,
    profileName: profile.profileName,
    providerId: profile.provider.id,
    modelId: profile.model.id,
    command: getIsolatedClaudeCommand(profile),
    connectionBaseUrl: transport.connectionBaseUrl,
    runtimeHome,
    updatedAt: new Date().toISOString()
  });
  const launcherPath = await ensureIsolatedLauncher(profile);

  return {
    runtimeHome,
    claudeSettingsPath,
    claudeAccountPath,
    runtimeInfoPath,
    connectionBaseUrl: transport.connectionBaseUrl,
    command: getIsolatedClaudeCommand(profile),
    launcherPath,
    connectionMode: transport.connectionMode
  };
}

export async function launchIsolatedClaudeProfile({ profile, args = [] }) {
  const runtime = await prepareIsolatedClaudeRuntime({ profile });
  await launchClaudeProcess({
    env: buildLaunchEnv(runtime.runtimeHome),
    args
  });

  return runtime;
}
