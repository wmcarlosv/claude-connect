const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEEPSEEK_ANTHROPIC_BASE_URL = `${DEEPSEEK_BASE_URL}/anthropic`;

function describeRequestError(error) {
  if (error && typeof error === 'object') {
    if ('cause' in error && error.cause && typeof error.cause === 'object' && 'message' in error.cause) {
      return String(error.cause.message);
    }

    if ('message' in error) {
      return String(error.message);
    }
  }

  return String(error);
}

function getDeepSeekModelName(modelId) {
  if (modelId === 'deepseek-v4-flash') {
    return 'DeepSeek V4 Flash';
  }

  if (modelId === 'deepseek-v4-pro') {
    return 'DeepSeek V4 Pro';
  }

  if (modelId === 'deepseek-chat') {
    return 'DeepSeek Chat';
  }

  if (modelId === 'deepseek-reasoner') {
    return 'DeepSeek Reasoner';
  }

  return modelId
    .split(/[-_/]+/g)
    .filter(Boolean)
    .map((part) => /^[a-z]\d+$/i.test(part) ? part.toUpperCase() : `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function getDeepSeekModelCategory(modelId) {
  if (modelId.includes('pro') || modelId.includes('reasoner')) {
    return 'Reasoning';
  }

  return 'General';
}

function summarizeDeepSeekModel(modelId) {
  if (modelId === 'deepseek-v4-flash') {
    return '1M ctx · thinking por defecto · tool calls · compatibilidad Anthropic directa.';
  }

  if (modelId === 'deepseek-v4-pro') {
    return '1M ctx · modelo mas capaz de DeepSeek · thinking por defecto · tool calls.';
  }

  if (modelId === 'deepseek-chat') {
    return 'Alias compatible de DeepSeek V4 Flash sin thinking forzado. DeepSeek lo depreca el 2026-07-24.';
  }

  if (modelId === 'deepseek-reasoner') {
    return 'Alias compatible de DeepSeek V4 Flash con thinking. DeepSeek lo depreca el 2026-07-24.';
  }

  return 'Modelo descubierto desde DeepSeek /models.';
}

function sortDeepSeekModels(left, right) {
  const priority = new Map([
    ['deepseek-v4-flash', 0],
    ['deepseek-v4-pro', 1],
    ['deepseek-chat', 2],
    ['deepseek-reasoner', 3]
  ]);

  const leftPriority = priority.get(left?.id) ?? 100;
  const rightPriority = priority.get(right?.id) ?? 100;

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return String(left?.id ?? '').localeCompare(String(right?.id ?? ''));
}

function mapDeepSeekModel(model, index) {
  const modelId = model.id;

  return {
    id: modelId,
    name: getDeepSeekModelName(modelId),
    category: getDeepSeekModelCategory(modelId),
    contextWindow: /^deepseek-v4-/.test(modelId) || /^deepseek-(chat|reasoner)$/.test(modelId)
      ? '1M'
      : 'Auto',
    summary: summarizeDeepSeekModel(modelId),
    upstreamModelId: modelId,
    transportMode: 'direct',
    apiStyle: 'anthropic',
    apiBaseUrl: DEEPSEEK_ANTHROPIC_BASE_URL,
    apiPath: '/v1/messages',
    authEnvMode: 'auth_token',
    supportsVision: false,
    sortOrder: index + 1,
    isDefault: index === 0
  };
}

export async function fetchDeepSeekModels({ apiKey = '', timeoutMs = 8000 } = {}) {
  const token = typeof apiKey === 'string' ? apiKey.trim() : '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);

  try {
    const headers = {
      accept: 'application/json'
    };

    if (token.length > 0) {
      headers.authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${DEEPSEEK_BASE_URL}/models`, {
      method: 'GET',
      headers,
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
      throw new Error(`DeepSeek respondio ${response.status}: ${message}`);
    }

    const rawModels = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.models)
        ? payload.models
        : [];
    const filteredModels = rawModels
      .filter((model) => typeof model?.id === 'string' && model.id.startsWith('deepseek-'))
      .sort(sortDeepSeekModels);
    const uniqueModels = [];
    const seen = new Set();

    for (const model of filteredModels) {
      if (seen.has(model.id)) {
        continue;
      }

      seen.add(model.id);
      uniqueModels.push(model);
    }

    return {
      baseUrl: DEEPSEEK_BASE_URL,
      anthropicBaseUrl: DEEPSEEK_ANTHROPIC_BASE_URL,
      models: uniqueModels.map(mapDeepSeekModel)
    };
  } catch (error) {
    throw new Error(`No se pudo consultar ${DEEPSEEK_BASE_URL}/models: ${describeRequestError(error)}`);
  } finally {
    clearTimeout(timer);
  }
}
