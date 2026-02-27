#!/usr/bin/env node

// ─────────────────────────────────────────────
// Demo – shows what claude-pretty looks like
// Run:  node lib/demo.mjs
// ─────────────────────────────────────────────

import chalk from 'chalk'
import { setTitleBarConfig } from './theme.mjs'
import { PRESETS } from './config.mjs'
import {
  renderUserInput,
  renderClaudeResponse,
  renderCodeBlock,
  renderThinking,
  renderToolUse,
  renderToolResult,
  renderError,
  renderSeparator,
  renderTitleBar,
  renderStickyBar,
  renderTimestamp,
} from './renderer.mjs'

const delay = (ms) => new Promise(r => setTimeout(r, ms))

async function demo() {
  console.clear()

  // ═══════════════════════════════════════════════
  //  PART 1: Show titlebar presets for different projects
  // ═══════════════════════════════════════════════

  console.log()
  console.log(chalk.hex('#888')('  ── Presets de proyecto ──────────────────────────────────────'))
  console.log()

  const projectExamples = [
    { project: 'MES Intranet',    preset: 'green',  model: 'opus' },
    { project: 'Extranet V2',     preset: 'purple', model: 'sonnet' },
    { project: 'GameXP Planning', preset: 'orange', model: 'opus' },
    { project: 'ISO 13485 Docs',  preset: 'cyan',   model: 'sonnet' },
    { project: 'R&D Memoria',     preset: 'pink',   model: 'opus' },
  ]

  for (const ex of projectExamples) {
    const preset = PRESETS[ex.preset]
    setTitleBarConfig({
      bg: preset.bg,
      fg: preset.fg,
      accent: preset.accent,
      icon: preset.icon,
      project: ex.project,
      model: ex.model,
      showCwd: true,
      showTime: true,
    })
    console.log(renderTitleBar())
    console.log()
    await delay(350)
  }

  await delay(500)

  // ═══════════════════════════════════════════════
  //  PART 2: Full conversation with a titlebar
  // ═══════════════════════════════════════════════

  console.log()
  console.log(chalk.hex('#888')('  ── Sesión completa con titlebar ────────────────────────────'))
  console.log()

  // Set up for GameXP project
  const gameXPreset = PRESETS['orange']
  setTitleBarConfig({
    bg: gameXPreset.bg,
    fg: gameXPreset.fg,
    accent: gameXPreset.accent,
    icon: '🎮',
    project: 'GameXP Planning',
    model: 'opus',
    showCwd: true,
    showTime: true,
  })

  console.log(renderTitleBar())
  console.log()

  await delay(500)

  // ─── Turn 1: User asks question ─────────────
  console.log(renderTimestamp())
  console.log(renderUserInput(
    'Crea un componente web vanilla para mostrar una tarjeta\nde empleado con foto, nombre y departamento'
  ))

  await delay(800)

  // ─── Thinking ───────────────────────────────
  console.log(renderThinking(
    'Analizando requisitos: componente web, vanilla JS,\nsin dependencias, shadow DOM para encapsulación...'
  ))

  await delay(600)

  // ─── Claude responds ────────────────────────
  console.log()
  console.log(renderTimestamp())
  console.log(renderClaudeResponse(
    'Te creo un Web Component con Shadow DOM para encapsular\n' +
    'los estilos. Usa slots para flexibilidad y atributos\n' +
    'observados para reactividad.'
  ))

  await delay(400)

  // ─── Code block ─────────────────────────────
  console.log()
  console.log(renderCodeBlock(
    `class EmployeeCard extends HTMLElement {
  static get observedAttributes() {
    return ['name', 'department', 'photo']
  }

  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
  }

  connectedCallback() {
    this.render()
  }

  render() {
    const name = this.getAttribute('name') || 'Unknown'
    const dept = this.getAttribute('department') || ''

    this.shadowRoot.innerHTML = \`
      <style>
        :host { display: block; border-radius: 12px;
                box-shadow: 0 2px 8px rgba(0,0,0,.15); }
        .info { padding: 1rem; }
        h3    { margin: 0 0 .25rem; }
        p     { margin: 0; opacity: .7; }
      </style>
      <div class="info">
        <h3>\${name}</h3>
        <p>\${dept}</p>
      </div>
    \`
  }
}

customElements.define('employee-card', EmployeeCard)`,
    'javascript'
  ))

  await delay(400)

  // ─── Sticky bar between turns ───────────────
  console.log()
  console.log(renderStickyBar())
  console.log()

  await delay(500)

  // ─── Turn 2 ─────────────────────────────────
  console.log(renderTimestamp())
  console.log(renderUserInput(
    'Añade un evento click que emita el employee-id'
  ))

  await delay(600)

  // ─── Tool use ───────────────────────────────
  console.log()
  console.log(renderToolUse('Read', '/src/components/employee-card.js'))
  console.log(renderToolResult('/src/components/employee-card.js (42 lines)'))

  await delay(600)

  console.log()
  console.log(renderTimestamp())
  console.log(renderClaudeResponse(
    'Hecho. He añadido un CustomEvent "employee-select"\n' +
    'que se despacha en el click con el detail.id del empleado.\n' +
    'También añadí cursor: pointer y efecto hover al card.'
  ))

  await delay(400)

  // ─── Error example ──────────────────────────
  console.log()
  console.log(renderError(
    'Permission denied: /etc/hosts (example error rendering)'
  ))

  await delay(300)

  // ─── Final separator ────────────────────────
  console.log()
  console.log(renderSeparator())

  // ═══════════════════════════════════════════════
  //  PART 3: Custom color titlebar
  // ═══════════════════════════════════════════════

  console.log()
  console.log(chalk.hex('#888')('  ── Color personalizado ─────────────────────────────────────'))
  console.log()

  setTitleBarConfig({
    bg: '#1a1a2e',
    fg: '#e94560',
    accent: '#e94560',
    icon: '🦷',
    project: 'Geniova MES',
    model: 'opus',
    showCwd: true,
    showTime: true,
  })

  console.log(renderTitleBar())
  console.log()

  await delay(500)

  // ═══════════════════════════════════════════════
  //  PART 4: Show .claude-pretty.json example
  // ═══════════════════════════════════════════════

  console.log()
  console.log(chalk.hex('#888')('  ── Configura por proyecto con .claude-pretty.json ──────────'))
  console.log()
  console.log(chalk.hex('#aaa')('  Crea este archivo en la raíz de tu proyecto:'))
  console.log()
  console.log(chalk.hex('#fde68a')('  {'))
  console.log(chalk.hex('#fde68a')('    "project": "MES Intranet",'))
  console.log(chalk.hex('#fde68a')('    "preset": "green",'))
  console.log(chalk.hex('#fde68a')('    "model": "opus",'))
  console.log(chalk.hex('#fde68a')('    "sticky": true'))
  console.log(chalk.hex('#fde68a')('  }'))
  console.log()
  console.log(chalk.hex('#aaa')('  O usa flags directamente:'))
  console.log()
  console.log(chalk.hex('#67e8f9')('  claude-pretty --project "GameXP" --preset orange'))
  console.log(chalk.hex('#67e8f9')('  claude-pretty --project "Geniova" --color "#1a1a2e" --icon "🦷"'))
  console.log(chalk.hex('#67e8f9')('  claude-pretty --preset list   # ver todos los presets'))
  console.log()
}

demo()
