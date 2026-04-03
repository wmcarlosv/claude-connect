function getProviderId(profile) {
  return profile?.provider?.id ?? '';
}

function getProviderInputTokensPerMinute(profile) {
  const providerId = getProviderId(profile);

  if (providerId === 'inception') {
    return 400_000;
  }

  return null;
}

const recentReservations = [];

function pruneReservations(now) {
  for (let index = recentReservations.length - 1; index >= 0; index -= 1) {
    if (now - recentReservations[index].timestamp >= 60_000) {
      recentReservations.splice(index, 1);
    }
  }
}

function sumReservedTokens(profile, now) {
  const providerId = getProviderId(profile);

  return recentReservations.reduce((total, entry) => {
    if (entry.providerId !== providerId) {
      return total;
    }

    if (now - entry.timestamp >= 60_000) {
      return total;
    }

    return total + entry.tokens;
  }, 0);
}

function earliestExpiryForProvider(profile, now) {
  const providerId = getProviderId(profile);
  let minExpiry = null;

  for (const entry of recentReservations) {
    if (entry.providerId !== providerId) {
      continue;
    }

    const expiry = entry.timestamp + 60_000;

    if (expiry <= now) {
      continue;
    }

    if (minExpiry == null || expiry < minExpiry) {
      minExpiry = expiry;
    }
  }

  return minExpiry;
}

export function resetProviderRateLimitState() {
  recentReservations.length = 0;
}

export async function reserveProviderInputTokens({
  profile,
  inputTokens,
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
}) {
  const tokensPerMinute = getProviderInputTokensPerMinute(profile);

  if (!tokensPerMinute) {
    return;
  }

  if (inputTokens > tokensPerMinute) {
    throw new Error(
      `${profile.provider.name} rechazo la solicitud porque la entrada estimada excede el limite de ${tokensPerMinute.toLocaleString('en-US')} tokens por minuto. Usa /compact o /clear antes de continuar.`
    );
  }

  while (true) {
    const currentTime = now();
    pruneReservations(currentTime);
    const usedTokens = sumReservedTokens(profile, currentTime);

    if (usedTokens + inputTokens <= tokensPerMinute) {
      recentReservations.push({
        providerId: getProviderId(profile),
        tokens: inputTokens,
        timestamp: currentTime
      });
      return;
    }

    const nextExpiry = earliestExpiryForProvider(profile, currentTime);

    if (nextExpiry == null) {
      throw new Error(`No se pudo reservar presupuesto de tokens para ${profile.provider.name}.`);
    }

    const waitMs = Math.max(250, nextExpiry - currentTime + 25);
    await sleep(waitMs);
  }
}
