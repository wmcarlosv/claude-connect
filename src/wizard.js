import {
  activateClaudeProfile,
  getClaudeSwitchStatus,
  revertClaudeProfile
} from './lib/claude-settings.js';
import { getCatalogStore } from './data/catalog-store.js';
import { gatewayBaseUrl } from './gateway/constants.js';
import { getGatewayStatus } from './gateway/state.js';
import { restartGatewayInBackground, stopGateway } from './gateway/server.js';
import { runOAuthAuthorization, saveOAuthToken } from './lib/oauth.js';
import {
  buildProfile,
  deleteProfileFile,
  listProfiles,
  saveProfile,
  slugifyProfileName,
  updateProfileFile
} from './lib/profile.js';
import {
  deleteManagedTokenSecret,
  readManagedProviderTokenSecret,
  readManagedTokenSecret,
  saveManagedProviderTokenSecret
} from './lib/secrets.js';
import { fetchCloudflareWorkersAiModels, normalizeCloudflareAccountId } from './lib/cloudflare-workers-ai.js';
import { fetchDeepSeekModels } from './lib/deepseek.js';
import { fetchKiloModels } from './lib/kilo.js';
import { fetchNvidiaCodingModels } from './lib/nvidia.js';
import { fetchOpenRouterFreeModels } from './lib/openrouter.js';
import { fetchOllamaCloudModels } from './lib/ollama-cloud.js';
import { fetchOllamaModels, normalizeOllamaBaseUrl } from './lib/ollama.js';
import { isSKaibaSelectableProfile } from './lib/s-kaiba.js';
import {
  assertInteractiveTerminal,
  buildFrame,
  closeAppScreen,
  navigation,
  openAppScreen,
  promptText,
  renderScreen,
  selectFromList,
  waitForAnyKey
} from './lib/terminal.js';
import { colorize, colors, gradientizeLines, rgb } from './lib/theme.js';

function buildBrandWordmark() {
  const wordmark = [
    '  ██████╗██╗      █████╗ ██╗   ██╗██████╗ ███████╗',
    '  ██╔════╝██║     ██╔══██╗██║   ██║██╔══██╗██╔════╝',
    '  ██║     ██║     ███████║██║   ██║██║  ██║█████╗  ',
    '  ██║     ██║     ██╔══██║██║   ██║██║  ██║██╔══╝  ',
    '  ╚██████╗███████╗██║  ██║╚██████╔╝██████╔╝███████╗',
    '   ╚═════╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝',
    '                 C L A U D E   ·   C O N N E C T'
  ];

  return gradientizeLines(wordmark, [
    rgb(103, 232, 249),
    rgb(56, 189, 248),
    rgb(59, 130, 246),
    rgb(14, 165, 233)
  ]);
}

function isBack(value) {
  return value === navigation.BACK;
}

function isExit(value) {
  return value === navigation.EXIT;
}

function mainMenuItems() {
  return [
    {
      label: 'Nueva conexion',
      description: 'Configura un proveedor y genera un perfil local.',
      value: 'new'
    },
    {
      label: 'Activar en Claude',
      description: 'Aplica el perfil seleccionado sobre Claude Code.',
      value: 'activate'
    },
    {
      label: 'Gestionar conexiones',
      description: 'Editar o eliminar perfiles ya creados.',
      value: 'manage'
    },
    {
      label: 'Estado gateway',
      description: 'Muestra si el gateway local esta activo y que perfil expone.',
      value: 'gateway-status'
    },
    {
      label: 'Detener gateway',
      description: 'Apaga el gateway local sin revertir tu switch de Claude.',
      value: 'gateway-stop'
    },
    {
      label: 'Revertir Claude',
      description: 'Restaura la configuracion original de Claude Code.',
      value: 'revert'
    },
    {
      label: 'Estado Claude',
      description: 'Muestra si Claude Code esta usando un perfil activado.',
      value: 'status'
    },
    {
      label: 'Ver catalogo',
      description: 'Consulta proveedores, modelos y autenticacion desde el catalogo local.',
      value: 'catalog'
    },
    {
      label: 'Salir',
      description: 'Cierra la aplicacion.',
      value: 'exit'
    }
  ];
}

function providerItems(providers) {
  return providers.map((provider) => ({
    label: provider.name,
    description: `${provider.vendor} · ${provider.baseUrl}`,
    value: provider
  }));
}

function modelItems(models) {
  return models.map((model) => ({
    label: model.name,
    description: `${model.category} · ${model.contextWindow} · ${model.summary}`,
    value: model
  }));
}

function authItems(authMethods) {
  return authMethods.map((authMethod) => ({
    label: authMethod.name,
    description: authMethod.description,
    value: authMethod
  }));
}

function profileItems(profiles) {
  return profiles.map((profile) => ({
    label: profile.profileName,
    description: `${profile.provider.name} · ${profile.model.name} · ${profile.auth.method}`,
    value: profile
  }));
}

function sKaibaCandidateItems(profiles, selectedPaths) {
  return profiles.map((profile) => {
    const selected = selectedPaths.has(profile.filePath);

    return {
      label: `${selected ? '[x]' : '[ ]'} ${profile.profileName}`,
      description: `${profile.provider.name} · ${profile.model.name} · ${profile.auth.method}`,
      value: {
        kind: 'profile',
        profile
      }
    };
  });
}

async function attachProviderCredentialMetadata(profiles) {
  const providerSecrets = new Map();

  for (const profile of profiles) {
    if (profile.auth.method === 'oauth') {
      continue;
    }

    if (!providerSecrets.has(profile.provider.id)) {
      providerSecrets.set(profile.provider.id, await readManagedProviderTokenSecret(profile.provider.id));
    }
  }

  return profiles.map((profile) => ({
    ...profile,
    providerSecretRecord: providerSecrets.get(profile.provider.id) ?? null,
    providerCredentialConfigured: typeof providerSecrets.get(profile.provider.id)?.secret?.token === 'string'
      && providerSecrets.get(profile.provider.id).secret.token.trim().length > 0
  }));
}

function buildTokenDetailLines(profile) {
  if (profile.auth.method === 'oauth') {
    return [`Token file: ${profile.auth.oauth?.tokenFile ?? 'no encontrado'}`];
  }

  if (profile.auth.method === 'server') {
    return [
      `Base URL: ${profile.endpoint?.baseUrl ?? 'sin definir'}`,
      `Modelo upstream: ${profile.model?.upstreamModelId ?? profile.model?.id ?? 'sin definir'}`
    ];
  }

  if (profile.providerCredentialConfigured) {
    return [
      `Credencial compartida: ${profile.providerSecretRecord?.filePath ?? profile.auth.providerSecretFile ?? 'configurada'}`,
      `Fallback por entorno: ${profile.auth.envVar}`
    ];
  }

  if (profile.auth.secretFile) {
    return [
      'API key antigua detectada en este perfil',
      `Archivo: ${profile.auth.secretFile}`,
      `Fallback por entorno: ${profile.auth.envVar}`
    ];
  }

  return [`Sin API key guardada · fallback: ${profile.auth.envVar}`];
}

function profileActionItems(profile) {
  const items = [];

  if (profile.auth.method === 'token' || profile.auth.method === 'api_key') {
    items.push({
      label: 'Editar conexion',
      description: 'Guardar o actualizar la API key compartida del proveedor.',
      value: 'edit-token'
    });
  }

  items.push({
    label: 'Eliminar conexion',
    description: 'Borra solo el perfil. La API key compartida del proveedor se conserva.',
    value: 'delete'
  });

  return items;
}

function renderInfoScreen({ title, subtitle, lines, footer }) {
  renderScreen(
    buildFrame({
      eyebrow: 'CLAUDE CONNECT',
      title,
      subtitle,
      body: lines,
      footer: [colorize(footer, colors.dim, colors.muted)]
    })
  );
}

