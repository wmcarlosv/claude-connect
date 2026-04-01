import {
  activateClaudeProfile,
  getClaudeSwitchStatus,
  revertClaudeProfile
} from './lib/claude-settings.js';
import { getCatalogStore } from './data/catalog-store.js';
import { gatewayBaseUrl } from './gateway/constants.js';
import { getGatewayStatus } from './gateway/state.js';
import { startGatewayInBackground, stopGateway } from './gateway/server.js';
import { runOAuthAuthorization, saveOAuthToken } from './lib/oauth.js';
import {
  getIsolatedClaudeCommand,
  prepareIsolatedClaudeRuntime,
  supportsIsolatedClaudeRuntime
} from './lib/isolated-claude.js';
import {
  buildProfile,
  deleteProfileFile,
  listProfiles,
  saveProfile,
  slugifyProfileName,
  updateProfileFile
} from './lib/profile.js';
import { deleteManagedTokenSecret, saveManagedTokenSecret } from './lib/secrets.js';
import {
  assertInteractiveTerminal,
  buildFrame,
  closeAppScreen,
  openAppScreen,
  promptText,
  renderScreen,
  selectFromList,
  waitForAnyKey
} from './lib/terminal.js';
import { colorize, colors } from './lib/theme.js';

function mainMenuItems() {
  return [
    {
      label: 'Nueva conexion',
      description: 'Configura un proveedor y genera un perfil local.',
      value: 'new'
    },
    {
      label: 'Activar en Claude',
      description: 'Aplica el perfil o prepara un lanzador aislado segun el proveedor.',
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
      description: 'Consulta proveedores, modelos y autenticacion desde SQLite.',
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

function profileActionItems(profile) {
  const items = [];

  if (profile.auth.method === 'token' || profile.auth.method === 'api_key') {
    items.push({
      label: 'Editar conexion',
      description: 'Guardar o actualizar la API key localmente.',
      value: 'edit-token'
    });
  }

  items.push({
    label: 'Eliminar conexion',
    description: 'Borra el perfil y sus secretos administrados por Claude Connect.',
    value: 'delete'
  });
  items.push({
    label: 'Volver',
    description: 'Regresa al menu principal.',
    value: 'back'
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

function renderWelcome() {
  renderScreen(
    buildFrame({
      eyebrow: 'CLAUDE CONNECT',
      title: 'Conecta Claude Code con otros modelos',
      subtitle: 'Flujo guiado, catalogo SQLite y perfiles locales listos para reutilizar.',
      body: [
        colorize('Experiencia inicial', colors.bold, colors.accentSoft),
        colorize('1. Elegir proveedor desde la base local', colors.soft),
        colorize('2. Elegir modelo y tipo de conexion', colors.soft),
        colorize('3. Si el proveedor soporta OAuth, se abre el login oficial', colors.soft),
        colorize('4. Guardar perfil y credenciales locales', colors.soft),
        '',
        colorize('Catalogo actual', colors.bold, colors.accentSoft),
        colorize('Kimi, DeepSeek y Qwen ya vienen almacenados en SQLite.', colors.soft),
        '',
        colorize('Seguridad', colors.bold, colors.accentSoft),
        colorize('El token OAuth se guarda localmente y el modo Token usa una variable de entorno.', colors.soft)
      ],
      footer: [colorize('Presiona cualquier tecla para entrar', colors.dim, colors.muted)]
    })
  );
}

function renderSummary({ profile, filePath }) {
  const authSummary = profile.auth.method === 'oauth'
    ? `Auth: oauth con token en ${profile.auth.oauth.tokenFile}`
    : `Auth: ${profile.auth.method} con fallback en ${profile.auth.envVar}`;
  const managedSecretSummary = profile.auth.method !== 'oauth' && profile.auth.secretFile
    ? colorize(`API key administrada en: ${profile.auth.secretFile}`, colors.soft)
    : profile.auth.method !== 'oauth'
      ? colorize(`API key no guardada localmente. Si existe ${profile.auth.envVar}, tambien se usara.`, colors.soft)
      : null;

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
          : [
              colorize(`Fallback opcional: export ${profile.auth.envVar}=<tu_token>`, colors.soft),
              colorize(`export OPENAI_BASE_URL=${profile.endpoint.baseUrl}`, colors.soft),
              colorize(`export OPENAI_MODEL=${profile.model.id}`, colors.soft),
              colorize('Tambien puedes guardar la API key directamente en Claude Connect.', colors.soft)
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
    subtitle: 'Todo lo que ves aqui sale directamente de SQLite.',
    items: providerItems(providers),
    detailBuilder: (selected) => [
      `Base URL: ${selected.value.baseUrl}`,
      `Modelos: ${selected.value.modelCount}`,
      `Autenticacion: ${selected.value.authCount}`,
      `Docs verificadas: ${selected.value.docsVerifiedAt}`
    ],
    footerHint: '↑/↓ mover · Enter ver detalle · Esc volver'
  });

  const catalog = store.getProviderCatalog(provider.id);
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
      ...catalog.models.map((model) => colorize(`${model.name} · ${model.summary}`, colors.soft))
    ],
    footer: 'Presiona una tecla para volver'
  });

  await waitForAnyKey();
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
    '',
    colorize('Gateway local', colors.bold, colors.accentSoft),
    colorize(`Activo: ${gateway.active ? 'si' : 'no'}`, colors.soft),
    colorize(`Base URL: ${gateway.baseUrl}`, colors.soft),
    colorize(`PID: ${gateway.pid ?? 'ninguno'}`, colors.soft),
    colorize(`Perfil expuesto: ${gateway.profileName ?? 'ninguno'}`, colors.soft)
  ];

  renderInfoScreen({
    title: 'Estado de Claude Code',
    subtitle: 'Resumen del switch reversible y del gateway local.',
    lines,
    footer: 'Presiona una tecla para volver'
  });

  await waitForAnyKey();
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

  await waitForAnyKey();
}

async function activateClaudeFromSavedProfile() {
  const profiles = await listProfiles();

  if (profiles.length === 0) {
    renderInfoScreen({
      title: 'Sin perfiles',
      subtitle: 'Todavia no hay perfiles guardados para activar.',
      lines: [
        colorize('Primero crea una conexion nueva y luego vuelve a esta opcion.', colors.soft)
      ],
      footer: 'Presiona una tecla para volver'
    });
    await waitForAnyKey();
    return;
  }

  const profile = await selectFromList({
    step: 1,
    totalSteps: 1,
    title: 'Activa un perfil en Claude Code',
    subtitle: 'Esto conserva tu settings.json actual y permite revertirlo.',
    items: profileItems(profiles),
    detailBuilder: (selected) => [
      `Proveedor: ${selected.value.provider.name}`,
      `Modelo: ${selected.value.model.id}`,
      `Auth: ${selected.value.auth.method}`,
      selected.value.auth.method === 'oauth'
        ? `Token file: ${selected.value.auth.oauth?.tokenFile ?? 'no encontrado'}`
        : `${selected.value.auth.secretFile ? 'API key guardada' : 'sin API key guardada'} · fallback: ${selected.value.auth.envVar}`
    ]
  });

  if (supportsIsolatedClaudeRuntime(profile)) {
    const revertResult = await revertClaudeProfile();
    const runtime = await prepareIsolatedClaudeRuntime({ profile });

    renderInfoScreen({
      title: 'Launcher aislado listo',
      subtitle: 'Tu Claude normal queda intacto y Kimi corre en un runtime separado.',
      lines: [
        colorize(`Perfil: ${profile.profileName}`, colors.soft),
        colorize(`Modelo: ${profile.model.id}`, colors.soft),
        colorize(`Endpoint: ${runtime.connectionBaseUrl}`, colors.soft),
        colorize(`Runtime: ${runtime.runtimeHome}`, colors.soft),
        colorize(`Settings aislado: ${runtime.claudeSettingsPath}`, colors.soft),
        colorize(`Comando recomendado: ${getIsolatedClaudeCommand(profile)}`, colors.soft),
        colorize(`Fallback universal: claude-connect launch-profile ${profile.profileName}`, colors.soft),
        '',
        colorize(
          revertResult.reverted
            ? 'Claude global fue restaurado para evitar el conflicto con claude.ai.'
            : 'Claude global no fue modificado.',
          colors.soft
        )
      ],
      footer: 'Presiona una tecla para volver'
    });

    await waitForAnyKey();
    return;
  }

  const result = await activateClaudeProfile({ profile });
  const gateway = result.connectionMode === 'gateway'
    ? await startGatewayInBackground()
    : null;

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
      ...(gateway ? [colorize(`Gateway activo en PID: ${gateway.pid ?? 'sin PID'}`, colors.soft)] : []),
      colorize(`Settings: ${result.claudeSettingsPath}`, colors.soft),
      colorize(`Estado del switch: ${result.stateFilePath}`, colors.soft),
      '',
      colorize('Listo para usar', colors.bold, colors.accentSoft),
      colorize(
        result.connectionMode === 'gateway'
          ? 'Claude Code ya puede hablar con el gateway local en esa URL.'
          : 'Claude Code ya puede hablar directamente con la API Anthropic del proveedor.',
        colors.soft
      )
    ],
    footer: 'Presiona una tecla para volver'
  });

  await waitForAnyKey();
}

