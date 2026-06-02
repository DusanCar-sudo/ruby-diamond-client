import { useState, useEffect } from "react";
import React from "react";
import { useStore } from "./store";
import { Splash } from "./components/Splash";
import { Sidebar } from "./components/Sidebar";
import { Explorer } from "./components/Explorer";
import { EditorTabs, Editor } from "./components/Editor";
import { TerminalPanel } from "./components/Terminal";
import { ChatPanel } from "./components/Chat";
import { AgentTabs } from "./components/AgentTabs";
import { MeshPanel } from "./components/MeshPanel";
import { LlamaPanel } from "./components/LlamaPanel";
import { PluginPanel } from "./components/PluginPanel";
import { MemoryPanel } from "./components/MemoryPanel";
import { SystemPanel } from "./components/SystemPanel";
import { SysAdminPanel } from "./components/SysAdminPanel";
import { X, Minus, Maximize2 } from "lucide-react";
import "./styles.css";

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", background: "#0D0D0F", color: "#D4CFC6",
      fontFamily: "monospace", flexDirection: "column", gap: 16, padding: 40,
    }}>
      <div style={{ fontSize: 48, color: "#9D0B28" }}>◆</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>Something went wrong</div>
      <div style={{
        fontSize: 12, color: "#666", maxWidth: 500, textAlign: "center",
        background: "#141417", padding: 16, borderRadius: 8, whiteSpace: "pre-wrap",
      }}>
        {error.message}
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) return <ErrorFallback error={this.state.error} />;
    return this.props.children;
  }
}

export default function App() {
  const { showSplash, activePanel, loadTools, loadSkills, refreshLlamaStatus, loadPlugins } = useStore();

  // Spawn default MiMo agent on first load
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (initialized) return;
    setInitialized(true);

    // Watch for splash dismissal to auto-create MiMo agent
    const check = setInterval(() => {
      const s = useStore.getState();
      if (!s.showSplash && s.agents.length === 0) {
        s.createAgent("Ruby", {
          provider: "mimo",
          model: "MiMo-V2.5-Pro",
          api_key: "tp-s49my2xvw1j15zyvnhobkc0jnb1lr31zjzq27ggfl9v50r70",
          base_url: "https://token-plan-sgp.xiaomimimo.com/v1",
          max_tokens: 4096,
          temperature: 0.3,
        });
        clearInterval(check);
      }
    }, 300);

    loadTools().catch(() => {});
    loadSkills().catch(() => {});
    refreshLlamaStatus().catch(() => {});
    loadPlugins().catch(() => {});
    return () => clearInterval(check);
  }, [initialized]);

  return (
    <ErrorBoundary>
      {showSplash ? (
        <Splash onDismiss={() => useStore.setState({ showSplash: false })} />
      ) : (
        <div className="app">
          <div className="titlebar">
            <div className="titlebar-left">
              <img src="/ruby.svg" className="titlebar-logo" alt="" />
              <span className="titlebar-title">RUBY DIAMOND</span>
              <AgentTabs />
            </div>
            <div className="titlebar-actions">
              <button className="titlebar-dot dot-min"><Minus size={8} /></button>
              <button className="titlebar-dot dot-max"><Maximize2 size={8} /></button>
              <button className="titlebar-dot dot-close"><X size={8} /></button>
            </div>
          </div>
          <div className="workspace">
            <Sidebar active={activePanel} onSelect={(p) => useStore.getState().setActivePanel(p)} />
            {/* Explorer always visible */}
            <Explorer />
            <div className="panels">
              <div className="editor-area">
                <EditorTabs />
                <Editor />
                <TerminalPanel />
              </div>
              {/* Right panel toggles based on sidebar */}
              {activePanel === "chat" && <ChatPanel />}
              {activePanel === "mesh" && <MeshPanel />}
              {activePanel === "llamacpp" && <LlamaPanel />}
              {activePanel === "plugins" && <PluginPanel />}
              {activePanel === "memory" && <MemoryPanel />}
              {activePanel === "system" && <SystemPanel />}
              {activePanel === "sysadmin" && <SysAdminPanel />}
              {!activePanel && <ChatPanel />}
            </div>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
}
