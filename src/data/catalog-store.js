import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const defaultCatalogDbPath = path.join(process.cwd(), 'storage', 'claude-connect.sqlite');

const schemaSql = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  vendor TEXT NOT NULL,
  description TEXT NOT NULL,
  docs_url TEXT,
  docs_verified_at TEXT,
  base_url TEXT NOT NULL,
  default_model_id TEXT,
  default_auth_method_id TEXT,
  default_api_key_env_var TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  context_window TEXT NOT NULL,
  summary TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS auth_methods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  credential_kind TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_auth_methods (
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  auth_method_id TEXT NOT NULL REFERENCES auth_methods(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (provider_id, auth_method_id)
);

CREATE TABLE IF NOT EXISTS provider_oauth_configs (
  provider_id TEXT PRIMARY KEY REFERENCES providers(id) ON DELETE CASCADE,
  authorize_url TEXT NOT NULL,
  token_url TEXT NOT NULL,
  callback_url TEXT NOT NULL,
  access_type TEXT NOT NULL,
  scope TEXT,
  client_id TEXT,
  app_secret_id TEXT
);
`;

const seedProvider = {
  id: 'qwen',
  name: 'Qwen',
  vendor: 'Qwen',
  description: 'Qwen Code con OAuth propio de qwen.ai y modo token compatible con OpenAI.',
  docsUrl: 'https://github.com/QwenLM/qwen-code',
  docsVerifiedAt: '2026-03-31',
  baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  defaultModelId: 'qwen3-coder-plus',
  defaultAuthMethodId: 'token',
  defaultApiKeyEnvVar: 'DASHSCOPE_API_KEY',
  models: [
    {
      id: 'qwen3-coder-plus',
      name: 'Qwen Coder',
      category: 'Coding',
      contextWindow: 'Auto',
      summary: 'Modelo fijo para esta primera version, siguiendo el flujo de Qwen Code.',
      sortOrder: 1,
      isDefault: 1
    }
  ],
  authMethods: [
    {
      id: 'token',
      name: 'Token',
      description: 'Conexion por API key / token contra el endpoint compatible con OpenAI.',
      credentialKind: 'env_var',
      sortOrder: 1,
      isDefault: 1
    },
    {
      id: 'oauth',
      name: 'OAuth',
      description: 'Login de Qwen Code mediante device flow en qwen.ai.',
      credentialKind: 'oauth',
      sortOrder: 2,
      isDefault: 0
    }
  ],
  oauth: {
    authorizeUrl: 'https://chat.qwen.ai/api/v1/oauth2/device/code',
    tokenUrl: 'https://chat.qwen.ai/api/v1/oauth2/token',
    callbackUrl: 'https://chat.qwen.ai/auth',
    accessType: 'device_code',
    scope: 'openid profile email model.completion',
    clientId: 'f0304373b74a44d2b584a3fb70ca9e56',
    appSecretId: ''
  }
};

function seedCatalog(db) {
  const insertProvider = db.prepare(`
    INSERT INTO providers (
      id, name, vendor, description, docs_url, docs_verified_at, base_url,
      default_model_id, default_auth_method_id, default_api_key_env_var
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      vendor = excluded.vendor,
      description = excluded.description,
      docs_url = excluded.docs_url,
      docs_verified_at = excluded.docs_verified_at,
      base_url = excluded.base_url,
      default_model_id = excluded.default_model_id,
      default_auth_method_id = excluded.default_auth_method_id,
      default_api_key_env_var = excluded.default_api_key_env_var
  `);

  const insertModel = db.prepare(`
    INSERT INTO models (
      id, provider_id, name, category, context_window, summary, sort_order, is_default
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      provider_id = excluded.provider_id,
      name = excluded.name,
      category = excluded.category,
      context_window = excluded.context_window,
      summary = excluded.summary,
      sort_order = excluded.sort_order,
      is_default = excluded.is_default
  `);

  const insertAuthMethod = db.prepare(`
    INSERT INTO auth_methods (id, name, description, credential_kind)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      credential_kind = excluded.credential_kind
  `);

  const insertProviderAuthMethod = db.prepare(`
    INSERT INTO provider_auth_methods (provider_id, auth_method_id, sort_order, is_default)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(provider_id, auth_method_id) DO UPDATE SET
      sort_order = excluded.sort_order,
      is_default = excluded.is_default
  `);

  const insertOAuthConfig = db.prepare(`
    INSERT INTO provider_oauth_configs (
      provider_id, authorize_url, token_url, callback_url, access_type, scope, client_id, app_secret_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider_id) DO UPDATE SET
      authorize_url = excluded.authorize_url,
      token_url = excluded.token_url,
      callback_url = excluded.callback_url,
      access_type = excluded.access_type,
      scope = excluded.scope,
      client_id = excluded.client_id,
      app_secret_id = excluded.app_secret_id
  `);

  db.exec('BEGIN');

  try {
    db.prepare('DELETE FROM models WHERE provider_id = ?').run(seedProvider.id);
    db.prepare('DELETE FROM provider_auth_methods WHERE provider_id = ?').run(seedProvider.id);

    insertProvider.run(
      seedProvider.id,
      seedProvider.name,
      seedProvider.vendor,
      seedProvider.description,
      seedProvider.docsUrl,
      seedProvider.docsVerifiedAt,
      seedProvider.baseUrl,
      seedProvider.defaultModelId,
      seedProvider.defaultAuthMethodId,
      seedProvider.defaultApiKeyEnvVar
    );

    for (const model of seedProvider.models) {
      insertModel.run(
        model.id,
        seedProvider.id,
        model.name,
        model.category,
        model.contextWindow,
        model.summary,
        model.sortOrder,
        model.isDefault
      );
    }

    for (const authMethod of seedProvider.authMethods) {
      insertAuthMethod.run(
        authMethod.id,
        authMethod.name,
        authMethod.description,
        authMethod.credentialKind
      );

      insertProviderAuthMethod.run(
        seedProvider.id,
        authMethod.id,
        authMethod.sortOrder,
        authMethod.isDefault
      );
    }

    insertOAuthConfig.run(
      seedProvider.id,
      seedProvider.oauth.authorizeUrl,
      seedProvider.oauth.tokenUrl,
      seedProvider.oauth.callbackUrl,
      seedProvider.oauth.accessType,
      seedProvider.oauth.scope,
      seedProvider.oauth.clientId,
      seedProvider.oauth.appSecretId
    );

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function mapProviderRow(row) {
  return {
    id: row.id,
    name: row.name,
    vendor: row.vendor,
    description: row.description,
    docsUrl: row.docs_url,
    docsVerifiedAt: row.docs_verified_at,
    baseUrl: row.base_url,
    defaultModelId: row.default_model_id,
    defaultAuthMethodId: row.default_auth_method_id,
    defaultApiKeyEnvVar: row.default_api_key_env_var,
    modelCount: Number(row.model_count ?? 0),
    authCount: Number(row.auth_count ?? 0)
  };
}

function mapModelRow(row) {
  return {
    id: row.id,
    providerId: row.provider_id,
    name: row.name,
    category: row.category,
    contextWindow: row.context_window,
    summary: row.summary,
    sortOrder: Number(row.sort_order),
    isDefault: Boolean(row.is_default)
  };
}

function mapAuthRow(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    credentialKind: row.credential_kind,
    sortOrder: Number(row.sort_order),
    isDefault: Boolean(row.is_default)
  };
}

function mapOAuthRow(row) {
  return {
    providerId: row.provider_id,
    deviceCodeUrl: row.authorize_url,
    tokenUrl: row.token_url,
    browserAuthUrl: row.callback_url,
    flowType: row.access_type,
    scope: row.scope ?? '',
    clientId: row.client_id ?? '',
    appSecretId: row.app_secret_id ?? ''
  };
}

export function createCatalogStore({ filename = defaultCatalogDbPath } = {}) {
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }

  const db = new DatabaseSync(filename);
  db.exec(schemaSql);
  seedCatalog(db);

  const providerListStatement = db.prepare(`
    SELECT
      p.*,
      COUNT(DISTINCT m.id) AS model_count,
      COUNT(DISTINCT pam.auth_method_id) AS auth_count
    FROM providers p
    LEFT JOIN models m ON m.provider_id = p.id
    LEFT JOIN provider_auth_methods pam ON pam.provider_id = p.id
    GROUP BY p.id
    ORDER BY p.name ASC
  `);

  const providerStatement = db.prepare(`
    SELECT *
    FROM providers
    WHERE id = ?
  `);

  const modelListStatement = db.prepare(`
    SELECT *
    FROM models
    WHERE provider_id = ?
    ORDER BY is_default DESC, sort_order ASC, name ASC
  `);

  const authListStatement = db.prepare(`
    SELECT am.*, pam.sort_order, pam.is_default
    FROM provider_auth_methods pam
    JOIN auth_methods am ON am.id = pam.auth_method_id
    WHERE pam.provider_id = ?
    ORDER BY pam.is_default DESC, pam.sort_order ASC, am.name ASC
  `);

  const oauthConfigStatement = db.prepare(`
    SELECT *
    FROM provider_oauth_configs
    WHERE provider_id = ?
  `);

  return {
    filename,
    close() {
      db.close();
    },
    getProviders() {
      return providerListStatement.all().map(mapProviderRow);
    },
    getProviderById(providerId) {
      const row = providerStatement.get(providerId);
      return row ? mapProviderRow(row) : null;
    },
    getModelsByProviderId(providerId) {
      return modelListStatement.all(providerId).map(mapModelRow);
    },
    getAuthMethodsByProviderId(providerId) {
      return authListStatement.all(providerId).map(mapAuthRow);
    },
    getOAuthConfigByProviderId(providerId) {
      const row = oauthConfigStatement.get(providerId);
      return row ? mapOAuthRow(row) : null;
    },
    getProviderCatalog(providerId) {
      const provider = this.getProviderById(providerId);

      if (!provider) {
        return null;
      }

      const models = this.getModelsByProviderId(providerId);
      const authMethods = this.getAuthMethodsByProviderId(providerId);
      const oauth = this.getOAuthConfigByProviderId(providerId);

      return {
        ...provider,
        modelCount: models.length,
        authCount: authMethods.length,
        models,
        authMethods,
        oauth
      };
    }
  };
}

let catalogStore;

export function getCatalogStore() {
  if (!catalogStore) {
    catalogStore = createCatalogStore();
  }

  return catalogStore;
}
