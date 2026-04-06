const KILO_GATEWAY_BASE_URL = 'https://api.kilo.ai/api/gateway';
const DOCUMENTED_FREE_KILO_MODELS = new Set([
  'minimax/minimax-m2.1:free',
  'z-ai/glm-5:free',
  'giga-potato',
  'corethink:free',
  'arcee-ai/trinity-large-preview:free'
]);

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

function isZeroLike(value) {
  if (value == null) {
    return false;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric === 0;
}

export function isFreeKiloModel(model) {
  const modelId = typeof model?.id === 'string' ? model.id : '';
  const modelName = typeof model?.name === 'string' ? model.name : '';
  const pricing = model?.pricing && typeof model.pricing === 'object' ? model.pricing : {};
  const tags = Array.isArray(model?.tags) ? model.tags.map((tag) => String(tag).toLowerCase()) : [];
  const lowerId = modelId.toLowerCase();
  const lowerName = modelName.toLowerCase();

  return DOCUMENTED_FREE_KILO_MODELS.has(modelId)
    || model?.free === true
    || tags.includes('free')
    || lowerId.endsWith(':free')
    || lowerName.includes('free')
    || isZeroLike(pricing.prompt)
    || isZeroLike(pricing.completion)
    || isZeroLike(pricing.input)
    || isZeroLike(pricing.output);
}

function summarizeKiloModel(model) {
  const parts = [
    model?.owned_by,
    typeof model?.context_length === 'number' ? `${model.context_length.toLocaleString('en-US')} ctx` : null
  ].filter(Boolean);

  return parts.length > 0
    ? parts.join(' · ')
    : 'Modelo gratuito descubierto desde /models';
}

export async function fetchKiloFreeModels({ timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);

  try {
    const response = await fetch(`${KILO_GATEWAY_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        accept: 'application/json'
      },
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
      throw new Error(`Kilo respondio ${response.status}: ${message}`);
    }

    const rawModels = Array.isArray(payload?.data) ? payload.data : [];
    const freeModels = rawModels.filter(isFreeKiloModel);

    return {
      baseUrl: KILO_GATEWAY_BASE_URL,
      models: freeModels.map((model, index) => ({
        id: model.id,
        name: model.name || model.id,
        category: 'Kilo Free Model',
        contextWindow: typeof model.context_length === 'number'
          ? model.context_length.toLocaleString('en-US')
          : 'Auto',
        summary: summarizeKiloModel(model),
        upstreamModelId: model.id,
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: KILO_GATEWAY_BASE_URL,
        apiPath: '/chat/completions',
        authEnvMode: 'auth_token',
        sortOrder: index + 1,
        isDefault: index === 0
      }))
    };
  } catch (error) {
    throw new Error(`No se pudo consultar ${KILO_GATEWAY_BASE_URL}/models: ${describeRequestError(error)}`);
  } finally {
    clearTimeout(timer);
  }
}
