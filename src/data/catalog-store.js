import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { resolveClaudeConnectHomeSync } from '../lib/app-paths.js';

export function getDefaultCatalogDbPath(options = {}) {
  const pathModule = options.platform === 'win32' ? path.win32 : path.posix;
  return pathModule.join(resolveClaudeConnectHomeSync(options), 'storage', 'claude-connect.sqlite');
}

export const defaultCatalogDbPath = getDefaultCatalogDbPath();

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
  upstream_model_id TEXT,
  transport_mode TEXT NOT NULL DEFAULT 'gateway',
  api_style TEXT NOT NULL DEFAULT 'openai-chat',
  api_base_url TEXT,
  api_path TEXT,
  auth_env_mode TEXT NOT NULL DEFAULT 'auth_token',
  supports_vision INTEGER NOT NULL DEFAULT 1,
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

const seedProviders = [
  {
    id: 'opencode-go',
    name: 'OpenCode Go',
    vendor: 'OpenCode',
    description: 'Suscripcion OpenCode Go con modelos abiertos de programacion. Algunos modelos van directos por messages y otros por gateway en chat/completions.',
    docsUrl: 'https://opencode.ai/docs/es/go/',
    docsVerifiedAt: '2026-04-01',
    baseUrl: 'https://opencode.ai/zen/go',
    defaultModelId: 'minimax-m2.5',
    defaultAuthMethodId: 'token',
    defaultApiKeyEnvVar: 'OPENCODE_API_KEY',
    models: [
      {
        id: 'opencode-go-glm-5',
        name: 'GLM 5',
        category: 'OpenAI-compatible',
        contextWindow: 'Auto',
        summary: 'Modelo de OpenCode Go servido por chat/completions y usado a través del gateway local.',
        upstreamModelId: 'glm-5',
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: 'https://opencode.ai/zen/go/v1',
        apiPath: '/chat/completions',
        authEnvMode: 'auth_token',
        sortOrder: 1,
        isDefault: 0
      },
      {
        id: 'opencode-go-kimi-k2.5',
        name: 'Kimi K2.5',
        category: 'OpenAI-compatible',
        contextWindow: 'Auto',
        summary: 'Modelo de OpenCode Go servido por chat/completions y usado a través del gateway local.',
        upstreamModelId: 'kimi-k2.5',
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: 'https://opencode.ai/zen/go/v1',
        apiPath: '/chat/completions',
        authEnvMode: 'auth_token',
        sortOrder: 2,
        isDefault: 0
      },
      {
        id: 'opencode-go-minimax-m2.7',
        name: 'MiniMax M2.7',
        category: 'Anthropic',
        contextWindow: 'Auto',
        summary: 'Modelo de OpenCode Go servido por messages y usado directamente por Claude Code.',
        upstreamModelId: 'minimax-m2.7',
        transportMode: 'direct',
        apiStyle: 'anthropic',
        apiBaseUrl: 'https://opencode.ai/zen/go',
        apiPath: '/v1/messages',
        authEnvMode: 'api_key',
        sortOrder: 3,
        isDefault: 0
      },
      {
        id: 'opencode-go-minimax-m2.5',
        name: 'MiniMax M2.5',
        category: 'Anthropic',
        contextWindow: 'Auto',
        summary: 'Modelo de OpenCode Go servido por messages y usado directamente por Claude Code.',
        upstreamModelId: 'minimax-m2.5',
        transportMode: 'direct',
        apiStyle: 'anthropic',
        apiBaseUrl: 'https://opencode.ai/zen/go',
        apiPath: '/v1/messages',
        authEnvMode: 'api_key',
        sortOrder: 4,
        isDefault: 1
      }
    ],
    authMethods: [
      {
        id: 'token',
        name: 'Token',
        description: 'Conexion por API key de OpenCode para la suscripcion Go.',
        credentialKind: 'env_var',
        sortOrder: 1,
        isDefault: 1
      }
    ]
  },
  {
    id: 'zen',
    name: 'OpenCode Zen',
    vendor: 'OpenCode',
    description: 'Zen de OpenCode con modelos curados. Claude va directo para modelos Anthropic y usa gateway para modelos OpenAI-compatible.',
    docsUrl: 'https://opencode.ai/docs/zen',
    docsVerifiedAt: '2026-04-01',
    baseUrl: 'https://opencode.ai/zen',
    defaultModelId: 'claude-sonnet-4-6',
    defaultAuthMethodId: 'token',
    defaultApiKeyEnvVar: 'OPENCODE_API_KEY',
    models: [
      {
        id: 'claude-opus-4-6',
        name: 'Claude Opus 4.6',
        category: 'Anthropic',
        contextWindow: '200K+',
        summary: 'Modelo Anthropic servido por Zen en el endpoint messages.',
        upstreamModelId: 'claude-opus-4-6',
        transportMode: 'direct',
        apiStyle: 'anthropic',
        apiBaseUrl: 'https://opencode.ai/zen',
        apiPath: '/v1/messages',
        authEnvMode: 'api_key',
        sortOrder: 1,
        isDefault: 0
      },
      {
        id: 'claude-opus-4-5',
        name: 'Claude Opus 4.5',
        category: 'Anthropic',
        contextWindow: '200K+',
        summary: 'Modelo Anthropic servido por Zen en el endpoint messages.',
        upstreamModelId: 'claude-opus-4-5',
        transportMode: 'direct',
        apiStyle: 'anthropic',
        apiBaseUrl: 'https://opencode.ai/zen',
        apiPath: '/v1/messages',
        authEnvMode: 'api_key',
        sortOrder: 2,
        isDefault: 0
      },
      {
        id: 'claude-opus-4-1',
        name: 'Claude Opus 4.1',
        category: 'Anthropic',
        contextWindow: '200K+',
        summary: 'Modelo Anthropic servido por Zen en el endpoint messages.',
        upstreamModelId: 'claude-opus-4-1',
        transportMode: 'direct',
        apiStyle: 'anthropic',
        apiBaseUrl: 'https://opencode.ai/zen',
        apiPath: '/v1/messages',
        authEnvMode: 'api_key',
        sortOrder: 3,
        isDefault: 0
      },
      {
        id: 'claude-sonnet-4-6',
        name: 'Claude Sonnet 4.6',
        category: 'Anthropic',
        contextWindow: '200K+',
        summary: 'Modelo Anthropic servido por Zen en el endpoint messages.',
        upstreamModelId: 'claude-sonnet-4-6',
        transportMode: 'direct',
        apiStyle: 'anthropic',
        apiBaseUrl: 'https://opencode.ai/zen',
        apiPath: '/v1/messages',
        authEnvMode: 'api_key',
        sortOrder: 4,
        isDefault: 1
      },
      {
        id: 'claude-sonnet-4-5',
        name: 'Claude Sonnet 4.5',
        category: 'Anthropic',
        contextWindow: '200K+',
        summary: 'Modelo Anthropic servido por Zen en el endpoint messages.',
        upstreamModelId: 'claude-sonnet-4-5',
        transportMode: 'direct',
        apiStyle: 'anthropic',
        apiBaseUrl: 'https://opencode.ai/zen',
        apiPath: '/v1/messages',
        authEnvMode: 'api_key',
        sortOrder: 5,
        isDefault: 0
      },
      {
        id: 'claude-sonnet-4',
        name: 'Claude Sonnet 4',
        category: 'Anthropic',
        contextWindow: '200K+',
        summary: 'Modelo Anthropic servido por Zen en el endpoint messages.',
        upstreamModelId: 'claude-sonnet-4',
        transportMode: 'direct',
        apiStyle: 'anthropic',
        apiBaseUrl: 'https://opencode.ai/zen',
        apiPath: '/v1/messages',
        authEnvMode: 'api_key',
        sortOrder: 6,
        isDefault: 0
      },
      {
        id: 'claude-haiku-4-5',
        name: 'Claude Haiku 4.5',
        category: 'Anthropic',
        contextWindow: '200K+',
        summary: 'Modelo Anthropic servido por Zen en el endpoint messages.',
        upstreamModelId: 'claude-haiku-4-5',
        transportMode: 'direct',
        apiStyle: 'anthropic',
        apiBaseUrl: 'https://opencode.ai/zen',
        apiPath: '/v1/messages',
        authEnvMode: 'api_key',
        sortOrder: 7,
        isDefault: 0
      },
      {
        id: 'claude-3-5-haiku',
        name: 'Claude Haiku 3.5',
        category: 'Anthropic',
        contextWindow: '200K+',
        summary: 'Modelo Anthropic servido por Zen en el endpoint messages.',
        upstreamModelId: 'claude-3-5-haiku',
        transportMode: 'direct',
        apiStyle: 'anthropic',
        apiBaseUrl: 'https://opencode.ai/zen',
        apiPath: '/v1/messages',
        authEnvMode: 'api_key',
        sortOrder: 8,
        isDefault: 0
      },
      {
        id: 'minimax-m2.5',
        name: 'MiniMax M2.5',
        category: 'OpenAI-compatible',
        contextWindow: 'Auto',
        summary: 'Modelo servido por Zen en chat/completions y usado a través del gateway local.',
        upstreamModelId: 'minimax-m2.5',
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: 'https://opencode.ai/zen/v1',
        apiPath: '/chat/completions',
        authEnvMode: 'auth_token',
        sortOrder: 9,
        isDefault: 0
      },
      {
        id: 'minimax-m2.5-free',
        name: 'MiniMax M2.5 Free',
        category: 'OpenAI-compatible',
        contextWindow: 'Auto',
        summary: 'Modelo gratis servido por Zen en chat/completions y usado a través del gateway local.',
        upstreamModelId: 'minimax-m2.5-free',
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: 'https://opencode.ai/zen/v1',
        apiPath: '/chat/completions',
        authEnvMode: 'auth_token',
        sortOrder: 10,
        isDefault: 0
      },
      {
        id: 'glm-5',
        name: 'GLM 5',
        category: 'OpenAI-compatible',
        contextWindow: 'Auto',
        summary: 'Modelo servido por Zen en chat/completions y usado a través del gateway local.',
        upstreamModelId: 'glm-5',
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: 'https://opencode.ai/zen/v1',
        apiPath: '/chat/completions',
        authEnvMode: 'auth_token',
        sortOrder: 11,
        isDefault: 0
      },
      {
        id: 'kimi-k2.5',
        name: 'Kimi K2.5',
        category: 'OpenAI-compatible',
        contextWindow: 'Auto',
        summary: 'Modelo servido por Zen en chat/completions y usado a través del gateway local.',
        upstreamModelId: 'kimi-k2.5',
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: 'https://opencode.ai/zen/v1',
        apiPath: '/chat/completions',
        authEnvMode: 'auth_token',
        sortOrder: 12,
        isDefault: 0
      },
      {
        id: 'big-pickle',
        name: 'Big Pickle',
        category: 'OpenAI-compatible',
        contextWindow: 'Auto',
        summary: 'Modelo servido por Zen en chat/completions y usado a través del gateway local.',
        upstreamModelId: 'big-pickle',
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: 'https://opencode.ai/zen/v1',
        apiPath: '/chat/completions',
        authEnvMode: 'auth_token',
        sortOrder: 13,
        isDefault: 0
      },
      {
        id: 'mimo-v2-pro-free',
        name: 'MiMo V2 Pro Free',
        category: 'OpenAI-compatible',
        contextWindow: 'Auto',
        summary: 'Modelo gratis servido por Zen en chat/completions y usado a través del gateway local.',
        upstreamModelId: 'mimo-v2-pro-free',
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: 'https://opencode.ai/zen/v1',
        apiPath: '/chat/completions',
        authEnvMode: 'auth_token',
        sortOrder: 14,
        isDefault: 0
      },
      {
        id: 'mimo-v2-omni-free',
        name: 'MiMo V2 Omni Free',
        category: 'OpenAI-compatible',
        contextWindow: 'Auto',
        summary: 'Modelo gratis servido por Zen en chat/completions y usado a través del gateway local.',
        upstreamModelId: 'mimo-v2-omni-free',
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: 'https://opencode.ai/zen/v1',
        apiPath: '/chat/completions',
        authEnvMode: 'auth_token',
        sortOrder: 15,
        isDefault: 0
      },
      {
        id: 'qwen3.6-plus-free',
        name: 'Qwen 3.6 Plus Free',
        category: 'OpenAI-compatible',
        contextWindow: 'Auto',
        summary: 'Modelo gratis servido por Zen en chat/completions y usado a través del gateway local.',
        upstreamModelId: 'qwen3.6-plus-free',
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: 'https://opencode.ai/zen/v1',
        apiPath: '/chat/completions',
        authEnvMode: 'auth_token',
        sortOrder: 16,
        isDefault: 0
      },
      {
        id: 'nemotron-3-super-free',
        name: 'Nemotron 3 Super Free',
        category: 'OpenAI-compatible',
        contextWindow: 'Auto',
        summary: 'Modelo gratis servido por Zen en chat/completions y usado a través del gateway local.',
        upstreamModelId: 'nemotron-3-super-free',
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: 'https://opencode.ai/zen/v1',
        apiPath: '/chat/completions',
        authEnvMode: 'auth_token',
        sortOrder: 17,
        isDefault: 0
      }
    ],
    authMethods: [
      {
        id: 'token',
        name: 'Token',
        description: 'Conexion por API key de OpenCode Zen.',
        credentialKind: 'env_var',
        sortOrder: 1,
        isDefault: 1
      }
    ]
  },
  {
    id: 'kimi',
    name: 'Kimi',
    vendor: 'Moonshot AI',
    description: 'Kimi Code para Claude Code usando el endpoint Anthropic oficial de Kimi a través del gateway local.',
    docsUrl: 'https://www.kimi.com/code/docs/en/more/third-party-agents.html',
    docsVerifiedAt: '2026-04-01',
    baseUrl: 'https://api.kimi.com/coding/',
    defaultModelId: 'kimi-for-coding',
    defaultAuthMethodId: 'token',
    defaultApiKeyEnvVar: 'KIMI_API_KEY',
    models: [
      {
        id: 'kimi-for-coding',
        name: 'Kimi For Coding',
        category: 'Coding',
        contextWindow: '262144',
        summary: 'Modelo oficial de Kimi Code para Claude Code. El modo thinking se conmuta con Tab dentro de Claude Code.',
        upstreamModelId: 'kimi-for-coding',
        transportMode: 'gateway',
        apiStyle: 'anthropic',
        apiBaseUrl: 'https://api.kimi.com/coding/',
        apiPath: '/v1/messages',
        authEnvMode: 'api_key',
        sortOrder: 1,
        isDefault: 1
      }
    ],
    authMethods: [
      {
        id: 'token',
        name: 'Token',
        description: 'Conexion por API key contra el endpoint Anthropic oficial del proveedor.',
        credentialKind: 'env_var',
        sortOrder: 1,
        isDefault: 1
      }
    ]
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    vendor: 'DeepSeek',
    description: 'DeepSeek API compatible con OpenAI usando API key y modelos chat/reasoner.',
    docsUrl: 'https://api-docs.deepseek.com/',
    docsVerifiedAt: '2026-03-31',
    baseUrl: 'https://api.deepseek.com',
    defaultModelId: 'deepseek-chat',
    defaultAuthMethodId: 'token',
    defaultApiKeyEnvVar: 'DEEPSEEK_API_KEY',
    models: [
      {
        id: 'deepseek-chat',
        name: 'DeepSeek Chat',
        category: 'General',
        contextWindow: '128K',
        summary: 'Modo no razonador de DeepSeek V3.2, apto como opcion base para Claude Code.',
        upstreamModelId: 'deepseek-chat',
        transportMode: 'direct',
        apiStyle: 'anthropic',
        apiBaseUrl: 'https://api.deepseek.com/anthropic',
        apiPath: '/v1/messages',
        authEnvMode: 'auth_token',
        sortOrder: 1,
        isDefault: 1
      },
      {
        id: 'deepseek-reasoner',
        name: 'DeepSeek Reasoner',
        category: 'Reasoning',
        contextWindow: '128K',
        summary: 'Modo razonador de DeepSeek V3.2 con soporte de Tool Calls segun la documentacion oficial.',
        upstreamModelId: 'deepseek-reasoner',
        transportMode: 'direct',
        apiStyle: 'anthropic',
        apiBaseUrl: 'https://api.deepseek.com/anthropic',
        apiPath: '/v1/messages',
        authEnvMode: 'auth_token',
        sortOrder: 2,
        isDefault: 0
      }
    ],
    authMethods: [
      {
        id: 'token',
        name: 'Token',
        description: 'Conexion por API key contra el endpoint Anthropic oficial del proveedor.',
        credentialKind: 'env_var',
        sortOrder: 1,
        isDefault: 1
      }
    ]
  },
  {
    id: 'zai',
    name: 'Z.AI',
    vendor: 'Zhipu AI',
    description: 'GLM Coding Plan para Claude Code usando el endpoint Anthropic-compatible oficial de z.ai.',
    docsUrl: 'https://docs.z.ai/devpack/tool/claude',
    docsVerifiedAt: '2026-04-04',
    baseUrl: 'https://api.z.ai/api/anthropic',
    defaultModelId: 'glm-5.1',
    defaultAuthMethodId: 'token',
    defaultApiKeyEnvVar: 'ZAI_API_KEY',
    models: [
      {
        id: 'glm-5.1',
        name: 'GLM-5.1',
        category: 'Coding',
        contextWindow: 'Auto',
        summary: 'Modelo recomendado de la documentacion oficial de z.ai para usuarios Max que quieren usar GLM-5.1 en Claude Code.',
        upstreamModelId: 'glm-5.1',
        transportMode: 'direct',
        apiStyle: 'anthropic',
        apiBaseUrl: 'https://api.z.ai/api/anthropic',
        apiPath: '/v1/messages',
        authEnvMode: 'auth_token',
        sortOrder: 1,
        isDefault: 1
      },
      {
        id: 'glm-4.7',
        name: 'GLM-4.7',
        category: 'General',
        contextWindow: 'Auto',
        summary: 'Modelo default recomendado por z.ai para Opus y Sonnet dentro del GLM Coding Plan.',
        upstreamModelId: 'glm-4.7',
        transportMode: 'direct',
        apiStyle: 'anthropic',
        apiBaseUrl: 'https://api.z.ai/api/anthropic',
        apiPath: '/v1/messages',
        authEnvMode: 'auth_token',
        sortOrder: 2,
        isDefault: 0
      },
      {
        id: 'glm-4.5-air',
        name: 'GLM-4.5-Air',
        category: 'Fast',
        contextWindow: 'Auto',
        summary: 'Modelo ligero recomendado por z.ai para la clase Haiku dentro del GLM Coding Plan.',
        upstreamModelId: 'glm-4.5-air',
        transportMode: 'direct',
        apiStyle: 'anthropic',
        apiBaseUrl: 'https://api.z.ai/api/anthropic',
        apiPath: '/v1/messages',
        authEnvMode: 'auth_token',
        sortOrder: 3,
        isDefault: 0
      }
    ],
    authMethods: [
      {
        id: 'token',
        name: 'Token',
        description: 'Conexion por API key contra el endpoint Anthropic-compatible oficial de z.ai.',
        credentialKind: 'env_var',
        sortOrder: 1,
        isDefault: 1
      }
    ]
  },
  {
    id: 'ollama',
    name: 'Ollama',
    vendor: 'Ollama',
    description: 'Servidor Ollama autohospedado. La conexion pide una base URL manual, descubre modelos via /api/tags y luego usa Chat Completions por el gateway local.',
    docsUrl: 'https://docs.ollama.com/openai',
    docsVerifiedAt: '2026-04-02',
    baseUrl: 'http://127.0.0.1:11434',
    defaultModelId: null,
    defaultAuthMethodId: 'server',
    defaultApiKeyEnvVar: 'OLLAMA_API_KEY',
    models: [],
    authMethods: [
      {
        id: 'server',
        name: 'Servidor Ollama',
        description: 'Conexion sin API key propia de Claude Connect. Solo necesitas la URL de tu servidor Ollama local o remoto.',
        credentialKind: 'none',
        sortOrder: 1,
        isDefault: 1
      }
    ]
  },
  {
    id: 'kilo-free',
    name: 'Kilo Code Free Models',
    vendor: 'Kilo AI',
    description: 'Gateway OpenAI-compatible de Kilo AI. La app descubre modelos gratuitos desde /models y deja elegir entre modo anonimo o API key.',
    docsUrl: 'https://kilo.ai/docs/gateway',
    docsVerifiedAt: '2026-04-05',
    baseUrl: 'https://api.kilo.ai/api/gateway',
    defaultModelId: null,
    defaultAuthMethodId: 'anonymous',
    defaultApiKeyEnvVar: 'KILO_API_KEY',
    models: [],
    authMethods: [
      {
        id: 'anonymous',
        name: 'Gratis sin token',
        description: 'Usa solo modelos free de Kilo sin autenticar. Kilo aplica rate limit por IP para usuarios anonimos.',
        credentialKind: 'none',
        sortOrder: 1,
        isDefault: 1
      },
      {
        id: 'token',
        name: 'Token',
        description: 'Usa una API key de Kilo AI sobre el mismo gateway OpenAI-compatible.',
        credentialKind: 'env_var',
        sortOrder: 2,
        isDefault: 0
      }
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    vendor: 'OpenAI',
    description: 'OpenAI con modelos GPT y Codex orientados a coding. Claude Code se conecta a traves del gateway local para mantener compatibilidad Anthropic, herramientas y vision.',
    docsUrl: 'https://developers.openai.com/api/docs/models',
    docsVerifiedAt: '2026-04-02',
    baseUrl: 'https://api.openai.com/v1',
    defaultModelId: 'gpt-5.4',
    defaultAuthMethodId: 'token',
    defaultApiKeyEnvVar: 'OPENAI_API_KEY',
    models: [
      {
        id: 'gpt-5.4',
        name: 'GPT-5.4',
        category: 'OpenAI Chat Completions',
        contextWindow: '1M',
        summary: 'Modelo frontier actual de OpenAI para trabajo complejo, coding y flujos profesionales.',
        upstreamModelId: 'gpt-5.4',
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: 'https://api.openai.com/v1',
        apiPath: '/chat/completions',
        authEnvMode: 'auth_token',
        sortOrder: 1,
        isDefault: 1
      },
      {
        id: 'gpt-5.4-mini',
        name: 'GPT-5.4 Mini',
        category: 'OpenAI Chat Completions',
        contextWindow: '400K',
        summary: 'Variante mas rapida y economica de GPT-5.4 para coding, subagentes y alto volumen.',
        upstreamModelId: 'gpt-5.4-mini',
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: 'https://api.openai.com/v1',
        apiPath: '/chat/completions',
        authEnvMode: 'auth_token',
        sortOrder: 2,
        isDefault: 0
      },
      {
        id: 'gpt-5.3-codex',
        name: 'GPT-5.3 Codex',
        category: 'OpenAI Chat Completions',
        contextWindow: '400K',
        summary: 'Modelo Codex mas capaz de OpenAI para tareas agenticas de programacion.',
        upstreamModelId: 'gpt-5.3-codex',
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: 'https://api.openai.com/v1',
        apiPath: '/chat/completions',
        authEnvMode: 'auth_token',
        sortOrder: 3,
        isDefault: 0
      },
      {
        id: 'gpt-5.2-codex',
        name: 'GPT-5.2 Codex',
        category: 'OpenAI Chat Completions',
        contextWindow: '400K',
        summary: 'Modelo Codex inteligente para tareas largas de coding y automatizacion.',
        upstreamModelId: 'gpt-5.2-codex',
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: 'https://api.openai.com/v1',
        apiPath: '/chat/completions',
        authEnvMode: 'auth_token',
        sortOrder: 4,
        isDefault: 0
      },
      {
        id: 'gpt-5.2',
        name: 'GPT-5.2',
        category: 'OpenAI Chat Completions',
        contextWindow: '400K',
        summary: 'Modelo frontier previo de OpenAI para trabajo profesional con razonamiento configurable.',
        upstreamModelId: 'gpt-5.2',
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: 'https://api.openai.com/v1',
        apiPath: '/chat/completions',
        authEnvMode: 'auth_token',
        sortOrder: 5,
        isDefault: 0
      },
      {
        id: 'gpt-5.1-codex-max',
        name: 'GPT-5.1 Codex Max',
        category: 'OpenAI Chat Completions',
        contextWindow: '400K',
        summary: 'Variante Codex optimizada para tareas de larga duracion y sesiones de coding mas extensas.',
        upstreamModelId: 'gpt-5.1-codex-max',
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: 'https://api.openai.com/v1',
        apiPath: '/chat/completions',
        authEnvMode: 'auth_token',
        sortOrder: 6,
        isDefault: 0
      },
      {
        id: 'gpt-5.1-codex-mini',
        name: 'GPT-5.1 Codex Mini',
        category: 'OpenAI Chat Completions',
        contextWindow: '400K',
        summary: 'Version mas ligera y economica de la linea Codex 5.1 para iteraciones rapidas.',
        upstreamModelId: 'gpt-5.1-codex-mini',
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: 'https://api.openai.com/v1',
        apiPath: '/chat/completions',
        authEnvMode: 'auth_token',
        sortOrder: 7,
        isDefault: 0
      }
    ],
    authMethods: [
      {
        id: 'token',
        name: 'Token',
        description: 'Conexion por API key de OpenAI.',
        credentialKind: 'env_var',
        sortOrder: 1,
        isDefault: 1
      }
    ]
  },
  {
    id: 'inception',
    name: 'Inception Labs',
    vendor: 'Inception Labs',
    description: 'Inception Platform con Mercury 2 sobre un endpoint OpenAI-compatible. Claude Code se conecta a traves del gateway local para mantener compatibilidad Anthropic y herramientas.',
    docsUrl: 'https://docs.inceptionlabs.ai/get-started/get-started',
    docsVerifiedAt: '2026-04-03',
    baseUrl: 'https://api.inceptionlabs.ai/v1',
    defaultModelId: 'mercury-2',
    defaultAuthMethodId: 'token',
    defaultApiKeyEnvVar: 'INCEPTION_API_KEY',
    models: [
      {
        id: 'mercury-2',
        name: 'Mercury 2',
        category: 'OpenAI Chat Completions',
        contextWindow: '128K',
        summary: 'Modelo generalista y de razonamiento de Inception Labs expuesto por v1/chat/completions.',
        upstreamModelId: 'mercury-2',
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: 'https://api.inceptionlabs.ai/v1',
        apiPath: '/chat/completions',
        authEnvMode: 'auth_token',
        supportsVision: false,
        sortOrder: 1,
        isDefault: 1
      }
    ],
    authMethods: [
      {
        id: 'token',
        name: 'Token',
        description: 'Conexion por API key de Inception Labs.',
        credentialKind: 'env_var',
        sortOrder: 1,
        isDefault: 1
      }
    ]
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    vendor: 'OpenRouter',
    description: 'OpenRouter con el router gratuito openrouter/free para usar inferencia sin costo y dejar que OpenRouter seleccione un modelo free compatible con la solicitud.',
    docsUrl: 'https://openrouter.ai/openrouter/free/activity',
    docsVerifiedAt: '2026-04-01',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModelId: 'openrouter-free',
    defaultAuthMethodId: 'token',
    defaultApiKeyEnvVar: 'OPENROUTER_API_KEY',
    models: [
      {
        id: 'openrouter-free',
        name: 'OpenRouter Free Router',
        category: 'Free Router',
        contextWindow: '200K',
        summary: 'Router gratuito de OpenRouter. Usa el modelo upstream openrouter/free y deja que el proveedor elija un modelo free compatible con herramientas, vision u otras capacidades.',
        upstreamModelId: 'openrouter/free',
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: 'https://openrouter.ai/api/v1',
        apiPath: '/chat/completions',
        authEnvMode: 'auth_token',
        sortOrder: 1,
        isDefault: 1
      }
    ],
    authMethods: [
      {
        id: 'token',
        name: 'Token',
        description: 'Conexion por API key contra el endpoint OpenAI-compatible oficial de OpenRouter.',
        credentialKind: 'env_var',
        sortOrder: 1,
        isDefault: 1
      }
    ]
  },
  {
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
        upstreamModelId: 'qwen3-coder-plus',
        transportMode: 'gateway',
        apiStyle: 'openai-chat',
        apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiPath: '/chat/completions',
        authEnvMode: 'auth_token',
        sortOrder: 1,
        isDefault: 1
      }
    ],
    authMethods: [
      {
        id: 'token',
        name: 'Token',
        description: 'Conexion por API key contra el endpoint compatible con OpenAI del proveedor.',
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
  }
];

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
      id, provider_id, name, category, context_window, summary,
      upstream_model_id,
      transport_mode, api_style, api_base_url, api_path, auth_env_mode, supports_vision,
      sort_order, is_default
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      provider_id = excluded.provider_id,
      name = excluded.name,
      category = excluded.category,
      context_window = excluded.context_window,
      summary = excluded.summary,
      upstream_model_id = excluded.upstream_model_id,
      transport_mode = excluded.transport_mode,
      api_style = excluded.api_style,
      api_base_url = excluded.api_base_url,
      api_path = excluded.api_path,
      auth_env_mode = excluded.auth_env_mode,
      supports_vision = excluded.supports_vision,
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
    for (const seedProvider of seedProviders) {
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
          model.upstreamModelId ?? model.id,
          model.transportMode ?? 'gateway',
          model.apiStyle ?? 'openai-chat',
          model.apiBaseUrl ?? null,
          model.apiPath ?? null,
          model.authEnvMode ?? 'auth_token',
          model.supportsVision === false ? 0 : 1,
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

      if (seedProvider.oauth) {
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
      } else {
        db.prepare('DELETE FROM provider_oauth_configs WHERE provider_id = ?').run(seedProvider.id);
      }
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function ensureSchemaMigrations(db) {
  const modelColumns = new Set(
    db.prepare('PRAGMA table_info(models)').all().map((column) => column.name)
  );

  const alterStatements = [];

  if (!modelColumns.has('transport_mode')) {
    alterStatements.push(`ALTER TABLE models ADD COLUMN transport_mode TEXT NOT NULL DEFAULT 'gateway'`);
  }

  if (!modelColumns.has('api_style')) {
    alterStatements.push(`ALTER TABLE models ADD COLUMN api_style TEXT NOT NULL DEFAULT 'openai-chat'`);
  }

  if (!modelColumns.has('api_base_url')) {
    alterStatements.push(`ALTER TABLE models ADD COLUMN api_base_url TEXT`);
  }

  if (!modelColumns.has('api_path')) {
    alterStatements.push(`ALTER TABLE models ADD COLUMN api_path TEXT`);
  }

  if (!modelColumns.has('auth_env_mode')) {
    alterStatements.push(`ALTER TABLE models ADD COLUMN auth_env_mode TEXT NOT NULL DEFAULT 'auth_token'`);
  }

  if (!modelColumns.has('supports_vision')) {
    alterStatements.push(`ALTER TABLE models ADD COLUMN supports_vision INTEGER NOT NULL DEFAULT 1`);
  }

  if (!modelColumns.has('upstream_model_id')) {
    alterStatements.push(`ALTER TABLE models ADD COLUMN upstream_model_id TEXT`);
  }

  for (const statement of alterStatements) {
    db.exec(statement);
  }

  db.exec(`UPDATE models SET upstream_model_id = id WHERE upstream_model_id IS NULL OR upstream_model_id = ''`);
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
    upstreamModelId: row.upstream_model_id ?? row.id,
    transportMode: row.transport_mode,
    apiStyle: row.api_style,
    apiBaseUrl: row.api_base_url,
    apiPath: row.api_path,
    authEnvMode: row.auth_env_mode,
    supportsVision: Boolean(row.supports_vision),
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

export function createCatalogStore({ filename = getDefaultCatalogDbPath() } = {}) {
  if (filename !== ':memory:') {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
  }

  const db = new DatabaseSync(filename);
  db.exec(schemaSql);
  ensureSchemaMigrations(db);
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
