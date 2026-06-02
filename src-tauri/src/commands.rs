use crate::AppState;
use crate::agent::AgentLoop;
use crate::types::{LLMConfig, ToolCall, WorkspaceState};
use std::env;
use tauri::State;

/// List all available tools
#[tauri::command]
pub async fn list_tools(state: State<'_, AppState>) -> Result<Vec<crate::types::ToolDef>, String> {
    let registry = state.tool_registry.lock().await;
    Ok(registry.list_definitions())
}

/// List all discovered skills
#[tauri::command]
pub fn list_skills(state: State<'_, AppState>) -> Result<Vec<crate::types::Skill>, String> {
    let engine = state.skill_engine.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(engine.discover())
}

/// Read a skill's full content by name
#[tauri::command]
pub fn read_skill(state: State<'_, AppState>, name: String) -> Result<Option<crate::types::Skill>, String> {
    let engine = state.skill_engine.lock().map_err(|e| format!("Lock error: {}", e))?;
    let skills = engine.discover();
    Ok(skills.into_iter().find(|s| s.name == name))
}

/// Create a new agent
#[tauri::command]
pub async fn create_agent(
    state: State<'_, AppState>,
    name: String,
    provider: String,
    model: String,
    api_key: Option<String>,
    base_url: Option<String>,
) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let cwd = dirs::home_dir()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|| env::current_dir()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|_| ".".into()));

    let config = LLMConfig {
        provider,
        api_key,
        model,
        base_url,
        max_tokens: 4096,
        temperature: 0.3,
    };

    let skill_engine = state.skill_engine.lock().unwrap().clone();
    let agent = AgentLoop::new(
        id.clone(),
        name,
        config,
        state.tool_registry.clone(),
        skill_engine,
        cwd,
    );

    state.agents.lock().await.push(agent);
    Ok(id)
}

/// Run an agent with a goal (streaming not yet implemented — returns final messages)
#[tauri::command]
pub async fn run_agent(
    state: State<'_, AppState>,
    agent_id: String,
    goal: String,
) -> Result<Vec<crate::types::Message>, String> {
    let mut agents = state.agents.lock().await;
    let agent = agents
        .iter_mut()
        .find(|a| a.state.id == agent_id)
        .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

    agent.run(&goal).await
}

/// Get all messages for an agent
#[tauri::command]
pub async fn get_agent_messages(
    state: State<'_, AppState>,
    agent_id: String,
) -> Result<Vec<crate::types::Message>, String> {
    let agents = state.agents.lock().await;
    let agent = agents
        .iter()
        .find(|a| a.state.id == agent_id)
        .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

    Ok(agent.get_messages().to_vec())
}

/// Execute a single tool directly (for terminal use)
#[tauri::command]
pub async fn execute_tool(
    state: State<'_, AppState>,
    tool_name: String,
    arguments: serde_json::Value,
) -> Result<crate::types::ToolResult, String> {
    let call = ToolCall {
        id: uuid::Uuid::new_v4().to_string(),
        name: tool_name,
        arguments,
    };

    let cwd = dirs::home_dir()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|| ".".to_string());

    let registry = state.tool_registry.lock().await;
    Ok(registry.execute(&call, &cwd).await)
}

/// Get full workspace state for the frontend
#[tauri::command]
pub async fn get_workspace_state(state: State<'_, AppState>) -> Result<WorkspaceState, String> {
    let registry = state.tool_registry.lock().await;
    let tools = registry.list_definitions();
    let skills = state.skill_engine.lock().unwrap().discover();
    let cwd = dirs::home_dir()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|| ".".to_string());

    let agents_state = {
        let agents = state.agents.lock().await;
        agents.iter().map(|a| a.state.clone()).collect()
    };

    Ok(WorkspaceState {
        agents: agents_state,
        tools,
        skills,
        cwd,
        git_branch: None,
    })
}

/// Read a directory from the real filesystem
#[tauri::command]
pub fn read_dir(path: Option<String>) -> Result<Vec<crate::types::FileEntry>, String> {
    let dir = path.unwrap_or_else(|| ".".into());
    let entries = std::fs::read_dir(&dir).map_err(|e| format!("Cannot read {}: {}", dir, e))?;
    let mut result = Vec::new();
    for entry in entries {
        if let Ok(e) = entry {
            let path = e.path();
            let name = e.file_name().to_string_lossy().to_string();
            let is_dir = path.is_dir();
            result.push(crate::types::FileEntry { name, path: path.display().to_string(), is_dir });
        }
    }
    result.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    Ok(result)
}

/// Read file content
#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Cannot read {}: {}", path, e))
}
