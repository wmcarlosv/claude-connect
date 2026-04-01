import packageJson from '../package.json' with { type: 'json' };
import { getCatalogStore } from './data/catalog-store.js';
import { gatewayBaseUrl } from './gateway/constants.js';
import { getGatewayStatus } from './gateway/state.js';
import { serveGateway, startGatewayInBackground, stopGateway } from './gateway/server.js';
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

function printVersion() {
  process.stdout.write(`${packageJson.version}\n`);
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

export async function run(argv = process.argv.slice(2)) {
  if (argv[0] === '--version' || argv[0] === '-v' || argv[0] === 'version') {
    printVersion();
    return;
  }

  if (argv[0] === 'gateway') {
    await runGatewayCommand(argv.slice(1));
    return;
  }

  getCatalogStore();
  await runWizard();
}
