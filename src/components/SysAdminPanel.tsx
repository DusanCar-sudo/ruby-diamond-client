// ============================================================================
// Ruby Diamond — System Admin Agent
// ============================================================================

import { useState, useRef, useEffect } from "react";
import { ShieldCheck, Send, Terminal, AlertTriangle, CheckCircle } from "lucide-react";

const SYSADMIN_PROMPT = `You are the Ruby Diamond System Administrator. Your job is to keep this Fedora Linux system in excellent shape.

You have full bash access. You can run any command — updates, cleanup, diagnostics, fixes.

Your responsibilities:
1. **Updates** — Check for and install system updates (dnf update, flatpak update)
2. **Cleanup** — Remove old kernels, clean package cache, clear temp files, empty trash
3. **Monitoring** — Check disk usage, RAM, CPU, running services, failed units
4. **Security** — Check firewall status, SELinux, failed login attempts
5. **Optimization** — Identify heavy processes, suggest improvements
6. **Logs** — Check system logs for errors (journalctl)

Guidelines:
- Be proactive — suggest maintenance tasks before problems occur
- Explain what each command does before running it
- Use sudo when needed — the user will approve
- Report what you found and what you did
- Keep it concise — show commands and results
- Prioritize safety — never remove anything critical without asking`;

async function callSysAdmin(messages: Array<{role: string; content: string}>, apiKey: string): Promise<string> {
  const resp = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: SYSADMIN_PROMPT },
        ...messages,
      ],
      max_tokens: 4096,
    }),
  });
  if (!resp.ok) throw new Error(`API ${resp.status}`);
  const data = await resp.json() as any;
  return data.choices?.[0]?.message?.content || "(no response)";
}

interface LogEntry {
  id: string;
  type: "agent" | "user" | "command" | "result" | "warning" | "success";
  text: string;
  time: number;
}

