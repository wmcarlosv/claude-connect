const OLLAMA_CLOUD_BASE_URL = 'https://ollama.com';

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

export function isOllamaCloudModelId(modelId) {
  return typeof modelId === 'string' && /(?::cloud|-cloud)$/.test(modelId);
}

function summarizeOllamaCloudModel(model) {
  const details = model?.details && typeof model.details === 'object' ? model.details : {};
  const parts = [
    typeof details.family === 'string' && details.family.length > 0 ? details.family : null,
    typeof details.parameter_size === 'string' && details.parameter_size.length > 0 ? details.parameter_size : null,
    typeof details.quantization_level === 'string' && details.quantization_level.length > 0 ? details.quantization_level : null
  ].filter(Boolean);

  return parts.length > 0
    ? parts.join(' · ')
    : 'Modelo cloud descubierto desde ollama.com/api/tags';
}

export async function fetchOllamaCloudModels({ apiKey, timeoutMs = 8000 }) {
  const token = typeof apiKey === 'string' ? apiKey.trim() : '';

  if (token.length === 0) {
    throw new Error('Falta la API key de Ollama Cloud.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);

  try {
    const response = await fetch(`${OLLAMA_CLOUD_BASE_URL}/api/tags`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`
      },
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = payload?.error || payload?.message || `HTTP ${response.status}`;
      throw new Error(`Ollama Cloud respondio ${response.status}: ${message}`);
    }

    const rawModels = Array.isArray(payload?.models) ? payload.models : [];
    const cloudModels = rawModels.filter((model) => isOllamaCloudModelId(model?.model || model?.name));
    const modelsToUse = cloudModels.length > 0 ? cloudModels : rawModels;

    return {
      baseUrl: OLLAMA_CLOUD_BASE_URL,
      models: modelsToUse.map((model, index) => ({
        id: model?.model || model?.name || `ollama-cloud-model-${index + 1}`,
        name: model?.name || model?.model || `Modelo cloud ${index + 1}`,
        category: 'Ollama Cloud',
        contextWindow: 'Auto',
        summary: summarizeOllamaCloudModel(model),
        upstreamModelId: model?.model || model?.name || `ollama-cloud-model-${index + 1}`,
        transportMode: 'gateway',
        apiStyle: 'ollama-chat',
        apiBaseUrl: OLLAMA_CLOUD_BASE_URL,
        apiPath: '/api/chat',
        authEnvMode: 'auth_token',
        sortOrder: index + 1,
        isDefault: index === 0
      }))
    };
  } catch (error) {
    throw new Error(`No se pudo consultar ${OLLAMA_CLOUD_BASE_URL}/api/tags: ${describeRequestError(error)}`);
  } finally {
    clearTimeout(timer);
  }
}
