# Ruby Diamond Client

**AI-powered terminal & code editor with tool system and skill engine.**

A Tauri 2 desktop client that bundles a multi-pane code editor, integrated terminal, AI chat panel, and a skill/plugin system. Ships with first-class skills for code review, project bootstrap, and Rust analysis.

Built by Dušan Milosavljević (Lean Progress IQ). The companion UI to AgentMesh — where AgentMesh is the orchestrator, Ruby Diamond is the workbench.

![TypeScript](https://img.shields.io/badge/TypeScript-frontend-blue)
![Tauri](https://img.shields.io/badge/Tauri-2-orange)
![Rust](https://img.shields.io/badge/Rust-backend-brown)
![React](https://img.shields.io/badge/React-19-61dafb)
![CodeMirror](https://img.shields.io/badge/CodeMirror-6-blue)

## Why

Most AI coding tools are web apps. Ruby Diamond is a native desktop app — fast, offline-capable, with real terminal access and a plugin system that can extend both the editor and the agent itself.

## Quick Start

```bash
# Install dependencies
pnpm install   # or npm install

# Development
pnpm dev

# Production build
pnpm build
pnpm tauri:build

# Or run the simple Python backend (Flask + NVIDIA API)
pip install -r requirements.txt
export NVIDIA_API_KEY=nvapi-...
python app.py
```

## Features

- **Multi-pane code editor** — CodeMirror 6 with syntax highlighting for JS/TS, Python, Rust, HTML, CSS, JSON, Markdown
- **Integrated terminal** — xterm.js with search, web links, fit addon
- **AI chat panel** — connects to NVIDIA NIM (Llama 3.1), OpenAI, Anthropic, or any OpenAI-compatible endpoint
- **Agent mesh panel** — connect to an AgentMesh orchestrator
- **Memory panel** — view learned episodes, lessons, and skill effectiveness
- **System panel** — local CPU/RAM/process info via Rust sysinfo backend
- **Sysadmin panel** — process control, system commands
- **Explorer sidebar** — file tree with quick navigation
- **Plugin system** — drop-in plugins via `skills/` directory
- **Skill engine** — built-in skills: `code-review`, `project-bootstrap`, `rust-analyzer`
- **Clipboard integration** — via Tauri clipboard plugin
- **File operations** — read/write via Tauri fs plugin
- **Shell commands** — execute commands via Tauri shell plugin
- **Multi-tab agents** — switch between multiple AI conversations
- **One-dark theme** — built-in CodeMirror One Dark theme

## Commands

```bash
pnpm dev              # Vite dev server
pnpm build            # build frontend
pnpm tauri:dev        # Tauri dev mode
pnpm tauri:build      # build production installer
python app.py         # run Python backend (port 5000)
bash setup.sh         # quick setup
```

## Architecture

- `src/` — React frontend (TypeScript + Vite)
  - `components/` — Editor, Terminal, Chat, MemoryPanel, MeshPanel, SystemPanel, etc.
  - `store.ts` — Zustand state
  - `lib/` — API clients, utilities
- `src-tauri/` — Rust backend (sysinfo, file ops, shell)
- `skills/` — skill definitions (`code-review`, `project-bootstrap`, `rust-analyzer`)
- `docs/` — API, Architecture, Examples, User Guide
- `app.py` — Optional Flask backend with NVIDIA NIM integration

## Tech Stack

- Tauri 2 (Rust + WebView)
- React 19, TypeScript, Vite
- CodeMirror 6 (editor)
- xterm.js (terminal)
- Zustand (state)
- Lucide React (icons)
- Optional Flask backend with OpenAI Python SDK

## License

MIT — see [LICENSE](LICENSE).

## Author

Built by **Dušan Milosavljević** — see [OWNERSHIP.md](OWNERSHIP.md).
