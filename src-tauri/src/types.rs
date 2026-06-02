use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A tool definition that agents can call
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDef {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value, // JSON Schema
}

/// A tool call made by an agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: serde_json::Value,
}

/// Result of a tool execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub call_id: String,
    pub tool_name: String,
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

/// A skill definition loaded from SKILL.md
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub name: String,
    pub description: String,
    pub path: String,
    pub content: String,
    pub metadata: HashMap<String, String>,
}

/// A message in an agent conversation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: String, // "system" | "user" | "assistant" | "tool"
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

/// Agent state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentState {
    pub id: String,
    pub name: String,
    pub system_prompt: String,
    pub messages: Vec<Message>,
    pub active_tools: Vec<String>,
    pub active_skills: Vec<String>,
}

/// Configuration for an LLM provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMConfig {
    pub provider: String, // "openai" | "anthropic" | "deepseek" | "llamacpp" | "groq"
    pub api_key: Option<String>,
    pub model: String,
    pub base_url: Option<String>,
    pub max_tokens: u32,
    pub temperature: f32,
}

/// Complete workspace state sent to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceState {
    pub agents: Vec<AgentState>,
    pub tools: Vec<ToolDef>,
    pub skills: Vec<Skill>,
    pub cwd: String,
    pub git_branch: Option<String>,
}

/// File entry from read_dir
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}
