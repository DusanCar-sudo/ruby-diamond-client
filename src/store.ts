import { create } from "zustand";
import type { AgentState, ToolDef, Skill, Message, LlamaStatus, MeshResult, PluginInfo, LLMConfig } from "./lib/api";
import { api } from "./lib/api";

export type Panel = "explorer" | "chat" | "mesh" | "llamacpp" | "plugins" | "memory" | "system" | "sysadmin" | null;

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
  content?: string;
  language?: string;
}

interface Tab {
  path: string;
  name: string;
  content: string;
  language: string;
}

interface AppStore {
  showSplash: boolean;
  activePanel: Panel | null;
  setActivePanel: (p: Panel) => void;

  agents: AgentState[];
  activeAgentId: string | null;
  createAgent: (name: string, config: LLMConfig) => Promise<void>;
  deleteAgent: (id: string) => void;
  runAgent: (goal: string) => Promise<void>;
  agentRunning: boolean;

  tools: ToolDef[];
  skills: Skill[];
  loadTools: () => Promise<void>;
  loadSkills: () => Promise<void>;

  files: FileNode[];
  openTabs: Tab[];
  activeTab: string | null;
  openFile: (file: FileNode) => void;
  closeTab: (path: string) => void;

  terminalOutput: string[];
  llamaStatus: LlamaStatus | null;
  refreshLlamaStatus: () => Promise<void>;
  meshResults: MeshResult[];
  runMeshDebate: (goal: string, a: LLMConfig, b: LLMConfig, j: LLMConfig) => Promise<void>;
  meshRunning: boolean;
  plugins: PluginInfo[];
  loadPlugins: () => Promise<void>;
}

// Check if running in Tauri desktop app
function isTauri(): boolean {
  try { return !!(window as any).__TAURI_INTERNALS__; } catch { return false; }
}

// Browser fallback: call LLM directly
async function browserAgentChat(messages: Message[], config: LLMConfig): Promise<string> {
  const isAnthropic = config.provider === "mimo" || config.provider === "anthropic";
  
  if (isAnthropic) {
    // Anthropic-compatible API (MiMo, Anthropic)
    const baseUrl = config.base_url || "https://token-plan-sgp.xiaomimimo.com/v1";
    const systemMsg = messages.find(m => m.role === "system");
    const userMsgs = messages.filter(m => m.role !== "system").map(m => ({
      role: m.role === "agent" || m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));
    const resp = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.api_key || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        system: systemMsg?.content || "",
        messages: userMsgs,
        max_tokens: config.max_tokens || 4096,
      }),
    });
    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`API ${resp.status}: ${errText.slice(0, 200)}`);
    }
    const data = await resp.json() as any;
    if (data.content) {
      return data.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    }
    return "(no response)";
  }
  
  // OpenAI-compatible
  const baseUrl = config.base_url || "https://api.deepseek.com/v1";
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.api_key}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: messages.map((m) => ({ role: m.role === "agent" ? "assistant" : m.role, content: m.content })),
      max_tokens: config.max_tokens || 4096,
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`API ${resp.status}: ${errText.slice(0, 200)}`);
  }
  const data = await resp.json() as any;
  return data.choices?.[0]?.message?.content || "(no response)";
}

