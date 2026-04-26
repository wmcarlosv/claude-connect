import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveClaudeConnectPaths } from './app-paths.js';
import { slugifyProfileName } from './profile.js';

export async function getManagedProviderTokenSecretPath(providerId) {
  const { providerSecretsDir } = await resolveClaudeConnectPaths();
  return path.join(providerSecretsDir, `${slugifyProfileName(providerId)}.json`);
}

export async function saveManagedProviderTokenSecret({ providerId, providerName, envVar, token, ...metadata }) {
  const filePath = await getManagedProviderTokenSecretPath(providerId);

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    `${JSON.stringify({
      schemaVersion: 1,
      providerId,
      providerName,
      envVar,
      token,
      ...metadata,
      savedAt: new Date().toISOString()
    }, null, 2)}\n`,
    { mode: 0o600 }
  );

  return filePath;
}

export async function readManagedProviderTokenSecret(providerId) {
  const filePath = await getManagedProviderTokenSecretPath(providerId);

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return {
      filePath,
      secret: JSON.parse(raw)
    };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export async function deleteManagedProviderTokenSecret(providerId) {
  const filePath = await getManagedProviderTokenSecretPath(providerId);
  return deleteManagedTokenSecret(filePath);
}

export async function saveManagedTokenSecret({ profileName, providerId, modelId, envVar, token }) {
  const { claudeConnectHome } = await resolveClaudeConnectPaths();
  const secretsDir = path.join(claudeConnectHome, 'secrets');
  const filePath = path.join(secretsDir, `${slugifyProfileName(`${providerId}-${profileName}`)}.json`);

  await fs.mkdir(secretsDir, { recursive: true });
  await fs.writeFile(
    filePath,
    `${JSON.stringify({
      schemaVersion: 1,
      providerId,
      modelId,
      envVar,
      token,
      savedAt: new Date().toISOString()
    }, null, 2)}\n`,
    { mode: 0o600 }
  );

  return filePath;
}

export async function readManagedTokenSecret(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

export async function deleteManagedTokenSecret(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }

  return true;
}
