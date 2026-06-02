mod system;
mod types;
mod tools;
mod skills;
mod agent;
mod llm;
mod commands;
mod llamacpp;
mod mesh;
mod memory;
mod plugins;

use tauri::Manager;
use std::sync::Arc;
use tokio::sync::Mutex;
use tools::registry::ToolRegistry;
use tools::builtin::register_all_tools;
use skills::SkillEngine;
use agent::AgentLoop;
use llamacpp::LlamaCppManager;
use memory::{HonchoClient, MemoryFallback};

pub struct AppState {
    pub tool_registry: Arc<Mutex<ToolRegistry>>,
    pub skill_engine: Arc<std::sync::Mutex<SkillEngine>>,
    pub agents: Arc<Mutex<Vec<AgentLoop>>>,
    pub llamacpp: Arc<Mutex<LlamaCppManager>>,
    pub honcho: Arc<Mutex<HonchoClient>>,
    pub memory_fallback: Arc<Mutex<MemoryFallback>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut registry = ToolRegistry::new();
    register_all_tools(&mut registry);

    let skill_engine = SkillEngine::new(vec![
        "skills".to_string(),
        dirs::home_dir()
            .map(|h| format!("{}/.ruby-diamond/skills", h.display()))
            .unwrap_or_default(),
    ]);

    let honcho = HonchoClient::new(
        "http://localhost:8000".into(),
        std::env::var("HONCHO_API_KEY").ok(),
    );

    let state = AppState {
        tool_registry: Arc::new(Mutex::new(registry)),
        skill_engine: Arc::new(std::sync::Mutex::new(skill_engine)),
        agents: Arc::new(Mutex::new(Vec::new())),
        llamacpp: Arc::new(Mutex::new(LlamaCppManager::new())),
        honcho: Arc::new(Mutex::new(honcho)),
        memory_fallback: Arc::new(Mutex::new(MemoryFallback::new())),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_process::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            // Core commands
            commands::list_tools,
            commands::list_skills,
            commands::read_skill,
            commands::create_agent,
            commands::run_agent,
            commands::get_agent_messages,
            commands::execute_tool,
            commands::get_workspace_state,
            commands::read_dir,
            commands::read_file,
            // Llama.cpp
            llamacpp::llama_status,
            llamacpp::llama_start,
            llamacpp::llama_stop,
            llamacpp::llama_discover,
            // Agent mesh
            mesh::mesh_debate,
            mesh::mesh_review,
            mesh::mesh_ensemble,
            // Memory (Honcho)
            memory::memory_create_peer,
            memory::memory_store_message,
            memory::memory_get_context,
            memory::memory_stats,
            // Plugins
            plugins::plugin_list_installed,
            plugins::plugin_fetch_registry,
            plugins::plugin_install,
            plugins::plugin_uninstall,
            // System monitor
            system::system_stats,
            system::system_kill_process,
            system::system_limit_cpu,
            system::system_remove_limit,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.set_title("Ruby Diamond")?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Ruby Diamond");
}
