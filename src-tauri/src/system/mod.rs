// ============================================================================
// Ruby Diamond — System Monitor (Rust backend)
// ============================================================================

use serde::{Deserialize, Serialize};
use sysinfo::{System, ProcessesToUpdate, ProcessRefreshKind, CpuRefreshKind, Disks};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStats {
    pub cpu_usage: f32,           // overall CPU %
    pub cpu_per_core: Vec<f32>,   // per-core usage
    pub cpu_count: usize,
    pub cpu_name: String,
    pub ram_total: u64,
    pub ram_used: u64,
    pub ram_free: u64,
    pub swap_total: u64,
    pub swap_used: u64,
    pub uptime: u64,              // seconds
    pub load_avg: Vec<f64>,
    pub processes: Vec<ProcessInfo>,
    pub disks: Vec<DiskInfo>,
    pub temps: Vec<TempInfo>,
    pub network: NetworkInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_usage: f32,
    pub memory_bytes: u64,
    pub memory_percent: f32,
    pub status: String,
    pub run_time: u64,           // seconds
    pub command: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub total: u64,
    pub used: u64,
    pub free: u64,
    pub usage_percent: f32,
    pub fs_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TempInfo {
    pub name: String,
    pub temperature: f32,
    pub max: Option<f32>,
    pub critical: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkInfo {
    pub interfaces: Vec<String>,
    pub total_received: u64,
    pub total_transmitted: u64,
}

use std::sync::Mutex;

static SYS: Mutex<Option<System>> = Mutex::new(None);

fn get_sys() -> std::sync::MutexGuard<'static, Option<System>> {
    let mut guard = SYS.lock().unwrap();
    if guard.is_none() {
        *guard = Some(System::new_all());
    }
    guard
}

/// Get full system stats
#[tauri::command]
pub fn system_stats() -> SystemStats {
    let mut guard = get_sys();
    let sys = guard.as_mut().unwrap();
    sys.refresh_all();
    sys.refresh_cpu_specifics(CpuRefreshKind::everything());
    sys.refresh_memory();
    sys.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::everything(),
    );

    let cpu_count = sys.cpus().len();
    let cpu_name = sys.cpus().first().map(|c| c.brand().to_string()).unwrap_or_default();
    let cpu_per_core: Vec<f32> = sys.cpus().iter().map(|c| c.cpu_usage()).collect();
    let cpu_usage = if cpu_per_core.is_empty() { 0.0 } else { 
        cpu_per_core.iter().sum::<f32>() / cpu_count as f32 
    };
    let total_mem = sys.total_memory();
    let used_mem = sys.used_memory();
    let free_mem = sys.free_memory();
    let total_swap = sys.total_swap();
    let used_swap = sys.used_swap();
    let uptime_val = System::uptime();
    let load_avg_val = {
        let la = System::load_average();
        vec![la.one, la.five, la.fifteen]
    };

    let mut processes: Vec<ProcessInfo> = sys.processes()
        .iter()
        .map(|(pid, p)| ProcessInfo {
            pid: pid.as_u32(),
            name: p.name().to_string_lossy().to_string(),
            cpu_usage: p.cpu_usage(),
            memory_bytes: p.memory(),
            memory_percent: (p.memory() as f64 / total_mem as f64 * 100.0) as f32,
            status: format!("{:?}", p.status()),
            run_time: p.run_time(),
            command: p.cmd().iter().map(|s| s.to_string_lossy().to_string()).collect::<Vec<_>>().join(" "),
        })
        .collect();
    processes.sort_by(|a, b| b.cpu_usage.partial_cmp(&a.cpu_usage).unwrap_or(std::cmp::Ordering::Equal));
    processes.truncate(50);

    let disks: Vec<DiskInfo> = Disks::new_with_refreshed_list().iter().map(|d| DiskInfo {
        name: d.name().to_string_lossy().to_string(),
        mount_point: d.mount_point().to_string_lossy().to_string(),
        total: d.total_space(),
        used: d.total_space() - d.available_space(),
        free: d.available_space(),
        usage_percent: ((d.total_space() - d.available_space()) as f64 / d.total_space() as f64 * 100.0) as f32,
        fs_type: d.file_system().to_string_lossy().to_string(),
    }).collect();

    let temps: Vec<TempInfo> = sys.cpus().iter().enumerate().map(|(i, _)| TempInfo {
        name: format!("CPU Core {}", i),
        temperature: 0.0,
        max: None,
        critical: None,
    }).collect();

    let networks = sysinfo::Networks::new_with_refreshed_list();
    let total_rx: u64 = networks.iter().map(|(_, d)| d.total_received()).sum();
    let total_tx: u64 = networks.iter().map(|(_, d)| d.total_transmitted()).sum();
    let interfaces: Vec<String> = networks.iter().map(|(name, _)| name.clone()).collect();

    SystemStats {
        cpu_usage,
        cpu_per_core,
        cpu_count,
        cpu_name,
        ram_total: total_mem,
        ram_used: used_mem,
        ram_free: free_mem,
        swap_total: total_swap,
        swap_used: used_swap,
        uptime: uptime_val,
        load_avg: load_avg_val,
        processes,
        disks,
        temps,
        network: NetworkInfo {
            interfaces,
            total_received: total_rx,
            total_transmitted: total_tx,
        },
    }
}

/// Kill a process by PID (Linux)
#[tauri::command]
pub fn system_kill_process(pid: u32) -> Result<String, String> {
    let output = std::process::Command::new("kill")
        .arg("-9")
        .arg(pid.to_string())
        .output()
        .map_err(|e| format!("Failed to kill: {}", e))?;
    if output.status.success() {
        Ok(format!("Process {} killed", pid))
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

/// Set process CPU limit via cpulimit (Linux)
#[tauri::command]
pub fn system_limit_cpu(pid: u32, percent: f32) -> Result<String, String> {
    // Kill any existing cpulimit for this pid
    let _ = std::process::Command::new("pkill")
        .args(["-f", &format!("cpulimit.*-p {}", pid)])
        .output();
    
    // Start cpulimit in background
    std::process::Command::new("cpulimit")
        .args(["-p", &pid.to_string(), "-l", &(percent as u32).to_string(), "-b", "-z"])
        .spawn()
        .map_err(|e| format!("Failed to set CPU limit (install cpulimit first): {}", e))?;
    
    Ok(format!("CPU limit set to {}% for process {}", percent as u32, pid))
}

/// Remove CPU limit
#[tauri::command]
pub fn system_remove_limit(pid: u32) -> Result<String, String> {
    let _ = std::process::Command::new("pkill")
        .args(["-f", &format!("cpulimit.*-p {}", pid)])
        .output();
    Ok(format!("CPU limit removed for process {}", pid))
}
