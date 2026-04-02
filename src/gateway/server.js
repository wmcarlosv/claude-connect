import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildAnthropicMessageFromOllama,
  buildAnthropicMessageFromOpenAI,
  buildOllamaRequestFromAnthropic,
  buildOpenAIRequestFromAnthropic,
  estimateTokenCountFromAnthropicRequest,
  normalizeAnthropicRequestForUpstream,
  writeAnthropicStreamFromMessage
} from './messages.js';
import { gatewayBasePath, gatewayBaseUrl, gatewayHost, gatewayPort } from './constants.js';
import {
  findListeningPidByPort,
  getGatewayStatus,
  readGatewayState,
  writeGatewayState,
  isProcessAlive
} from './state.js';
import { resolveClaudeConnectPaths } from '../lib/app-paths.js';
import { readSwitchState } from '../lib/claude-settings.js';
import { readOAuthToken, refreshOAuthToken } from '../lib/oauth.js';
import { readProfileFile } from '../lib/profile.js';
import { readManagedProviderTokenSecret, readManagedTokenSecret } from '../lib/secrets.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cliEntryPath = path.join(projectRoot, 'bin', 'claude-connect.js');

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeRequestError(error) {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const parts = [error.message];
  const cause = error.cause;

  if (cause && typeof cause === 'object') {
    const code = 'code' in cause && typeof cause.code === 'string' ? cause.code : null;
    const message = 'message' in cause && typeof cause.message === 'string' ? cause.message : null;

    if (code) {
      parts.push(`code=${code}`);
    }

    if (message && message !== error.message) {
      parts.push(message);
    }
  }

  return parts.join(' · ');
}

async function terminatePid(pid) {
  if (!isProcessAlive(pid)) {
    return false;
  }

  if (process.platform === 'win32') {
    await new Promise((resolve, reject) => {
      const child = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true
      });

      child.once('error', reject);
      child.once('exit', (code) => {
        if (code === 0 || code === 128) {
          resolve();
          return;
        }

        reject(new Error(`taskkill devolvio ${code}`));
      });
    });
  } else {
    process.kill(pid, 'SIGTERM');
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (!isProcessAlive(pid)) {
      return true;
    }
  }

  return !isProcessAlive(pid);
}

async function clearStaleGatewayProcess() {
  const portPid = await findListeningPidByPort(gatewayPort);

  if (!isProcessAlive(portPid)) {
    return false;
  }

  return await terminatePid(portPid);
}

