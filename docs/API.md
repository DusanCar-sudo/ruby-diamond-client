# Ruby Diamond — API Reference

## Tauri Commands (Rust → Frontend IPC)

All commands are invoked from TypeScript via `import { invoke } from "@tauri-apps/api/core"`.

### Agent Commands

#### `create_agent`
Create a new AI agent.
- **Args**: `{ name: string, config: LLMConfig }`
- **Returns**: `AgentState`

#### `run_agent`
Run an agent with a goal.
- **Args**: `{ agent_id: string, goal: string }`
- **Returns**: `AgentState` (updated with messages)

#### `get_agent_messages`
Get conversation history for an agent.
- **Args**: `{ agent_id: string }`
- **Returns**: `Message[]`

#### `list_tools`
List all available tools in the registry.
- **Returns**: `ToolDef[]`

#### `list_skills`
List loaded skills.
- **Returns**: `Skill[]`

#### `execute_tool`
Execute a single tool by name.
- **Args**: `{ tool_name: string, args: Record<string, unknown> }`
- **Returns**: `ToolResult`

### Filesystem Commands

#### `read_dir`
List directory contents.
- **Args**: `{ path: string }`
- **Returns**: `FileEntry[]` (name, path, is_dir)

#### `read_file`
Read a file's contents.
- **Args**: `{ path: string, offset?: number, limit?: number }`
- **Returns**: string (truncated to 2000 lines / 50KB)

### System Commands

#### `system_stats`
Get real-time system statistics.
- **Returns**: `SystemStats` (CPU per-core, RAM, swap, disks, processes, network, temps)

### Llama.cpp Commands

#### `llama_status`
Check llama.cpp server status.
- **Returns**: `LlamaStatus`

#### `llama_start`
Start the llama.cpp server.
- **Args**: `{ model_path: string, port?: number }`
- **Returns**: `LlamaStatus`

#### `llama_stop`
Stop the llama.cpp server.
- **Returns**: `LlamaStatus`

#### `llama_discover`
Discover available GGUF/GGML models.
- **Returns**: `LlamaModel[]`

### Agent Mesh Commands

#### `mesh_debate`
Run a three-agent debate protocol.
- **Args**: `{ goal: string, config_a: LLMConfig, config_b: LLMConfig, config_judge: LLMConfig }`
- **Returns**: `MeshResult`

#### `mesh_review`
Run a review protocol (worker + reviewer).
- **Args**: `{ goal: string, config_worker: LLMConfig, config_reviewer: LLMConfig }`
- **Returns**: `MeshResult`

#### `mesh_ensemble`
Run an ensemble (multiple agents independently, results synthesized).
- **Args**: `{ goal: string, configs: LLMConfig[] }`
- **Returns**: `MeshResult`

### Memory Commands (Honcho)

#### `memory_create_peer`
Register a new agent identity.
- **Args**: `{ name: string, role: string, description: string }`
- **Returns**: `HonchoPeer`

#### `memory_store_message`
Store a message in Honcho memory.
- **Args**: `{ session_id: string, role: string, content: string }`
- **Returns**: HonchoMessage

#### `memory_get_session_messages`
Retrieve session history.
- **Args**: `{ session_id: string }`
- **Returns**: Message[]

#### `memory_get_stats`
Get memory usage statistics.
- **Returns**: `HonchoMemoryStats`

## Frontend API Layer

In browser mode (no Tauri), the frontend falls back to direct HTTP calls:

### Anthropic-Compatible Providers
```typescript
POST /v1/messages
Headers: { "x-api-key": "...", "anthropic-version": "2023-06-01" }
Body: {
  model: string,
  system?: string,
  messages: Array<{ role: "user"|"assistant", content: string }>,
  max_tokens: number
}
```

### OpenAI-Compatible Providers
```typescript
POST /v1/chat/completions
Body: {
  model: string,
  messages: Array<{ role: string, content: string }>,
  max_tokens: number
}
```

## Type Definitions

```typescript
interface LLMConfig {
  provider: string;      // "openai" | "anthropic" | "deepseek" | "groq" | ...
  api_key?: string;
  model: string;
  base_url?: string;
  max_tokens: number;
  temperature: number;
}

interface AgentState {
  id: string;
  name: string;
  system_prompt: string;
  messages: Message[];
  active_tools: string[];
  active_skills: string[];
}

interface Message {
  role: string;          // "system" | "user" | "assistant" | "tool"
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;  // JSON Schema
}

interface SystemStats {
  cpu_usage: number;
  cpu_per_core: number[];
  cpu_count: number;
  cpu_name: string;
  ram_total: number;
  ram_used: number;
  ram_free: number;
  swap_total: number;
  swap_used: number;
  uptime: number;
  load_avg: number[];
  processes: ProcessInfo[];
  disks: DiskInfo[];
  temps: TempInfo[];
  network: NetworkInfo;
}

interface MeshResult {
  goal: string;
  rounds: MeshRound[];
  final_output: string;
  agents_used: string[];
  total_tokens: number;
}
```

## Plugins API

### PluginRegistry
```typescript
interface PluginInfo {
  name: string;
  version: string;
  description: string;
  author: string;
  installed: boolean;
  source: string;
}
```

Skills are loaded from `SKILL.md` files with YAML frontmatter:
```yaml
---
name: skill-name
description: What this skill does
---
```
