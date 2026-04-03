import process from 'node:process';
import readline from 'node:readline';
import { colorize, colors, padRight, truncate, visibleWidth } from './theme.js';

const KEY_NAMES = new Set(['up', 'down', 'return', 'escape', 'backspace', 'tab']);
export const navigation = {
  BACK: '__CLAUDE_CONNECT_BACK__',
  EXIT: '__CLAUDE_CONNECT_EXIT__'
};

export function assertInteractiveTerminal() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Este CLI requiere una terminal interactiva.');
  }
}

export function openAppScreen() {
  process.stdout.write('\x1b[?1049h\x1b[?25l');
}

export function closeAppScreen() {
  process.stdout.write('\x1b[?25h\x1b[?1049l\r\n');
}

function beginKeyboardCapture() {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.resume();
  process.stdin.setRawMode(true);
}

function restoreKeyboardState(onKeypress) {
  if (typeof onKeypress === 'function') {
    process.stdin.removeListener('keypress', onKeypress);
  }

  if (process.stdin.isTTY && process.stdin.isRaw) {
    process.stdin.setRawMode(false);
  }

  process.stdin.pause();
  process.stdout.write('\x1b[?25h');
}

export function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H');
}

export function renderScreen(lines) {
  clearScreen();
  process.stdout.write(`${lines.join('\n')}\n`);
}

function frameLine(content, width) {
  return `│ ${padRight(truncate(content, width - 4), width - 4)} │`;
}

export function buildFrame({ eyebrow, title, subtitle, body = [], footer = [] }) {
  const width = Math.min(88, Math.max(72, process.stdout.columns || 80));
  const innerWidth = width - 4;
  const lines = [];

  lines.push(colorize(`╭${'─'.repeat(width - 2)}╮`, colors.accentSoft));
  lines.push(frameLine(colorize(eyebrow, colors.bold, colors.accent), width));
  lines.push(frameLine(colorize(title, colors.bold, colors.text), width));
  lines.push(frameLine(colorize(subtitle, colors.soft), width));
  lines.push(colorize(`├${'─'.repeat(width - 2)}┤`, colors.accentSoft));

  for (const line of body) {
    lines.push(frameLine(line, width));
  }

  if (footer.length > 0) {
    lines.push(colorize(`├${'─'.repeat(width - 2)}┤`, colors.accentSoft));
    for (const line of footer) {
      lines.push(frameLine(line, width));
    }
  }

  lines.push(colorize(`╰${'─'.repeat(width - 2)}╯`, colors.accentSoft));

  return lines.map((line) => truncate(line, visibleWidth(line) > innerWidth + 4 ? width : width));
}

export function waitForAnyKey(message = 'Presiona una tecla para continuar.') {
  return new Promise((resolve, reject) => {
    beginKeyboardCapture();
    let escapePending = false;

    const cleanup = () => {
      restoreKeyboardState(onKeypress);
    };

    const onKeypress = (_input, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        resolve(navigation.EXIT);
        return;
      }

      if (key.name === 'escape') {
        if (escapePending) {
          cleanup();
          resolve(navigation.EXIT);
          return;
        }

        escapePending = true;
        process.stdout.write(`\n${colorize('Presiona Esc otra vez para salir.', colors.warning)}\n`);
        return;
      }

      cleanup();
      resolve(message);
    };

    process.stdin.on('keypress', onKeypress);
  });
}

