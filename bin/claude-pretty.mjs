#!/usr/bin/env node

// ─────────────────────────────────────────────
// claude-pretty – Visual wrapper for Claude CLI
// ─────────────────────────────────────────────
//
// Uses `claude -p --output-format stream-json` to get structured
// JSON output, then renders it with visual styling.
//
// Session context is maintained via --resume between turns.
//
// Usage:
//   claude-pretty --project "MES Intranet" --preset green
//   claude-pretty --project "GameXP" --preset orange --yolo
//   claude-pretty --preset cyan --permissions standard
//   claude-pretty --preset cyan -- --model sonnet

import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import chalk from 'chalk'
import { StreamJsonParser } from '../lib/parser.mjs'
import { parseArgs, resolveConfig, PRESETS, PERMISSION_MODES } from '../lib/config.mjs'
import { setTitleBarConfig } from '../lib/theme.mjs'
import THEME from '../lib/theme.mjs'
import {
  renderUserInput,
  renderClaudeResponse,
  renderCodeBlock,
  renderThinking,
  renderToolUse,
  renderError,
  renderSeparator,
  renderHeader,
  renderStickyBar,
  renderTimestamp,
  renderPrompt,
  renderToolResult,
} from '../lib/renderer.mjs'

// ─── Parse args ────────────────────────────────

const { wrapperArgs, claudeArgs } = parseArgs(process.argv.slice(2))

// ─── Show available presets ───────────────────

if (wrapperArgs.preset === 'list' || wrapperArgs.project === 'list') {
  console.log('\n  Available presets:\n')
  for (const [name, preset] of Object.entries(PRESETS)) {
    const swatch = chalk.bgHex(preset.bg).hex(preset.fg)
    console.log(`  ${preset.icon}  ${swatch(`  ${name.padEnd(10)}  `)}  bg: ${preset.bg}  fg: ${preset.fg}`)
  }
  console.log(`\n  Usage: claude-pretty --preset green --project "My Project"\n`)
  process.exit(0)
}

// ─── Resolve config ────────────────────────────

const config = resolveConfig(wrapperArgs)

setTitleBarConfig({
  bg: config.color,
  fg: config.textColor,
  accent: config._accent,
  icon: config.icon,
  project: config.project,
  model: config.model,
  showCwd: config.showCwd,
  showTime: config.showTime,
  sticky: config.sticky,
})

// ─── Session state ─────────────────────────────

let sessionId = null      // Captured from first response, used for --resume
let turnCount = 0
let currentModel = config.model || ''
let permissionMode = config.permissions || ''
let rl = null

// ─── Env for child processes ───────────────────

function buildEnv() {
  const env = { ...process.env, TERM: 'xterm-256color' }
  delete env.CLAUDECODE
  return env
}

// ─── Ask permission mode interactively ─────────

async function askPermissionMode() {
  const askRl = createInterface({ input: process.stdin, output: process.stdout })

  console.log()
  console.log(chalk.hex('#f97316').bold('  Permission mode:'))
  console.log()
  console.log(chalk.hex('#86efac')('  1) Safe')      + THEME.dim('       – Read-only (Read, Glob, Grep)'))
  console.log(chalk.hex('#93c5fd')('  2) Standard')   + THEME.dim('   – Read + Write + Edit + Bash + search'))
  console.log(chalk.hex('#c4b5fd')('  3) Full')       + THEME.dim('       – All tools + MCPs (acceptEdits)'))
  console.log(chalk.hex('#fca5a5')('  4) YOLO')       + THEME.dim('       – All permissions bypassed (dangerous)'))
  console.log()

  return new Promise((resolve) => {
    askRl.question(chalk.hex('#888')('  Choose [1/2/3/4]: '), (answer) => {
      askRl.close()
      const choice = answer.trim().toLowerCase()
      if (choice === '1' || choice === 'safe')     return resolve('safe')
      if (choice === '3' || choice === 'full')     return resolve('full')
      if (choice === '4' || choice === 'yolo')     return resolve('yolo')
      // Default to standard
      return resolve('standard')
    })
  })
}

// ─── Build Claude args ─────────────────────────

function buildClaudeArgs(userPrompt) {
  const args = ['-p', '--output-format', 'stream-json']

  // Resume session for multi-turn context
  if (sessionId) {
    args.push('--resume', sessionId)
  }

  // Permission handling (priority: CLI flags > .claude-pretty.json > interactive choice)
  //
  // 1. Explicit allowedTools from config (most specific)
  if (config.allowedTools && config.allowedTools.length > 0) {
    args.push('--allowedTools', config.allowedTools.join(','))
  }
  // 2. Claude's permissionMode from config
  if (config.permissionMode) {
    args.push('--permission-mode', config.permissionMode)
  }
  // 3. Shorthand permission mode (safe/standard/full/yolo)
  if (permissionMode) {
    const mode = PERMISSION_MODES[permissionMode]
    if (mode) {
      if (mode.dangerous) {
        args.push('--dangerously-skip-permissions')
      } else if (mode.permissionMode) {
        args.push('--permission-mode', mode.permissionMode)
      } else if (!config.allowedTools?.length) {
        // Only add allowedTools if not already set from config
        args.push('--allowedTools', mode.allowedTools)
      }
    }
  }

  // Forward Claude-specific flags (from -- separator)
  for (const arg of claudeArgs) {
    args.push(arg)
  }

  // User prompt
  args.push(userPrompt)

  return args
}

// ─── Create parser + wire events ───────────────

