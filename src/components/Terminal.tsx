import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

export function TerminalPanel() {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (!termRef.current || xtermRef.current) return;

    const term = new XTerm({
      cursorBlink: true, cursorStyle: "bar",
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace',
      fontSize: 13,
      theme: {
        background: "#0a0a0a", foreground: "#e0e0e0",
        cursor: "#FF1493", cursorAccent: "#0a0a0a",
        selectionBackground: "#E0115F44",
        green: "#00ff88", red: "#E0115F", cyan: "#00ddff",
        magenta: "#FF1493", yellow: "#ffcc00",
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(new WebLinksAddon());
    term.open(termRef.current);
    fitAddon.fit();

    term.writeln("╔══════════════════════════════════════════╗");
    term.writeln("║   \x1b[1;35mRuby Diamond Client v0.1.0\x1b[0m            ║");
    term.writeln("║   AI Terminal · Tools · Skills · Agents  ║");
    term.writeln("╚══════════════════════════════════════════╝");
    term.writeln("");
    term.write("\x1b[1;32mruby@diamond\x1b[0m ~ $ ");

    let currentLine = "";
    term.onData((data) => {
      if (data === "\r") {
        term.writeln("");
        handleCommand(currentLine.trim(), term);
        currentLine = "";
        term.write("\x1b[1;32mruby@diamond\x1b[0m ~ $ ");
      } else if (data === "\x7f") {
        if (currentLine.length > 0) { currentLine = currentLine.slice(0, -1); term.write("\b \b"); }
      } else {
        currentLine += data; term.write(data);
      }
    });

    xtermRef.current = term;
    const handleResize = () => fitAddon.fit();
    window.addEventListener("resize", handleResize);
    return () => { window.removeEventListener("resize", handleResize); term.dispose(); };
  }, []);

  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <span style={{ fontSize: 11, color: "var(--fg-dim)" }}>Terminal</span>
        <button onClick={() => xtermRef.current?.clear()} style={{ background: "none", border: "none", color: "var(--fg-dim)", cursor: "pointer", fontSize: 11 }}>Clear</button>
      </div>
      <div className="terminal-content" ref={termRef} />
    </div>
  );
}

function handleCommand(cmd: string, term: XTerm) {
  if (!cmd) return;
  switch (cmd) {
    case "help":
      term.writeln("\n  help | about | clear | status | build | test | agent <goal>");
      term.writeln("");
      break;
    case "about":
      term.writeln("\n  \x1b[1;35mRuby Diamond\x1b[0m v0.1.0 — 7MB AI coding tool");
      term.writeln("  Tools: 10 | Skills: 3 | Mesh protocols: 3\n");
      break;
    case "status":
      term.writeln("\n  \x1b[32m●\x1b[0m Agent: Ready");
      term.writeln("  \x1b[32m●\x1b[0m Tools: 10 loaded");
      term.writeln("  \x1b[32m●\x1b[0m Skills: 3 loaded");
      term.writeln("  \x1b[32m●\x1b[0m Binary: \x1b[36m7.1MB\x1b[0m\n");
      break;
    case "clear": term.clear(); break;
    case "build":
      term.writeln("\n  🔨 cargo build --release");
      term.writeln("  \x1b[32m✅ Finished in 1.5s (7.1MB)\x1b[0m\n");
      break;
    default:
      if (cmd.startsWith("agent ")) {
        term.writeln(`\n  ⚡ Agent: ${cmd.slice(6)}`);
        term.writeln("  📋 Plan → Execute → Verify");
        term.writeln("  \x1b[32m✅ Done.\x1b[0m\n");
      } else if (cmd.startsWith("echo ")) {
        term.writeln(`\n  ${cmd.slice(5)}\n`);
      } else {
        term.writeln(`\n  bash: ${cmd}: command not found\n`);
      }
  }
}
