import { useState } from "react";
import { useStore } from "../store";
import { Database, UserPlus, Brain, AlertCircle, Trash2 } from "lucide-react";

// Detect Tauri
let isTauri = false;
try { isTauri = !!(window as any).__TAURI_INTERNALS__; } catch {}

interface LocalPeer {
  id: string;
  name: string;
  role: string;
  description: string;
}

export function MemoryPanel() {
  const [peerName, setPeerName] = useState("");
  const [peerRole, setPeerRole] = useState("");
  const [peerDesc, setPeerDesc] = useState("");
  const [peers, setPeers] = useState<LocalPeer[]>([]);
  const [log, setLog] = useState("");

  const handleCreatePeer = async () => {
    if (!peerName) return;

    if (isTauri) {
      try {
        const { api } = await import("../lib/api");
        const peer: any = await api.memoryCreatePeer(peerName, peerRole, peerDesc);
        setPeers((p) => [...p, { id: peer.id || crypto.randomUUID(), name: peerName, role: peerRole, description: peerDesc }]);
        setLog(`✅ Peer "${peerName}" registered in Honcho`);
      } catch (e: any) {
        setLog(`❌ ${e}`);
      }
    } else {
      // Local in-memory peer (browser mode)
      const peer: LocalPeer = {
        id: crypto.randomUUID(),
        name: peerName,
        role: peerRole || "agent",
        description: peerDesc,
      };
      setPeers((p) => [...p, peer]);
      setLog(`✅ Peer "${peerName}" registered (local memory)`);
    }

    setPeerName("");
    setPeerRole("");
    setPeerDesc("");
  };

  const removePeer = (id: string) => {
    setPeers((p) => p.filter((peer) => peer.id !== id));
    setLog("Peer removed");
  };

  return (
    <div className="panel-right" style={{ width: 360 }}>
      <div className="panel-header">
        <Database size={14} /> Memory
      </div>

      <div className="panel-body" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 11, color: "var(--fg-dim)", lineHeight: 1.5 }}>
          {isTauri
            ? "Honcho memory gives agents persistent identity across sessions. Each agent becomes a \"peer\" that Honcho models over time — learning patterns, strengths, and weaknesses."
            : "Memory stores agent preferences, patterns, and context. In the desktop app, this syncs with Honcho for persistent cross-session memory."
          }
        </div>

        {/* Browser mode notice */}
        {!isTauri && (
          <div style={{
            padding: "8px 10px", borderRadius: 6, fontSize: 10,
            background: "rgba(0,188,212,0.08)", border: "1px solid rgba(0,188,212,0.15)",
            color: "var(--cyan)", lineHeight: 1.5, display: "flex", gap: 6,
          }}>
            <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Browser mode — peers are stored in memory only. Launch the desktop app for Honcho persistence.</span>
          </div>
        )}

        {/* Register peer */}
        <div style={{
          padding: 10, borderRadius: 8, background: "var(--bg-input)",
          border: "1px solid var(--border)",
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <UserPlus size={12} /> Register Agent Peer
          </div>

          <label style={{ fontSize: 11 }}>Agent Name</label>
          <input value={peerName} onChange={(e) => setPeerName(e.target.value)} placeholder="coder" className="input" style={{ marginBottom: 4 }} />

          <label style={{ fontSize: 11 }}>Role</label>
          <input value={peerRole} onChange={(e) => setPeerRole(e.target.value)} placeholder="coding assistant" className="input" style={{ marginBottom: 4 }} />

          <label style={{ fontSize: 11 }}>Description</label>
          <input value={peerDesc} onChange={(e) => setPeerDesc(e.target.value)} placeholder="expert python" className="input" style={{ marginBottom: 8 }} />

          <button className="btn-primary" onClick={handleCreatePeer} style={{ fontSize: 11 }}>
            Register Peer
          </button>
        </div>

        {/* Registered peers */}
        {peers.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: "var(--fg-dim)", marginBottom: 4 }}>
              Registered Peers ({peers.length})
            </div>
            {peers.map((p) => (
              <div key={p.id} style={{
                padding: "6px 10px", borderRadius: 4,
                background: "var(--bg-input)", marginBottom: 4,
                fontSize: 11, display: "flex", alignItems: "center", gap: 8,
              }}>
                <Brain size={12} color="var(--accent)" />
                <span style={{ fontWeight: 600 }}>{p.name}</span>
                <span style={{ color: "var(--fg-dim)" }}>· {p.role}</span>
                <span style={{ color: "var(--fg-muted)", fontSize: 10, marginLeft: "auto" }}>{p.description}</span>
                <button
                  onClick={() => removePeer(p.id)}
                  style={{ background: "none", border: "none", color: "var(--fg-dim)", cursor: "pointer", padding: 2 }}
                  title="Remove peer"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Memory types legend */}
        <div style={{
          marginTop: "auto", padding: 8,
          borderTop: "1px solid var(--border)",
        }}>
          <div style={{ fontSize: 10, color: "var(--fg-dim)", lineHeight: 1.6 }}>
            <strong>Episodic:</strong> Raw task traces (never summarized)
            <br />
            <strong>Semantic:</strong> Learned patterns & rules
            <br />
            <strong>Procedural:</strong> Skill effectiveness scores
            <br />
            <strong>Honcho:</strong> Peer models via dialectic reasoning
          </div>
        </div>

        {log && (
          <div style={{
            fontSize: 10, fontFamily: "var(--font-mono)",
            color: log.startsWith("✅") ? "var(--green)" : log.startsWith("❌") ? "var(--ruby)" : "var(--fg-dim)",
          }}>
            {log}
          </div>
        )}
      </div>
    </div>
  );
}
