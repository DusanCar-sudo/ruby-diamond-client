import { useState, useRef, useEffect } from "react";
import { useStore } from "../store";
import { Send, Sparkles } from "lucide-react";

export function ChatPanel() {
  const { agents, activeAgentId, runAgent, agentRunning } = useStore();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const agent = agents.find((a) => a.id === activeAgentId);
  const messages = agent?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || agentRunning) return;
    
    // Handle slash commands
    if (input.startsWith("/")) {
      const cmd = input.trim().toLowerCase();
      if (cmd === "/model" || cmd === "/help") {
        // These will be handled by the agent as regular messages
        // Filter out unknown commands
        if (cmd !== "/model") {
          console.log("Unknown command:", cmd);
          setInput("");
          return;
        }
      }
    }
    
    runAgent(input.trim());
    setInput("");
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span>✦ {agent?.name || "AI Agent"}</span>
        {agent && (
          <span style={{ fontSize: 10, color: "var(--fg-dim)", marginLeft: 8 }}>
            {((agent as any)._config as any)?.provider}/{((agent as any)._config as any)?.model || "?"}
          </span>
        )}
        <button
          onClick={() => useStore.getState().setActivePanel("explorer")}
          style={{ marginLeft: "auto", fontSize: 10, color: "var(--cyan)", background: "none", border: "none", cursor: "pointer" }}
          title="Create new agent with + in titlebar"
        >
          switch model → use +
        </button>
        <Sparkles size={14} color="var(--accent-glow)" />
      </div>
      <div className="chat-messages">
        {messages.filter((m) => m.role !== "system").map((msg, i) => (
          <div key={i} className={`chat-msg ${msg.role}`}>
            <div style={{ fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {msg.content.slice(0, 1000)}
            </div>
            {msg.tool_calls && msg.tool_calls.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 10, color: "var(--cyan)" }}>
                🔧 {msg.tool_calls.map((tc) => tc.name).join(", ")}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-area">
        <textarea
          className="chat-input"
          rows={2}
          placeholder={agentRunning ? "Agent running..." : "Ask Ruby Diamond..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          disabled={agentRunning}
        />
        <button className="chat-send" onClick={handleSend} disabled={agentRunning}>
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