async function selectSKaibaConnections() {
  const profiles = await attachProviderCredentialMetadata(await listProfiles());
  const candidates = profiles
    .filter((profile) => isSKaibaSelectableProfile(profile))
    .sort((left, right) => left.profileName.localeCompare(right.profileName));

  if (candidates.length === 0) {
    renderInfoScreen({
      title: 'Sin conexiones compatibles',
      subtitle: 'Seto Kaiba necesita perfiles gratuitos que usen el gateway local de Claude Connect.',
      lines: [
        colorize('Crea primero perfiles free compatibles, por ejemplo OpenRouter free, Kilo free o modelos free equivalentes servidos por nuestro bridge.', colors.soft)
      ],
      footer: 'Presiona una tecla para volver'
    });

    const result = await waitForAnyKey();
    return result;
  }

  const selectedPaths = new Set();

  while (true) {
    const selectedNames = candidates
      .filter((profile) => selectedPaths.has(profile.filePath))
      .map((profile) => profile.profileName);
    const choice = await selectFromList({
      step: 3,
      totalSteps: 3,
      title: 'Conexiones para Seto Kaiba',
      subtitle: selectedPaths.size === 0
        ? 'Marca las conexiones gratuitas compatibles que quieres rotar. Enter alterna una seleccion.'
        : `Seleccionadas: ${selectedNames.join(', ')}`,
      items: [
        ...sKaibaCandidateItems(candidates, selectedPaths),
        {
          label: 'Continuar',
          description: selectedPaths.size === 0
            ? 'Selecciona al menos una conexion antes de continuar.'
            : 'Guardar Seto Kaiba con las conexiones marcadas.',
          value: {
            kind: 'done'
          }
        }
      ],
      allowBack: true,
      detailBuilder: (selected) => {
        if (selected.value.kind === 'done') {
          return selectedPaths.size === 0
            ? ['Debes seleccionar al menos una conexion compatible.']
            : ['Claude Connect usara solo las conexiones marcadas para hacer failover.'];
        }

        const profile = selected.value.profile;
        return [
          `Perfil: ${profile.profileName}`,
          `Proveedor: ${profile.provider.name}`,
          `Modelo: ${profile.model.name}`,
          `Auth: ${profile.auth.method}`,
          `Modo: ${profile.model.transportMode}/${profile.model.apiStyle}`,
          selectedPaths.has(profile.filePath)
            ? 'Estado: seleccionado'
            : 'Estado: disponible'
        ];
      }
    });

    if (isExit(choice) || isBack(choice)) {
      return choice;
    }

    if (choice.kind === 'done') {
      if (selectedPaths.size === 0) {
        continue;
      }

      return candidates.filter((profile) => selectedPaths.has(profile.filePath));
    }

    const filePath = choice.profile.filePath;

    if (selectedPaths.has(filePath)) {
      selectedPaths.delete(filePath);
    } else {
      selectedPaths.add(filePath);
    }
  }
}

function buildExternalConflictLines(conflicts) {
  if (!Array.isArray(conflicts) || conflicts.length === 0) {
    return [];
  }

  return [
    '',
    colorize('Variables externas detectadas', colors.bold, colors.warning),
    ...conflicts.map((conflict) => colorize(`${conflict.key}=${conflict.value}`, colors.warning)),
    colorize('Estas variables del sistema o de la terminal pueden pisar la configuracion activada.', colors.warning)
  ];
}

function renderWelcome() {
  renderScreen(
    buildFrame({
      eyebrow: 'CLAUDE CONNECT',
      title: 'Conecta Claude Code con otros modelos',
      subtitle: 'Flujo guiado, catalogo local y perfiles listos para reutilizar.',
      body: [
        ...buildBrandWordmark(),
        '',
        colorize('Experiencia inicial', colors.bold, colors.accentSoft),
        colorize('1. Elegir proveedor desde la base local', colors.soft),
        colorize('2. Elegir modelo y tipo de conexion', colors.soft),
        colorize('3. Si el proveedor soporta OAuth, se abre el login oficial', colors.soft),
        colorize('4. Guardar perfil y credenciales locales', colors.soft),
        '',
        colorize('Catalogo actual', colors.bold, colors.accentSoft),
        colorize('OpenCode Go, Zen, Kimi, DeepSeek, Z.AI, Ollama, NVIDIA NIM, OpenAI, Inception Labs, OpenRouter, Seto Kaiba y Qwen ya vienen en el catalogo local.', colors.soft),
        '',
        colorize('Seguridad', colors.bold, colors.accentSoft),
        colorize('El token OAuth se guarda localmente y el modo Token puede guardarse una sola vez por proveedor.', colors.soft)
      ],
      footer: [colorize('Presiona cualquier tecla para entrar', colors.dim, colors.muted)]
    })
  );
}

function renderSummary({ profile, filePath }) {
  const authSummary = profile.auth.method === 'oauth'
    ? `Auth: oauth con token en ${profile.auth.oauth.tokenFile}`
    : profile.auth.method === 'server'
      ? 'Auth: servidor Ollama sin API key administrada por Claude Connect'
      : `Auth: ${profile.auth.method} con fallback en ${profile.auth.envVar}`;
  const managedSecretSummary = profile.auth.method === 'server'
    ? colorize('Esta conexion usa solo la URL y el modelo descubiertos en el servidor Ollama.', colors.soft)
    : profile.auth.method !== 'oauth' && profile.auth.providerSecretFile
    ? colorize(`API key compartida del proveedor en: ${profile.auth.providerSecretFile}`, colors.soft)
    : profile.auth.method !== 'oauth' && profile.auth.secretFile
      ? colorize(`API key antigua detectada en: ${profile.auth.secretFile}`, colors.soft)
    : profile.auth.method !== 'oauth'
      ? colorize(`API key no guardada localmente. Si existe ${profile.auth.envVar}, tambien se usara.`, colors.soft)
      : null;
  const routerSummary = profile.provider.id === 's-kaiba' && Array.isArray(profile.router?.candidateProfileNames)
    ? [
        '',
        colorize('Conexiones seleccionadas para rotacion', colors.bold, colors.accentSoft),
        ...profile.router.candidateProfileNames.map((name) => colorize(name, colors.soft))
      ]
    : [];

  renderScreen(
    buildFrame({
      eyebrow: 'CLAUDE CONNECT',
      title: 'Perfil generado',
      subtitle: 'La configuracion quedo lista para futuras integraciones y automatizaciones.',
      body: [
        colorize('Resumen', colors.bold, colors.accentSoft),
        colorize(`Perfil: ${profile.profileName}`, colors.soft),
        colorize(`Proveedor: ${profile.provider.name}`, colors.soft),
        colorize(`Modelo: ${profile.model.name}`, colors.soft),
        colorize(`Base URL: ${profile.endpoint.baseUrl}`, colors.soft),
        colorize(authSummary, colors.soft),
        ...(managedSecretSummary ? [managedSecretSummary] : []),
        ...routerSummary,
        '',
        colorize('Archivo generado', colors.bold, colors.accentSoft),
        colorize(filePath, colors.soft),
        '',
        colorize('Variables sugeridas', colors.bold, colors.accentSoft),
        ...(profile.auth.method === 'oauth'
          ? [
              colorize(`export OPENAI_BASE_URL=${profile.endpoint.baseUrl}`, colors.soft),
              colorize(`export OPENAI_MODEL=${profile.model.id}`, colors.soft),
              colorize('El access token y refresh token ya quedaron guardados localmente.', colors.soft)
            ]
          : profile.auth.method === 'server'
            ? [
                colorize(`export OPENAI_BASE_URL=${profile.endpoint.baseUrl}`, colors.soft),
                colorize(`export OPENAI_MODEL=${profile.model.id}`, colors.soft),
                colorize('La conexion usa el servidor Ollama descubierto y se valida antes de guardar.', colors.soft)
              ]
            : [
                colorize(`Fallback opcional: export ${profile.auth.envVar}=<tu_token>`, colors.soft),
                colorize(`export OPENAI_BASE_URL=${profile.endpoint.baseUrl}`, colors.soft),
                colorize(`export OPENAI_MODEL=${profile.model.id}`, colors.soft),
                colorize('La API key puede guardarse una sola vez por proveedor en Claude Connect.', colors.soft)
              ])
      ],
      footer: [colorize('Presiona cualquier tecla para volver al menu', colors.dim, colors.muted)]
    })
  );
}

