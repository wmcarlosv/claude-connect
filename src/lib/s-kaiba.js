function getLowerString(value) {
  return typeof value === 'string' ? value.toLowerCase() : '';
}

export function isVargasThunderCandidateProfile(profile) {
  const providerId = getLowerString(profile?.provider?.id);
  const modelId = getLowerString(profile?.model?.id);
  const upstreamModelId = getLowerString(profile?.model?.upstreamModelId);
  const name = getLowerString(profile?.model?.name);
  const category = getLowerString(profile?.model?.category);
  const summary = getLowerString(profile?.model?.summary);
  const isFreeTier = profile?.model?.isFreeTier === true;
  const supportsAnonymous = profile?.model?.supportsAnonymous === true || profile?.auth?.method === 'anonymous';

  if (!profile || providerId === 's-kaiba') {
    return false;
  }

  if (supportsAnonymous || isFreeTier) {
    return true;
  }

  if (providerId === 'openrouter') {
    return true;
  }

  if (providerId === 'zen') {
    return modelId.endsWith('-free')
      || upstreamModelId.endsWith('-free')
      || name.includes('free')
      || category.includes('free')
      || summary.includes('free');
  }

  return modelId.includes(':free')
    || modelId.endsWith('-free')
    || upstreamModelId.includes(':free')
    || upstreamModelId.endsWith('-free')
    || category.includes('free');
}

export function isSKaibaSelectableProfile(profile) {
  if (!isVargasThunderCandidateProfile(profile)) {
    return false;
  }

  return profile?.model?.transportMode === 'gateway'
    && profile?.model?.apiStyle !== 'router-free';
}

export function shouldFailoverOnProviderError(error) {
  const message = typeof error === 'string'
    ? error
    : error instanceof Error
      ? error.message
      : String(error);
  const lower = message.toLowerCase();

  return [
    'rate limit',
    'quota',
    'too many requests',
    'temporarily unavailable',
    'credits exhausted',
    'credit exhausted',
    'input token limit exceeded',
    'resource exhausted',
    'billing hard limit'
  ].some((fragment) => lower.includes(fragment))
    || lower.includes(' 429')
    || lower.startsWith('429 ');
}

export function buildVargasThunderSummary(profiles) {
  if (!Array.isArray(profiles) || profiles.length === 0) {
    return 'Router local que rota entre conexiones gratuitas configuradas cuando encuentra cuota o rate limit.';
  }

  const labels = profiles.map((profile) => `${profile.provider.name} / ${profile.model.name}`);
  return `Router local que rota entre conexiones gratuitas configuradas (${labels.join(', ')}) cuando encuentra cuota o rate limit.`;
}
