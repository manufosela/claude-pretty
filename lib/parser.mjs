// ─────────────────────────────────────────────
// Parser – processes Claude CLI stream-json output
// ─────────────────────────────────────────────
//
// Claude's --output-format stream-json emits one JSON object per line.
// Each object has a `type` field: system, assistant, user, result, rate_limit_event
//
// assistant messages contain a content array with items of type:
//   - thinking  → { type: 'thinking', thinking: '...' }
//   - text      → { type: 'text', text: '...' }
//   - tool_use  → { type: 'tool_use', name: '...', input: {...} }
//
// user messages contain tool_result items:
//   - { type: 'tool_result', content: '...' }

export class StreamJsonParser {
  constructor() {
    this.listeners = new Map()
    this._lineBuffer = ''
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event).push(callback)
    return this
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event) || []
    for (const cb of callbacks) cb(data)
  }

  // ─── Feed raw data from stdout ────────────────
  // Handles partial lines (data may arrive mid-JSON)

  feed(chunk) {
    this._lineBuffer += chunk
    const lines = this._lineBuffer.split('\n')
    // Last element may be incomplete – keep it in buffer
    this._lineBuffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      this._processJsonLine(trimmed)
    }
  }

  // Flush any remaining buffer (on stream end)
  flush() {
    if (this._lineBuffer.trim()) {
      this._processJsonLine(this._lineBuffer.trim())
      this._lineBuffer = ''
    }
  }

  // ─── Parse and dispatch a single JSON line ────

  _processJsonLine(line) {
    let obj
    try {
      obj = JSON.parse(line)
    } catch {
      // Not valid JSON – emit as raw passthrough
      this.emit('passthrough', { text: line })
      return
    }

    switch (obj.type) {
      case 'system':
        this._handleSystem(obj)
        break
      case 'assistant':
        this._handleAssistant(obj)
        break
      case 'user':
        this._handleUser(obj)
        break
      case 'result':
        this._handleResult(obj)
        break
      case 'rate_limit_event':
        // Silently ignore rate limit events
        break
      default:
        this.emit('passthrough', { text: line })
    }
  }

  // ─── System init message ──────────────────────

  _handleSystem(obj) {
    if (obj.subtype === 'init') {
      this.emit('system_init', {
        sessionId: obj.session_id,
        model: obj.model,
        cwd: obj.cwd,
        tools: obj.tools || [],
        mcpServers: obj.mcp_servers || [],
        permissionMode: obj.permissionMode,
        version: obj.claude_code_version,
      })
    }
  }

  // ─── Assistant messages (thinking, text, tool_use) ─

  _handleAssistant(obj) {
    const msg = obj.message
    if (!msg || !msg.content) return

    for (const block of msg.content) {
      switch (block.type) {
        case 'thinking':
          if (block.thinking) {
            this.emit('thinking', { text: block.thinking })
          }
          break

        case 'text':
          if (block.text) {
            this._emitTextContent(block.text)
          }
          break

        case 'tool_use':
          this.emit('tool_use', {
            tool: block.name,
            id: block.id,
            input: block.input || {},
            details: this._formatToolDetails(block.name, block.input),
          })
          break
      }
    }
  }

  // ─── Emit text, splitting out markdown code blocks ─

  _emitTextContent(text) {
    // Split text into prose and code blocks
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g
    let lastIndex = 0
    let match

    while ((match = codeBlockRegex.exec(text)) !== null) {
      // Emit text before the code block
      const before = text.slice(lastIndex, match.index).trim()
      if (before) {
        this.emit('claude_response', { text: before })
      }

      // Emit the code block
      this.emit('code_block', {
        language: match[1] || '',
        code: match[2].replace(/\n$/, ''),
      })

      lastIndex = match.index + match[0].length
    }

    // Emit remaining text after last code block
    const remaining = text.slice(lastIndex).trim()
    if (remaining) {
      this.emit('claude_response', { text: remaining })
    }
  }

  // ─── User messages (tool results) ─────────────

  _handleUser(obj) {
    const msg = obj.message
    if (!msg || !msg.content) return

    // tool_use_result has extra metadata at top level
    const toolResult = obj.tool_use_result
    const content = msg.content

    for (const block of content) {
      if (block.type === 'tool_result') {
        const resultText = typeof block.content === 'string'
          ? block.content
          : JSON.stringify(block.content, null, 2)

        this.emit('tool_result', {
          toolUseId: block.tool_use_id,
          content: resultText,
          file: toolResult?.file || null,
        })
      }
    }
  }

  // ─── Final result message ─────────────────────

  _handleResult(obj) {
    this.emit('result', {
      success: obj.subtype === 'success',
      isError: obj.is_error || false,
      result: obj.result || '',
      durationMs: obj.duration_ms,
      numTurns: obj.num_turns,
      costUsd: obj.total_cost_usd,
      sessionId: obj.session_id,
      usage: obj.usage || {},
    })
  }

  // ─── Format tool details for display ──────────

  _formatToolDetails(toolName, input) {
    if (!input) return ''

    switch (toolName) {
      case 'Read':
        return input.file_path || ''

      case 'Write':
        return input.file_path || ''

      case 'Edit':
        return input.file_path || ''

      case 'Bash':
        return input.command || ''

      case 'Glob':
        return input.pattern || ''

      case 'Grep':
        return `${input.pattern || ''}${input.path ? ' in ' + input.path : ''}`

      case 'WebFetch':
        return input.url || ''

      case 'WebSearch':
        return input.query || ''

      case 'Task':
        return input.description || ''

      case 'AskUserQuestion':
        return (input.questions || []).map(q => q.question).join('; ')

      default:
        // MCP tools or unknown – show tool name + first string value
        if (toolName.startsWith('mcp__')) {
          const parts = toolName.split('__')
          const server = parts[1] || ''
          const method = parts[2] || ''
          return `${server} → ${method}`
        }
        return ''
    }
  }
}

// Legacy export for demo.mjs compatibility (not used in stream mode)
export const STATE = {
  IDLE: 'idle',
  USER_INPUT: 'user_input',
  CLAUDE_RESPONSE: 'claude_response',
  CODE_BLOCK: 'code_block',
  THINKING: 'thinking',
  TOOL_USE: 'tool_use',
}