async function showCatalog(store) {
  const providers = store.getProviders();
  const provider = await selectFromList({
    step: 1,
    totalSteps: 1,
    title: 'Catalogo de proveedores',
    subtitle: 'Todo lo que ves aqui sale del catalogo local de Claude Connect.',
    items: providerItems(providers),
    detailBuilder: (selected) => [
      `Base URL: ${selected.value.baseUrl}`,
      `Modelos: ${selected.value.modelCount}`,
      `Autenticacion: ${selected.value.authCount}`,
      `Docs verificadas: ${selected.value.docsVerifiedAt}`
    ],
    footerHint: '↑/↓ mover · Enter ver detalle · Tab volver · Esc salir',
    allowBack: true
  });

  if (isBack(provider) || isExit(provider)) {
    return provider;
  }

  const catalog = store.getProviderCatalog(provider.id);
  let modelLines = catalog.models.map((model) => colorize(`${model.name} · ${model.summary}`, colors.soft));

  if (catalog.id === 'kilo-free') {
    try {
      const discovered = await fetchKiloModels();
      modelLines = discovered.models.length > 0
        ? discovered.models.map((model) => colorize(`${model.name} · ${model.summary}`, colors.soft))
        : [colorize('No se encontraron modelos utilizables en vivo para Kilo en este momento.', colors.warning)];
    } catch (error) {
      modelLines = [
        colorize('No se pudieron cargar los modelos de Kilo en vivo.', colors.warning),
        colorize(error instanceof Error ? error.message : String(error), colors.soft)
      ];
    }
  }

  if (catalog.id === 'openrouter') {
    try {
      const discovered = await fetchOpenRouterFreeModels();
      modelLines = discovered.models.length > 0
        ? discovered.models.map((model) => colorize(`${model.name} · ${model.summary}`, colors.soft))
        : [colorize('No se encontraron modelos free utilizables en vivo para OpenRouter en este momento.', colors.warning)];
    } catch (error) {
      modelLines = [
        colorize('No se pudieron cargar los modelos free de OpenRouter en vivo.', colors.warning),
        colorize('Se mantiene disponible el router openrouter/free del catalogo base.', colors.soft),
        colorize(error instanceof Error ? error.message : String(error), colors.soft)
      ];
    }
  }

  if (catalog.id === 'deepseek') {
    try {
      const discovered = await fetchDeepSeekModels();
      modelLines = discovered.models.length > 0
        ? discovered.models.map((model) => colorize(`${model.name} · ${model.summary}`, colors.soft))
        : [colorize('DeepSeek /models respondio, pero no devolvio modelos utilizables.', colors.warning)];
    } catch (error) {
      modelLines = [
        colorize('No se pudieron cargar los modelos actuales de DeepSeek en vivo.', colors.warning),
        colorize('Se mantiene disponible el catalogo local como respaldo.', colors.soft),
        colorize(error instanceof Error ? error.message : String(error), colors.soft)
      ];
    }
  }

  if (catalog.id === 'ollama-cloud') {
    const providerSecret = await readManagedProviderTokenSecret(catalog.id);
    const token = typeof providerSecret?.secret?.token === 'string' ? providerSecret.secret.token.trim() : '';

    if (token.length === 0) {
      modelLines = [
        colorize('Guarda primero OLLAMA_API_KEY en una conexion de Ollama Cloud para listar modelos en vivo.', colors.warning)
      ];
    } else {
      try {
        const discovered = await fetchOllamaCloudModels({ apiKey: token });
        modelLines = discovered.models.length > 0
          ? discovered.models.map((model) => colorize(`${model.name} · ${model.summary}`, colors.soft))
          : [colorize('La cuenta no devolvio modelos utilizables en ollama.com/api/tags.', colors.warning)];
      } catch (error) {
        modelLines = [
          colorize('No se pudieron cargar los modelos de Ollama Cloud en vivo.', colors.warning),
          colorize(error instanceof Error ? error.message : String(error), colors.soft)
        ];
      }
    }
  }

  if (catalog.id === 'nvidia') {
    const providerSecret = await readManagedProviderTokenSecret(catalog.id);
    const token = typeof providerSecret?.secret?.token === 'string' ? providerSecret.secret.token.trim() : '';

    if (token.length === 0) {
      modelLines = [
        colorize('Guarda primero NVIDIA_API_KEY en una conexion de NVIDIA NIM para listar modelos de coding y Downloadable en vivo.', colors.warning)
      ];
    } else {
      try {
        const discovered = await fetchNvidiaCodingModels({ apiKey: token });
        modelLines = discovered.models.length > 0
          ? discovered.models.map((model) => colorize(`${model.name} · ${model.summary}`, colors.soft))
          : [colorize('NVIDIA /models respondio, pero no hubo modelos de coding o Downloadable filtrables.', colors.warning)];
      } catch (error) {
        modelLines = [
          colorize('No se pudieron cargar los modelos de NVIDIA NIM en vivo.', colors.warning),
          colorize(error instanceof Error ? error.message : String(error), colors.soft)
        ];
      }
    }
  }

  renderInfoScreen({
    title: 'Detalle del proveedor',
    subtitle: catalog.description,
    lines: [
      colorize(`Proveedor: ${catalog.name}`, colors.bold, colors.text),
      colorize(`Vendor: ${catalog.vendor}`, colors.soft),
      colorize(`Base URL: ${catalog.baseUrl}`, colors.soft),
      colorize(`Auth: ${catalog.authMethods.map((item) => item.name).join(', ')}`, colors.soft),
      '',
      colorize('Modelos', colors.bold, colors.accentSoft),
      ...modelLines
    ],
    footer: 'Presiona una tecla para volver'
  });

  return await waitForAnyKey();
}

async function showClaudeStatus() {
  const status = await getClaudeSwitchStatus();
  const gateway = await getGatewayStatus();
  const lines = [
    colorize(`Activo: ${status.active ? 'si' : 'no'}`, colors.bold, colors.text),
    colorize(`Model actual: ${status.currentModel ?? 'sin definir'}`, colors.soft),
    colorize(`ANTHROPIC_BASE_URL: ${status.anthropicBaseUrl ?? 'sin definir'}`, colors.soft),
    colorize(`Modo de conexion: ${status.connectionMode ?? 'sin definir'}`, colors.soft),
    colorize(`Perfil activo: ${status.profileName ?? 'ninguno'}`, colors.soft),
    colorize(`Snapshot original: ${status.hasOriginalSnapshot ? 'disponible' : 'no'}`, colors.soft),
    colorize(`Snapshot de sesion: ${status.hasOriginalAccountSnapshot ? 'disponible' : 'no'}`, colors.soft),
    colorize(`Snapshot de credenciales: ${status.hasOriginalCredentialsSnapshot ? 'disponible' : 'no'}`, colors.soft),
    colorize(`Sesion oauth actual: ${status.hasOauthAccount ? 'si' : 'no'}`, colors.soft),
    colorize(`Credenciales claude.ai activas: ${status.hasClaudeAiOauthCredentials ? 'si' : 'no'}`, colors.soft),
    '',
    colorize('Gateway local', colors.bold, colors.accentSoft),
    colorize(`Activo: ${gateway.active ? 'si' : 'no'}`, colors.soft),
    colorize(`Base URL: ${gateway.baseUrl}`, colors.soft),
    colorize(`PID: ${gateway.pid ?? 'ninguno'}`, colors.soft),
    colorize(`Perfil expuesto: ${gateway.profileName ?? 'ninguno'}`, colors.soft)
  ].concat(buildExternalConflictLines(status.externalEnvConflicts));

  renderInfoScreen({
    title: 'Estado de Claude Code',
    subtitle: 'Resumen del switch reversible y del gateway local.',
    lines,
    footer: 'Presiona una tecla para volver'
  });

  return await waitForAnyKey();
}

async function showGatewayStatus() {
  const status = await getGatewayStatus();

  renderInfoScreen({
    title: status.active ? 'Gateway activo' : 'Gateway inactivo',
    subtitle: status.active
      ? 'Claude Code ya tiene un bridge local compatible con Anthropic.'
      : 'Todavia no hay un gateway local respondiendo.',
    lines: [
      colorize(`Base URL: ${status.baseUrl}`, colors.soft),
      colorize(`PID: ${status.pid ?? 'ninguno'}`, colors.soft),
      colorize(`Perfil activo: ${status.profileName ?? 'ninguno'}`, colors.soft),
      colorize(`Auth: ${status.authMethod ?? 'ninguno'}`, colors.soft),
      colorize(`Upstream: ${status.upstreamBaseUrl ?? 'sin resolver'}`, colors.soft),
      colorize(`Log: ${status.logPath}`, colors.soft)
    ],
    footer: 'Presiona una tecla para volver'
  });

  return await waitForAnyKey();
}

