import chalk from 'chalk'
import stripAnsi from 'strip-ansi'
import THEME, { getTitleBarConfig } from './theme.mjs'

// ─────────────────────────────────────────────
// Renderer – visual output components
// ─────────────────────────────────────────────

function visibleLength(str) {
  return stripAnsi(str).length
}

function pad(str, len) {
  const diff = len - visibleLength(str)
  return diff > 0 ? str + ' '.repeat(diff) : str
}

function repeatChar(ch, n) {
  return n > 0 ? ch.repeat(n) : ''
}

// ─── Draw a full bordered box ─────────────────

export function drawBox(lines, style, label = '') {
  const w = THEME.width()
  const innerW = w - 4  // 2 border + 2 padding
  const { border, borderChar, cornerTL, cornerBL, horizontal, cornerTR, cornerBR } = style

  const output = []

  // Top border with label
  const labelStr = label ? ` ${label} ` : ''
  const labelLen = visibleLength(labelStr)
  const topLine = border(cornerTL + horizontal + labelStr + repeatChar(horizontal, w - 3 - labelLen - 1) + cornerTR)
  output.push(topLine)

  // Content lines
  for (const line of lines) {
    const stripped = stripAnsi(line)
    // Wrap long lines manually
    if (stripped.length > innerW) {
      const words = line.split(' ')
      let currentLine = ''
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        if (visibleLength(testLine) > innerW) {
          if (currentLine) {
            output.push(border(borderChar) + ' ' + pad(currentLine, innerW) + ' ' + border(borderChar))
          }
          currentLine = word
        } else {
          currentLine = testLine
        }
      }
      if (currentLine) {
        output.push(border(borderChar) + ' ' + pad(currentLine, innerW) + ' ' + border(borderChar))
      }
    } else {
      output.push(border(borderChar) + ' ' + pad(line, innerW) + ' ' + border(borderChar))
    }
  }

  // Bottom border
  const bottomLine = border(cornerBL + repeatChar(horizontal, w - 2) + cornerBR)
  output.push(bottomLine)

  return output.join('\n')
}

// ─── Draw left-border-only section (lighter) ──

export function drawSideBorder(lines, style, label = '') {
  const output = []

  if (label) {
    output.push(style.border(style.borderChar) + ' ' + style.label(` ${label} `))
    output.push(style.border(style.borderChar))
  }

  for (const line of lines) {
    output.push(style.border(style.borderChar) + ' ' + line)
  }

  output.push(style.border(style.borderChar))
  return output.join('\n')
}

// ─── Section renderers ────────────────────────

export function renderUserInput(text) {
  const lines = text.split('\n').map(l => THEME.user.text(l))
  return drawBox(lines, THEME.user, THEME.user.label(` ${THEME.user.icon} YOU `))
}

export function renderClaudeResponse(text) {
  const lines = text.split('\n').map(l => THEME.claude.text(l))
  return drawSideBorder(lines, THEME.claude, `${THEME.claude.icon} CLAUDE`)
}

export function renderCodeBlock(code, language = '') {
  const langLabel = language ? language.toUpperCase() : 'CODE'
  const lines = code.split('\n').map(l => THEME.code.bg(THEME.code.text(l)))
  return drawBox(lines, THEME.code, THEME.code.label(` ${langLabel} `))
}

export function renderThinking(text) {
  const lines = text.split('\n').map(l => THEME.thinking.text(l))
  return drawSideBorder(lines, THEME.thinking, `${THEME.thinking.icon} THINKING`)
}

export function renderToolUse(toolName, details = '') {
  const lines = []
  lines.push(THEME.tool.text(`Tool: ${toolName}`))
  if (details) {
    lines.push(THEME.tool.text(details))
  }
  return drawSideBorder(lines, THEME.tool, `${THEME.tool.icon} TOOL`)
}

export function renderToolResult(summary) {
  if (!summary) return ''
  const lines = [THEME.dim(summary)]
  return drawSideBorder(lines, { ...THEME.tool, borderChar: '·' }, '')
}

export function renderError(text) {
  const lines = text.split('\n').map(l => THEME.error.text(l))
  return drawSideBorder(lines, THEME.error, `${THEME.error.icon} ERROR`)
}

// ─── Decorative elements ──────────────────────

export function renderSeparator() {
  const w = THEME.width()
  return THEME.separator(repeatChar('─', w))
}

// ─── Title bar ────────────────────────────────

export function renderTitleBar(opts = {}) {
  const config = { ...getTitleBarConfig(), ...opts }
  const w = THEME.width()

  const bgStyle = chalk.bgHex(config.bg).hex(config.fg)
  const bgBold = chalk.bgHex(config.bg).hex(config.fg).bold
  const accentStyle = chalk.bgHex(config.bg).hex(config.accent || config.fg).bold
  const dimStyle = chalk.bgHex(config.bg).hex(config.fg).dim

  // Build components
  const icon = config.icon || '◆'
  const projectName = config.project || 'session'

  // Right side info
  const infoParts = []
  if (config.model) infoParts.push(config.model)
  if (config.showCwd) {
    const cwd = process.cwd().replace(process.env.HOME || '', '~')
    infoParts.push(cwd)
  }
  if (config.showTime) {
    infoParts.push(new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }))
  }
  const rightText = infoParts.join('  │  ')

  // ─── Top accent line (thin colored strip) ───
  const accentLine = chalk.hex(config.accent || config.fg)(repeatChar('▀', w))

  // ─── Main title bar ─────────────────────────
  const leftContent = ` ${icon}  ${projectName} `
  const leftLen = visibleLength(leftContent)
  const rightLen = rightText.length + 2  // +2 for padding
  const middlePad = w - leftLen - rightLen

  let mainLine
  if (middlePad > 0) {
    mainLine = bgBold(leftContent) +
               bgStyle(repeatChar(' ', middlePad)) +
               dimStyle(rightText + '  ')
  } else {
    mainLine = bgBold(pad(leftContent, w))
  }

  // ─── Bottom accent line (thin shadow) ───────
  const shadowLine = chalk.hex(config.accent || config.fg).dim(repeatChar('▄', w))

  return [accentLine, mainLine, shadowLine].join('\n')
}

// ─── Compact sticky bar (between turns) ───────

export function renderStickyBar(opts = {}) {
  const config = { ...getTitleBarConfig(), ...opts }
  const w = THEME.width()

  const accentStyle = chalk.hex(config.accent || '#3b82f6')
  const dimStyle = chalk.hex(config.accent || '#3b82f6').dim

  const icon = config.icon || '◆'
  const name = config.project || 'session'
  const time = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  const left = ` ${icon} ${name}`
  const right = `${time} `
  const fill = w - left.length - right.length

  if (fill > 0) {
    return accentStyle(left) +
           dimStyle(repeatChar('─', fill)) +
           accentStyle(right)
  }
  return accentStyle(pad(left, w))
}

// ─── Legacy header (now wraps titlebar) ───────

export function renderHeader() {
  return '\n' + renderTitleBar() + '\n'
}

export function renderTimestamp() {
  const now = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  return THEME.timestamp(`  ${now}`)
}

export function renderPrompt() {
  return THEME.user.border('❯ ')
}
