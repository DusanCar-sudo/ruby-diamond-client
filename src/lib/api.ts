import { invoke } from "@tauri-apps/api/core";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  call_id: string;
  tool_name: string;
  success: boolean;
  output: string;
  error?: string;
}

export interface Skill {
  name: string;
  description: string;
  path: string;
  content: string;
  metadata: Record<string, string>;
}

export interface Message {
  role: string;
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface AgentState {
  id: string;
  name: string;
  system_prompt: string;
  messages: Message[];
  active_tools: string[];
  active_skills: string[];
}

export interface LLMConfig {
  provider: string;
  api_key?: string;
  model: string;
  base_url?: string;
  max_tokens: number;
  temperature: number;
}

export interface LlamaModel {
  name: string;
  path: string;
  size_bytes: number;
  format: string;
}

export interface LlamaStatus {
  running: boolean;
  server_url: string;
  model?: string;
  models_available: LlamaModel[];
}

export interface MeshRound {
  round_number: number;
  agent_id: string;
  role: string;
  output: string;
  tool_calls: number;
}

export interface MeshResult {
  goal: string;
  rounds: MeshRound[];
  final_output: string;
  agents_used: string[];
  total_tokens: number;
}

export interface PluginInfo {
  name: string;
  version: string;
  description: string;
  author: string;
  installed: boolean;
  source: string;
}

export interface PluginRegistry {
  plugins: PluginInfo[];
  registry_url: string;
}

// ── API ──────────────────────────────────────────────────────────────────────

export const api = {
  // Core
  listTools: () => invoke<ToolDef[]>("list_tools"),
  listSkills: () => invoke<Skill[]>("list_skills"),
  readSkill: (name: string) => invoke<Skill | null>("read_skill", { name }),
  createAgent: (name: string, provider: string, model: string, apiKey?: string, baseUrl?: string) =>
    invoke<string>("create_agent", { name, provider, model, apiKey, baseUrl }),
  runAgent: (agentId: string, goal: string) =>
    invoke<Message[]>("run_agent", { agentId, goal }),
  getAgentMessages: (agentId: string) =>
    invoke<Message[]>("get_agent_messages", { agentId }),
  executeTool: (toolName: string, args: Record<string, unknown>) =>
    invoke<ToolResult>("execute_tool", { toolName, arguments: args }),
  readDir: (path?: string) => invoke<Array<{name: string; path: string; is_dir: boolean}>>("read_dir", { path }),
  readFile: (path: string) => invoke<string>("read_file", { path }),

  // Llama.cpp
  llamaStatus: () => invoke<LlamaStatus>("llama_status"),
  llamaStart: (modelPath: string, port?: number, nGpuLayers?: number, ctxSize?: number) =>
    invoke<string>("llama_start", { modelPath, port, nGpuLayers, ctxSize }),
  llamaStop: () => invoke<void>("llama_stop"),
  llamaDiscover: () => invoke<LlamaModel[]>("llama_discover"),

  // Mesh
  meshDebate: (goal: string, a: LLMConfig, b: LLMConfig, judge: LLMConfig) =>
    invoke<MeshResult>("mesh_debate", { goal, configA: a, configB: b, configJudge: judge }),
  meshReview: (goal: string, author: LLMConfig, reviewer: LLMConfig) =>
    invoke<MeshResult>("mesh_review", { goal, configAuthor: author, configReviewer: reviewer }),
  meshEnsemble: (goal: string, configs: LLMConfig[]) =>
    invoke<MeshResult>("mesh_ensemble", { goal, configs }),

  // Memory
  memoryCreatePeer: (name: string, role: string, desc: string) =>
    invoke("memory_create_peer", { name, role, description: desc }),
  memoryStats: () => invoke("memory_stats"),

  // Plugins
  pluginListInstalled: () => invoke<PluginInfo[]>("plugin_list_installed"),
  pluginInstall: (name: string, source: string) =>
    invoke<PluginInfo>("plugin_install", { name, source }),
  pluginUninstall: (name: string) => invoke<void>("plugin_uninstall", { name }),
};
