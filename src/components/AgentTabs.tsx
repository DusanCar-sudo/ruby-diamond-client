import { useState } from "react";
import { useStore } from "../store";
import { Plus, X, Sparkles } from "lucide-react";

const PROVIDERS = [
  { id: "openai", name: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "o4-mini", "o3-mini", "gpt-4.1-nano"] },
  { id: "anthropic", name: "Anthropic", models: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-haiku-3-5-20241022", "claude-3-5-sonnet-20241022"] },
  { id: "deepseek", name: "DeepSeek", models: ["deepseek-chat", "deepseek-reasoner"] },
  { id: "groq", name: "Groq", models: ["llama-4-maverick-17b-128e", "deepseek-r1-distill-llama-70b", "llama-3.3-70b-versatile", "mixtral-8x7b-32768", "gemma2-9b-it"] },
  { id: "google", name: "Google Gemini", models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"] },
  { id: "xai", name: "xAI Grok", models: ["grok-3", "grok-3-mini"] },
  { id: "openrouter", name: "OpenRouter", models: ["openai/gpt-4o", "anthropic/claude-sonnet-4", "google/gemini-2.5-pro", "meta-llama/llama-4-maverick"] },
  { id: "cerebras", name: "Cerebras", models: ["llama-4-scout-17b-16e", "llama-3.3-70b"] },
  { id: "mistral", name: "Mistral", models: ["mistral-large-latest", "mistral-small-latest", "codestral-latest"] },
  { id: "together", name: "Together AI", models: ["meta-llama/Llama-4-Maverick-17B-128E", "deepseek-ai/DeepSeek-R1", "mistralai/Mixtral-8x7B"] },
  { id: "fireworks", name: "Fireworks", models: ["accounts/fireworks/models/llama-v3p1-405b", "accounts/fireworks/models/deepseek-r1"] },
  { id: "llamacpp", name: "Llama.cpp (Local)", models: ["local"] },
  { id: "ollama", name: "Ollama (Local)", models: ["llama3.2", "codellama", "deepseek-r1", "mistral", "phi4"] },
  { id: "mimo", name: "Xiaomi MiMo", models: ["mimo-v2", "mimo-v2-fast", "MiMo-V2.5-Pro", "MiMo-V2.5"] },
  { id: "mimo-cn", name: "MiMo Token (China)", models: ["mimo-v2"] },
  { id: "mimo-ams", name: "MiMo Token (Amsterdam)", models: ["mimo-v2"] },
  { id: "mimo-sgp", name: "MiMo Token (Singapore)", models: ["mimo-v2"] },
];

export function AgentTabs() {
  const { agents, activeAgentId, createAgent, deleteAgent } = useStore();
  const [showSetup, setShowSetup] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("deepseek");
  const [model, setModel] = useState("deepseek-chat");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    const prov = PROVIDERS.find((p) => p.id === provider)!;
    await createAgent(name, {
      provider,
      model,
      api_key: apiKey || undefined,
      base_url: baseUrl || (provider === "mimo" ? "https://token-plan-sgp.xiaomimimo.com/v1" : undefined),
      max_tokens: 4096,
      temperature: 0.3,
    });
    setShowSetup(false);
    setName("");
    setApiKey("");
    setBaseUrl("");
  };

  return (
    <>
      <div style={{ display: "flex", gap: 4, marginLeft: 16, alignItems: "center" }}>
        {agents.map((a) => (
          <span
            key={a.id}
            className="agent-tab"
            style={{
              padding: "2px 10px",
              borderRadius: 4,
              fontSize: 11,
              background: a.id === activeAgentId ? "var(--accent)" : "transparent",
              color: a.id === activeAgentId ? "white" : "var(--fg-dim)",
              cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}
            onClick={() => useStore.setState({ activeAgentId: a.id })}
          >
            {a.name}
            <span
              onClick={(e) => { e.stopPropagation(); deleteAgent(a.id); }}
              style={{ fontSize: 13, opacity: 0.5, cursor: "pointer", lineHeight: 1 }}
              title="Delete agent"
            >×</span>
          </span>
        ))}
        <button
          onClick={() => setShowSetup(true)}
          style={{
            background: "none", border: "1px dashed var(--border)",
            borderRadius: 4, color: "var(--fg-dim)", cursor: "pointer",
            padding: "2px 6px", fontSize: 13,
          }}
        >
          <Plus size={12} />
        </button>
      </div>

      {showSetup && (
        <div className="modal-overlay" onClick={() => setShowSetup(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span><Sparkles size={14} /> New Agent</span>
              <button onClick={() => setShowSetup(false)} style={{ background: "none", border: "none", color: "var(--fg-dim)", cursor: "pointer" }}>
                <X size={14} />
              </button>
            </div>
            <div className="modal-body">
              <label>Agent Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Coding Assistant" />

              <label>Provider</label>
              <select value={provider} onChange={(e) => { setProvider(e.target.value); setModel(PROVIDERS.find(p => p.id === e.target.value)?.models[0] || ""); }}>
                {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              <label>Model</label>
              <select value={model} onChange={(e) => setModel(e.target.value)}>
                {PROVIDERS.find(p => p.id === provider)?.models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>

              <label>API Key (optional, uses env var if blank)</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." />

              <label>Base URL (for local models or custom endpoints)</label>
              <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://127.0.0.1:1234/v1" />

              <button className="btn-primary" onClick={handleCreate}>Create Agent</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