export function selectFromList({
  step,
  totalSteps,
  title,
  subtitle,
  items,
  detailBuilder,
  footerHint,
  allowBack = false
}) {
  return new Promise((resolve, reject) => {
    const options = allowBack
      ? [
          ...items,
          {
            label: 'Volver',
            description: 'Regresa a la pantalla anterior.',
            value: navigation.BACK
          }
        ]
      : items;
    let selectedIndex = 0;
    let escapePending = false;

    beginKeyboardCapture();

    const cleanup = () => {
      restoreKeyboardState(onKeypress);
    };

    const render = () => {
      const selected = options[selectedIndex];
      const detailLines = selected.value === navigation.BACK
        ? ['Regresa a la pantalla anterior.']
        : detailBuilder(selected);
      const body = [
        colorize(`Paso ${step}/${totalSteps}`, colors.warning),
        '',
        ...options.flatMap((item, index) => {
          const active = index === selectedIndex;
          const prefix = active
            ? colorize('›', colors.bold, colors.accent)
            : colorize(' ', colors.muted);
          const label = active
            ? colorize(item.label, colors.bold, colors.text)
            : colorize(item.label, colors.text);
          const description = active
            ? colorize(item.description, colors.soft)
            : colorize(item.description, colors.muted);
          return [`${prefix} ${label}`, `  ${description}`];
        }),
        '',
        colorize('Detalle', colors.bold, colors.accentSoft),
        ...detailLines.map((line) => colorize(line, colors.soft))
      ];

      const footer = [
        colorize(
          escapePending
            ? `Esc otra vez salir · Enter seleccionar${allowBack ? ' · Tab volver' : ''}`
            : footerHint ?? `↑/↓ mover · Enter seleccionar${allowBack ? ' · Tab volver' : ''} · Esc salir`,
          colors.dim,
          escapePending ? colors.warning : colors.muted
        )
      ];

      renderScreen(
        buildFrame({
          eyebrow: 'CLAUDE CONNECT',
          title,
          subtitle,
          body,
          footer
        })
      );
    };

    const onKeypress = (_input, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        resolve(navigation.EXIT);
        return;
      }

      if (escapePending && key.name !== 'escape') {
        escapePending = false;
      }

      if (key.name === 'up') {
        selectedIndex = (selectedIndex - 1 + options.length) % options.length;
        render();
        return;
      }

      if (key.name === 'down') {
        selectedIndex = (selectedIndex + 1) % options.length;
        render();
        return;
      }

      if (key.name === 'escape') {
        if (escapePending) {
          cleanup();
          resolve(navigation.EXIT);
          return;
        }

        escapePending = true;
        render();
        return;
      }

      if (key.name === 'tab' && allowBack) {
        cleanup();
        resolve(navigation.BACK);
        return;
      }

      if (key.name === 'return') {
        const selected = options[selectedIndex];
        cleanup();
        resolve(selected.value);
      }
    };

    process.stdin.on('keypress', onKeypress);
    render();
  });
}

export function promptText({
  step,
  totalSteps,
  title,
  subtitle,
  label,
  defaultValue = '',
  placeholder = '',
  secret = false,
  allowBack = false
}) {
  return new Promise((resolve, reject) => {
    let value = '';
    let escapePending = false;

    beginKeyboardCapture();

    const cleanup = () => {
      restoreKeyboardState(onKeypress);
    };

    const render = () => {
      const displayValue = value.length === 0
        ? colorize(placeholder || 'Escribe aqui...', colors.muted)
        : secret
          ? colorize('•'.repeat(value.length), colors.text)
          : colorize(value, colors.text);

      const body = [
        colorize(`Paso ${step}/${totalSteps}`, colors.warning),
        '',
        colorize(label, colors.bold, colors.text),
        displayValue,
        '',
        colorize('Sugerencia', colors.bold, colors.accentSoft),
        colorize(defaultValue ? `Enter usa el valor por defecto: ${defaultValue}` : 'Enter confirma el valor actual.', colors.soft)
      ];

      const footer = [
        colorize(
          escapePending
            ? `Esc otra vez salir · Enter confirmar${allowBack ? ' · Tab volver' : ''}`
            : `Escribe para editar · Backspace borrar · Enter confirmar${allowBack ? ' · Tab volver' : ''} · Esc salir`,
          colors.dim,
          escapePending ? colors.warning : colors.muted
        )
      ];

      renderScreen(
        buildFrame({
          eyebrow: 'CLAUDE CONNECT',
          title,
          subtitle,
          body,
          footer
        })
      );
    };

    const onKeypress = (input = '', key = {}) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        resolve(navigation.EXIT);
        return;
      }

      if (key.name === 'escape') {
        if (escapePending) {
          cleanup();
          resolve(navigation.EXIT);
          return;
        }

        escapePending = true;
        render();
        return;
      }

      if (escapePending) {
        escapePending = false;
      }

      if (key.name === 'tab' && allowBack) {
        cleanup();
        resolve(navigation.BACK);
        return;
      }

      if (key.name === 'return') {
        cleanup();
        resolve(value.trim() || defaultValue.trim());
        return;
      }

      if (key.name === 'backspace') {
        value = value.slice(0, -1);
        render();
        return;
      }

      if (KEY_NAMES.has(key.name)) {
        return;
      }

      if (!key.ctrl && !key.meta && input) {
        value += input;
        render();
      }
    };

    process.stdin.on('keypress', onKeypress);
    render();
  });
}