async function activateClaudeFromSavedProfile() {
  const profiles = await attachProviderCredentialMetadata(await listProfiles());

  if (profiles.length === 0) {
    renderInfoScreen({
      title: 'Sin perfiles',
      subtitle: 'Todavia no hay perfiles guardados para activar.',
      lines: [
        colorize('Primero crea una conexion nueva y luego vuelve a esta opcion.', colors.soft)
      ],
      footer: 'Presiona una tecla para volver'
    });
    return await waitForAnyKey();
  }

  const profile = await selectFromList({
    step: 1,
    totalSteps: 1,
    title: 'Activa un perfil en Claude Code',
    subtitle: 'Esto conserva tu settings.json actual y permite revertirlo.',
      items: profileItems(profiles),
      allowBack: true,
      detailBuilder: (selected) => [
        `Proveedor: ${selected.value.provider.name}`,
        `Modelo: ${selected.value.model.id}`,
        `Auth: ${selected.value.auth.method}`,
        ...buildTokenDetailLines(selected.value)
      ]
    });

  if (isBack(profile) || isExit(profile)) {
    return profile;
  }

  let result;

  try {
    result = await activateClaudeProfile({ profile });
  } catch (error) {
    renderInfoScreen({
      title: 'No se pudo activar Claude',
      subtitle: 'Claude Connect no pudo aplicar la conexion en Claude Code.',
      lines: [
        colorize(error instanceof Error ? error.message : String(error), colors.warning)
      ],
      footer: 'Presiona una tecla para volver'
    });
    return await waitForAnyKey();
  }

  const gateway = result.connectionMode === 'gateway'
    ? await restartGatewayInBackground()
    : await stopGateway();
  const status = await getClaudeSwitchStatus();

  renderInfoScreen({
    title: 'Claude Code actualizado',
    subtitle: result.connectionMode === 'gateway'
      ? 'El switch quedo aplicado y el gateway local ya fue iniciado.'
      : 'El switch quedo aplicado usando una conexion Anthropic directa.',
    lines: [
      colorize(`Perfil activo: ${profile.profileName}`, colors.soft),
      colorize(`Modelo configurado: ${profile.model.id}`, colors.soft),
      colorize(`Modo: ${result.connectionMode}`, colors.soft),
      colorize(
        result.connectionMode === 'gateway'
          ? `Gateway configurado: ${result.gatewayBaseUrl}`
          : `Endpoint directo: ${result.connectionBaseUrl}`,
        colors.soft
      ),
      ...(result.connectionMode === 'gateway'
        ? [colorize(`Gateway activo en PID: ${gateway.pid ?? 'sin PID'}`, colors.soft)]
        : gateway.stopped
          ? [colorize(`Gateway anterior detenido: ${gateway.pid ?? 'sin PID'}`, colors.soft)]
          : []),
      colorize(`Settings: ${result.claudeSettingsPath}`, colors.soft),
      colorize(`Sesion Claude: ${result.claudeAccountPath}`, colors.soft),
      colorize(`Credenciales Claude: ${result.claudeCredentialsPath}`, colors.soft),
      colorize(`Estado del switch: ${result.stateFilePath}`, colors.soft),
      '',
      colorize('Listo para usar', colors.bold, colors.accentSoft),
      colorize(
        result.connectionMode === 'gateway'
          ? 'Claude Code ya puede hablar con el gateway local en esa URL.'
          : 'Claude Code ya puede hablar directamente con la API Anthropic del proveedor.',
        colors.soft
      ),
      colorize('La sesion original de claude.ai y sus credenciales quedaron guardadas para restaurarlas con Revertir Claude.', colors.soft),
      ...buildExternalConflictLines(status.externalEnvConflicts)
    ],
    footer: 'Presiona una tecla para volver'
  });

  return await waitForAnyKey();
}

async function editTokenProfile(profile) {
  const providerSecretRecord = await readManagedProviderTokenSecret(profile.provider.id);
  const apiKey = await promptText({
    step: 1,
    totalSteps: 1,
    title: 'Guardar API key del proveedor',
    subtitle: `Proveedor: ${profile.provider.name}. Esta API key se compartira con todos los modelos de este proveedor.`,
    label: 'API key',
    placeholder: providerSecretRecord?.secret?.token
      ? 'Deja vacio para conservar la API key compartida'
      : 'Pega aqui tu API key',
    secret: true,
    allowBack: true
  });

  if (isBack(apiKey) || isExit(apiKey)) {
    return apiKey;
  }

  const nextProfile = structuredClone(profile);
  nextProfile.auth.method = profile.auth.method === 'api_key' ? 'token' : profile.auth.method;
  nextProfile.auth.envVar = nextProfile.auth.envVar || `${nextProfile.provider.id.toUpperCase()}_API_KEY`;
  nextProfile.updatedAt = new Date().toISOString();
  let providerSecretFile = providerSecretRecord?.filePath ?? nextProfile.auth.providerSecretFile ?? '';

  if (apiKey.trim().length > 0) {
    providerSecretFile = await saveManagedProviderTokenSecret({
      providerId: nextProfile.provider.id,
      providerName: nextProfile.provider.name,
      envVar: nextProfile.auth.envVar,
      token: apiKey.trim()
    });
  } else if (!providerSecretFile && typeof nextProfile.auth.secretFile === 'string') {
    const legacySecret = await readManagedTokenSecret(nextProfile.auth.secretFile);
    const legacyToken = typeof legacySecret?.token === 'string' ? legacySecret.token.trim() : '';

    if (legacyToken.length > 0) {
      providerSecretFile = await saveManagedProviderTokenSecret({
        providerId: nextProfile.provider.id,
        providerName: nextProfile.provider.name,
        envVar: nextProfile.auth.envVar,
        token: legacyToken
      });
    }
  }

  if (providerSecretFile) {
    nextProfile.auth.providerSecretFile = providerSecretFile;
  }

  if (typeof nextProfile.auth.secretFile === 'string') {
    await deleteManagedTokenSecret(nextProfile.auth.secretFile);
    delete nextProfile.auth.secretFile;
  }

  await updateProfileFile(profile.filePath, nextProfile);

  renderInfoScreen({
    title: 'Conexion actualizada',
    subtitle: 'La credencial del proveedor ya quedo actualizada.',
    lines: [
      colorize(`Perfil: ${nextProfile.profileName}`, colors.soft),
      colorize(`Proveedor: ${nextProfile.provider.name}`, colors.soft),
      colorize(`Fallback por entorno: ${nextProfile.auth.envVar}`, colors.soft),
      colorize(
        nextProfile.auth.providerSecretFile
          ? `API key compartida guardada en: ${nextProfile.auth.providerSecretFile}`
          : 'No se guardo una API key administrada localmente.',
        colors.soft
      )
    ],
    footer: 'Presiona una tecla para volver'
  });

  return await waitForAnyKey();
}

async function deleteSavedProfile(profile) {
  await deleteProfileFile(profile.filePath);

  if (typeof profile.auth?.secretFile === 'string') {
    await deleteManagedTokenSecret(profile.auth.secretFile);
  }

  if (typeof profile.auth?.oauth?.tokenFile === 'string') {
    await deleteManagedTokenSecret(profile.auth.oauth.tokenFile);
  }

  renderInfoScreen({
    title: 'Conexion eliminada',
    subtitle: 'El perfil ya no aparece en Claude Connect.',
    lines: [
      colorize(`Perfil: ${profile.profileName}`, colors.soft),
      colorize(`Archivo eliminado: ${profile.filePath}`, colors.soft),
      ...(profile.auth?.method === 'token' || profile.auth?.method === 'api_key'
        ? [colorize('La API key compartida del proveedor se conserva para otros modelos.', colors.soft)]
        : [])
    ],
    footer: 'Presiona una tecla para volver'
  });

  return await waitForAnyKey();
}