export function SysAdminPanel() {
  const [apiKey, setApiKey] = useState(localStorage.getItem("rd_sysadmin_key") || "");
  const [input, setInput] = useState("");
  const [log, setLog] = useState<LogEntry[]>([
    { id: "welcome", type: "agent", text: "🛡️ System Admin ready. I'll keep your Fedora system healthy.\n\nTry:\n• `check system health`\n• `clean up system`\n• `install updates`\n• `check for issues`", time: Date.now() },
  ]);
  const [running, setRunning] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [showKeySetup, setShowKeySetup] = useState(!apiKey);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  const addLog = (type: LogEntry["type"], text: string) => {
    setLog((l) => [...l, { id: crypto.randomUUID(), type, text, time: Date.now() }]);
  };

  const runCommand = async (cmd: string): Promise<string> => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<{output: string; success: boolean; error?: string}>("execute_tool", {
        toolName: "bash",
        arguments: { command: cmd, timeout: 30 },
      });
      return result.error ? `Error: ${result.error}` : result.output || "(no output)";
    } catch (e: any) {
      return `Error: ${e}`;
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || running) return;
    setInput("");
    setRunning(true);
    addLog("user", text);

    if (!apiKey) {
      addLog("warning", "Set your API key first (click Settings icon).");
      setRunning(false);
      return;
    }

    try {
      const messages = log
        .filter((l) => l.type === "user" || l.type === "agent")
        .map((l) => ({ role: l.type === "user" ? "user" : "assistant", content: l.text }));
      messages.push({ role: "user", content: text });

      const response = await callSysAdmin(messages, apiKey);
      addLog("agent", response);

      // Auto-execute suggested commands
      const cmdPattern = /`([^`]+)`/g;
      let match;
      while ((match = cmdPattern.exec(response)) !== null) {
        const cmd = match[1].trim();
        if (cmd.startsWith("dnf") || cmd.startsWith("sudo") || cmd.startsWith("systemctl") ||
            cmd.startsWith("journalctl") || cmd.startsWith("flatpak") || cmd.startsWith("du") ||
            cmd.startsWith("df") || cmd.startsWith("free") || cmd.startsWith("top") ||
            cmd.startsWith("ps") || cmd.startsWith("ls") || cmd.startsWith("rm") ||
            cmd.startsWith("find") || cmd.startsWith("grep")) {
          addLog("command", `$ ${cmd}`);
          const result = await runCommand(cmd);
          addLog("result", result.slice(0, 500));
        }
      }
    } catch (e: any) {
      addLog("warning", `Error: ${e.message || e}`);
    }
    setRunning(false);
  };

  const quickActions = [
    { label: "Check Health", cmd: "check system health — CPU, RAM, disk, services, errors" },
    { label: "Clean Up", cmd: "clean up the system — old kernels, cache, temp files, trash" },
    { label: "Update All", cmd: "install all available system updates" },
    { label: "Security Audit", cmd: "run a security audit — firewall, SELinux, failed logins, open ports" },
    { label: "Optimize", cmd: "analyze system performance and suggest optimizations" },
  ];

  if (showKeySetup) {
    return (
      <div className="panel-right" style={{ width: 420 }}>
        <div className="panel-header"><ShieldCheck size={14} /> System Admin</div>
        <div className="panel-body" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, color: "var(--fg-dim)", lineHeight: 1.5 }}>
            Enter your DeepSeek API key to enable the System Admin agent.
          </div>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..." className="input" autoFocus
            onKeyDown={(e) => e.key === "Enter" && apiKey.trim() && (localStorage.setItem("rd_sysadmin_key", apiKey), setShowKeySetup(false))} />
          <button className="btn-primary" onClick={() => { localStorage.setItem("rd_sysadmin_key", apiKey); setShowKeySetup(false); }}
            disabled={!apiKey.trim()}>Connect</button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-right" style={{ width: 420 }}>
      <div className="panel-header">
        <ShieldCheck size={14} /> System Admin
        <button onClick={() => { localStorage.removeItem("rd_sysadmin_key"); setApiKey(""); setShowKeySetup(true); }}
          style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--fg-dim)", cursor: "pointer", fontSize: 10 }}>
          Key
        </button>
      </div>

      <div className="panel-body" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Quick actions */}
        <div style={{ padding: "6px 8px", display: "flex", gap: 4, flexWrap: "wrap", borderBottom: "1px solid var(--border)" }}>
          {quickActions.map((a) => (
            <button key={a.label} onClick={() => { setInput(a.cmd); }}
              disabled={running}
              style={{
                padding: "3px 8px", fontSize: 10, borderRadius: 4,
                background: "var(--bg-input)", border: "1px solid var(--border)",
                color: "var(--fg-dim)", cursor: "pointer", whiteSpace: "nowrap",
              }}>
              {a.label}
            </button>
          ))}
        </div>

        {/* Log */}
        <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {log.map((entry) => (
            <div key={entry.id} style={{
              padding: "6px 10px", borderRadius: 6, fontSize: 12,
              lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word",
              background:
                entry.type === "user" ? "var(--accent)" :
                entry.type === "command" ? "rgba(0,0,0,0.05)" :
                entry.type === "warning" ? "rgba(224,122,95,0.1)" :
                entry.type === "success" ? "rgba(91,140,90,0.1)" :
                entry.type === "result" ? "var(--bg-input)" :
                "var(--bg-raised)",
              color:
                entry.type === "user" ? "var(--fg-inverse)" :
                entry.type === "command" ? "var(--accent)" :
                entry.type === "warning" ? "var(--ruby)" :
                entry.type === "success" ? "var(--green)" :
                "var(--fg)",
              fontFamily: entry.type === "command" || entry.type === "result" ? "var(--font-mono)" : "var(--font-sans)",
              border: entry.type === "agent" ? "1px solid var(--border)" : "none",
              alignSelf: entry.type === "user" ? "flex-end" : "flex-start",
              maxWidth: "90%",
            }}>
              {entry.type === "command" && <Terminal size={10} style={{ marginRight: 4, opacity: 0.5 }} />}
              {entry.type === "warning" && <AlertTriangle size={10} style={{ marginRight: 4 }} />}
              {entry.type === "success" && <CheckCircle size={10} style={{ marginRight: 4 }} />}
              {entry.text}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: 8, borderTop: "1px solid var(--border)", display: "flex", gap: 6 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
            placeholder="check system health..."
            className="input"
            style={{ flex: 1, fontSize: 12 }}
            disabled={running}
          />
          <button className="chat-send" onClick={handleSend} disabled={running || !input.trim()}>
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
