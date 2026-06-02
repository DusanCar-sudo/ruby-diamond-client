import { useState, useEffect } from "react";
import { Folder, File, ChevronRight, ChevronDown, RefreshCw, Home } from "lucide-react";
import { useStore } from "../store";

interface FsEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FsEntry[];
}

async function readDir(path?: string): Promise<FsEntry[]> {
  try {
    const { api } = await import("../lib/api");
    const entries = await api.readDir(path);
    return entries.map((e) => ({ name: e.name, path: e.path, is_dir: e.is_dir }));
  } catch {
    // Browser fallback
    return [];
  }
}

async function readFileContent(path: string): Promise<string> {
  try {
    const { api } = await import("../lib/api");
    return await api.readFile(path);
  } catch {
    return `// ${path}\n// File content not available in browser`;
  }
}

function TreeItem({ entry, depth = 0, onOpen }: { entry: FsEntry; depth?: number; onOpen: (path: string, content: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FsEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (entry.is_dir) {
      if (!expanded && !children) {
        setLoading(true);
        const kids = await readDir(entry.path);
        setChildren(kids);
        setLoading(false);
      }
      setExpanded(!expanded);
    } else {
      const content = await readFileContent(entry.path);
      onOpen(entry.path, content);
    }
  };

  return (
    <>
      <div
        className="tree-item"
        style={{ paddingLeft: 14 + depth * 16 }}
        onClick={handleClick}
      >
        {entry.is_dir ? (
          loading ? <RefreshCw size={10} style={{ animation: "spin 1s linear infinite" }} /> :
          expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
        ) : <span style={{ width: 12 }} />}
        {entry.is_dir ? <Folder size={14} className="tree-folder" /> : <File size={14} className="tree-file" />}
        <span>{entry.name}</span>
      </div>
      {entry.is_dir && expanded && children && children.map((c) => (
        <TreeItem key={c.path} entry={c} depth={depth + 1} onOpen={onOpen} />
      ))}
    </>
  );
}

export function Explorer() {
  const [root, setRoot] = useState<FsEntry[]>([]);
  const [cwd, setCwd] = useState("~");
  const openFile = useStore((s) => s.openFile);

  useEffect(() => {
    readDir(".").then(setRoot);
  }, []);

  const goHome = () => {
    readDir(".").then((entries) => { setRoot(entries); setCwd("~"); });
  };

  const handleOpen = async (path: string, content: string) => {
    const ext = path.split(".").pop() || "";
    const langMap: Record<string, string> = {
      rs: "rust", ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
      py: "python", json: "json", md: "markdown", html: "html", css: "css",
      toml: "toml", yaml: "yaml",
    };
    openFile({ name: path.split("/").pop() || path, path, type: "file", language: langMap[ext] || "text", content });
  };

  return (
    <div className="explorer">
      <div className="explorer-header">
        <span>Explorer</span>
        <button onClick={goHome} style={{ background: "none", border: "none", color: "var(--fg-dim)", cursor: "pointer", padding: 2 }}>
          <Home size={12} />
        </button>
      </div>
      <div className="explorer-tree">
        {root.map((e) => <TreeItem key={e.path} entry={e} onOpen={handleOpen} />)}
      </div>
    </div>
  );
}