function buildErrorResponse(statusCode, message, type = 'api_error') {
  return {
    statusCode,
    body: {
      type: 'error',
      error: {
        type,
        message
      }
    }
  };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

async function readJsonBody(request) {
  const chunks = [];
  let totalLength = 0;

  for await (const chunk of request) {
    totalLength += chunk.length;

    if (totalLength > 10 * 1024 * 1024) {
      throw new Error('La peticion excede el limite de 10 MB.');
    }

    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  return raw.length === 0 ? {} : JSON.parse(raw);
}

function normalizeOauthResourceUrl(resourceUrl) {
  if (typeof resourceUrl !== 'string' || resourceUrl.trim().length === 0) {
    return null;
  }

  const normalized = resourceUrl.startsWith('http://') || resourceUrl.startsWith('https://')
    ? resourceUrl
    : `https://${resourceUrl}`;

  return normalized.replace(/\/$/, '');
}

function getUpstreamModelId(profile) {
  return profile?.model?.upstreamModelId ?? profile?.model?.id ?? 'unknown';
}

function resolveGatewayUpstreamConfig(profile) {
  if (profile?.provider?.id === 'ollama') {
    return {
      upstreamBaseUrl: typeof profile?.endpoint?.baseUrl === 'string' && profile.endpoint.baseUrl.length > 0
        ? profile.endpoint.baseUrl
        : typeof profile?.model?.apiBaseUrl === 'string' && profile.model.apiBaseUrl.length > 0
          ? profile.model.apiBaseUrl
          : 'http://127.0.0.1:11434',
      upstreamApiStyle: 'ollama-chat',
      upstreamApiPath: '/api/chat'
    };
  }

  return {
    upstreamBaseUrl: typeof profile?.model?.apiBaseUrl === 'string' && profile.model.apiBaseUrl.length > 0
      ? profile.model.apiBaseUrl
      : profile?.endpoint?.baseUrl,
    upstreamApiStyle: profile?.model?.apiStyle ?? 'openai-chat',
    upstreamApiPath: profile?.model?.apiPath ?? '/chat/completions'
  };
}

function buildOauthApiBaseUrl(profile, tokenRecord) {
  if (typeof profile?.auth?.oauth?.apiBaseUrl === 'string' && profile.auth.oauth.apiBaseUrl.length > 0) {
    return profile.auth.oauth.apiBaseUrl;
  }

  const resourceUrl = normalizeOauthResourceUrl(tokenRecord?.token?.resource_url);

  if (resourceUrl) {
    return resourceUrl.endsWith('/v1') ? resourceUrl : `${resourceUrl}/v1`;
  }

  return 'https://portal.qwen.ai/v1';
}

async function resolveGatewayContext() {
  const switchState = await readSwitchState();

  if (!switchState?.active || typeof switchState.profilePath !== 'string') {
    throw new Error('Claude Connect no tiene un perfil activo en Claude Code.');
  }

  const profile = await readProfileFile(switchState.profilePath);
  const authMethod = profile?.auth?.method === 'api_key' ? 'token' : profile?.auth?.method;

  if (authMethod === 'server' && profile?.provider?.id === 'ollama') {
    const upstream = resolveGatewayUpstreamConfig(profile);

    return {
      profile,
      authMethod,
      upstreamBaseUrl: upstream.upstreamBaseUrl,
      upstreamApiStyle: upstream.upstreamApiStyle,
      upstreamApiPath: upstream.upstreamApiPath,
      accessToken: 'ollama'
    };
  }

  if (authMethod === 'token') {
    const envVar = profile?.auth?.envVar;
    let token = typeof envVar === 'string' ? process.env[envVar] : '';

    if (!token || token.trim().length === 0) {
      const providerSecretRecord = await readManagedProviderTokenSecret(profile?.provider?.id);
      token = typeof providerSecretRecord?.secret?.token === 'string' ? providerSecretRecord.secret.token : '';
    }

    if ((!token || token.trim().length === 0) && typeof profile?.auth?.secretFile === 'string') {
      const secret = await readManagedTokenSecret(profile.auth.secretFile);
      token = typeof secret?.token === 'string' ? secret.token : '';
    }

    if (typeof token !== 'string' || token.trim().length === 0) {
      throw new Error(`Falta la variable de entorno ${envVar} y tampoco hay una API key guardada para este perfil.`);
    }

    const upstream = resolveGatewayUpstreamConfig(profile);

    return {
      profile,
      authMethod,
      upstreamBaseUrl: upstream.upstreamBaseUrl,
      upstreamApiStyle: upstream.upstreamApiStyle,
      upstreamApiPath: upstream.upstreamApiPath,
      accessToken: token.trim()
    };
  }

  if (authMethod === 'oauth') {
    const tokenFile = profile?.auth?.oauth?.tokenFile;

    if (typeof tokenFile !== 'string' || tokenFile.length === 0) {
      throw new Error('El perfil OAuth no tiene un token local asociado.');
    }

    let record = await readOAuthToken(tokenFile);
    let accessToken = typeof record.token?.access_token === 'string' ? record.token.access_token : '';

    if (!accessToken && typeof record.token?.refresh_token === 'string') {
      record = await refreshOAuthToken({
        filePath: tokenFile,
        tokenUrl: profile.auth.oauth.tokenUrl,
        clientId: profile.auth.oauth.clientId
      });
      accessToken = record.token.access_token;
    }

    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      throw new Error('No se encontro un access_token valido para el perfil OAuth.');
    }

    return {
      profile,
      authMethod,
      upstreamBaseUrl: buildOauthApiBaseUrl(profile, record),
      upstreamApiStyle: profile?.model?.apiStyle ?? 'openai-chat',
      upstreamApiPath: profile?.model?.apiPath ?? '/chat/completions',
      accessToken
    };
  }

  throw new Error(`Metodo de autenticacion no soportado por el gateway: ${authMethod}`);
}

async function forwardUpstreamRequest({ targetUrl, headers, payload, context, refreshOnUnauthorized = true }) {
  let response;

  try {
    response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
  } catch (error) {
    const providerName = context?.profile?.provider?.name ?? context?.profile?.provider?.id ?? 'El proveedor';

    if (context?.profile?.provider?.id === 'ollama') {
      throw new Error(
        `${providerName} no respondio en ${targetUrl}. Revisa que el servidor remoto este accesible, que el puerto este expuesto y que Ollama escuche en esa URL. Detalle: ${describeRequestError(error)}`
      );
    }

    throw new Error(`${providerName} no respondio en ${targetUrl}. Detalle: ${describeRequestError(error)}`);
  }

  const responsePayload = await response.json().catch(() => ({}));

  if (response.ok) {
    return responsePayload;
  }

  if (response.status === 401 && refreshOnUnauthorized && context.authMethod === 'oauth') {
    const refreshed = await refreshOAuthToken({
      filePath: context.profile.auth.oauth.tokenFile,
      tokenUrl: context.profile.auth.oauth.tokenUrl,
      clientId: context.profile.auth.oauth.clientId
    });

    return forwardUpstreamRequest({
      targetUrl,
      headers: {
        ...headers,
        authorization: `Bearer ${refreshed.token.access_token}`
      },
      payload,
      context: {
        ...context,
        accessToken: refreshed.token.access_token
      },
      refreshOnUnauthorized: false
    });
  }

  const message = responsePayload?.error?.message
    || responsePayload?.message
    || responsePayload?.error
    || `HTTP ${response.status}`;
  const providerName = context?.profile?.provider?.name ?? context?.profile?.provider?.id ?? 'El proveedor';
  const containsImageInput = Array.isArray(payload?.messages)
    && payload.messages.some((messageItem) => Array.isArray(messageItem?.content)
      && messageItem.content.some((part) => part?.type === 'image_url' || part?.type === 'image'));

  if (containsImageInput && typeof message === 'string' && message.includes("prompt_tokens")) {
    throw new Error(
      `${providerName} rechazo esta imagen. El modelo o endpoint actual probablemente no soporta entrada visual en esta integracion.`
    );
  }

  throw new Error(`${providerName} devolvio un error: ${message}`);
}

async function forwardChatCompletion({ openAiRequest, context, refreshOnUnauthorized = true }) {
  const targetUrl = `${context.upstreamBaseUrl.replace(/\/$/, '')}${context.upstreamApiPath || '/chat/completions'}`;

  return forwardUpstreamRequest({
    targetUrl,
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: `Bearer ${context.accessToken}`,
      'user-agent': 'claude-connect-gateway/0.1.0'
    },
    payload: openAiRequest,
    context,
    refreshOnUnauthorized
  });
}

