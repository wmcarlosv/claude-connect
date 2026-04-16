const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

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
  if (value == null || value === '') {
    return false;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric === 0;
}

export function isFreeOpenRouterModel(model) {
  const modelId = typeof model?.id === 'string' ? model.id.toLowerCase() : '';
  const name = typeof model?.name === 'string' ? model.name.toLowerCase() : '';
  const pricing = model?.pricing && typeof model.pricing === 'object' ? model.pricing : {};

  return modelId === 'openrouter/free'
    || modelId.endsWith(':free')
    || name.includes('free')
    || isZeroLike(pricing.prompt)
    || isZeroLike(pricing.completion)
    || isZeroLike(pricing.input)
    || isZeroLike(pricing.output);
}

function summarizeOpenRouterModel(model) {
  const parts = [
    typeof model?.context_length === 'number' ? `${model.context_length.toLocaleString('en-US')} ctx` : null,
    typeof model?.architecture?.modality === 'string' ? model.architecture.modality : null,
    typeof model?.top_provider?.context_length === 'number'
      ? `${model.top_provider.context_length.toLocaleString('en-US')} max`
      : null
  ].filter(Boolean);

  return parts.length > 0
    ? parts.join(' · ')
    : 'Modelo gratuito descubierto desde /models';
}

function mapOpenRouterModel(model, index) {
  return {
    id: model.id.replace(/[/:]/g, '-'),
    name: model.name || model.id,
    category: model.id === 'openrouter/free' ? 'Free Router' : 'OpenRouter Free Model',
    contextWindow: typeof model.context_length === 'number'
      ? model.context_length.toLocaleString('en-US')
      : 'Auto',
    summary: summarizeOpenRouterModel(model),
    upstreamModelId: model.id,
    transportMode: 'gateway',
    apiStyle: 'openai-chat',
    apiBaseUrl: OPENROUTER_BASE_URL,
    apiPath: '/chat/completions',
    authEnvMode: 'auth_token',
    sortOrder: index + 1,
    isDefault: index === 0,
    isFreeTier: true
  };
}

export async function fetchOpenRouterFreeModels({ timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
      method: 'GET',
      headers: {
        accept: 'application/json'
      },
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
      throw new Error(`OpenRouter respondio ${response.status}: ${message}`);
    }

    const rawModels = Array.isArray(payload?.data) ? payload.data : [];
    const freeModels = rawModels
      .filter((model) => isFreeOpenRouterModel(model))
      .sort((left, right) => {
        if (left.id === 'openrouter/free') {
          return -1;
        }

        if (right.id === 'openrouter/free') {
          return 1;
        }

        return String(left.name || left.id).localeCompare(String(right.name || right.id));
      });

    const uniqueModels = [];
    const seen = new Set();

    for (const model of freeModels) {
      if (seen.has(model.id)) {
        continue;
      }

      seen.add(model.id);
      uniqueModels.push(model);
    }

    return {
      baseUrl: OPENROUTER_BASE_URL,
      models: uniqueModels.map(mapOpenRouterModel)
    };
  } catch (error) {
    throw new Error(`No se pudo consultar ${OPENROUTER_BASE_URL}/models: ${describeRequestError(error)}`);
  } finally {
    clearTimeout(timer);
  }
}
