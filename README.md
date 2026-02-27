<p align="center">
  <img src="https://img.shields.io/npm/v/claude-pretty?style=flat-square&color=f97316&label=npm" alt="npm version">
  <img src="https://img.shields.io/node/v/claude-pretty?style=flat-square&color=22c55e" alt="node version">
  <img src="https://img.shields.io/npm/l/claude-pretty?style=flat-square&color=8b5cf6" alt="license">
  <img src="https://img.shields.io/npm/dm/claude-pretty?style=flat-square&color=3b82f6" alt="downloads">
  <img src="https://img.shields.io/badge/Claude_Code-compatible-06b6d4?style=flat-square&logo=anthropic" alt="Claude Code compatible">
  <img src="https://img.shields.io/badge/ESM-only-fde68a?style=flat-square" alt="ESM only">
</p>

# claude-pretty

**Visual terminal wrapper for [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)** — color-coded title bars, bordered sections, and visual differentiation per project.

```
▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀
 🟠  GameXP Planning        opus  │  ~/projects/gamexp  │  14:32
▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄

  14:32
╭─  YOU  ───────────────────────────────────────────────────────────────╮
│ Create a web component for employee cards                              │
╰───────────────────────────────────────────────────────────────────────╯

┊  THINKING
┊  Analyzing requirements: web component, vanilla JS, Shadow DOM...

▎  TOOL
▎  Read  /src/components/employee-card.js

┃  CLAUDE
┃  Here's the Web Component with Shadow DOM for encapsulated styles...

┌─  JAVASCRIPT  ────────────────────────────────────────────────────────┐
│ class EmployeeCard extends HTMLElement { ... }                          │
└───────────────────────────────────────────────────────────────────────╯
────────────────────────────────────────────────────────────────────────
  3.2s  ·  2 turns  ·  $0.0847
```

## Why?

When you have 3-4 Claude sessions open in different terminals, they all look the same. `claude-pretty` gives each one a unique visual identity:

- **Color-coded title bar** per project — instant visual identification
- **10 built-in presets** — blue, green, orange, purple, cyan, pink, red, yellow, emerald, slate
- **Custom colors** via hex values or `.claude-pretty.json`
- **Structured output parsing** — uses Claude's `stream-json` format, no heuristics
- **Visual sections** — user input (blue box), responses (green border), code (amber frame), thinking (purple), tool use (orange), errors (red)
- **Session stats** — duration, turns, and cost after each response
- **Timestamps** on each turn

## Install

```bash
npm install -g claude-pretty
```

> **Prerequisite:** [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) must be installed and authenticated.

## Usage

```bash
# Interactive session with preset
claude-pretty --project "MES Intranet" --preset green

# Custom colors
claude-pretty --project "Geniova" --color "#1a1a2e" --icon "🦷"

# Pipe mode (single prompt, exits after response)
echo "explain this codebase" | claude-pretty --preset cyan

# Forward flags to Claude CLI (after --)
claude-pretty --preset purple -- --model sonnet --allowedTools "Read,Bash"

# See the visual demo (no Claude CLI needed)
npx claude-pretty demo

# List all presets
claude-pretty --preset list
```

## Presets

| Preset    | Icon | Background | Text       | Best for              |
|-----------|------|------------|------------|-----------------------|
| `blue`    | 🔵   | `#1e3a5f`  | `#93c5fd`  | Default               |
| `green`   | 🟢   | `#14532d`  | `#86efac`  | Backend / APIs        |
| `orange`  | 🟠   | `#431407`  | `#fdba74`  | Planning / Management |
| `purple`  | 🟣   | `#2e1065`  | `#c4b5fd`  | Frontend              |
| `cyan`    | 🩵   | `#083344`  | `#67e8f9`  | Documentation         |
| `pink`    | 🩷   | `#500724`  | `#f9a8d4`  | R&D / Research        |
| `red`     | 🔴   | `#450a0a`  | `#fca5a5`  | Production / Alerts   |
| `yellow`  | 🟡   | `#422006`  | `#fde68a`  | Experiments           |
| `emerald` | 💚   | `#022c22`  | `#6ee7b7`  | Open Source           |
| `slate`   | ⚪   | `#1e293b`  | `#cbd5e1`  | General               |

## Per-project config

Drop a `.claude-pretty.json` in your project root:

```json
{
  "project": "MES Intranet",
  "preset": "green",
  "model": "opus",
  "sticky": true,
  "showCwd": true,
  "showTime": true
}
```

Then just run `claude-pretty` — it picks up the config automatically.

## Config options

| Option      | CLI flag          | Type    | Default      | Description                    |
|-------------|-------------------|---------|--------------|--------------------------------|
| `project`   | `--project`, `-p` | string  | dir name     | Project name in title bar      |
| `preset`    | `--preset`        | string  | `blue`       | Color preset name              |
| `color`     | `--color`         | hex     | —            | Custom background color        |
| `textColor` | `--text-color`    | hex     | —            | Custom text color              |
| `icon`      | `--icon`          | string  | —            | Custom icon/emoji              |
| `model`     | (auto-detected)   | string  | —            | Model name shown in bar        |
| `sticky`    | `--sticky`        | boolean | `false`      | Show project bar between turns |
| `showCwd`   | `--no-cwd`        | boolean | `true`       | Show current directory         |
| `showTime`  | `--no-time`       | boolean | `true`       | Show timestamp in bar          |

**Priority:** CLI flags > `.claude-pretty.json` > defaults

## How it works

```
┌──────────────┐      ┌─────────────┐      ┌──────────┐
│  Claude CLI   │─────▶│ StreamJSON  │─────▶│ Renderer │──▶ Terminal
│   -p --output │      │   Parser    │      │ (chalk + │
│  stream-json  │      │ (events)    │      │  boxes)  │
└──────────────┘      └─────────────┘      └──────────┘
```

1. Launches `claude -p --output-format stream-json` as a child process
2. Parses each JSON line into typed events: `thinking`, `claude_response`, `code_block`, `tool_use`, `tool_result`, `result`
3. Renders each event with the appropriate visual style (borders, colors, boxes)
4. Shows session stats (duration, turns, cost) after each response

### Visual section types

| Section          | Style                | Color   |
|------------------|----------------------|---------|
| User input       | Full bordered box    | Blue    |
| Claude response  | Left side border     | Green   |
| Code block       | Full box + lang tag  | Amber   |
| Thinking         | Dotted side border   | Purple  |
| Tool use         | Bar side border      | Orange  |
| Error            | Bold side border     | Red     |

## Commands

| Command      | Description            |
|--------------|------------------------|
| `/exit`      | End the session        |
| `/quit`      | End the session        |
| `Ctrl+D`     | End the session        |

## Project structure

```
claude-pretty/
├── bin/
│   └── claude-pretty.mjs    # CLI entry point, interactive loop
├── lib/
│   ├── config.mjs            # Presets, arg parsing, .claude-pretty.json
│   ├── theme.mjs             # Colors, borders, titlebar state
│   ├── parser.mjs            # Stream-JSON parser (events)
│   ├── renderer.mjs          # Visual drawing (boxes, bars, borders)
│   └── demo.mjs              # Visual demo without Claude CLI
├── .claude-pretty.example.json
├── package.json
└── README.md
```

## Requirements

- **Node.js 18+**
- **Claude Code CLI** installed and authenticated
- Terminal with **Unicode + 256-color** support (iTerm2, Warp, Kitty, Windows Terminal, Ghostty...)

## License

MIT