async function editTokenProfile(profile) {
  const apiKey = await promptText({
    step: 1,
    totalSteps: 1,
    title: 'Guardar API key',
    subtitle: `Perfil: ${profile.profileName}. Deja vacio para conservar la API key ya guardada.`,
    label: 'API key',
    placeholder: profile.auth.secretFile ? 'Deja vacio para conservar la API key guardada' : 'Pega aqui tu API key',
    secret: true
  });

  const nextProfile = structuredClone(profile);
  nextProfile.auth.method = profile.auth.method === 'api_key' ? 'token' : profile.auth.method;
  nextProfile.auth.envVar = nextProfile.auth.envVar || `${nextProfile.provider.id.toUpperCase()}_API_KEY`;
  nextProfile.updatedAt = new Date().toISOString();

  if (apiKey.trim().length > 0) {
    nextProfile.auth.secretFile = await saveManagedTokenSecret({
      profileName: nextProfile.profileName,
      providerId: nextProfile.provider.id,
      modelId: nextProfile.model.id,
      envVar: nextProfile.auth.envVar,
      token: apiKey.trim()
    });
  }

  await updateProfileFile(profile.filePath, nextProfile);

  renderInfoScreen({
    title: 'Conexion actualizada',
    subtitle: 'El perfil ya quedo editado.',
    lines: [
      colorize(`Perfil: ${nextProfile.profileName}`, colors.soft),
      colorize(`Fallback por entorno: ${nextProfile.auth.envVar}`, colors.soft),
      colorize(
        nextProfile.auth.secretFile
          ? `API key guardada en: ${nextProfile.auth.secretFile}`
          : 'No se guardo una API key administrada localmente.',
        colors.soft
      )
    ],
    footer: 'Presiona una tecla para volver'
  });

  await waitForAnyKey();
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
      colorize(`Archivo eliminado: ${profile.filePath}`, colors.soft)
    ],
    footer: 'Presiona una tecla para volver'
  });

  await waitForAnyKey();
}

