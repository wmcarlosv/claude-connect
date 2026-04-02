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

export function normalizeOllamaBaseUrl(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';

  if (trimmed.length === 0) {
    throw new Error('La URL de Ollama no puede quedar vacia.');
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;

  let url;

  try {
    url = new URL(withProtocol);
  } catch (_error) {
    throw new Error('La URL de Ollama no es valida.');
  }

  if (!url.hostname) {
    throw new Error('La URL de Ollama no es valida.');
  }

  return url.toString().replace(/\/$/, '');
}

function summarizeOllamaModel(model) {
  const details = model?.details && typeof model.details === 'object' ? model.details : {};
  const segments = [
    typeof details.family === 'string' && details.family.length > 0 ? details.family : null,
    typeof details.parameter_size === 'string' && details.parameter_size.length > 0 ? details.parameter_size : null,
    typeof details.quantization_level === 'string' && details.quantization_level.length > 0 ? details.quantization_level : null
  ].filter(Boolean);

  return segments.length > 0
    ? segments.join(' · ')
    : 'Modelo descubierto desde /api/tags';
}

export async function fetchOllamaModels({ baseUrl, timeoutMs = 8000 }) {
  const normalizedBaseUrl = normalizeOllamaBaseUrl(baseUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);

  try {
    const response = await fetch(`${normalizedBaseUrl}/api/tags`, {
      method: 'GET',
      headers: {
        accept: 'application/json'
      },
      signal: controller.signal
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = payload?.error || payload?.message || `HTTP ${response.status}`;
      throw new Error(`Ollama respondio ${response.status}: ${message}`);
    }

    const rawModels = Array.isArray(payload?.models) ? payload.models : [];

    return {
      baseUrl: normalizedBaseUrl,
      models: rawModels.map((model, index) => ({
        id: model?.model || model?.name || `ollama-model-${index + 1}`,
        name: model?.name || model?.model || `Modelo ${index + 1}`,
        category: 'Ollama OpenAI-compatible',
        contextWindow: 'Auto',
        summary: summarizeOllamaModel(model),
        upstreamModelId: model?.model || model?.name || `ollama-model-${index + 1}`,
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: normalizedBaseUrl,
        apiPath: '/v1/chat/completions',
        authEnvMode: 'auth_token',
        sortOrder: index + 1,
        isDefault: index === 0
      }))
    };
  } catch (error) {
    throw new Error(`No se pudo consultar ${normalizedBaseUrl}/api/tags: ${describeRequestError(error)}`);
  } finally {
    clearTimeout(timer);
  }
}
