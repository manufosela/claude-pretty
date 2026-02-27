import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// ─────────────────────────────────────────────
// Config – project detection + CLI args parsing
// ─────────────────────────────────────────────

// Preset color palettes for quick project differentiation
export const PRESETS = {
  blue:    { bg: '#1e3a5f', fg: '#93c5fd', accent: '#3b82f6', icon: '🔵' },
  green:   { bg: '#14532d', fg: '#86efac', accent: '#22c55e', icon: '🟢' },
  orange:  { bg: '#431407', fg: '#fdba74', accent: '#f97316', icon: '🟠' },
  red:     { bg: '#450a0a', fg: '#fca5a5', accent: '#ef4444', icon: '🔴' },
  purple:  { bg: '#2e1065', fg: '#c4b5fd', accent: '#8b5cf6', icon: '🟣' },
  pink:    { bg: '#500724', fg: '#f9a8d4', accent: '#ec4899', icon: '🩷' },
  yellow:  { bg: '#422006', fg: '#fde68a', accent: '#eab308', icon: '🟡' },
  cyan:    { bg: '#083344', fg: '#67e8f9', accent: '#06b6d4', icon: '🩵' },
  emerald: { bg: '#022c22', fg: '#6ee7b7', accent: '#10b981', icon: '💚' },
  slate:   { bg: '#1e293b', fg: '#cbd5e1', accent: '#64748b', icon: '⚪' },
}

// Permission modes for Claude CLI
export const PERMISSION_MODES = {
  safe:     { label: 'Safe',     desc: 'Read-only tools (Read, Glob, Grep)',       allowedTools: 'Read,Glob,Grep' },
  standard: { label: 'Standard', desc: 'Read + Write + Edit + Bash + search',      allowedTools: 'Read,Write,Edit,Bash,Glob,Grep,WebSearch,WebFetch' },
  yolo:     { label: 'YOLO',     desc: 'All permissions bypassed (--dangerously-skip-permissions)', dangerous: true },
}

// Default config
const DEFAULTS = {
  project: '',
  preset: '',
  color: '',        // custom hex bg
  textColor: '',    // custom hex fg
  icon: '',
  model: '',
  permissions: '',       // safe | standard | yolo (shorthand)
  permissionMode: '',    // Claude CLI: acceptEdits | bypassPermissions | default | plan
  allowedTools: [],      // Claude CLI: explicit tool list e.g. ["Read","Write","Edit","Bash"]
  showCwd: true,
  showTime: true,
  sticky: false,         // re-render bar on every turn
}

// ─── Parse CLI args for wrapper-specific flags ─

export function parseArgs(argv) {
  const wrapperArgs = {}
  const claudeArgs = []

  let i = 0
  while (i < argv.length) {
    const arg = argv[i]

    if (arg === '--project' || arg === '-p') {
      wrapperArgs.project = argv[++i] || ''
    } else if (arg.startsWith('--project=')) {
      wrapperArgs.project = arg.split('=')[1]
    } else if (arg === '--preset') {
      wrapperArgs.preset = argv[++i] || ''
    } else if (arg.startsWith('--preset=')) {
      wrapperArgs.preset = arg.split('=')[1]
    } else if (arg === '--color') {
      wrapperArgs.color = argv[++i] || ''
    } else if (arg.startsWith('--color=')) {
      wrapperArgs.color = arg.split('=')[1]
    } else if (arg === '--text-color') {
      wrapperArgs.textColor = argv[++i] || ''
    } else if (arg.startsWith('--text-color=')) {
      wrapperArgs.textColor = arg.split('=')[1]
    } else if (arg === '--icon') {
      wrapperArgs.icon = argv[++i] || ''
    } else if (arg.startsWith('--icon=')) {
      wrapperArgs.icon = arg.split('=')[1]
    } else if (arg === '--yolo') {
      wrapperArgs.permissions = 'yolo'
    } else if (arg === '--safe') {
      wrapperArgs.permissions = 'safe'
    } else if (arg === '--permissions') {
      wrapperArgs.permissions = argv[++i] || ''
    } else if (arg.startsWith('--permissions=')) {
      wrapperArgs.permissions = arg.split('=')[1]
    } else if (arg === '--sticky') {
      wrapperArgs.sticky = true
    } else if (arg === '--no-cwd') {
      wrapperArgs.showCwd = false
    } else if (arg === '--no-time') {
      wrapperArgs.showTime = false
    } else {
      // Pass everything else to Claude CLI
      claudeArgs.push(arg)
    }
    i++
  }

  return { wrapperArgs, claudeArgs }
}

// ─── Load .claude-pretty.json from cwd ────────

function loadConfigFile() {
  const paths = [
    join(process.cwd(), '.claude-pretty.json'),
    join(process.cwd(), '.claude-pretty'),
  ]

  for (const p of paths) {
    if (existsSync(p)) {
      try {
        const raw = readFileSync(p, 'utf-8')
        return JSON.parse(raw)
      } catch {
        // Invalid JSON – ignore silently
      }
    }
  }
  return {}
}

// ─── Merge: defaults < config file < CLI args ─

export function resolveConfig(cliArgs = {}) {
  const fileConfig = loadConfigFile()

  const merged = {
    ...DEFAULTS,
    ...fileConfig,
    ...cliArgs,
  }

  // Auto-detect project name from cwd if not set
  if (!merged.project) {
    const cwdParts = process.cwd().split('/')
    merged.project = cwdParts[cwdParts.length - 1] || 'session'
  }

  // Resolve preset colors
  if (merged.preset && PRESETS[merged.preset]) {
    const preset = PRESETS[merged.preset]
    if (!merged.color) merged.color = preset.bg
    if (!merged.textColor) merged.textColor = preset.fg
    if (!merged.icon) merged.icon = preset.icon
    merged._accent = preset.accent
  }

  // Fallback colors if nothing set
  if (!merged.color) merged.color = '#1e3a5f'
  if (!merged.textColor) merged.textColor = '#93c5fd'
  if (!merged.icon) merged.icon = '◆'
  if (!merged._accent) merged._accent = '#3b82f6'

  return merged
}
