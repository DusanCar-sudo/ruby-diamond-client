import { useState } from "react";
import { useStore } from "../store";
import { Package, Download, Trash2, RefreshCw, Globe, AlertCircle } from "lucide-react";

// Detect Tauri
let isTauri = false;
try { isTauri = !!(window as any).__TAURI_INTERNALS__; } catch {}

export function PluginPanel() {
  const { plugins, loadPlugins } = useStore();
  const [source, setSource] = useState("");
  const [name, setName] = useState("");
  const [installing, setInstalling] = useState(false);
  const [log, setLog] = useState("");

  const handleInstall = async () => {
    if (!name || !source) return;
    if (!isTauri) {
      setLog("⚠️ Plugin installation requires the Tauri desktop app. Skills can be added manually by placing SKILL.md files in ~/.ruby-diamond/skills/.");
      return;
    }
    setInstalling(true);
    setLog(`Installing ${name}...`);
    try {
      const { api } = await import("../lib/api");
      await api.pluginInstall(name, source);
      setLog(`✅ ${name} installed!`);
      setName("");
      setSource("");
      loadPlugins();
    } catch (e: any) {
      setLog(`❌ ${e}`);
    }
    setInstalling(false);
  };

  const handleUninstall = async (pluginName: string) => {
    if (!isTauri) {
      setLog("⚠️ Plugin management requires the Tauri desktop app.");
      return;
    }
    try {
      const { api } = await import("../lib/api");
      await api.pluginUninstall(pluginName);
      loadPlugins();
    } catch (e: any) {
      setLog(`❌ ${e}`);
    }
  };

  return (
    <div className="panel-right" style={{ width: 360 }}>
      <div className="panel-header">
        <Package size={14} /> Plugin Marketplace
      </div>

      <div className="panel-body" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {/* Browser mode notice */}
        {!isTauri && (
          <div style={{
            padding: "8px 10px", borderRadius: 6, fontSize: 10,
            background: "rgba(0,188,212,0.08)", border: "1px solid rgba(0,188,212,0.15)",
            color: "var(--cyan)", lineHeight: 1.5, display: "flex", gap: 6,
          }}>
            <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Browser mode — plugin install requires the desktop app.</span>
          </div>
        )}

        {/* Install section */}
        <div style={{
          padding: 10, borderRadius: 8, background: "var(--bg-input)",
          border: "1px solid var(--border)",
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Download size={12} /> Install Plugin
          </div>

          <label style={{ fontSize: 11 }}>Plugin Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-skill"
            className="input"
            style={{ marginBottom: 6 }}
          />

          <label style={{ fontSize: 11 }}>Source (URL, git repo, or local path)</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="https://raw.githubusercontent.com/.../SKILL.md"
              className="input"
              style={{ flex: 1 }}
            />
            <button
              className="btn-primary"
              onClick={handleInstall}
              disabled={installing || !name || !source}
              style={{ padding: "4px 12px", whiteSpace: "nowrap" }}
            >
              Install
            </button>
          </div>

          {log && (
            <div style={{ marginTop: 6, fontSize: 11, color: log.startsWith("✅") ? "var(--green)" : "var(--ruby)", fontFamily: "var(--font-mono)" }}>
              {log}
            </div>
          )}
        </div>

        {/* Installed plugins */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: "var(--fg-dim)" }}>
              Installed ({plugins.length})
            </span>
            <button onClick={loadPlugins} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer" }}>
              <RefreshCw size={10} />
            </button>
          </div>

          {plugins.length === 0 && (
            <div style={{ fontSize: 11, color: "var(--fg-dim)", padding: 8, textAlign: "center" }}>
              No plugins installed. Install a skill to get started.
            </div>
          )}

          {plugins.map((p) => (
            <div key={p.name} style={{
              padding: "8px 10px", borderRadius: 6,
              background: "var(--bg-input)", border: "1px solid var(--border)",
              marginBottom: 6,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: "var(--fg-dim)" }}>v{p.version} · {p.author}</div>
                </div>
                <button
                  onClick={() => handleUninstall(p.name)}
                  style={{ background: "none", border: "none", color: "var(--ruby)", cursor: "pointer", padding: 4 }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
              {p.description && (
                <div style={{ fontSize: 10, color: "var(--fg-dim)", marginTop: 4 }}>
                  {p.description}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Registry hint */}
        <div style={{
          fontSize: 10, color: "var(--fg-dim)", textAlign: "center",
          padding: 8, borderTop: "1px solid var(--border)",
        }}>
          <Globe size={10} /> Skills follow the <a href="https://agentskills.io" style={{ color: "var(--cyan)" }}>Agent Skills</a> standard
        </div>
      </div>
    </div>
  );
}
