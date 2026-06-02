use serde::{Deserialize, Serialize};
use std::process::{Child, Command};
use std::path::Path;
use std::fs;

/// Manages a local llama.cpp server for offline inference
pub struct LlamaCppManager {
    process: Option<Child>,
    server_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlamaModel {
    pub name: String,
    pub path: String,
    pub size_bytes: u64,
    pub format: String, // "gguf", "ggml"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlamaStatus {
    pub running: bool,
    pub server_url: String,
    pub model: Option<String>,
    pub models_available: Vec<LlamaModel>,
}

impl LlamaCppManager {
    pub fn new() -> Self {
        Self {
            process: None,
            server_url: "http://localhost:8080/v1".to_string(),
        }
    }

    /// Discover llama.cpp models in common locations
    pub fn discover_models(&self) -> Vec<LlamaModel> {
        let home_models = dirs::home_dir()
            .map(|h| format!("{}/.ruby-diamond/models/", h.display()))
            .unwrap_or_default();
        let search_paths: Vec<&str> = vec![
            "models/",
            "../models/",
            "/home/dusanmilosavljevic/llama.cpp/models/",
            "/home/dusanmilosavljevic/minicpm5-1b/",
            &home_models,
        ];

        let mut models = Vec::new();
        for search in search_paths {
            let path = Path::new(&search);
            if !path.exists() { continue; }

            if let Ok(entries) = fs::read_dir(path) {
                for entry in entries.filter_map(|e| e.ok()) {
                    let p = entry.path();
                    let name = p.file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();

                    // Check for GGUF/GGML model files
                    if name.ends_with(".gguf") || name.ends_with(".ggml") || name.ends_with(".bin") {
                        let size = p.metadata().map(|m| m.len()).unwrap_or(0);
                        if size > 10_000_000 {
                            // >10MB = likely a model
                            models.push(LlamaModel {
                                name: name.clone(),
                                path: p.display().to_string(),
                                size_bytes: size,
                                format: if name.ends_with(".gguf") { "gguf".into() }
                                    else if name.ends_with(".ggml") { "ggml".into() }
                                    else { "unknown".into() },
                            });
                        }
                    }
                }
            }
        }

        models.sort_by_key(|m| m.size_bytes);
        models
    }

    /// Get current status
    pub fn status(&self) -> LlamaStatus {
        let models = self.discover_models();
        let current_model = models.first().map(|m| m.name.clone());

        LlamaStatus {
            running: self.process.is_some(),
            server_url: self.server_url.clone(),
            model: current_model,
            models_available: models,
        }
    }

    /// Try to start llama-server with a specific model
    pub fn start(&mut self, model_path: &str, port: u16, n_gpu_layers: u32, ctx_size: u32) -> Result<String, String> {
        if self.process.is_some() {
            return Err("Server already running".into());
        }

        // Find llama-server binary
        let server_bin = Self::find_llama_server()?;

        let url = format!("http://localhost:{}/v1", port);
        self.server_url = url.clone();

        let child = Command::new(&server_bin)
            .arg("-m").arg(model_path)
            .arg("--port").arg(port.to_string())
            .arg("-ngl").arg(n_gpu_layers.to_string())
            .arg("-c").arg(ctx_size.to_string())
            .arg("--host").arg("127.0.0.1")
            .spawn()
            .map_err(|e| format!("Failed to start llama-server: {}", e))?;

        self.process = Some(child);
        Ok(url)
    }

    /// Stop the server
    pub fn stop(&mut self) -> Result<(), String> {
        if let Some(mut child) = self.process.take() {
            child.kill().map_err(|e| format!("Failed to stop server: {}", e))?;
            child.wait().ok();
        }
        Ok(())
    }

    fn find_llama_server() -> Result<String, String> {
        let cargo_llama = format!("{}/.cargo/bin/llama-server",
            dirs::home_dir().map(|h| h.display().to_string()).unwrap_or_default());
        let candidates: Vec<&str> = vec![
            "llama-server",
            "/home/dusanmilosavljevic/llama.cpp/build/bin/llama-server",
            "/usr/local/bin/llama-server",
            &cargo_llama,
        ];

        for bin in candidates {
            if Command::new(bin).arg("--version").output().is_ok() {
                return Ok(bin.to_string());
            }
            // Also check if the path exists
            if Path::new(bin).exists() {
                return Ok(bin.to_string());
            }
        }

        Err("llama-server not found. Install llama.cpp with: cd llama.cpp && cmake -B build && cmake --build build --config Release".into())
    }
}

// Tauri commands for llama.cpp

#[tauri::command]
pub async fn llama_status(manager: tauri::State<'_, super::AppState>) -> Result<LlamaStatus, String> {
    let mgr = manager.llamacpp.lock().await;
    Ok(mgr.status())
}

#[tauri::command]
pub async fn llama_start(
    manager: tauri::State<'_, super::AppState>,
    model_path: String,
    port: Option<u16>,
    n_gpu_layers: Option<u32>,
    ctx_size: Option<u32>,
) -> Result<String, String> {
    let mut mgr = manager.llamacpp.lock().await;
    mgr.start(
        &model_path,
        port.unwrap_or(8080),
        n_gpu_layers.unwrap_or(0),
        ctx_size.unwrap_or(4096),
    )
}

#[tauri::command]
pub async fn llama_stop(manager: tauri::State<'_, super::AppState>) -> Result<(), String> {
    let mut mgr = manager.llamacpp.lock().await;
    mgr.stop()
}

#[tauri::command]
pub async fn llama_discover(manager: tauri::State<'_, super::AppState>) -> Result<Vec<LlamaModel>, String> {
    let mgr = manager.llamacpp.lock().await;
    Ok(mgr.discover_models())
}