async function manageSavedProfiles() {
  const profiles = await attachProviderCredentialMetadata(await listProfiles());

  if (profiles.length === 0) {
    renderInfoScreen({
      title: 'Sin conexiones',
      subtitle: 'Todavia no hay perfiles guardados para editar o eliminar.',
      lines: [
        colorize('Primero crea una conexion nueva.', colors.soft)
      ],
      footer: 'Presiona una tecla para volver'
    });
    return await waitForAnyKey();
  }

  while (true) {
    const profile = await selectFromList({
      step: 1,
      totalSteps: 2,
      title: 'Gestionar conexiones',
      subtitle: 'Selecciona la conexion que quieres modificar.',
      items: profileItems(await attachProviderCredentialMetadata(await listProfiles())),
      allowBack: true,
      detailBuilder: (selected) => [
        `Proveedor: ${selected.value.provider.name}`,
        `Modelo: ${selected.value.model.name}`,
        `Auth: ${selected.value.auth.method}`,
        ...buildTokenDetailLines(selected.value)
      ]
    });

    if (isBack(profile) || isExit(profile)) {
      return profile;
    }

    const action = await selectFromList({
      step: 2,
      totalSteps: 2,
      title: 'Accion sobre la conexion',
      subtitle: `Perfil: ${profile.profileName}.`,
      items: profileActionItems(profile),
      allowBack: true,
      detailBuilder: (selected) => [selected.description]
    });

    if (isExit(action)) {
      return action;
    }

    if (isBack(action) || action === 'back') {
      continue;
    }

    if (action === 'edit-token') {
      const result = await editTokenProfile(profile);

      if (isExit(result)) {
        return result;
      }
    }

    if (action === 'delete') {
      const result = await deleteSavedProfile(profile);

      if (isExit(result)) {
        return result;
      }
    }
  }
}

async function stopGatewayFromMenu() {
  const result = await stopGateway();

  renderInfoScreen({
    title: result.stopped ? 'Gateway detenido' : 'Gateway ya estaba apagado',
    subtitle: 'El switch de Claude no fue tocado. Solo se cerro el bridge local.',
    lines: [
      colorize(`PID: ${result.pid ?? 'ninguno'}`, colors.soft),
      colorize(`Log: ${result.logPath}`, colors.soft),
      colorize(`Base URL: ${gatewayBaseUrl}`, colors.soft)
    ],
    footer: 'Presiona una tecla para volver'
  });

  return await waitForAnyKey();
}

async function revertClaudeSwitch() {
  const result = await revertClaudeProfile();

  renderInfoScreen({
    title: result.reverted ? 'Claude restaurado' : 'Nada que revertir',
    subtitle: result.reverted
      ? 'La configuracion original de Claude Code fue restaurada.'
      : 'No habia un switch activo administrado por Claude Connect.',
    lines: [
      colorize(`Settings: ${result.claudeSettingsPath}`, colors.soft),
      colorize(`Sesion Claude: ${result.claudeAccountPath}`, colors.soft),
      colorize(`Credenciales Claude: ${result.claudeCredentialsPath}`, colors.soft),
      colorize(`Estado del switch: ${result.stateFilePath}`, colors.soft)
    ],
    footer: 'Presiona una tecla para volver'
  });

  return await waitForAnyKey();
}

