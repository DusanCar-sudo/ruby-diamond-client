// ============================================================================
// Ruby Diamond — System Monitor Panel
// ============================================================================

import { useState, useEffect, useRef, useCallback } from "react";
import { Activity, Cpu, HardDrive, Thermometer, Wifi, X, Gauge, Ban } from "lucide-react";

interface ProcessInfo { pid: number; name: string; cpu_usage: number; memory_bytes: number; memory_percent: number; status: string; run_time: number; command: string; }
interface DiskInfo { name: string; mount_point: string; total: number; used: number; free: number; usage_percent: number; fs_type: string; }
interface NetworkInfo { interfaces: string[]; total_received: number; total_transmitted: number; }
interface SystemStats { cpu_usage: number; cpu_per_core: number[]; cpu_count: number; cpu_name: string; ram_total: number; ram_used: number; ram_free: number; ram_percent?: number; swap_total: number; swap_used: number; uptime: number; load_avg: number[]; processes: ProcessInfo[]; disks: DiskInfo[]; temps: Array<{name: string; temperature: number}>; network: NetworkInfo; }

type SensorColor = string;

const DEFAULT_CORE_COLORS = [
  "#E07A5F", "#A0522D", "#C17F59", "#5B8C5A",
  "#6B8CAA", "#C4889A", "#8B7AAA", "#5A9EA0",
  "#D4A78A", "#8BAA8B", "#AA8899", "#7A9AAA",
  "#C08060", "#9A8870", "#6A9E7A", "#8878A8",
];

