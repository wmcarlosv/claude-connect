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

export function buildProfile({ provider, model, authMethod, profileName, apiKeyEnvVar, oauthSession }) {
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
      name: model.name,
      contextWindow: model.contextWindow
    },
    auth: {
      method: authMethod.id
    },
    endpoint: {
      baseUrl: provider.baseUrl
    },
    integration: {
      protocol: 'openai-compatible',
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
