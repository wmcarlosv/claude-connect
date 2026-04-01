import { getCatalogStore } from './data/catalog-store.js';
import { gatewayBaseUrl } from './gateway/constants.js';
import { getGatewayStatus } from './gateway/state.js';
import { serveGateway, startGatewayInBackground, stopGateway } from './gateway/server.js';
import { launchIsolatedClaudeProfile, supportsIsolatedClaudeRuntime } from './lib/isolated-claude.js';
import { listProfiles } from './lib/profile.js';
import { runWizard } from './wizard.js';

function printGatewayStatus(status) {
  const lines = [
    `active=${status.active ? 'yes' : 'no'}`,
    `base_url=${status.baseUrl}`,
    `pid=${status.pid ?? 'none'}`,
    `profile=${status.profileName ?? 'none'}`,
    `auth=${status.authMethod ?? 'none'}`,
    `upstream=${status.upstreamBaseUrl ?? 'none'}`,
    `log=${status.logPath}`
  ];

  process.stdout.write(`${lines.join('\n')}\n`);
}

async function runGatewayCommand(args) {
  const action = args[0] ?? 'status';

  if (action === 'serve') {
    await serveGateway();
    return;
  }

  if (action === 'start') {
    const status = await startGatewayInBackground();
    process.stdout.write(`Gateway listo en ${gatewayBaseUrl} (pid ${status.pid})\n`);
    return;
  }

  if (action === 'stop') {
    const result = await stopGateway();
    process.stdout.write(
      result.stopped
        ? `Gateway detenido (pid ${result.pid})\n`
        : 'No habia un gateway en ejecucion.\n'
    );
    return;
  }

  if (action === 'status') {
    printGatewayStatus(await getGatewayStatus());
    return;
  }

  throw new Error(`Comando de gateway no soportado: ${action}`);
}

async function resolveProfile(selectorType, selectorValue) {
  const profiles = await listProfiles();

  if (profiles.length === 0) {
    throw new Error('No hay perfiles guardados. Primero crea una conexion desde el menu principal.');
  }

  const profile = selectorType === 'provider'
    ? profiles.find((entry) => entry.provider.id === selectorValue)
    : profiles.find((entry) => entry.profileName === selectorValue);

  if (!profile) {
    throw new Error(
      selectorType === 'provider'
        ? `No encontre un perfil para el proveedor ${selectorValue}.`
        : `No encontre el perfil ${selectorValue}.`
    );
  }

  if (!supportsIsolatedClaudeRuntime(profile)) {
    throw new Error(`El perfil ${profile.profileName} no usa launcher aislado.`);
  }

  return profile;
}

async function runLaunchCommand(args, selectorType) {
  const selectorValue = args[0];

  if (!selectorValue) {
    throw new Error(
      selectorType === 'provider'
        ? 'Debes indicar un proveedor. Ejemplo: claude-connect launch-provider kimi'
        : 'Debes indicar un perfil. Ejemplo: claude-connect launch-profile kimi-kimi-for-coding-token'
    );
  }

  const profile = await resolveProfile(selectorType, selectorValue);
  await launchIsolatedClaudeProfile({
    profile,
    args: args.slice(1)
  });
}

export async function run(argv = process.argv.slice(2)) {
  if (argv[0] === 'gateway') {
    await runGatewayCommand(argv.slice(1));
    return;
  }

  if (argv[0] === 'launch-provider') {
    await runLaunchCommand(argv.slice(1), 'provider');
    return;
  }

  if (argv[0] === 'launch-profile') {
    await runLaunchCommand(argv.slice(1), 'profile');
    return;
  }

  getCatalogStore();
  await runWizard();
}