export function SystemPanel() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [coreColors, setCoreColors] = useState<string[]>(DEFAULT_CORE_COLORS);
  const [sensorColors, setSensorColors] = useState({ cpu: "#E07A5F", ram: "#A0522D", disk: "#C17F59", net: "#5B8C5A" });
  const [pollMs, setPollMs] = useState(2000);
  const intervalRef = useRef<number | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const data = await invoke<SystemStats>("system_stats");
      setStats(data);
    } catch {
      // Browser fallback — mock data
      setStats({
        cpu_usage: Math.random() * 40 + 10,
        cpu_per_core: Array.from({length: 8}, () => Math.random() * 50 + 5),
        cpu_count: 8, cpu_name: "Demo CPU",
        ram_total: 16_000_000_000, ram_used: Math.random() * 8_000_000_000 + 4_000_000_000,
        ram_free: 4_000_000_000, swap_total: 8_000_000_000, swap_used: 1_000_000_000,
        uptime: 360000, load_avg: [1.2, 0.8, 0.6],
        processes: [
          { pid: 1234, name: "chrome", cpu_usage: 12.5, memory_bytes: 500_000_000, memory_percent: 3.1, status: "Running", run_time: 3600, command: "/usr/bin/chrome" },
          { pid: 5678, name: "node", cpu_usage: 8.2, memory_bytes: 200_000_000, memory_percent: 1.2, status: "Running", run_time: 7200, command: "node server.js" },
          { pid: 9012, name: "vscode", cpu_usage: 3.1, memory_bytes: 800_000_000, memory_percent: 5.0, status: "Sleeping", run_time: 14400, command: "/usr/share/code" },
        ],
        disks: [{ name: "nvme0n1", mount_point: "/", total: 500_000_000_000, used: 250_000_000_000, free: 250_000_000_000, usage_percent: 50, fs_type: "ext4" }],
        temps: [{name: "CPU", temperature: 45}, {name: "GPU", temperature: 52}],
        network: { interfaces: ["wlan0"], total_received: 10_000_000_000, total_transmitted: 5_000_000_000 },
      });
    }
  }, []);

  useEffect(() => {
    fetchStats();
    intervalRef.current = window.setInterval(fetchStats, pollMs);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [pollMs]);

  const killProcess = async (pid: number) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("system_kill_process", { pid });
      fetchStats();
    } catch {}
  };

  const limitCpu = async (pid: number) => {
    const pct = prompt("CPU limit % (0-100):", "25");
    if (!pct) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("system_limit_cpu", { pid, percent: parseFloat(pct) });
    } catch {}
  };

  const removeLimit = async (pid: number) => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("system_remove_limit", { pid });
    } catch {}
  };

  const formatBytes = (b: number) => b > 1e9 ? `${(b/1e9).toFixed(1)}GB` : b > 1e6 ? `${(b/1e6).toFixed(0)}MB` : `${(b/1e3).toFixed(0)}KB`;
  const formatUptime = (s: number) => `${Math.floor(s/86400)}d ${Math.floor(s/3600)%24}h ${Math.floor(s/60)%60}m`;

  const handleColorChange = (key: string, value: string) => {
    setSensorColors((c) => ({ ...c, [key]: value }));
  };
  const handleCoreColorChange = (idx: number, value: string) => {
    setCoreColors((c) => { const n = [...c]; n[idx] = value; return n; });
  };

  return (
    <div className="panel-right" style={{ width: 420 }}>
      <div className="panel-header">
        <Activity size={14} /> System Monitor
        <select value={pollMs} onChange={(e) => setPollMs(+e.target.value)} style={{ marginLeft: "auto", fontSize: 10, padding: "2px 4px", background: "var(--bg-input)", border: "1px solid var(--border)", borderRadius: 4, color: "var(--fg-dim)" }}>
          <option value={1000}>1s</option><option value={2000}>2s</option><option value={5000}>5s</option>
        </select>
      </div>

      <div className="panel-body" style={{ padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
        {!stats ? (
          <div style={{ textAlign: "center", padding: 20, color: "var(--fg-muted)" }}>Loading system stats...</div>
        ) : (
          <>
            {/* CPU Graph — Per-core bars */}
            <SensorCard icon={<Cpu size={12} />} label={`CPU · ${stats.cpu_name} · ${stats.cpu_count} cores`} color={sensorColors.cpu} onChangeColor={(c) => handleColorChange("cpu", c)}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 60, marginBottom: 2 }}>
                  {stats.cpu_per_core.map((usage, i) => (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{
                        width: "100%", height: `${Math.max(usage * 0.6, 2)}px`,
                        background: coreColors[i] || sensorColors.cpu,
                        borderRadius: "2px 2px 0 0", transition: "height 0.3s",
                        minHeight: 2,
                      }} />
                      <div style={{ fontSize: 7, color: "var(--fg-muted)", marginTop: 2 }}>
                        <input type="color" value={coreColors[i] || sensorColors.cpu}
                          onChange={(e) => handleCoreColorChange(i, e.target.value)}
                          style={{ width: 10, height: 10, border: "none", padding: 0, cursor: "pointer", background: "transparent" }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: "var(--fg-dim)", textAlign: "center" }}>
                  {stats.cpu_usage.toFixed(1)}% · Load: {stats.load_avg[0]?.toFixed(1)} · Uptime: {formatUptime(stats.uptime)}
                </div>
              </div>
            </SensorCard>

            {/* RAM */}
            <SensorCard icon={<Gauge size={12} />} label="Memory" color={sensorColors.ram} onChangeColor={(c) => handleColorChange("ram", c)}>
              <BarDisplay pct={(stats.ram_used / stats.ram_total) * 100} color={sensorColors.ram} label={`${formatBytes(stats.ram_used)} / ${formatBytes(stats.ram_total)}`} />
            </SensorCard>

            {/* Disks */}
            {stats.disks.map((d) => (
              <SensorCard key={d.mount_point} icon={<HardDrive size={12} />} label={`Disk · ${d.mount_point}`} color={sensorColors.disk} onChangeColor={(c) => handleColorChange("disk", c)}>
                <BarDisplay pct={d.usage_percent} color={sensorColors.disk} label={`${formatBytes(d.used)} / ${formatBytes(d.total)}`} />
              </SensorCard>
            ))}

            {/* Temps */}
            {stats.temps.length > 0 && (
              <SensorCard icon={<Thermometer size={12} />} label="Temperatures" color="#E07A5F" onChangeColor={() => {}}>
                <div style={{ display: "flex", gap: 8 }}>
                  {stats.temps.map((t) => (
                    <div key={t.name} style={{ fontSize: 11 }}>{t.name}: <strong>{t.temperature}°C</strong></div>
                  ))}
                </div>
              </SensorCard>
            )}

            {/* Network */}
            <SensorCard icon={<Wifi size={12} />} label="Network" color={sensorColors.net} onChangeColor={(c) => handleColorChange("net", c)}>
              <div style={{ fontSize: 10, color: "var(--fg-dim)" }}>
                ↓ {formatBytes(stats.network.total_received)} · ↑ {formatBytes(stats.network.total_transmitted)}
              </div>
            </SensorCard>

            {/* Processes */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--fg-muted)", marginBottom: 4 }}>
                Processes ({stats.processes.length})
              </div>
              <div style={{ maxHeight: 200, overflowY: "auto", fontSize: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "var(--fg-muted)", textAlign: "left" }}>
                      <th style={{ padding: "2px 4px" }}>PID</th>
                      <th style={{ padding: "2px 4px" }}>Name</th>
                      <th style={{ padding: "2px 4px" }}>CPU</th>
                      <th style={{ padding: "2px 4px" }}>Mem</th>
                      <th style={{ padding: "2px 4px" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.processes.map((p) => (
                      <tr key={p.pid} style={{ borderTop: "1px solid var(--border)" }}>
                        <td style={{ padding: "3px 4px", fontFamily: "var(--font-mono)", fontSize: 9 }}>{p.pid}</td>
                        <td style={{ padding: "3px 4px", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</td>
                        <td style={{ padding: "3px 4px", fontFamily: "var(--font-mono)" }}>{p.cpu_usage.toFixed(1)}%</td>
                        <td style={{ padding: "3px 4px", fontFamily: "var(--font-mono)", fontSize: 9 }}>{formatBytes(p.memory_bytes)}</td>
                        <td style={{ padding: "3px 2px", display: "flex", gap: 2 }}>
                          <button onClick={() => killProcess(p.pid)} title="Kill" style={{ background: "none", border: "none", color: "var(--ruby)", cursor: "pointer", padding: 1 }}>
                            <X size={11} />
                          </button>
                          <button onClick={() => limitCpu(p.pid)} title="Limit CPU" style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 1 }}>
                            <Gauge size={11} />
                          </button>
                          <button onClick={() => removeLimit(p.pid)} title="Remove limit" style={{ background: "none", border: "none", color: "var(--fg-dim)", cursor: "pointer", padding: 1 }}>
                            <Ban size={11} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function SensorCard({ icon, label, color, onChangeColor, children }: {
  icon: React.ReactNode; label: string; color: string;
  onChangeColor: (color: string) => void; children: React.ReactNode;
}) {
  return (
    <div style={{
      padding: 8, borderRadius: 8,
      background: "var(--bg-raised)", border: "1px solid var(--border)",
      borderLeft: `3px solid ${color}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 500, color: "var(--fg-dim)" }}>{label}</span>
        <input type="color" value={color} onChange={(e) => onChangeColor(e.target.value)}
          style={{ marginLeft: "auto", width: 14, height: 14, border: "1px solid var(--border)", borderRadius: 3, padding: 0, cursor: "pointer" }} />
      </div>
      {children}
    </div>
  );
}

function BarDisplay({ pct, color, label }: { pct: number; color: string; label: string }) {
  return (
    <div>
      <div style={{ height: 8, borderRadius: 4, background: "var(--bg-input)", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${Math.min(pct, 100)}%`,
          background: color, borderRadius: 4,
          transition: "width 0.5s ease",
        }} />
      </div>
      <div style={{ fontSize: 10, color: "var(--fg-dim)", marginTop: 3 }}>{label} · {pct.toFixed(1)}%</div>
    </div>
  );
}