async function forwardOllamaChat({ ollamaRequest, context, refreshOnUnauthorized = true }) {
  const targetUrl = `${context.upstreamBaseUrl.replace(/\/$/, '')}${context.upstreamApiPath || '/api/chat'}`;

  return forwardUpstreamRequest({
    targetUrl,
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'user-agent': 'claude-connect-gateway/0.1.0'
    },
    payload: ollamaRequest,
    context,
    refreshOnUnauthorized
  });
}

async function forwardAnthropicMessage({ requestBody, context, refreshOnUnauthorized = true }) {
  const targetUrl = `${context.upstreamBaseUrl.replace(/\/$/, '')}${context.upstreamApiPath || '/v1/messages'}`;

  return forwardUpstreamRequest({
    targetUrl,
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': context.accessToken,
      'user-agent': 'claude-connect-gateway/0.1.0'
    },
    payload: normalizeAnthropicRequestForUpstream(requestBody),
    context,
    refreshOnUnauthorized
  });
}

function buildHealthPayload(context) {
  return {
    ok: true,
    service: 'claude-connect-gateway',
    baseUrl: gatewayBaseUrl,
    profileName: context.profile.profileName,
    provider: context.profile.provider.id,
    model: getUpstreamModelId(context.profile),
    authMethod: context.authMethod,
    upstreamBaseUrl: context.upstreamBaseUrl,
    upstreamApiStyle: context.upstreamApiStyle,
    upstreamApiPath: context.upstreamApiPath,
    pid: process.pid
  };
}

