import fs from 'node:fs/promises';
import { gatewayBaseUrl } from './constants.js';
import { resolveClaudeConnectPaths } from '../lib/app-paths.js';

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

export async function writeGatewayState(payload) {
  const { gatewayDir, gatewayStatePath } = await resolveClaudeConnectPaths();
  await fs.mkdir(gatewayDir, { recursive: true });
  await fs.writeFile(gatewayStatePath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
}

export async function readGatewayState() {
  const { gatewayStatePath } = await resolveClaudeConnectPaths();
  const state = await readJsonIfExists(gatewayStatePath);
  return isObject(state) ? state : null;
}

export function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH') {
      return false;
    }

    if (error && typeof error === 'object' && 'code' in error && error.code === 'EPERM') {
      return true;
    }

    throw error;
  }
}

async function probeGatewayHealth(timeoutMs) {
  try {
    const response = await fetch(`${gatewayBaseUrl}/health`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (_error) {
    return null;
  }
}

export async function getGatewayStatus({ timeoutMs = 700 } = {}) {
  const { gatewayLogPath, gatewayStatePath } = await resolveClaudeConnectPaths();
  const state = await readGatewayState();
  const pid = Number(state?.pid ?? 0);
  const processAlive = isProcessAlive(pid);
  const health = await probeGatewayHealth(timeoutMs);

  return {
    active: Boolean(health),
    pid: processAlive ? pid : null,
    baseUrl: gatewayBaseUrl,
    logPath: gatewayLogPath,
    statePath: gatewayStatePath,
    startedAt: typeof state?.startedAt === 'string' ? state.startedAt : null,
    lastError: typeof state?.lastError === 'string' ? state.lastError : null,
    profileName: typeof health?.profileName === 'string'
      ? health.profileName
      : typeof state?.profileName === 'string'
        ? state.profileName
        : null,
    upstreamBaseUrl: typeof health?.upstreamBaseUrl === 'string'
      ? health.upstreamBaseUrl
      : typeof state?.upstreamBaseUrl === 'string'
        ? state.upstreamBaseUrl
        : null,
    authMethod: typeof health?.authMethod === 'string'
      ? health.authMethod
      : typeof state?.authMethod === 'string'
        ? state.authMethod
        : null,
    health
  };
}
