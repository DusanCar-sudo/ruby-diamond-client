// ============================================================================
// Ruby Diamond Client — AI Coding Agent with Tools
// ============================================================================

// ============================================================================
// Tool Definitions
// ============================================================================

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string }>;
  required: string[];
}

export const TOOLS: ToolDef[] = [
  {
    name: "bash",
    description: "Execute a shell command and return the output",
    parameters: {
      command: { type: "string", description: "The shell command to execute" },
      cwd: { type: "string", description: "Working directory (optional)" },
    },
    required: ["command"],
  },
  {
    name: "read",
    description: "Read the contents of a file",
    parameters: {
      path: { type: "string", description: "Path to the file" },
      offset: { type: "number", description: "Line number to start reading from (optional)" },
      limit: { type: "number", description: "Maximum lines to read (optional)" },
    },
    required: ["path"],
  },
  {
    name: "write",
    description: "Write content to a file. Creates the file if it doesn't exist.",
    parameters: {
      path: { type: "string", description: "Path to the file" },
      content: { type: "string", description: "Content to write" },
    },
    required: ["path", "content"],
  },
  {
    name: "edit",
    description: "Edit a file by replacing exact text",
    parameters: {
      path: { type: "string", description: "Path to the file" },
      oldText: { type: "string", description: "Exact text to replace" },
      newText: { type: "string", description: "Replacement text" },
    },
    required: ["path", "oldText", "newText"],
  },
  {
    name: "grep",
    description: "Search for a pattern in files",
    parameters: {
      pattern: { type: "string", description: "Text or regex pattern to search" },
      path: { type: "string", description: "File or directory to search (optional)" },
    },
    required: ["pattern"],
  },
  {
    name: "ls",
    description: "List files in a directory",
    parameters: {
      path: { type: "string", description: "Directory path (optional, default .)" },
    },
    required: [],
  },
];

// ============================================================================
// Tool Executor — runs tools and returns results
// ============================================================================

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type LogFn = (termId: string, text: string) => void;

export async function executeTool(
  call: ToolCall,
  cwd: string,
  log: LogFn
): Promise<string> {
  switch (call.name) {
    case "bash": {
      const cmd = String(call.arguments.command || "");
      log("shell", `$ ${cmd}`);
      try {
        const { spawn } = await import("child_process");
        const result = await new Promise<string>((resolve) => {
          const proc = spawn("sh", ["-c", cmd], {
            cwd: String(call.arguments.cwd || cwd),
            timeout: 30000,
          });
          let out = "";
          let err = "";
          proc.stdout?.on("data", (d: Buffer) => { out += d.toString(); });
          proc.stderr?.on("data", (d: Buffer) => { err += d.toString(); });
          proc.on("close", (code: number) => {
            resolve(code === 0 ? out || "(no output)" : `Exit ${code}\n${err || out}`);
          });
          proc.on("error", (e: Error) => resolve(`Error: ${e.message}`));
        });
        log("shell", result.slice(0, 500));
        return result;
      } catch {
        return "Error: bash execution not available in browser";
      }
    }

    case "read": {
      const path = String(call.arguments.path);
      log("files", `Reading ${path}`);
      try {
        const { readFileSync, existsSync } = await import("fs");
        if (!existsSync(path)) return `Error: File not found: ${path}`;
        const content = readFileSync(path, "utf-8");
        const lines = content.split("\n");
        const offset = Number(call.arguments.offset) || 0;
        const limit = Number(call.arguments.limit) || Math.min(lines.length, 200);
        const result = lines.slice(offset, offset + limit).join("\n");
        log("files", `${lines.length} lines, showing ${offset + 1}-${offset + limit}`);
        return result;
      } catch {
        return "Error: file reading not available in browser";
      }
    }

    case "write": {
      const path = String(call.arguments.path);
      const content = String(call.arguments.content);
      log("files", `Writing ${path} (${content.length} bytes)`);
      try {
        const { writeFileSync, mkdirSync } = await import("fs");
        const { dirname } = await import("path");
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, content, "utf-8");
        return `Wrote ${content.length} bytes to ${path}`;
      } catch {
        return "Error: file writing not available in browser";
      }
    }

    case "edit": {
      const path = String(call.arguments.path);
      const oldText = String(call.arguments.oldText);
      const newText = String(call.arguments.newText);
      log("files", `Editing ${path}`);
      try {
        const { readFileSync, writeFileSync, existsSync } = await import("fs");
        if (!existsSync(path)) return `Error: File not found: ${path}`;
        const content = readFileSync(path, "utf-8");
        if (!content.includes(oldText)) return `Error: text not found in ${path}`;
        const updated = content.replace(oldText, newText);
        writeFileSync(path, updated, "utf-8");
        return `Edited ${path} — replaced ${oldText.length} chars with ${newText.length} chars`;
      } catch {
        return "Error: file editing not available in browser";
      }
    }

    case "grep": {
      const pattern = String(call.arguments.pattern);
      const searchPath = String(call.arguments.path || ".");
      log("shell", `grep "${pattern}" ${searchPath}`);
      try {
        const { execSync } = await import("child_process");
        const result = execSync(
          `grep -rn --include='*.{ts,tsx,js,jsx,rs,py,json,md,css,html,toml,yaml}' "${pattern}" ${searchPath} 2>/dev/null | head -30`,
          { encoding: "utf-8", timeout: 10000, cwd }
        );
        log("shell", result || "(no matches)");
        return result || "(no matches)";
      } catch {
        return "(no matches or grep not available)";
      }
    }

    case "ls": {
      const path = String(call.arguments.path || ".");
      log("files", `ls ${path}`);
      try {
        const { readdirSync, statSync } = await import("fs");
        const entries = readdirSync(path).slice(0, 50);
        const result = entries
          .map((f: string) => {
            try {
              const s = statSync(`${path}/${f}`);
              return s.isDirectory() ? `${f}/` : f;
            } catch { return f; }
          })
          .join("\n");
        return result || "(empty)";
      } catch {
        return "Error: directory listing not available in browser";
      }
    }

    default:
      return `Unknown tool: ${call.name}`;
  }
}

// ============================================================================
// Agent System Prompt
// ============================================================================

export const AGENT_PROMPT = `You are Ruby Diamond, an expert AI coding agent. You work inside a terminal-based IDE. The user gives you a goal, and you accomplish it using tools.

You have these tools:
- **bash** — execute shell commands (npm, cargo, git, mkdir, etc.)
- **read** — read file contents  
- **write** — create or overwrite files
- **edit** — make precise text replacements in files
- **grep** — search code for patterns
- **ls** — list directory contents

Workflow:
1. Understand the goal
2. Explore the codebase (ls, grep, read)  
3. Plan the changes
4. Execute (write, edit, bash for build/test)

Guidelines:
- Use tools aggressively — don't ask permission, just do
- Show your thinking briefly, then act
- When you write code, explain your approach in 1-2 sentences
- Execute build/test commands to verify your work
- If a command fails, read the error and fix it
- Be concise — the user sees your work across terminal panes`;