async function handleHealth(_request, response) {
  const context = await resolveGatewayContext();
  sendJson(response, 200, buildHealthPayload(context));
}

async function handleModels(_request, response) {
  const context = await resolveGatewayContext();
  const model = context.profile.model;
  const modelId = getUpstreamModelId(context.profile);

  sendJson(response, 200, {
    data: [
      {
        type: 'model',
        id: modelId,
        display_name: model.name,
        created_at: '2026-03-31'
      }
    ],
    first_id: modelId,
    has_more: false,
    last_id: modelId
  });
}

async function handleCountTokens(request, response) {
  const body = await readJsonBody(request);
  sendJson(response, 200, {
    input_tokens: estimateTokenCountFromAnthropicRequest(body)
  });
}

async function handleMessages(request, response) {
  const body = await readJsonBody(request);
  const context = await resolveGatewayContext();

  if (context.upstreamApiStyle === 'anthropic') {
    const upstreamResponse = await forwardAnthropicMessage({
      requestBody: body,
      context
    });
    sendJson(response, 200, upstreamResponse);
    return;
  }

  if (context.upstreamApiStyle === 'ollama-chat') {
    const ollamaRequest = buildOllamaRequestFromAnthropic({
      body,
      model: getUpstreamModelId(context.profile)
    });
    const upstreamResponse = await forwardOllamaChat({
      ollamaRequest,
      context
    });
    const anthropicMessage = buildAnthropicMessageFromOllama({
      response: upstreamResponse,
      requestedModel: getUpstreamModelId(context.profile)
    });

    if (body.stream === true) {
      response.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no'
      });
      writeAnthropicStreamFromMessage(response, anthropicMessage);
      response.end();
      return;
    }

    sendJson(response, 200, anthropicMessage);
    return;
  }

  if (context.upstreamApiStyle !== 'openai-chat') {
    throw new Error(`El gateway todavia no soporta el estilo ${context.upstreamApiStyle} para ${context.profile.provider.name}.`);
  }

  const openAiRequest = buildOpenAIRequestFromAnthropic({
    body,
    model: getUpstreamModelId(context.profile)
  });
  const upstreamResponse = await forwardChatCompletion({
    openAiRequest,
    context
  });
  const anthropicMessage = buildAnthropicMessageFromOpenAI({
    response: upstreamResponse,
    requestedModel: getUpstreamModelId(context.profile)
  });

  if (body.stream === true) {
    response.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no'
    });
    writeAnthropicStreamFromMessage(response, anthropicMessage);
    response.end();
    return;
  }

  sendJson(response, 200, anthropicMessage);
}

async function routeRequest(request, response) {
  const requestUrl = new URL(request.url || '/', gatewayBaseUrl);

  if (request.method === 'GET' && requestUrl.pathname === `${gatewayBasePath}/health`) {
    await handleHealth(request, response);
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === `${gatewayBasePath}/v1/models`) {
    await handleModels(request, response);
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === `${gatewayBasePath}/v1/messages/count_tokens`) {
    await handleCountTokens(request, response);
    return;
  }

  if (request.method === 'POST' && requestUrl.pathname === `${gatewayBasePath}/v1/messages`) {
    await handleMessages(request, response);
    return;
  }

  const error = buildErrorResponse(404, `Ruta no soportada: ${request.method} ${requestUrl.pathname}`, 'not_found_error');
  sendJson(response, error.statusCode, error.body);
}

