import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { resolveClaudeConnectPaths } from './app-paths.js';

function encodeForm(data) {
  return new URLSearchParams(data).toString();
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function buildBrowserOpenCommands(url, platform = process.platform) {
  if (platform === 'darwin') {
    return [['open', [url]]];
  }

  if (platform === 'win32') {
    return [
      ['explorer.exe', [url]],
      ['rundll32.exe', ['url.dll,FileProtocolHandler', url]],
      ['powershell.exe', ['-NoProfile', '-Command', 'Start-Process', url]]
    ];
  }

  return [['xdg-open', [url]], ['gio', ['open', url]]];
}

function openBrowser(url) {
  const commands = buildBrowserOpenCommands(url);

  return new Promise((resolve) => {
    let index = 0;

    const tryNext = () => {
      if (index >= commands.length) {
        resolve(false);
        return;
      }

      const [command, args] = commands[index++];
      const child = spawn(command, args, {
        stdio: 'ignore',
        detached: true
      });

      child.once('error', tryNext);
      child.once('spawn', () => {
        child.unref();
        resolve(true);
      });
    };

    tryNext();
  });
}

function generatePKCEPair() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return {
    codeVerifier,
    codeChallenge
  };
}

async function requestDeviceCode(oauthConfig) {
  const { codeVerifier, codeChallenge } = generatePKCEPair();

  const response = await fetch(oauthConfig.deviceCodeUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json'
    },
    body: encodeForm({
      client_id: oauthConfig.clientId,
      scope: oauthConfig.scope,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.error_description || payload.error || `HTTP ${response.status}`;
    throw new Error(`No se pudo iniciar OAuth con Qwen: ${message}`);
  }

  return {
    codeVerifier,
    deviceAuthorization: payload
  };
}

async function pollForToken({ oauthConfig, deviceCode, codeVerifier, expiresInSeconds, statusRenderer }) {
  const startedAt = Date.now();
  let pollIntervalMs = 2000;

  while (Date.now() - startedAt < expiresInSeconds * 1000) {
    const response = await fetch(oauthConfig.tokenUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json'
      },
      body: encodeForm({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: oauthConfig.clientId,
        device_code: deviceCode,
        code_verifier: codeVerifier
      })
    });

    const payload = await response.json().catch(() => ({}));

    if (response.ok && payload.access_token) {
      return payload;
    }

    if (response.status === 400 && payload.error === 'authorization_pending') {
      statusRenderer({
        title: 'Esperando autorizacion',
        subtitle: 'Completa el login en qwen.ai. El CLI esta consultando el token.',
        lines: [
          payload.error_description || 'La autorizacion sigue pendiente.',
          'Esperando aprobacion...'
        ]
      });
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      continue;
    }

    if (response.status === 429 && payload.error === 'slow_down') {
      pollIntervalMs = Math.min(pollIntervalMs + 1000, 10000);
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      continue;
    }

    const message = payload.error_description || payload.error || `HTTP ${response.status}`;
    throw new Error(`Qwen OAuth devolvio un error al pedir el token: ${message}`);
  }

  throw new Error('Se agoto el tiempo esperando la aprobacion de Qwen OAuth.');
}

export async function runOAuthAuthorization({ providerName, oauthConfig, statusRenderer }) {
  statusRenderer({
    title: 'Qwen OAuth',
    subtitle: `Iniciando el login de ${providerName} con Qwen Code.`,
    lines: [
      `Device code URL: ${oauthConfig.deviceCodeUrl}`,
      `Token URL: ${oauthConfig.tokenUrl}`,
      'Solicitando codigo de autorizacion...'
    ]
  });

  const { codeVerifier, deviceAuthorization } = await requestDeviceCode(oauthConfig);
  const authUrl = deviceAuthorization.verification_uri_complete
    || `${oauthConfig.browserAuthUrl}?user_code=${encodeURIComponent(deviceAuthorization.user_code)}&client=qwen-code`;

  const browserOpened = await openBrowser(authUrl);

  statusRenderer({
    title: 'Autoriza en qwen.ai',
    subtitle: browserOpened
      ? 'Se abrio el navegador. Completa el login y vuelve a la terminal.'
      : 'No pude abrir el navegador automaticamente. Abre esta URL manualmente.',
    lines: [
      authUrl,
      '',
      `User code: ${deviceAuthorization.user_code}`,
      'La URL mostrada es la de Qwen, no la de Alibaba Cloud.'
    ]
  });

  const tokenPayload = await pollForToken({
    oauthConfig,
    deviceCode: deviceAuthorization.device_code,
    codeVerifier,
    expiresInSeconds: Number(deviceAuthorization.expires_in || 600),
    statusRenderer
  });

  statusRenderer({
    title: 'Autenticacion completada',
    subtitle: 'Qwen ya aprobo el login y el token fue recibido por la consola.',
    lines: [
      'Access token recibido correctamente.',
      'La sesion OAuth ya puede guardarse localmente.'
    ]
  });

  return {
    authUrl,
    tokenPayload
  };
}

export async function saveOAuthToken({ profileName, providerId, tokenPayload }) {
  const { tokensDir: tokenDir } = await resolveClaudeConnectPaths();
  const safeProfileName = profileName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const filePath = path.join(tokenDir, `${providerId}-${safeProfileName}.json`);
  const savedAt = new Date().toISOString();
  const expiresAt = typeof tokenPayload.expires_in === 'number'
    ? new Date(Date.now() + tokenPayload.expires_in * 1000).toISOString()
    : null;
  const payload = {
    schemaVersion: 1,
    providerId,
    savedAt,
    expiresAt,
    token: tokenPayload
  };

  await fs.mkdir(tokenDir, { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });

  return filePath;
}

export async function readOAuthToken(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);

  if (isObject(parsed) && isObject(parsed.token)) {
    return {
      filePath,
      schemaVersion: typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1,
      providerId: typeof parsed.providerId === 'string' ? parsed.providerId : null,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : null,
      expiresAt: typeof parsed.expiresAt === 'string' ? parsed.expiresAt : null,
      token: parsed.token
    };
  }

  return {
    filePath,
    schemaVersion: 0,
    providerId: null,
    savedAt: null,
    expiresAt: null,
    token: parsed
  };
}

export async function refreshOAuthToken({ filePath, tokenUrl, clientId }) {
  const record = await readOAuthToken(filePath);
  const refreshToken = record.token?.refresh_token;

  if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
    throw new Error('No hay refresh_token disponible para renovar la sesion OAuth.');
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json'
    },
    body: encodeForm({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.access_token) {
    const message = payload.error_description || payload.error || `HTTP ${response.status}`;
    throw new Error(`No se pudo refrescar el token OAuth de Qwen: ${message}`);
  }

  const nextToken = {
    ...record.token,
    ...payload,
    refresh_token: payload.refresh_token || refreshToken
  };
  const savedAt = new Date().toISOString();
  const expiresAt = typeof nextToken.expires_in === 'number'
    ? new Date(Date.now() + nextToken.expires_in * 1000).toISOString()
    : null;
  const nextRecord = {
    schemaVersion: 1,
    providerId: record.providerId,
    savedAt,
    expiresAt,
    token: nextToken
  };

  await fs.writeFile(filePath, `${JSON.stringify(nextRecord, null, 2)}\n`, { mode: 0o600 });

  return {
    ...nextRecord,
    filePath
  };
}
