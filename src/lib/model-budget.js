import { estimateTokenCountFromAnthropicRequest } from '../gateway/messages.js';

function getModelIdentity(profile) {
  return profile?.model?.upstreamModelId ?? profile?.model?.id ?? '';
}

export function getModelTokenLimits(profile) {
  const providerId = profile?.provider?.id;
  const modelId = getModelIdentity(profile);

  if (providerId === 'inception' && modelId === 'mercury-2') {
    return {
      contextWindowTokens: 128_000,
      defaultOutputTokens: 8_192,
      maxOutputTokens: 16_384
    };
  }

  if (providerId === 'deepseek' && modelId === 'deepseek-chat') {
    return {
      contextWindowTokens: 128_000,
      defaultOutputTokens: 4_000,
      maxOutputTokens: 8_000
    };
  }

  if (providerId === 'deepseek' && modelId === 'deepseek-reasoner') {
    return {
      contextWindowTokens: 128_000,
      defaultOutputTokens: 32_000,
      maxOutputTokens: 64_000
    };
  }

  return null;
}

export function enforceModelTokenBudget({ body, profile, safetyMarginTokens = 1024 }) {
  const limits = getModelTokenLimits(profile);

  if (!limits) {
    return body;
  }

  const estimatedInputTokens = estimateTokenCountFromAnthropicRequest(body);
  const availableForOutput = limits.contextWindowTokens - estimatedInputTokens - safetyMarginTokens;

  if (availableForOutput <= 0) {
    throw new Error(
      `La conversacion actual excede el contexto aproximado de ${limits.contextWindowTokens.toLocaleString('en-US')} tokens para ${profile.model.name}. Usa /compact o /clear antes de continuar.`
    );
  }

  const requestedOutputTokens = typeof body?.max_tokens === 'number'
    ? body.max_tokens
    : limits.defaultOutputTokens;
  const clampedOutputTokens = Math.min(
    requestedOutputTokens,
    limits.maxOutputTokens,
    availableForOutput
  );

  if (clampedOutputTokens < 256) {
    throw new Error(
      `Queda muy poco margen de salida para ${profile.model.name} dentro de su contexto aproximado de ${limits.contextWindowTokens.toLocaleString('en-US')} tokens. Usa /compact o /clear antes de continuar.`
    );
  }

  return {
    ...body,
    max_tokens: clampedOutputTokens
  };
}