async function createNewConnection(store) {
  const providers = store.getProviders();

  while (true) {
    const provider = await selectFromList({
      step: 1,
      totalSteps: 3,
      title: 'Selecciona el proveedor',
      subtitle: 'El proveedor usa su base_url definida en el catalogo local.',
      items: providerItems(providers),
      allowBack: true,
      detailBuilder: (selected) => [
        `Vendor: ${selected.value.vendor}`,
        `Base URL: ${selected.value.baseUrl}`,
        `Modelos: ${selected.value.modelCount}`,
        `Docs verificadas: ${selected.value.docsVerifiedAt}`
      ]
    });

    if (isBack(provider) || isExit(provider)) {
      return provider;
    }

    const catalog = store.getProviderCatalog(provider.id);
    let workingCatalog = catalog;

    if (catalog.id === 'kilo-free') {
      let discovered;

      try {
        discovered = await fetchKiloModels();
      } catch (error) {
        renderInfoScreen({
          title: 'No se pudo cargar Kilo',
          subtitle: 'Claude Connect intento consultar /models para descubrir los modelos disponibles de Kilo.',
          lines: [
            colorize(`Base URL: ${catalog.baseUrl}`, colors.soft),
            colorize(error instanceof Error ? error.message : String(error), colors.warning)
          ],
          footer: 'Presiona una tecla para volver'
        });

        const failedKiloResult = await waitForAnyKey();

        if (isExit(failedKiloResult)) {
          return failedKiloResult;
        }

        continue;
      }

      if (discovered.models.length === 0) {
        renderInfoScreen({
          title: 'Sin modelos en Kilo',
          subtitle: 'El endpoint /models respondio, pero no devolvio modelos utilizables.',
          lines: [
            colorize(`Base URL: ${catalog.baseUrl}`, colors.soft),
            colorize('Revisa la disponibilidad actual del gateway y vuelve a intentarlo.', colors.soft)
          ],
          footer: 'Presiona una tecla para volver'
        });

        const emptyKiloResult = await waitForAnyKey();

        if (isExit(emptyKiloResult)) {
          return emptyKiloResult;
        }

        continue;
      }

      workingCatalog = {
        ...catalog,
        models: discovered.models,
        modelCount: discovered.models.length
      };
    }

    if (catalog.id === 'openrouter') {
      try {
        const discovered = await fetchOpenRouterFreeModels();

        if (discovered.models.length > 0) {
          workingCatalog = {
            ...catalog,
            models: discovered.models,
            modelCount: discovered.models.length
          };
        }
      } catch (_error) {
        workingCatalog = catalog;
      }
    }

    if (catalog.id === 'deepseek') {
      try {
        const discovered = await fetchDeepSeekModels();

        if (discovered.models.length > 0) {
          workingCatalog = {
            ...catalog,
            models: discovered.models,
            modelCount: discovered.models.length
          };
        }
      } catch (_error) {
        workingCatalog = catalog;
      }
    }

    if (catalog.id === 's-kaiba') {
      const model = workingCatalog.models[0];
      const authMethod = workingCatalog.authMethods[0];
      const selectedProfiles = await selectSKaibaConnections();

      if (isExit(selectedProfiles) || isBack(selectedProfiles)) {
        if (isExit(selectedProfiles)) {
          return selectedProfiles;
        }

        continue;
      }

      const profileName = slugifyProfileName(`${provider.id}-${model.id}-${authMethod.id}`);
      const profile = buildProfile({
        provider: workingCatalog,
        model,
        authMethod,
        profileName,
        apiKeyEnvVar: workingCatalog.defaultApiKeyEnvVar
      });

      profile.router = {
        strategy: 'selected-free-gateway-failover',
        candidateProfilePaths: selectedProfiles.map((item) => item.filePath),
        candidateProfileNames: selectedProfiles.map((item) => item.profileName)
      };

      const filePath = await saveProfile(profile);
      renderSummary({ profile, filePath });
      return await waitForAnyKey();
    }

    if (catalog.id === 'ollama') {
      const ollamaBaseUrlInput = await promptText({
        step: 2,
        totalSteps: 4,
        title: 'URL del servidor Ollama',
        subtitle: 'Puede ser local o remoto, por ejemplo http://127.0.0.1:11434 o https://mi-vps:11434.',
        label: 'Base URL',
        defaultValue: catalog.baseUrl,
        placeholder: catalog.baseUrl,
        allowBack: true
      });

      if (isExit(ollamaBaseUrlInput)) {
        return ollamaBaseUrlInput;
      }

      if (isBack(ollamaBaseUrlInput)) {
        continue;
      }

      let normalizedOllamaBaseUrl;

      try {
        normalizedOllamaBaseUrl = normalizeOllamaBaseUrl(ollamaBaseUrlInput);
      } catch (error) {
        renderInfoScreen({
          title: 'URL invalida',
          subtitle: 'La direccion del servidor Ollama no se pudo normalizar.',
          lines: [
            colorize(error instanceof Error ? error.message : String(error), colors.warning)
          ],
          footer: 'Presiona una tecla para volver'
        });

        const invalidUrlResult = await waitForAnyKey();

        if (isExit(invalidUrlResult)) {
          return invalidUrlResult;
        }

        continue;
      }

      let discovered;

      try {
        discovered = await fetchOllamaModels({ baseUrl: normalizedOllamaBaseUrl });
      } catch (error) {
        renderInfoScreen({
          title: 'No se pudo conectar a Ollama',
          subtitle: 'Claude Connect intento consultar /api/tags para descubrir modelos.',
          lines: [
            colorize(`Base URL: ${normalizedOllamaBaseUrl}`, colors.soft),
            colorize(error instanceof Error ? error.message : String(error), colors.warning)
          ],
          footer: 'Presiona una tecla para volver'
        });

        const failedConnectionResult = await waitForAnyKey();

        if (isExit(failedConnectionResult)) {
          return failedConnectionResult;
        }

        continue;
      }

      if (discovered.models.length === 0) {
        renderInfoScreen({
          title: 'Sin modelos en Ollama',
          subtitle: 'La conexion esta viva, pero /api/tags no devolvio modelos disponibles.',
          lines: [
            colorize(`Base URL: ${normalizedOllamaBaseUrl}`, colors.soft),
            colorize('Carga al menos un modelo en ese servidor y vuelve a intentarlo.', colors.soft)
          ],
          footer: 'Presiona una tecla para volver'
        });

        const emptyModelsResult = await waitForAnyKey();

        if (isExit(emptyModelsResult)) {
          return emptyModelsResult;
        }

        continue;
      }

      const discoveredModel = await selectFromList({
        step: 3,
        totalSteps: 4,
        title: 'Selecciona el modelo de Ollama',
        subtitle: `Servidor: ${normalizedOllamaBaseUrl}.`,
        items: modelItems(discovered.models),
        allowBack: true,
        detailBuilder: (selected) => [
          `Modelo: ${selected.value.id}`,
          `Categoria: ${selected.value.category}`,
          `Contexto: ${selected.value.contextWindow}`,
          selected.value.summary
        ]
      });

      if (isExit(discoveredModel)) {
        return discoveredModel;
      }

      if (isBack(discoveredModel)) {
        continue;
      }

      const authMethod = catalog.authMethods[0];
      const profileName = slugifyProfileName(`${provider.id}-${discoveredModel.id}-${authMethod.id}`);
      const customProvider = {
        ...catalog,
        baseUrl: normalizedOllamaBaseUrl
      };
      const profile = buildProfile({
        provider: customProvider,
        model: {
          ...discoveredModel,
          apiBaseUrl: normalizedOllamaBaseUrl,
          apiPath: '/api/chat',
          transportMode: 'gateway',
          apiStyle: 'ollama-chat',
          authEnvMode: 'auth_token'
        },
        authMethod,
        profileName,
        apiKeyEnvVar: catalog.defaultApiKeyEnvVar
      });

      const filePath = await saveProfile(profile);
      renderSummary({ profile, filePath });
      return await waitForAnyKey();
    }

    if (catalog.id === 'ollama-cloud') {
      const authMethod = catalog.authMethods[0];
      const existingProviderSecret = await readManagedProviderTokenSecret(catalog.id);
      const apiKeyValue = await promptText({
        step: 2,
        totalSteps: 4,
        title: 'API key de Ollama Cloud',
        subtitle: 'Se usara para consultar ollama.com/api/tags y listar modelos cloud.',
        label: 'OLLAMA_API_KEY',
        placeholder: existingProviderSecret?.secret?.token
          ? 'Deja vacio para conservar la API key compartida'
          : 'Pega aqui tu OLLAMA_API_KEY',
        secret: true,
        allowBack: true
      });

      if (isExit(apiKeyValue)) {
        return apiKeyValue;
      }

      if (isBack(apiKeyValue)) {
        continue;
      }

      let providerSecretFile = existingProviderSecret?.filePath ?? '';
      let tokenForDiscovery = existingProviderSecret?.secret?.token ?? '';

      if (apiKeyValue.trim().length > 0) {
        tokenForDiscovery = apiKeyValue.trim();
        providerSecretFile = await saveManagedProviderTokenSecret({
          providerId: catalog.id,
          providerName: catalog.name,
          envVar: catalog.defaultApiKeyEnvVar,
          token: tokenForDiscovery
        });
      }

      if (tokenForDiscovery.trim().length === 0) {
        renderInfoScreen({
          title: 'Falta OLLAMA_API_KEY',
          subtitle: 'Ollama Cloud requiere una API key para consultar modelos en ollama.com/api.',
          lines: [
            colorize('Guarda una OLLAMA_API_KEY y vuelve a intentarlo.', colors.warning)
          ],
          footer: 'Presiona una tecla para volver'
        });

        const missingKeyResult = await waitForAnyKey();

        if (isExit(missingKeyResult)) {
          return missingKeyResult;
        }

        continue;
      }

      let discovered;

      try {
        discovered = await fetchOllamaCloudModels({
          apiKey: tokenForDiscovery
        });
      } catch (error) {
        renderInfoScreen({
          title: 'No se pudo cargar Ollama Cloud',
          subtitle: 'Claude Connect intento consultar ollama.com/api/tags para cargar los modelos de tu cuenta.',
          lines: [
            colorize(`Base URL: ${catalog.baseUrl}/api`, colors.soft),
            colorize(error instanceof Error ? error.message : String(error), colors.warning)
          ],
          footer: 'Presiona una tecla para volver'
        });

        const failedCloudResult = await waitForAnyKey();

        if (isExit(failedCloudResult)) {
          return failedCloudResult;
        }

        continue;
      }

      if (discovered.models.length === 0) {
        renderInfoScreen({
          title: 'Sin modelos cloud en Ollama',
          subtitle: 'La API respondio, pero no devolvio modelos utilizables para esta cuenta.',
          lines: [
            colorize('Ollama no expone un flag oficial de modelos free en /api/tags.', colors.soft),
            colorize('Claude Connect usa los modelos que realmente devuelve tu cuenta en ollama.com/api/tags.', colors.soft)
          ],
          footer: 'Presiona una tecla para volver'
        });

        const emptyCloudResult = await waitForAnyKey();

        if (isExit(emptyCloudResult)) {
          return emptyCloudResult;
        }

        continue;
      }

      const discoveredModel = await selectFromList({
        step: 3,
        totalSteps: 4,
        title: 'Selecciona el modelo cloud',
        subtitle: 'Fuente: ollama.com/api/tags.',
        items: modelItems(discovered.models),
        allowBack: true,
        detailBuilder: (selected) => [
          `Modelo: ${selected.value.id}`,
          `Categoria: ${selected.value.category}`,
          `Contexto: ${selected.value.contextWindow}`,
          selected.value.summary
        ]
      });

      if (isExit(discoveredModel)) {
        return discoveredModel;
      }

      if (isBack(discoveredModel)) {
        continue;
      }

      const profileName = slugifyProfileName(`${provider.id}-${discoveredModel.id}-${authMethod.id}`);
      const profile = buildProfile({
        provider: catalog,
        model: discoveredModel,
        authMethod,
        profileName,
        apiKeyEnvVar: catalog.defaultApiKeyEnvVar
      });

      if (providerSecretFile) {
        profile.auth.providerSecretFile = providerSecretFile;
      }

      const filePath = await saveProfile(profile);
      renderSummary({ profile, filePath });
      return await waitForAnyKey();
    }

    if (catalog.id === 'nvidia') {
      const authMethod = catalog.authMethods[0];
      const existingProviderSecret = await readManagedProviderTokenSecret(catalog.id);
      const apiKeyValue = await promptText({
        step: 2,
        totalSteps: 4,
        title: 'API key de NVIDIA NIM',
        subtitle: 'Se usara para consultar /v1/models y listar modelos de coding o marcados como Downloadable.',
        label: 'NVIDIA_API_KEY',
        placeholder: existingProviderSecret?.secret?.token
          ? 'Deja vacio para conservar la API key compartida'
          : 'Pega aqui tu NVIDIA_API_KEY',
        secret: true,
        allowBack: true
      });

      if (isExit(apiKeyValue)) {
        return apiKeyValue;
      }

      if (isBack(apiKeyValue)) {
        continue;
      }

      let providerSecretFile = existingProviderSecret?.filePath ?? '';
      let tokenForDiscovery = existingProviderSecret?.secret?.token ?? '';

      if (apiKeyValue.trim().length > 0) {
        tokenForDiscovery = apiKeyValue.trim();
        providerSecretFile = await saveManagedProviderTokenSecret({
          providerId: catalog.id,
          providerName: catalog.name,
          envVar: catalog.defaultApiKeyEnvVar,
          token: tokenForDiscovery
        });
      }

      if (tokenForDiscovery.trim().length === 0) {
        renderInfoScreen({
          title: 'Falta NVIDIA_API_KEY',
          subtitle: 'NVIDIA NIM requiere una API key para consultar /v1/models.',
          lines: [
            colorize('Guarda una NVIDIA_API_KEY y vuelve a intentarlo.', colors.warning)
          ],
          footer: 'Presiona una tecla para volver'
        });

        const missingKeyResult = await waitForAnyKey();

        if (isExit(missingKeyResult)) {
          return missingKeyResult;
        }

        continue;
      }

      let discovered;

      try {
        discovered = await fetchNvidiaCodingModels({
          apiKey: tokenForDiscovery
        });
      } catch (error) {
        renderInfoScreen({
          title: 'No se pudo cargar NVIDIA NIM',
          subtitle: 'Claude Connect intento consultar https://integrate.api.nvidia.com/v1/models.',
          lines: [
            colorize(`Base URL: ${catalog.baseUrl}`, colors.soft),
            colorize(error instanceof Error ? error.message : String(error), colors.warning)
          ],
          footer: 'Presiona una tecla para volver'
        });

        const failedNvidiaResult = await waitForAnyKey();

        if (isExit(failedNvidiaResult)) {
          return failedNvidiaResult;
        }

        continue;
      }

      if (discovered.models.length === 0) {
        renderInfoScreen({
          title: 'Sin modelos elegibles en NVIDIA',
          subtitle: 'La API respondio, pero no devolvio modelos de coding ni marcados como Downloadable.',
          lines: [
            colorize('Claude Connect filtra por senales como Downloadable, coder, code, gemma, devstral, kimi, deepseek, minimax, nemotron, qwen, glm y gpt-oss.', colors.soft),
            colorize('Si NVIDIA cambia los metadatos, actualiza el filtro o selecciona otro proveedor.', colors.soft)
          ],
          footer: 'Presiona una tecla para volver'
        });

        const emptyNvidiaResult = await waitForAnyKey();

        if (isExit(emptyNvidiaResult)) {
          return emptyNvidiaResult;
        }

        continue;
      }

      const discoveredModel = await selectFromList({
        step: 3,
        totalSteps: 4,
        title: 'Selecciona el modelo NVIDIA NIM',
        subtitle: 'Fuente: https://integrate.api.nvidia.com/v1/models · filtro: coding + Downloadable.',
        items: modelItems(discovered.models),
        allowBack: true,
        detailBuilder: (selected) => [
          `Modelo: ${selected.value.upstreamModelId}`,
          `Categoria: ${selected.value.category}`,
          `Contexto: ${selected.value.contextWindow}`,
          `Vision: ${selected.value.supportsVision ? 'si' : 'no'}`,
          selected.value.summary
        ]
      });

      if (isExit(discoveredModel)) {
        return discoveredModel;
      }

      if (isBack(discoveredModel)) {
        continue;
      }

      const profileName = slugifyProfileName(`${provider.id}-${discoveredModel.id}-${authMethod.id}`);
      const profile = buildProfile({
        provider: catalog,
        model: discoveredModel,
        authMethod,
        profileName,
        apiKeyEnvVar: catalog.defaultApiKeyEnvVar
      });

      if (providerSecretFile) {
        profile.auth.providerSecretFile = providerSecretFile;
      }

      const filePath = await saveProfile(profile);
      renderSummary({ profile, filePath });
      return await waitForAnyKey();
    }

    if (catalog.id === 'cloudflare-workers-ai') {
      const authMethod = catalog.authMethods[0];
      const existingProviderSecret = await readManagedProviderTokenSecret(catalog.id);
      const accountIdInput = await promptText({
        step: 2,
        totalSteps: 5,
        title: 'Account ID de Cloudflare',
        subtitle: 'Se usara para construir el endpoint OpenAI-compatible de Workers AI.',
        label: 'Account ID',
        defaultValue: existingProviderSecret?.secret?.accountId ?? '',
        placeholder: '32 caracteres hexadecimales',
        allowBack: true
      });

      if (isExit(accountIdInput)) {
        return accountIdInput;
      }

      if (isBack(accountIdInput)) {
        continue;
      }

      let accountId;

      try {
        accountId = normalizeCloudflareAccountId(accountIdInput);
      } catch (error) {
        renderInfoScreen({
          title: 'Account ID invalido',
          subtitle: 'Cloudflare Workers AI requiere el Account ID de tu cuenta.',
          lines: [
            colorize(error instanceof Error ? error.message : String(error), colors.warning)
          ],
          footer: 'Presiona una tecla para volver'
        });

        const invalidAccountResult = await waitForAnyKey();

        if (isExit(invalidAccountResult)) {
          return invalidAccountResult;
        }

        continue;
      }

      const apiKeyValue = await promptText({
        step: 3,
        totalSteps: 5,
        title: 'API token de Cloudflare Workers AI',
        subtitle: 'Debe tener permisos Workers AI Read o Workers AI Edit.',
        label: 'CLOUDFLARE_API_TOKEN',
        placeholder: existingProviderSecret?.secret?.token
          ? 'Deja vacio para conservar el token compartido'
          : 'Pega aqui tu CLOUDFLARE_API_TOKEN',
        secret: true,
        allowBack: true
      });

      if (isExit(apiKeyValue)) {
        return apiKeyValue;
      }

      if (isBack(apiKeyValue)) {
        continue;
      }

      let providerSecretFile = existingProviderSecret?.filePath ?? '';
      let tokenForDiscovery = existingProviderSecret?.secret?.token ?? '';

      if (apiKeyValue.trim().length > 0) {
        tokenForDiscovery = apiKeyValue.trim();
      }

      if (tokenForDiscovery.trim().length === 0) {
        renderInfoScreen({
          title: 'Falta CLOUDFLARE_API_TOKEN',
          subtitle: 'Cloudflare Workers AI requiere un API token para consultar modelos.',
          lines: [
            colorize('Guarda un token con permiso Workers AI Read o Edit y vuelve a intentarlo.', colors.warning)
          ],
          footer: 'Presiona una tecla para volver'
        });

        const missingTokenResult = await waitForAnyKey();

        if (isExit(missingTokenResult)) {
          return missingTokenResult;
        }

        continue;
      }

      providerSecretFile = await saveManagedProviderTokenSecret({
        providerId: catalog.id,
        providerName: catalog.name,
        envVar: catalog.defaultApiKeyEnvVar,
        token: tokenForDiscovery.trim(),
        accountId
      });

      let discovered;

      try {
        discovered = await fetchCloudflareWorkersAiModels({
          accountId,
          apiKey: tokenForDiscovery
        });
      } catch (error) {
        renderInfoScreen({
          title: 'No se pudo cargar Workers AI',
          subtitle: 'Claude Connect intento consultar /ai/models/search para descubrir modelos Text Generation.',
          lines: [
            colorize(`Account ID: ${accountId}`, colors.soft),
            colorize(error instanceof Error ? error.message : String(error), colors.warning)
          ],
          footer: 'Presiona una tecla para volver'
        });

        const failedCloudflareResult = await waitForAnyKey();

        if (isExit(failedCloudflareResult)) {
          return failedCloudflareResult;
        }

        continue;
      }

      if (discovered.models.length === 0) {
        renderInfoScreen({
          title: 'Sin modelos Text Generation',
          subtitle: 'La API respondio, pero no devolvio modelos utilizables para Claude Code.',
          lines: [
            colorize('Claude Connect filtra modelos de tipo Text Generation para usarlos via chat/completions.', colors.soft),
            colorize('Revisa permisos Workers AI o disponibilidad de modelos en tu cuenta.', colors.soft)
          ],
          footer: 'Presiona una tecla para volver'
        });

        const emptyCloudflareResult = await waitForAnyKey();

        if (isExit(emptyCloudflareResult)) {
          return emptyCloudflareResult;
        }

        continue;
      }

      const discoveredModel = await selectFromList({
        step: 4,
        totalSteps: 5,
        title: 'Selecciona el modelo Workers AI',
        subtitle: 'Fuente: Cloudflare /ai/models/search · filtro: Text Generation.',
        items: modelItems(discovered.models),
        allowBack: true,
        detailBuilder: (selected) => [
          `Modelo: ${selected.value.upstreamModelId}`,
          `Categoria: ${selected.value.category}`,
          `Contexto: ${selected.value.contextWindow}`,
          `Vision: ${selected.value.supportsVision ? 'si' : 'no'}`,
          selected.value.summary
        ]
      });

      if (isExit(discoveredModel)) {
        return discoveredModel;
      }

      if (isBack(discoveredModel)) {
        continue;
      }

      const profileName = slugifyProfileName(`${provider.id}-${discoveredModel.id}-${authMethod.id}`);
      const profile = buildProfile({
        provider: {
          ...catalog,
          baseUrl: discovered.baseUrl
        },
        model: discoveredModel,
        authMethod,
        profileName,
        apiKeyEnvVar: catalog.defaultApiKeyEnvVar
      });

      profile.cloudflare = {
        accountId
      };

      if (providerSecretFile) {
        profile.auth.providerSecretFile = providerSecretFile;
      }

      const filePath = await saveProfile(profile);
      renderSummary({ profile, filePath });
      return await waitForAnyKey();
    }

    const totalSteps = workingCatalog.models.length > 1 ? 3 : 2;
    let model = workingCatalog.models[0];

    if (workingCatalog.models.length > 1) {
      model = await selectFromList({
        step: 2,
        totalSteps,
        title: 'Selecciona el modelo',
        subtitle: `Proveedor: ${workingCatalog.name}.`,
        items: modelItems(workingCatalog.models),
        allowBack: true,
        detailBuilder: (selected) => [
          `Modelo: ${selected.value.id}`,
          `Categoria: ${selected.value.category}`,
          `Contexto: ${selected.value.contextWindow}`,
          selected.value.summary
        ]
      });

      if (isExit(model)) {
        return model;
      }

      if (isBack(model)) {
        continue;
      }
    }

    while (true) {
      const availableAuthMethods = workingCatalog.id === 'kilo-free' && model?.supportsAnonymous === false
        ? workingCatalog.authMethods.filter((item) => item.id === 'token')
        : workingCatalog.authMethods;

      const authMethod = await selectFromList({
        step: totalSteps,
        totalSteps,
        title: 'Tipo de conexion',
        subtitle: workingCatalog.id === 'kilo-free' && model?.supportsAnonymous === false
          ? `${workingCatalog.name} usara ${model.name}. Este modelo requiere KILO_API_KEY.`
          : `${workingCatalog.name} usara el modelo ${model.name}.`,
        items: authItems(availableAuthMethods),
        allowBack: true,
        detailBuilder: (selected) => [
          `Metodo: ${selected.value.name}`,
          selected.value.description,
          selected.value.id === 'oauth' && workingCatalog.oauth
            ? `Se abrira: ${workingCatalog.oauth.browserAuthUrl}?user_code=...&client=qwen-code`
            : `Base URL: ${workingCatalog.baseUrl}`
        ]
      });

      if (isExit(authMethod)) {
        return authMethod;
      }

      if (isBack(authMethod)) {
        break;
      }

      const profileName = slugifyProfileName(`${provider.id}-${model.id}-${authMethod.id}`);
      const apiKeyEnvVar = workingCatalog.defaultApiKeyEnvVar;
      let providerSecretFile = '';
      let oauthSession;

      if (authMethod.id === 'token') {
        const existingProviderSecret = await readManagedProviderTokenSecret(workingCatalog.id);
        const apiKeyValue = await promptText({
          step: totalSteps,
          totalSteps,
          title: 'API key del proveedor',
          subtitle: `Modelo: ${model.name}. Esta API key se compartira con todos los modelos de ${workingCatalog.name}.`,
          label: 'API key',
          placeholder: existingProviderSecret?.secret?.token
            ? 'Deja vacio para conservar la API key compartida'
            : 'Pega aqui tu API key o deja vacio',
          secret: true,
          allowBack: true
        });

        if (isExit(apiKeyValue)) {
          return apiKeyValue;
        }

        if (isBack(apiKeyValue)) {
          continue;
        }

        if (apiKeyValue.trim().length > 0) {
          providerSecretFile = await saveManagedProviderTokenSecret({
            providerId: workingCatalog.id,
            providerName: workingCatalog.name,
            envVar: apiKeyEnvVar,
            token: apiKeyValue.trim()
          });
        } else if (existingProviderSecret?.filePath) {
          providerSecretFile = existingProviderSecret.filePath;
        }
      }

      if (authMethod.id === 'oauth') {
        const renderOAuthStatus = ({ title, subtitle, lines }) => {
          renderInfoScreen({
            title,
            subtitle,
            lines: lines.map((line) => colorize(line, colors.soft)),
            footer: 'Completa el flujo en el navegador o vuelve a la terminal'
          });
        };

        const oauthResult = await runOAuthAuthorization({
          providerName: catalog.name,
          oauthConfig: workingCatalog.oauth,
          statusRenderer: renderOAuthStatus,
          waitUntilReady: async () => await waitForAnyKey()
        });

        if (isExit(oauthResult)) {
          return oauthResult;
        }

        const { authUrl, tokenPayload } = oauthResult;

        const tokenFile = await saveOAuthToken({
          profileName,
          providerId: workingCatalog.id,
          tokenPayload
        });

        renderInfoScreen({
          title: 'OAuth guardado',
          subtitle: 'La consola ya recibio la aprobacion de Qwen y guardo el token.',
          lines: [
            colorize(`URL usada: ${authUrl}`, colors.soft),
            colorize(`Token guardado en: ${tokenFile}`, colors.soft),
            colorize('Ahora se generara el perfil local.', colors.soft)
          ],
          footer: 'Presiona una tecla para continuar'
        });

        const oauthContinue = await waitForAnyKey();

        if (isExit(oauthContinue)) {
          return oauthContinue;
        }

        oauthSession = {
          clientId: catalog.oauth.clientId,
          clientId: workingCatalog.oauth.clientId,
          authUrl,
          deviceCodeUrl: workingCatalog.oauth.deviceCodeUrl,
          tokenUrl: workingCatalog.oauth.tokenUrl,
          tokenFile,
          apiBaseUrl: 'https://portal.qwen.ai/v1'
        };
      }

      const profile = buildProfile({
        provider: workingCatalog,
        model,
        authMethod,
        profileName,
        apiKeyEnvVar,
        oauthSession
      });

      if (providerSecretFile) {
        profile.auth.providerSecretFile = providerSecretFile;
      }

      const filePath = await saveProfile(profile);
      renderSummary({ profile, filePath });
      return await waitForAnyKey();
    }
  }
}

