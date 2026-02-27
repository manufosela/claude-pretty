import chalk from 'chalk'

// ─────────────────────────────────────────────
// Theme config – edit colors and symbols here
// ─────────────────────────────────────────────

// Titlebar is set dynamically via setTitleBarConfig()
let _titleBar = {
  bg: '#1e3a5f',
  fg: '#93c5fd',
  accent: '#3b82f6',
  icon: '◆',
  project: 'session',
  showCwd: true,
  showTime: true,
  sticky: false,
}

export function setTitleBarConfig(config) {
  _titleBar = { ..._titleBar, ...config }
}

export function getTitleBarConfig() {
  return _titleBar
}

const THEME = {
  // Section colors
  user: {
    border: chalk.hex('#5B9BD5'),       // soft blue
    label: chalk.bgHex('#1a3a5c').hex('#93c5fd').bold,
    text: chalk.hex('#e0e0e0'),
    icon: '  ',
    borderChar: '│',
    cornerTL: '╭',
    cornerBL: '╰',
    horizontal: '─',
    cornerTR: '╮',
    cornerBR: '╯',
  },

  claude: {
    border: chalk.hex('#6BCB77'),       // soft green
    label: chalk.bgHex('#1a3c2a').hex('#86efac').bold,
    text: chalk.hex('#f0f0f0'),
    icon: '  ',
    borderChar: '┃',
    cornerTL: '┏',
    cornerBL: '┗',
    horizontal: '━',
    cornerTR: '┓',
    cornerBR: '┛',
  },

  code: {
    border: chalk.hex('#FFD93D'),       // amber
    label: chalk.bgHex('#3c3520').hex('#fde68a').bold,
    bg: chalk.bgHex('#1e1e2e'),
    text: chalk.hex('#d4d4d4'),
    borderChar: '│',
    cornerTL: '┌',
    cornerBL: '└',
    horizontal: '─',
    cornerTR: '┐',
    cornerBR: '┘',
  },

  thinking: {
    border: chalk.hex('#A78BFA'),       // purple
    label: chalk.bgHex('#2d1f5e').hex('#c4b5fd').bold,
    text: chalk.hex('#a0a0a0').italic,
    icon: '  ',
    borderChar: '┊',
  },

  tool: {
    border: chalk.hex('#F97316'),       // orange
    label: chalk.bgHex('#3c2010').hex('#fdba74').bold,
    text: chalk.hex('#d0d0d0'),
    icon: '  ',
    borderChar: '▎',
  },

  error: {
    border: chalk.hex('#EF4444'),       // red
    label: chalk.bgHex('#3c1010').hex('#fca5a5').bold,
    text: chalk.hex('#fca5a5'),
    icon: '  ',
    borderChar: '▌',
  },

  // General
  separator: chalk.hex('#444444'),
  dim: chalk.hex('#666666'),
  timestamp: chalk.hex('#555555'),
  highlight: chalk.hex('#FFD93D').bold,

  // Box drawing helpers
  width: () => Math.min(process.stdout.columns || 80, 120),
}

export default THEME
