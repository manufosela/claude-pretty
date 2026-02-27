#!/usr/bin/env node

// ─────────────────────────────────────────────
// claude-pretty – Visual wrapper for Claude CLI
// ─────────────────────────────────────────────
//
// Uses `claude -p --output-format stream-json` to get structured
// JSON output from Claude CLI, then renders it with visual styling.
//
// Usage:
//   claude-pretty --project "MES Intranet" --preset green
//   claude-pretty --project "Extranet V2" --preset purple
//   claude-pretty --project "GameXP" --color "#431407" --icon "🎮"
//   claude-pretty --preset cyan -- --model sonnet
//
// Or create .claude-pretty.json in your project root:
//   { "project": "MES Intranet", "preset": "green" }

import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import chalk from 'chalk'
import { StreamJsonParser } from '../lib/parser.mjs'
import { parseArgs, resolveConfig, PRESETS } from '../lib/config.mjs'
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

// ─── Parse args: separate wrapper flags from Claude flags ─

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

// ─── State ─────────────────────────────────────

let turnCount = 0
let currentModel = config.model || ''
let sessionActive = false
let waitingForInput = false
let rl = null

// ─── Banner ────────────────────────────────────

console.log(renderHeader())
console.log(THEME.dim('  Mode: stream-json (structured output)'))
console.log()

// ─── Build Claude command ──────────────────────

function buildClaudeArgs(userPrompt) {
  const args = ['-p', '--output-format', 'stream-json']

  // Forward Claude-specific flags
  for (const arg of claudeArgs) {
    args.push(arg)
  }

  // Add the user prompt
  args.push(userPrompt)

  return args
}

// ─── Create parser + wire up events ────────────

function createParser() {
  const parser = new StreamJsonParser()

  parser.on('system_init', ({ model, version }) => {
    if (model && !currentModel) {
      currentModel = model
      setTitleBarConfig({ model })
    }
    if (version) {
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
    // Show a compact summary of the tool result
    const display = file?.filePath || ''
    if (display) {
      console.log(renderToolResult(display))
    }
  })

  parser.on('result', ({ success, durationMs, numTurns, costUsd }) => {
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

// ─── Run a single prompt through Claude ────────

function runPrompt(userPrompt) {
  waitingForInput = false
  turnCount++

  // Show user input visually
  console.log(renderTimestamp())
  console.log(renderUserInput(userPrompt))
  console.log()

  const parser = createParser()
  const args = buildClaudeArgs(userPrompt)

  const env = { ...process.env, TERM: 'xterm-256color' }
  delete env.CLAUDECODE  // Avoid "nested session" error

  const child = spawn('claude', args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env,
  })

  // Close stdin immediately – prompt is passed as CLI argument
  child.stdin.end()

  // Parse stdout (stream-json, one JSON per line)
  child.stdout.on('data', (chunk) => {
    parser.feed(chunk.toString())
  })

  // Stderr → errors
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

    // Prompt for next input
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
  waitingForInput = true

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

  // Show the visual prompt
  const promptStr = renderPrompt()
  rl.question(promptStr, (answer) => {
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

// ─── Handle piped input (non-interactive) ──────

if (!process.stdin.isTTY) {
  // Input is being piped – read all of stdin, run once
  let input = ''
  process.stdin.setEncoding('utf-8')
  process.stdin.on('data', (chunk) => { input += chunk })
  process.stdin.on('end', () => {
    const trimmed = input.trim()
    if (trimmed) {
      const parser = createParser()
      const args = buildClaudeArgs(trimmed)

      const pipeEnv = { ...process.env }
      delete pipeEnv.CLAUDECODE

      const child = spawn('claude', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: pipeEnv,
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
    }
  })
} else {
  // Interactive mode
  sessionActive = true
  promptForInput()
}
