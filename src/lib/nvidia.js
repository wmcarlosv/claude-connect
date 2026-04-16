const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

const CODING_PATTERNS = [
  /\bcod(e|er|ing)\b/i,
  /codellama/i,
  /starcoder/i,
  /devstral/i,
  /deepseek/i,
  /kimi/i,
  /minimax/i,
  /nemotron/i,
  /qwen/i,
  /glm/i,
  /gpt-oss/i
];

const VISION_PATTERNS = [
  /kimi-k2\.5/i,
  /vision/i,
  /vl\b/i,
  /multimodal/i,
  /maverick/i,
  /scout/i
];

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

function collectSearchText(model) {
  const parts = [
    model?.id,
    model?.name,
    model?.description,
    model?.owned_by,
    model?.publisher,
    Array.isArray(model?.tags) ? model.tags.join(' ') : '',
    Array.isArray(model?.categories) ? model.categories.join(' ') : '',
    Array.isArray(model?.use_cases) ? model.use_cases.join(' ') : ''
  ];

  return parts
    .filter((value) => typeof value === 'string' && value.length > 0)
    .join(' ');
}

export function isNvidiaCodingModel(model) {
  const searchText = collectSearchText(model);

  return CODING_PATTERNS.some((pattern) => pattern.test(searchText));
}

function supportsVision(model) {
  const searchText = collectSearchText(model);

  return VISION_PATTERNS.some((pattern) => pattern.test(searchText));
}

function summarizeNvidiaModel(model) {
  const contextLength = model?.context_length ?? model?.context_window ?? model?.max_context_length;
  const parts = [
    typeof model?.owned_by === 'string' ? model.owned_by : null,
    typeof model?.publisher === 'string' ? model.publisher : null,
    typeof contextLength === 'number' ? `${contextLength.toLocaleString('en-US')} ctx` : null,
    supportsVision(model) ? 'vision' : null
  ].filter(Boolean);

  return parts.length > 0
    ? parts.join(' · ')
    : 'Modelo de coding descubierto desde NVIDIA /models';
}

function mapNvidiaModel(model, index) {
  const modelId = typeof model?.id === 'string' && model.id.length > 0
    ? model.id
    : `nvidia-model-${index + 1}`;
  const contextLength = model?.context_length ?? model?.context_window ?? model?.max_context_length;

  return {
    id: modelId.replace(/[/:]/g, '-'),
    name: model?.name || modelId,
    category: 'NVIDIA NIM Coding',
    contextWindow: typeof contextLength === 'number'
      ? contextLength.toLocaleString('en-US')
      : modelId === 'moonshotai/kimi-k2.5'
        ? '256K'
        : 'Auto',
    summary: summarizeNvidiaModel(model),
    upstreamModelId: modelId,
    transportMode: 'gateway',
    apiStyle: 'openai-chat',
    apiBaseUrl: NVIDIA_BASE_URL,
    apiPath: '/chat/completions',
    authEnvMode: 'auth_token',
    supportsVision: supportsVision(model),
    sortOrder: index + 1,
    isDefault: index === 0
  };
}

export async function fetchNvidiaCodingModels({ apiKey, timeoutMs = 8000 }) {
  const token = typeof apiKey === 'string' ? apiKey.trim() : '';

  if (token.length === 0) {
    throw new Error('Falta la API key de NVIDIA.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);

  try {
    const response = await fetch(`${NVIDIA_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`
      },
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || payload?.error || `HTTP ${response.status}`;
      throw new Error(`NVIDIA respondio ${response.status}: ${message}`);
    }

    const rawModels = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.models)
        ? payload.models
        : [];
    const codingModels = rawModels
      .filter((model) => typeof model?.id === 'string' && model.id.length > 0)
      .filter((model) => isNvidiaCodingModel(model))
      .sort((left, right) => String(left.name || left.id).localeCompare(String(right.name || right.id)));
    const uniqueModels = [];
    const seen = new Set();

    for (const model of codingModels) {
      if (seen.has(model.id)) {
        continue;
      }

      seen.add(model.id);
      uniqueModels.push(model);
    }

    return {
      baseUrl: NVIDIA_BASE_URL,
      models: uniqueModels.map(mapNvidiaModel)
    };
  } catch (error) {
    throw new Error(`No se pudo consultar ${NVIDIA_BASE_URL}/models: ${describeRequestError(error)}`);
  } finally {
    clearTimeout(timer);
  }
}
