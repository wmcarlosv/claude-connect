import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveClaudeConnectPaths } from './app-paths.js';

export function slugifyProfileName(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function inferFreeTierModel({ provider, model }) {
  const providerId = typeof provider?.id === 'string' ? provider.id.toLowerCase() : '';
  const modelId = typeof model?.id === 'string' ? model.id.toLowerCase() : '';
  const upstreamModelId = typeof model?.upstreamModelId === 'string' ? model.upstreamModelId.toLowerCase() : '';
  const name = typeof model?.name === 'string' ? model.name.toLowerCase() : '';
  const category = typeof model?.category === 'string' ? model.category.toLowerCase() : '';

  if (model?.isFreeTier === true || model?.supportsAnonymous === true) {
    return true;
  }

  if (providerId === 's-kaiba') {
    return true;
  }

  if (upstreamModelId === 'openrouter/free') {
    return true;
  }

  if (providerId === 'kilo-free' && model?.supportsAnonymous === true) {
    return true;
  }

  return modelId.includes(':free')
    || modelId.endsWith('-free')
    || upstreamModelId.includes(':free')
    || upstreamModelId.endsWith('-free')
    || name.includes(' free')
    || category.includes('free');
}

export function buildProfile({ provider, model, authMethod, profileName, apiKeyEnvVar, oauthSession }) {
  const protocol = model.apiStyle === 'openai-chat'
    ? 'openai-compatible'
    : model.apiStyle ?? 'openai-compatible';
  const profile = {
    schemaVersion: 1,
    profileName,
    provider: {
      id: provider.id,
      name: provider.name,
      vendor: provider.vendor
    },
    model: {
      id: model.id,
      upstreamModelId: model.upstreamModelId ?? model.id,
      name: model.name,
      contextWindow: model.contextWindow,
      transportMode: model.transportMode,
      apiStyle: model.apiStyle,
      apiBaseUrl: model.apiBaseUrl,
      apiPath: model.apiPath,
      authEnvMode: model.authEnvMode,
      supportsVision: model.supportsVision ?? true,
      supportsAnonymous: model.supportsAnonymous ?? false,
      isFreeTier: inferFreeTierModel({ provider, model })
    },
    auth: {
      method: authMethod.id
    },
    endpoint: {
      baseUrl: provider.baseUrl
    },
    integration: {
      protocol,
      notes: provider.description
    },
    createdAt: new Date().toISOString()
  };

  if (authMethod.id === 'token') {
    profile.auth.envVar = apiKeyEnvVar;
  }

  if (authMethod.id === 'oauth' && oauthSession) {
    profile.auth.oauth = oauthSession;
  }

  return profile;
}

export async function saveProfile(profile) {
  const { profilesDir: configDir } = await resolveClaudeConnectPaths();
  const fileName = `${slugifyProfileName(profile.profileName || `${profile.provider.id}-${profile.model.id}`)}.json`;
  const filePath = path.join(configDir, fileName);

  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(profile, null, 2)}\n`, { mode: 0o600 });

  return filePath;
}

export async function readProfileFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

export async function updateProfileFile(filePath, profile) {
  await fs.writeFile(filePath, `${JSON.stringify(profile, null, 2)}\n`, { mode: 0o600 });
}

export async function deleteProfileFile(filePath) {
  await fs.unlink(filePath);
}

export async function listProfiles() {
  const { profilesDir: configDir } = await resolveClaudeConnectPaths();

  try {
    const entries = await fs.readdir(configDir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => path.join(configDir, entry.name))
      .sort();

    const profiles = [];

    for (const filePath of files) {
      const profile = await readProfileFile(filePath);
      profiles.push({
        ...profile,
        filePath
      });
    }

    return profiles;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}