async function manageSavedProfiles() {
  const profiles = await listProfiles();

  if (profiles.length === 0) {
    renderInfoScreen({
      title: 'Sin conexiones',
      subtitle: 'Todavia no hay perfiles guardados para editar o eliminar.',
      lines: [
        colorize('Primero crea una conexion nueva.', colors.soft)
      ],
      footer: 'Presiona una tecla para volver'
    });
    await waitForAnyKey();
    return;
  }

  const profile = await selectFromList({
    step: 1,
    totalSteps: 2,
    title: 'Gestionar conexiones',
    subtitle: 'Selecciona la conexion que quieres modificar.',
    items: profileItems(profiles),
    detailBuilder: (selected) => [
      `Proveedor: ${selected.value.provider.name}`,
      `Modelo: ${selected.value.model.name}`,
      `Auth: ${selected.value.auth.method}`,
      selected.value.auth.method === 'oauth'
        ? `Token file: ${selected.value.auth.oauth?.tokenFile ?? 'no encontrado'}`
        : `${selected.value.auth.secretFile ? 'API key guardada' : 'sin API key guardada'} · fallback: ${selected.value.auth.envVar}`
    ]
  });

  const action = await selectFromList({
    step: 2,
    totalSteps: 2,
    title: 'Accion sobre la conexion',
    subtitle: `Perfil: ${profile.profileName}.`,
    items: profileActionItems(profile),
    detailBuilder: (selected) => [selected.description]
  });

  if (action === 'edit-token') {
    await editTokenProfile(profile);
  }

  if (action === 'delete') {
    await deleteSavedProfile(profile);
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

  await waitForAnyKey();
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
      colorize(`Estado del switch: ${result.stateFilePath}`, colors.soft)
    ],
    footer: 'Presiona una tecla para volver'
  });

  await waitForAnyKey();
}