function createParser() {
  const parser = new StreamJsonParser()

  parser.on('system_init', ({ model, version, sessionId: sid }) => {
    // Capture session ID from first turn
    if (sid && !sessionId) {
      sessionId = sid
    }
    if (model && !currentModel) {
      currentModel = model
      setTitleBarConfig({ model })
    }
    if (version && turnCount === 1) {
      console.log(THEME.dim(`  Claude Code v${version}  ·  ${model || 'default'}`))
      console.log()
    }
  })

  parser.on('thinking', ({ text }) => {
    console.log(renderThinking(text))
  })

  parser.on('claude_response', ({ text }) => {
    console.log()
    console.log(renderClaudeResponse(text))
  })

  parser.on('code_block', ({ code, language }) => {
    console.log()
    console.log(renderCodeBlock(code, language))
  })

  parser.on('tool_use', ({ tool, details }) => {
    console.log()
    console.log(renderToolUse(tool, details))
  })

  parser.on('tool_result', ({ content, file }) => {
    const display = file?.filePath || ''
    if (display) {
      console.log(renderToolResult(display))
    }
  })

  parser.on('result', ({ success, durationMs, numTurns, costUsd, sessionId: sid }) => {
    // Capture session ID from result too
    if (sid && !sessionId) {
      sessionId = sid
    }

    console.log()
    if (config.sticky) {
      console.log(renderStickyBar())
    } else {
      console.log(renderSeparator())
    }

    const parts = []
    if (durationMs) parts.push(`${(durationMs / 1000).toFixed(1)}s`)
    if (numTurns) parts.push(`${numTurns} turn${numTurns > 1 ? 's' : ''}`)
    if (costUsd) parts.push(`$${costUsd.toFixed(4)}`)
    if (parts.length > 0) {
      console.log(THEME.dim(`  ${parts.join('  ·  ')}`))
    }
    console.log()
  })

  parser.on('passthrough', ({ text }) => {
    if (text.trim()) {
      console.log(THEME.dim('  ' + text))
    }
  })

  return parser
}

// ─── Run a single prompt ───────────────────────

function runPrompt(userPrompt) {
  turnCount++

  // Show user input
  console.log(renderTimestamp())
  console.log(renderUserInput(userPrompt))
  console.log()

  const parser = createParser()
  const args = buildClaudeArgs(userPrompt)

  const child = spawn('claude', args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: buildEnv(),
  })

  child.stdin.end()

  child.stdout.on('data', (chunk) => {
    parser.feed(chunk.toString())
  })

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString().trim()
    if (text) {
      console.log(renderError(text))
    }
  })

  child.on('close', (code) => {
    parser.flush()
    if (code !== 0 && code !== null) {
      console.log(renderError(`Claude exited with code ${code}`))
    }
    promptForInput()
  })

  child.on('error', (err) => {
    if (err.code === 'ENOENT') {
      console.log(renderError(
        'Claude CLI not found.\n' +
        'Install it with: npm install -g @anthropic-ai/claude-code'
      ))
      process.exit(1)
    }
    console.log(renderError(err.message))
    promptForInput()
  })
}

// ─── Interactive prompt loop ───────────────────

function promptForInput() {
  if (!rl) {
    rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    rl.on('close', () => {
      console.log()
      console.log(renderSeparator())
      console.log(THEME.dim('  Session ended'))
      process.exit(0)
    })
  }

  rl.question(renderPrompt(), (answer) => {
    const trimmed = answer.trim()
    if (!trimmed) {
      promptForInput()
      return
    }

    if (trimmed === '/exit' || trimmed === '/quit') {
      console.log()
      console.log(renderSeparator())
      console.log(THEME.dim('  Session ended'))
      process.exit(0)
    }

    runPrompt(trimmed)
  })
}

// ─── Pipe mode (non-interactive) ───────────────

if (!process.stdin.isTTY) {
  let input = ''
  process.stdin.setEncoding('utf-8')
  process.stdin.on('data', (chunk) => { input += chunk })
  process.stdin.on('end', () => {
    const trimmed = input.trim()
    if (!trimmed) process.exit(0)

    // In pipe mode, default to standard if not specified
    if (!permissionMode) permissionMode = 'standard'

    console.log(renderHeader())
    turnCount++

    const parser = createParser()
    const args = buildClaudeArgs(trimmed)
    const child = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: buildEnv(),
    })

    child.stdin.end()
    child.stdout.on('data', (chunk) => parser.feed(chunk.toString()))
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString().trim()
      if (text) console.log(renderError(text))
    })
    child.on('close', (code) => {
      parser.flush()
      process.exit(code ?? 0)
    })
  })
} else {
  // ─── Interactive mode ──────────────────────────

  console.log(renderHeader())

  // Show permission mode badge
  const modeLabel = permissionMode
    ? PERMISSION_MODES[permissionMode]?.label || permissionMode
    : null

  if (modeLabel) {
    const modeColor = { safe: '#86efac', standard: '#93c5fd', full: '#c4b5fd', yolo: '#fca5a5' }[permissionMode] || '#93c5fd'
    console.log(THEME.dim('  Mode: stream-json') + chalk.hex(modeColor)(` [${modeLabel}]`))
    console.log()
    promptForInput()
  } else {
    // Ask user to choose permission mode
    askPermissionMode().then((mode) => {
      permissionMode = mode
      const m = PERMISSION_MODES[mode]
      const modeColor = { safe: '#86efac', standard: '#93c5fd', full: '#c4b5fd', yolo: '#fca5a5' }[mode] || '#93c5fd'
      console.log()
      console.log(THEME.dim('  Mode: stream-json') + chalk.hex(modeColor)(` [${m.label}]`))
      console.log()
      promptForInput()
    })
  }
}
