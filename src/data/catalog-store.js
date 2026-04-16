import path from 'node:path';
import { resolveClaudeConnectHomeSync } from '../lib/app-paths.js';

export function getDefaultCatalogDataPath(options = {}) {
  const pathModule = options.platform === 'win32' ? path.win32 : path.posix;
  return pathModule.join(resolveClaudeConnectHomeSync(options), 'storage', 'catalog.json');
}

export const getDefaultCatalogDbPath = getDefaultCatalogDataPath;
export const defaultCatalogDbPath = getDefaultCatalogDataPath();

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
    name: 'Kilo Code Models',
    vendor: 'Kilo AI',
    description: 'Gateway OpenAI-compatible de Kilo AI. La app descubre modelos gratis y pagos desde /models, y deja elegir modo anonimo solo en los gratuitos o API key para el resto.',
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
    id: 'ollama-cloud',
    name: 'Ollama Cloud Models',
    vendor: 'Ollama',
    description: 'Modelos de Ollama Cloud consultados directamente en ollama.com con OLLAMA_API_KEY. La app usa los modelos que devuelve tu cuenta desde /api/tags.',
    docsUrl: 'https://docs.ollama.com/cloud',
    docsVerifiedAt: '2026-04-05',
    baseUrl: 'https://ollama.com',
    defaultModelId: null,
    defaultAuthMethodId: 'token',
    defaultApiKeyEnvVar: 'OLLAMA_API_KEY',
    models: [],
    authMethods: [
      {
        id: 'token',
        name: 'Token',
        description: 'Conexion por OLLAMA_API_KEY contra ollama.com/api.',
        credentialKind: 'env_var',
        sortOrder: 1,
        isDefault: 1
      }
    ]
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    vendor: 'NVIDIA',
    description: 'Modelos NVIDIA NIM servidos por el endpoint OpenAI-compatible de NVIDIA API Catalog. Claude Code se conecta a traves del gateway local para mantener compatibilidad Anthropic, herramientas y vision cuando el modelo lo soporta.',
    docsUrl: 'https://docs.api.nvidia.com/nim/reference/moonshotai-kimi-k2-5',
    docsVerifiedAt: '2026-04-15',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModelId: null,
    defaultAuthMethodId: 'token',
    defaultApiKeyEnvVar: 'NVIDIA_API_KEY',
    models: [],
    authMethods: [
      {
        id: 'token',
        name: 'Token',
        description: 'Conexion por NVIDIA_API_KEY contra el endpoint OpenAI-compatible de NVIDIA API Catalog.',
        credentialKind: 'env_var',
        sortOrder: 1,
        isDefault: 1
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
    id: 's-kaiba',
    name: 'Seto Kaiba',
    vendor: 'Claude Connect',
    description: 'Router virtual de Claude Connect que usa conexiones gratuitas ya configuradas y rota automaticamente entre ellas cuando encuentra cuota o rate limit.',
    docsUrl: '',
    docsVerifiedAt: '2026-04-08',
    baseUrl: 'claude-connect://s-kaiba',
    defaultModelId: 's-kaiba',
    defaultAuthMethodId: 'anonymous',
    defaultApiKeyEnvVar: '',
    models: [
      {
        id: 's-kaiba',
        name: 'Seto Kaiba',
        category: 'Router Virtual',
        contextWindow: 'Auto',
        summary: 'Modelo virtual que prioriza conexiones gratuitas configuradas y hace failover local cuando un proveedor agota cuota o rate limit.',
        upstreamModelId: 's-kaiba',
        transportMode: 'gateway',
        apiStyle: 'router-free',
        apiBaseUrl: 'claude-connect://s-kaiba',
        apiPath: '/router/free',
        authEnvMode: 'auth_token',
        sortOrder: 1,
        isDefault: 1
      }
    ],
    authMethods: [
      {
        id: 'anonymous',
        name: 'Automatico',
        description: 'Usa el router local de Claude Connect y las conexiones gratuitas ya configuradas.',
        credentialKind: 'none',
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

export function createCatalogStore({ filename = getDefaultCatalogDataPath() } = {}) {
  const providers = seedProviders.map((provider) => structuredClone(provider));

  const findProvider = (providerId) => providers.find((provider) => provider.id === providerId) ?? null;
  const mapProvider = (provider) => ({
    id: provider.id,
    name: provider.name,
    vendor: provider.vendor,
    description: provider.description,
    docsUrl: provider.docsUrl,
    docsVerifiedAt: provider.docsVerifiedAt,
    baseUrl: provider.baseUrl,
    defaultModelId: provider.defaultModelId,
    defaultAuthMethodId: provider.defaultAuthMethodId,
    defaultApiKeyEnvVar: provider.defaultApiKeyEnvVar,
    modelCount: provider.models.length,
    authCount: provider.authMethods.length
  });
  const mapModel = (provider, model) => ({
    id: model.id,
    providerId: provider.id,
    name: model.name,
    category: model.category,
    contextWindow: model.contextWindow,
    summary: model.summary,
    upstreamModelId: model.upstreamModelId ?? model.id,
    transportMode: model.transportMode ?? 'gateway',
    apiStyle: model.apiStyle ?? 'openai-chat',
    apiBaseUrl: model.apiBaseUrl ?? null,
    apiPath: model.apiPath ?? null,
    authEnvMode: model.authEnvMode ?? 'auth_token',
    supportsVision: model.supportsVision !== false,
    supportsAnonymous: model.supportsAnonymous ?? false,
    isFreeTier: model.isFreeTier ?? false,
    sortOrder: Number(model.sortOrder ?? 0),
    isDefault: Boolean(model.isDefault)
  });
  const mapAuthMethod = (authMethod) => ({
    id: authMethod.id,
    name: authMethod.name,
    description: authMethod.description,
    credentialKind: authMethod.credentialKind,
    sortOrder: Number(authMethod.sortOrder ?? 0),
    isDefault: Boolean(authMethod.isDefault)
  });
  const mapOAuth = (provider) => provider.oauth
    ? {
        providerId: provider.id,
        deviceCodeUrl: provider.oauth.authorizeUrl,
        tokenUrl: provider.oauth.tokenUrl,
        browserAuthUrl: provider.oauth.callbackUrl,
        flowType: provider.oauth.accessType,
        scope: provider.oauth.scope ?? '',
        clientId: provider.oauth.clientId ?? '',
        appSecretId: provider.oauth.appSecretId ?? ''
      }
    : null;

  return {
    filename,
    close() {
      // Catalog data is generated from seeds, so there is no native handle to close.
    },
    getProviders() {
      return providers
        .map(mapProvider)
        .sort((left, right) => left.name.localeCompare(right.name));
    },
    getProviderById(providerId) {
      const provider = findProvider(providerId);
      return provider ? mapProvider(provider) : null;
    },
    getModelsByProviderId(providerId) {
      const provider = findProvider(providerId);

      if (!provider) {
        return [];
      }

      return provider.models
        .map((model) => mapModel(provider, model))
        .sort((left, right) => {
          if (left.isDefault !== right.isDefault) {
            return left.isDefault ? -1 : 1;
          }

          if (left.sortOrder !== right.sortOrder) {
            return left.sortOrder - right.sortOrder;
          }

          return left.name.localeCompare(right.name);
        });
    },
    getAuthMethodsByProviderId(providerId) {
      const provider = findProvider(providerId);

      if (!provider) {
        return [];
      }

      return provider.authMethods
        .map(mapAuthMethod)
        .sort((left, right) => {
          if (left.isDefault !== right.isDefault) {
            return left.isDefault ? -1 : 1;
          }

          if (left.sortOrder !== right.sortOrder) {
            return left.sortOrder - right.sortOrder;
          }

          return left.name.localeCompare(right.name);
        });
    },
    getOAuthConfigByProviderId(providerId) {
      const provider = findProvider(providerId);
      return provider ? mapOAuth(provider) : null;
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
