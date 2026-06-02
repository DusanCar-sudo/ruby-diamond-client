import { useState, useEffect } from "react";
import { useStore } from "../store";
import { Cpu, Play, Square, HardDrive, RefreshCw, AlertCircle } from "lucide-react";

// Detect if we're running inside Tauri
let isTauri = false;
try {
  isTauri = !!(window as any).__TAURI_INTERNALS__;
} catch {}

export function LlamaPanel() {
  const { llamaStatus, refreshLlamaStatus } = useStore();
  const [modelPath, setModelPath] = useState("");
  const [port, setPort] = useState(8080);
  const [nGpu, setNGpu] = useState(0);
  const [ctxSize, setCtxSize] = useState(4096);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    if (isTauri) refreshLlamaStatus();
  }, []);

  const handleStart = async () => {
    if (!isTauri) {
      setLog((l) => [...l, "⚠️ Llama.cpp management requires the Tauri desktop app."]);
      setLog((l) => [...l, "   To use a local model in the browser:"]);
      setLog((l) => [...l, "   1. Start LM Studio or Ollama separately"]);
      setLog((l) => [...l, "   2. Create an agent with Llama.cpp or Ollama provider"]);
      setLog((l) => [...l, "   3. Set the base URL to your server (e.g. http://127.0.0.1:1234/v1)"]);
      return;
    }
    setLoading(true);
    setLog((l) => [...l, `Starting llama-server with ${modelPath}...`]);
    try {
      const { api } = await import("../lib/api");
      const url = await api.llamaStart(modelPath, port, nGpu, ctxSize);
      setLog((l) => [...l, `✅ Server running at ${url}`]);
      refreshLlamaStatus();
    } catch (e: any) {
      setLog((l) => [...l, `❌ ${e}`]);
    }
    setLoading(false);
  };

  const handleStop = async () => {
    if (!isTauri) return;
    const { api } = await import("../lib/api");
    try {
      await api.llamaStop();
      setLog((l) => [...l, "Server stopped"]);
      refreshLlamaStatus();
    } catch (e: any) {
      setLog((l) => [...l, `Error: ${e}`]);
    }
  };

  const status = llamaStatus;

  return (
    <div className="panel-right" style={{ width: 360 }}>
      <div className="panel-header">
        <Cpu size={14} /> Local LLM
      </div>

      <div className="panel-body" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Browser mode notice */}
        {!isTauri && (
          <div style={{
            padding: "10px 12px", borderRadius: 6, fontSize: 11,
            background: "rgba(255,204,0,0.08)", border: "1px solid rgba(255,204,0,0.2)",
            color: "var(--copper)", lineHeight: 1.5,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <AlertCircle size={13} />
              <strong>Browser Mode</strong>
            </div>
            Llama.cpp server management requires the desktop app. To use local models now, create an agent with the <strong>Llama.cpp</strong> or <strong>Ollama</strong> provider and enter your server URL as the base URL.
          </div>
        )}

        {/* Status (Tauri only) */}
        {isTauri && (
          <div style={{
            padding: "8px 12px", borderRadius: 6,
            background: status?.running ? "rgba(0,255,136,0.1)" : "var(--bg-input)",
            border: `1px solid ${status?.running ? "var(--green)" : "var(--border)"}`,
            fontSize: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: status?.running ? "var(--green)" : "var(--fg-dim)",
                display: "inline-block",
              }} />
              <span>{status?.running ? `Running — ${status.server_url}` : "Not running"}</span>
            </div>
            {status?.model && <div style={{ marginTop: 4, fontSize: 11, color: "var(--fg-dim)" }}>Model: {status.model}</div>}
          </div>
        )}

        {/* Start controls (Tauri only) */}
        {isTauri && !status?.running && (
          <>
            <label style={{ fontSize: 11 }}>Model Path</label>
            <input
              value={modelPath}
              onChange={(e) => setModelPath(e.target.value)}
              placeholder="/path/to/model.gguf"
              className="input"
            />

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11 }}>Port</label>
                <input type="number" value={port} onChange={(e) => setPort(+e.target.value)} className="input" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11 }}>GPU Layers</label>
                <input type="number" value={nGpu} onChange={(e) => setNGpu(+e.target.value)} className="input" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11 }}>Context</label>
                <input type="number" value={ctxSize} onChange={(e) => setCtxSize(+e.target.value)} className="input" />
              </div>
            </div>

            <button className="btn-primary" onClick={handleStart} disabled={loading || !modelPath}>
              <Play size={12} /> Start Server
            </button>
          </>
        )}

        {isTauri && status?.running && (
          <button className="btn-primary" onClick={handleStop} style={{ background: "var(--ruby)" }}>
            <Square size={12} /> Stop Server
          </button>
        )}

        {/* Discovered models (Tauri only) */}
        {isTauri && status && status.models_available.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: "var(--fg-dim)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
              <HardDrive size={11} /> Available Models
              <button onClick={refreshLlamaStatus} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", marginLeft: "auto" }}>
                <RefreshCw size={10} />
              </button>
            </div>
            {status.models_available.map((m) => (
              <div
                key={m.path}
                onClick={() => setModelPath(m.path)}
                style={{
                  padding: "4px 8px", fontSize: 11, cursor: "pointer",
                  background: modelPath === m.path ? "rgba(224,17,95,0.15)" : "transparent",
                  borderRadius: 4, display: "flex", justifyContent: "space-between",
                }}
              >
                <span>{m.name}</span>
                <span style={{ color: "var(--fg-dim)" }}>{formatBytes(m.size_bytes)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Log */}
        {log.length > 0 && (
          <div style={{ flex: 1, overflow: "auto", fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--fg-dim)", maxHeight: 200 }}>
            {log.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}