export async function runWizard() {
  assertInteractiveTerminal();
  openAppScreen();

  try {
    const store = getCatalogStore();

    renderWelcome();
    const welcomeAction = await waitForAnyKey();

    if (isExit(welcomeAction)) {
      return;
    }

    while (true) {
      const action = await selectFromList({
        step: 1,
        totalSteps: 1,
        title: 'Menu principal',
        subtitle: 'Empieza una configuracion nueva o revisa el catalogo disponible.',
        items: mainMenuItems(),
        detailBuilder: (selected) => [selected.description]
      });

      if (isExit(action) || action === 'exit') {
        return;
      }

      if (action === 'catalog') {
        const result = await showCatalog(store);

        if (isExit(result)) {
          return;
        }
      }

      if (action === 'new') {
        const result = await createNewConnection(store);

        if (isExit(result)) {
          return;
        }
      }

      if (action === 'status') {
        const result = await showClaudeStatus();

        if (isExit(result)) {
          return;
        }
      }

      if (action === 'activate') {
        const result = await activateClaudeFromSavedProfile();

        if (isExit(result)) {
          return;
        }
      }

      if (action === 'manage') {
        const result = await manageSavedProfiles();

        if (isExit(result)) {
          return;
        }
      }

      if (action === 'gateway-status') {
        const result = await showGatewayStatus();

        if (isExit(result)) {
          return;
        }
      }

      if (action === 'gateway-stop') {
        const result = await stopGatewayFromMenu();

        if (isExit(result)) {
          return;
        }
      }

      if (action === 'revert') {
        const result = await revertClaudeSwitch();

        if (isExit(result)) {
          return;
        }
      }
    }
  } finally {
    closeAppScreen();
  }
}
