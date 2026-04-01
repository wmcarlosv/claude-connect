import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
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

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true
    });

    let stdout = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });

    child.once('error', () => resolve(''));
    child.once('close', () => resolve(stdout));
  });
}

function parsePidList(raw) {
  return [...raw.matchAll(/\b(\d+)\b/g)]
    .map((match) => Number(match[1]))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

export async function findListeningPidByPort(port) {
  if (!Number.isInteger(port) || port <= 0) {
    return null;
  }

  if (process.platform === 'win32') {
    const raw = await runCommand('netstat', ['-ano', '-p', 'tcp']);
    const pattern = new RegExp(`^\\s*TCP\\s+[^\\s]+:${port}\\s+[^\\s]+\\s+LISTENING\\s+(\\d+)\\s*$`, 'im');
    const match = raw.match(pattern);
    const pid = Number(match?.[1] ?? 0);
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  }

  const ssOutput = await runCommand('ss', ['-lntp']);
  const ssPattern = new RegExp(`:${port}\\s+.*pid=(\\d+)`);
  const ssMatch = ssOutput.match(ssPattern);
  const ssPid = Number(ssMatch?.[1] ?? 0);

  if (Number.isInteger(ssPid) && ssPid > 0) {
    return ssPid;
  }

  const lsofOutput = await runCommand('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN']);
  const [lsofPid] = parsePidList(lsofOutput);
  return Number.isInteger(lsofPid) && lsofPid > 0 ? lsofPid : null;
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
