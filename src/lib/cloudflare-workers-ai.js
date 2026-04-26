const CLOUDFLARE_API_BASE_URL = 'https://api.cloudflare.com/client/v4';

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeAccountId(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';

  if (!/^[a-f0-9]{32}$/i.test(normalized)) {
    throw new Error('El Account ID de Cloudflare debe tener 32 caracteres hexadecimales.');
  }

  return normalized;
}

function describeRequestError(error) {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = error.cause;

  if (cause && typeof cause === 'object' && 'code' in cause && typeof cause.code === 'string') {
    return `${error.message} · code=${cause.code}`;
  }

  return error.message;
}

function collectSearchText(value) {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(collectSearchText).join(' ');
  }

  if (isObject(value)) {
    return Object.values(value).map(collectSearchText).join(' ');
  }

  return '';
}

function getModelId(model) {
  return typeof model?.name === 'string' && model.name.startsWith('@cf/')
    ? model.name
    : typeof model?.id === 'string' && model.id.startsWith('@cf/')
      ? model.id
      : typeof model?.model === 'string' && model.model.startsWith('@cf/')
        ? model.model
        : '';
}

function getModelName(modelId) {
  const name = modelId.split('/').at(-1) || modelId;
  return name
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function hasCapability(model, pattern) {
  const text = collectSearchText([
    model?.capabilities,
    model?.tags,
    model?.properties,
    model?.description,
    model?.task,
    model?.task_name,
    model?.name,
    model?.id
  ]).toLowerCase();

  return pattern.test(text);
}

export function isCloudflareTextGenerationModel(model) {
  const modelId = getModelId(model);

  if (!modelId) {
    return false;
  }

  const taskText = collectSearchText([model?.task, model?.task_name, model?.tasks]).toLowerCase();
  const allText = collectSearchText(model).toLowerCase();

  return taskText.includes('text generation')
    || allText.includes('text generation')
    || /(?:llama|qwen|deepseek|kimi|glm|gemma|gpt-oss|mistral|coder|code)/i.test(modelId);
}

function getContextWindow(model) {
  const text = collectSearchText([
    model?.context_window,
    model?.contextWindow,
    model?.max_tokens,
    model?.max_input_tokens,
    model?.description
  ]);
  const match = text.match(/(\d{2,7})\s*(?:tokens?|context)?/i);

  if (match) {
    const tokens = Number(match[1]);

    if (Number.isFinite(tokens) && tokens > 0) {
      return tokens >= 1000 ? String(tokens) : 'Auto';
    }
  }

  return 'Auto';
}

function summarizeModel(model) {
  const pieces = [
    typeof model?.description === 'string' ? model.description : '',
    hasCapability(model, /function calling|tool/i) ? 'Soporta function calling segun metadatos.' : '',
    hasCapability(model, /reasoning/i) ? 'Soporta reasoning segun metadatos.' : '',
    hasCapability(model, /vision|image/i) ? 'Soporta vision segun metadatos.' : ''
  ].filter(Boolean);

  return pieces.join(' ') || 'Modelo Text Generation descubierto desde Cloudflare Workers AI.';
}

export function mapCloudflareModel(model, index, { accountId }) {
  const modelId = getModelId(model);
  const supportsVision = hasCapability(model, /vision|image|multimodal/i);
  const supportsReasoning = hasCapability(model, /reasoning|deepseek|gpt-oss|kimi|glm|qwen/i);
  const supportsTools = hasCapability(model, /function calling|tool|agentic|coder|code/i);

  return {
    id: modelId.replace(/^@cf\//, '').replace(/[^a-zA-Z0-9_.:/-]+/g, '-'),
    name: getModelName(modelId),
    category: [
      'Workers AI',
      supportsTools ? 'Tools' : '',
      supportsReasoning ? 'Reasoning' : '',
      supportsVision ? 'Vision' : ''
    ].filter(Boolean).join(' · '),
    contextWindow: getContextWindow(model),
    summary: summarizeModel(model),
    upstreamModelId: modelId,
    transportMode: 'gateway',
    apiStyle: 'openai-chat',
    apiBaseUrl: `${CLOUDFLARE_API_BASE_URL}/accounts/${accountId}/ai/v1`,
    apiPath: '/chat/completions',
    authEnvMode: 'auth_token',
    supportsVision,
    sortOrder: index + 1,
    isDefault: index === 0 ? 1 : 0,
    isFreeTier: true
  };
}

function sortModels(left, right) {
  const score = (model) => {
    const text = `${model.upstreamModelId} ${model.category} ${model.summary}`.toLowerCase();
    let value = 0;

    if (text.includes('gpt-oss')) value += 50;
    if (text.includes('kimi')) value += 45;
    if (text.includes('qwen')) value += 40;
    if (text.includes('glm')) value += 35;
    if (text.includes('deepseek')) value += 30;
    if (text.includes('coder') || text.includes('code')) value += 25;
    if (text.includes('function') || text.includes('tool')) value += 20;
    if (text.includes('reasoning')) value += 15;
    if (text.includes('vision')) value += 5;

    return value;
  };

  const scoreDiff = score(right) - score(left);

  if (scoreDiff !== 0) {
    return scoreDiff;
  }

  return left.name.localeCompare(right.name);
}

export async function fetchCloudflareWorkersAiModels({ accountId, apiKey, timeoutMs = 8000 }) {
  const normalizedAccountId = normalizeAccountId(accountId);
  const token = typeof apiKey === 'string' ? apiKey.trim() : '';

  if (token.length === 0) {
    throw new Error('Falta CLOUDFLARE_API_TOKEN para consultar modelos de Workers AI.');
  }

  const models = [];
  let page = 1;
  let totalPages = 1;

  do {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const url = new URL(`${CLOUDFLARE_API_BASE_URL}/accounts/${normalizedAccountId}/ai/models/search`);

    url.searchParams.set('task', 'Text Generation');
    url.searchParams.set('hide_experimental', 'true');
    url.searchParams.set('per_page', '50');
    url.searchParams.set('page', String(page));

    let response;

    try {
      response = await fetch(url, {
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/json',
          'user-agent': 'claude-connect/0.1.0'
        },
        signal: controller.signal
      });
    } catch (error) {
      throw new Error(`No se pudo consultar Cloudflare Workers AI: ${describeRequestError(error)}`);
    } finally {
      clearTimeout(timeout);
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.success === false) {
      const message = Array.isArray(payload?.errors) && payload.errors.length > 0
        ? payload.errors.map((item) => item?.message ?? JSON.stringify(item)).join(' | ')
        : `HTTP ${response.status}`;
      throw new Error(`Cloudflare Workers AI devolvio un error: ${message}`);
    }

    if (Array.isArray(payload?.result)) {
      models.push(...payload.result);
    }

    totalPages = Number(payload?.result_info?.total_pages ?? 1);
    page += 1;
  } while (page <= totalPages && page <= 10);

  const mapped = models
    .filter(isCloudflareTextGenerationModel)
    .map((model, index) => mapCloudflareModel(model, index, { accountId: normalizedAccountId }))
    .sort(sortModels)
    .map((model, index) => ({
      ...model,
      sortOrder: index + 1,
      isDefault: index === 0 ? 1 : 0
    }));

  return {
    baseUrl: `${CLOUDFLARE_API_BASE_URL}/accounts/${normalizedAccountId}/ai/v1`,
    models: mapped
  };
}

export { normalizeAccountId as normalizeCloudflareAccountId };