async function createNewConnection(store) {
  const providers = store.getProviders();
  const provider = await selectFromList({
    step: 1,
    totalSteps: 3,
    title: 'Selecciona el proveedor',
    subtitle: 'El proveedor guarda su base_url directamente en SQLite.',
    items: providerItems(providers),
    detailBuilder: (selected) => [
      `Vendor: ${selected.value.vendor}`,
      `Base URL: ${selected.value.baseUrl}`,
      `Modelos: ${selected.value.modelCount}`,
      `Docs verificadas: ${selected.value.docsVerifiedAt}`
    ]
  });

  const catalog = store.getProviderCatalog(provider.id);
  const totalSteps = catalog.models.length > 1 ? 3 : 2;
  let model = catalog.models[0];

  let authMethod = catalog.authMethods[0];
  let oauthSession;

  if (catalog.models.length > 1) {
    model = await selectFromList({
      step: 2,
      totalSteps,
      title: 'Selecciona el modelo',
      subtitle: `Proveedor: ${catalog.name}.`,
      items: modelItems(catalog.models),
      detailBuilder: (selected) => [
        `Modelo: ${selected.value.id}`,
        `Categoria: ${selected.value.category}`,
        `Contexto: ${selected.value.contextWindow}`,
        selected.value.summary
      ]
    });
  }

  authMethod = await selectFromList({
    step: totalSteps,
    totalSteps,
    title: 'Tipo de conexion',
    subtitle: `${catalog.name} usara el modelo ${model.name}.`,
    items: authItems(catalog.authMethods),
    detailBuilder: (selected) => [
      `Metodo: ${selected.value.name}`,
      selected.value.description,
      selected.value.id === 'oauth' && catalog.oauth
        ? `Se abrira: ${catalog.oauth.browserAuthUrl}?user_code=...&client=qwen-code`
        : `Base URL: ${catalog.baseUrl}`
    ]
  });

  const profileName = slugifyProfileName(`${provider.id}-${model.id}-${authMethod.id}`);
  const apiKeyEnvVar = catalog.defaultApiKeyEnvVar;
  let managedSecretFile = '';

  if (authMethod.id === 'token') {
    const apiKeyValue = await promptText({
      step: totalSteps,
      totalSteps,
      title: 'API key del proveedor',
      subtitle: `Modelo: ${model.name}. Puedes guardarla ahora o hacerlo luego en Gestionar conexiones.`,
      label: 'API key',
      placeholder: 'Pega aqui tu API key o deja vacio',
      secret: true
    });

    if (apiKeyValue.trim().length > 0) {
      managedSecretFile = await saveManagedTokenSecret({
        profileName,
        providerId: catalog.id,
        modelId: model.id,
        envVar: apiKeyEnvVar,
        token: apiKeyValue.trim()
      });
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

    const { authUrl, tokenPayload } = await runOAuthAuthorization({
      providerName: catalog.name,
      oauthConfig: catalog.oauth,
      statusRenderer: renderOAuthStatus,
      waitUntilReady: async () => await waitForAnyKey()
    });

    const tokenFile = await saveOAuthToken({
      profileName,
      providerId: catalog.id,
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
    await waitForAnyKey();

    oauthSession = {
      clientId: catalog.oauth.clientId,
      authUrl,
      deviceCodeUrl: catalog.oauth.deviceCodeUrl,
      tokenUrl: catalog.oauth.tokenUrl,
      tokenFile,
      apiBaseUrl: 'https://portal.qwen.ai/v1'
    };
  }

  const profile = buildProfile({
    provider: catalog,
    model,
    authMethod,
    profileName,
    apiKeyEnvVar,
    oauthSession
  });

  if (managedSecretFile) {
    profile.auth.secretFile = managedSecretFile;
  }

  const filePath = await saveProfile(profile);
  renderSummary({ profile, filePath });
  await waitForAnyKey();
}

export async function runWizard() {
  assertInteractiveTerminal();
  openAppScreen();

  try {
    const store = getCatalogStore();

    renderWelcome();
    await waitForAnyKey();

    while (true) {
      const action = await selectFromList({
        step: 1,
        totalSteps: 1,
        title: 'Menu principal',
        subtitle: 'Empieza una configuracion nueva o revisa el catalogo disponible.',
        items: mainMenuItems(),
        detailBuilder: (selected) => [selected.description]
      });

      if (action === 'exit') {
        return;
      }

      if (action === 'catalog') {
        await showCatalog(store);
      }

      if (action === 'new') {
        await createNewConnection(store);
      }

      if (action === 'status') {
        await showClaudeStatus();
      }

      if (action === 'activate') {
        await activateClaudeFromSavedProfile();
      }

      if (action === 'manage') {
        await manageSavedProfiles();
      }

      if (action === 'gateway-status') {
        await showGatewayStatus();
      }

      if (action === 'gateway-stop') {
        await stopGatewayFromMenu();
      }

      if (action === 'revert') {
        await revertClaudeSwitch();
      }
    }
  } finally {
    closeAppScreen();
  }
}
