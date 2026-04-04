const RESET = '\x1b[0m';

export const colors = {
  reset: RESET,
  panel: '\x1b[48;2;12;18;30m',
  surface: '\x1b[48;2;18;27;44m',
  soft: '\x1b[38;2;148;163;184m',
  text: '\x1b[38;2;226;232;240m',
  muted: '\x1b[38;2;100;116;139m',
  accent: '\x1b[38;2;56;189;248m',
  accentSoft: '\x1b[38;2;125;211;252m',
  accentBg: '\x1b[48;2;10;71;104m',
  success: '\x1b[38;2;74;222;128m',
  warning: '\x1b[38;2;251;191;36m',
  danger: '\x1b[38;2;248;113;113m',
  dim: '\x1b[2m',
  bold: '\x1b[1m'
};

export function rgb(r, g, b) {
  return `\x1b[38;2;${r};${g};${b}m`;
}

export function colorize(text, ...tokens) {
  return `${tokens.join('')}${text}${RESET}`;
}

export function gradientizeLines(lines, palette) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return [];
  }

  if (!Array.isArray(palette) || palette.length === 0) {
    return [...lines];
  }

  if (palette.length === 1) {
    return lines.map((line) => colorize(line, palette[0], colors.bold));
  }

  return lines.map((line, index) => {
    const paletteIndex = Math.round((index / Math.max(1, lines.length - 1)) * (palette.length - 1));
    return colorize(line, palette[paletteIndex], colors.bold);
  });
}

export function stripAnsi(value) {
  return value.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
}

export function visibleWidth(value) {
  return stripAnsi(value).length;
}

export function padRight(value, width) {
  const padding = Math.max(0, width - visibleWidth(value));
  return `${value}${' '.repeat(padding)}`;
}

export function truncate(value, width) {
  if (visibleWidth(value) <= width) {
    return value;
  }

  const plain = stripAnsi(value);
  return `${plain.slice(0, Math.max(0, width - 1))}…`;
}