export const useStore = create<AppStore>((set, get) => ({
  showSplash: true,
  activePanel: "chat",
  setActivePanel: (p) => set((s) => ({ activePanel: s.activePanel === p ? null : p })),

  agents: [],
  activeAgentId: null,
  agentRunning: false,

  createAgent: async (name, config) => {
    let id: string;
    if (isTauri()) {
      id = await api.createAgent(name, config.provider, config.model, config.api_key, config.base_url);
    } else {
      id = crypto.randomUUID();
    }
    const agent: AgentState = {
      id, name, system_prompt: "", messages: [], active_tools: [], active_skills: [],
      // Store config for browser mode
      _config: config,
    } as any;
    set((s) => ({ agents: [...s.agents, agent], activeAgentId: id }));
    console.log(`Agent "${name}" created (${config.provider}/${config.model})`);
  },

  deleteAgent: (id) => {
    set((s) => {
      const filtered = s.agents.filter((a) => a.id !== id);
      return {
        agents: filtered,
        activeAgentId: s.activeAgentId === id ? (filtered[0]?.id || null) : s.activeAgentId,
      };
    });
  },

  runAgent: async (goal) => {
    const { agents, activeAgentId } = get();
    const agent = agents.find((a) => a.id === activeAgentId);
    if (!agent) {
      console.error("No active agent. Create one first (+ button in titlebar).");
      return;
    }

    const config = (agent as any)._config as LLMConfig | undefined;
    if (!isTauri() && !config?.api_key) {
      const errMsg: Message = { role: "assistant", content: "⚠️ No API key. Set an API key when creating the agent, or use the desktop app." };
      set((s) => ({
        agents: s.agents.map((a) => a.id === agent.id ? { ...a, messages: [...a.messages, errMsg] } : a),
      }));
      return;
    }

    const userMsg: Message = { role: "user", content: goal };
    set((s) => ({
      agents: s.agents.map((a) => a.id === agent.id ? { ...a, messages: [...a.messages, userMsg] } : a),
    }));
    set({ agentRunning: true });

    try {
      if (isTauri()) {
        const allMessages = await api.runAgent(agent.id, goal);
        // Only keep non-system messages for display, preserving history
        const displayMessages = allMessages.filter((m: Message) => m.role !== "system");
        set((s) => ({
          agents: s.agents.map((a) => a.id === agent.id ? { ...a, messages: displayMessages } : a),
        }));
      } else {
        // Browser mode: call LLM directly
        const allMessages = [...agent.messages, userMsg];
        const response = await browserAgentChat(allMessages, config!);
        const assistantMsg: Message = { role: "assistant", content: response };
        set((s) => ({
          agents: s.agents.map((a) =>
            a.id === agent.id ? { ...a, messages: [...a.messages, assistantMsg] } : a
          ),
        }));
      }
    } catch (e: any) {
      console.error("Agent error:", e);
      const errMsg: Message = { role: "assistant", content: `❌ Error: ${e.message || e}` };
      set((s) => ({
        agents: s.agents.map((a) => a.id === agent.id ? { ...a, messages: [...a.messages, errMsg] } : a),
      }));
    }
    set({ agentRunning: false });
  },

  tools: [],
  skills: [],
  loadTools: async () => { try { set({ tools: await api.listTools() }); } catch {} },
  loadSkills: async () => { try { set({ skills: await api.listSkills() }); } catch {} },

  files: [],
  openTabs: [],
  activeTab: null,
  openFile: (file) => {
    if (file.type !== "file") return;
    const tabs = get().openTabs;
    if (tabs.find((t) => t.path === file.path)) {
      set({ activeTab: file.path });
      return;
    }
    set({
      openTabs: [...tabs, {
        path: file.path, name: file.name,
        content: file.content || "",
        language: file.language || "text",
      }],
      activeTab: file.path,
    });
  },
  closeTab: (path) => {
    const tabs = get().openTabs.filter((t) => t.path !== path);
    set({ openTabs: tabs, activeTab: tabs[tabs.length - 1]?.path ?? null });
  },

  terminalOutput: ["ruby@diamond ~ $ _"],
  llamaStatus: null,
  refreshLlamaStatus: async () => { try { set({ llamaStatus: await api.llamaStatus() }); } catch {} },

  meshResults: [],
  meshRunning: false,
  runMeshDebate: async (goal, a, b, j) => {
    set({ meshRunning: true });
    try {
      const result = await api.meshDebate(goal, a, b, j);
      set((s) => ({ meshResults: [result, ...s.meshResults] }));
    } catch (e) { console.error(e); }
    set({ meshRunning: false });
  },

  plugins: [],
  loadPlugins: async () => { try { set({ plugins: await api.pluginListInstalled() }); } catch {} },
}));
