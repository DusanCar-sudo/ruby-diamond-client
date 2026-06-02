import { MessageSquare, Brain, Cpu, Package, Database, Activity, ShieldCheck } from "lucide-react";
import type { Panel } from "../store";

interface Props {
  active: Panel | null;
  onSelect: (p: Panel) => void;
}

export function Sidebar({ active, onSelect }: Props) {
  const items: Array<{ id: Panel; icon: React.ReactNode; label: string }> = [
    { id: "chat", icon: <MessageSquare size={18} />, label: "Chat" },
    { id: "mesh", icon: <Brain size={18} />, label: "Agent Mesh" },
    { id: "llamacpp", icon: <Cpu size={18} />, label: "Local LLM" },
    { id: "plugins", icon: <Package size={18} />, label: "Plugins" },
    { id: "memory", icon: <Database size={18} />, label: "Memory" },
    { id: "system", icon: <Activity size={18} />, label: "System Monitor" },
    { id: "sysadmin", icon: <ShieldCheck size={18} />, label: "System Admin" },
  ];

  return (
    <div className="sidebar">
      {items.map((item) => (
        <button
          key={item.id}
          className={`sidebar-btn ${active === item.id ? "active" : ""}`}
          onClick={() => onSelect(item.id)}
          title={item.label}
        >
          {item.icon}
        </button>
      ))}
    </div>
  );
}