export async function serveGateway() {
  const initialContext = await resolveGatewayContext();
  const server = http.createServer(async (request, response) => {
    try {
      await routeRequest(request, response);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const apiError = buildErrorResponse(500, message);
      sendJson(response, apiError.statusCode, apiError.body);
    }
  });

  server.on('clientError', () => {
    // Silence malformed local requests.
  });

  const stop = async () => {
    await writeGatewayState({
      active: false,
      pid: process.pid,
      stoppedAt: new Date().toISOString()
    });

    await new Promise((resolve) => server.close(resolve));
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void stop();
  });
  process.on('SIGTERM', () => {
    void stop();
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(gatewayPort, gatewayHost, resolve);
  });

  await writeGatewayState({
    active: true,
    pid: process.pid,
    startedAt: new Date().toISOString(),
    logPath: (await resolveClaudeConnectPaths()).gatewayLogPath,
    profileName: initialContext.profile.profileName,
    authMethod: initialContext.authMethod,
    upstreamBaseUrl: initialContext.upstreamBaseUrl,
    upstreamApiStyle: initialContext.upstreamApiStyle,
    upstreamApiPath: initialContext.upstreamApiPath,
    baseUrl: gatewayBaseUrl
  });

  console.log(`claude-connect gateway escuchando en ${gatewayBaseUrl}`);
  return new Promise(() => {});
}

export async function startGatewayInBackground() {
  const currentStatus = await getGatewayStatus();
  const { gatewayLogPath } = await resolveClaudeConnectPaths();

  if (currentStatus.active) {
    return {
      ...currentStatus,
      alreadyRunning: true
    };
  }

  const staleProcessCleared = await clearStaleGatewayProcess();

  if (staleProcessCleared) {
    await writeGatewayState({
      active: false,
      stoppedAt: new Date().toISOString(),
      logPath: gatewayLogPath,
      baseUrl: gatewayBaseUrl,
      lastError: 'Se limpio un gateway previo que ocupaba el puerto sin responder saludablemente.'
    });
  }

  await fsPromises.mkdir(path.dirname(gatewayLogPath), { recursive: true });
  const outputFd = fs.openSync(gatewayLogPath, 'a');
  const child = spawn(process.execPath, ['--no-warnings=ExperimentalWarning', cliEntryPath, 'gateway', 'serve'], {
    cwd: projectRoot,
    detached: true,
    stdio: ['ignore', outputFd, outputFd]
  });

  child.unref();
  fs.closeSync(outputFd);

  await writeGatewayState({
    active: false,
    pid: child.pid,
    startedAt: new Date().toISOString(),
    logPath: gatewayLogPath,
    baseUrl: gatewayBaseUrl
  });

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const status = await getGatewayStatus({ timeoutMs: 500 });

    if (status.active) {
      return {
        ...status,
        alreadyRunning: false
      };
    }

    if (!isProcessAlive(child.pid)) {
      break;
    }
  }

  const adoptedStatus = await getGatewayStatus({ timeoutMs: 700 });

  if (adoptedStatus.active) {
    return {
      ...adoptedStatus,
      alreadyRunning: true
    };
  }

  await writeGatewayState({
    active: false,
    pid: child.pid,
    startedAt: new Date().toISOString(),
    logPath: gatewayLogPath,
    baseUrl: gatewayBaseUrl,
    lastError: 'El gateway no llego a responder en el tiempo esperado.'
  });

  throw new Error(`No pude iniciar el gateway local. Revisa el log: ${gatewayLogPath}`);
}

export async function restartGatewayInBackground() {
  await stopGateway();
  return await startGatewayInBackground();
}

export async function stopGateway() {
  const { gatewayLogPath } = await resolveClaudeConnectPaths();
  const state = await readGatewayState();
  const pid = Number(state?.pid ?? 0);

  if (!isProcessAlive(pid)) {
    const stalePid = await findListeningPidByPort(gatewayPort);
    const staleProcessCleared = await clearStaleGatewayProcess();

    await writeGatewayState({
      active: false,
      stoppedAt: new Date().toISOString(),
      logPath: gatewayLogPath
    });

    return {
      stopped: staleProcessCleared,
      pid: staleProcessCleared ? stalePid : null,
      logPath: gatewayLogPath
    };
  }

  if (await terminatePid(pid)) {
    await writeGatewayState({
      active: false,
      pid,
      stoppedAt: new Date().toISOString(),
      logPath: gatewayLogPath
    });

    return {
      stopped: true,
      pid,
      logPath: gatewayLogPath
    };
  }

  throw new Error(`No pude detener el gateway local (pid ${pid}).`);
}
