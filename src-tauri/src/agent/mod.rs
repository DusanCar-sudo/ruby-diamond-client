use crate::types::{AgentState, Message, LLMConfig};
use crate::tools::registry::ToolRegistry;
use crate::skills::SkillEngine;
use crate::llm::{create_provider, LLMProvider};
use std::sync::Arc;
use tokio::sync::Mutex;

/// The core agent loop — plan → tool calls → observe → replan
pub struct AgentLoop {
    pub state: AgentState,
    provider: Box<dyn LLMProvider>,
    tool_registry: Arc<Mutex<ToolRegistry>>,
    skill_engine: SkillEngine,
    cwd: String,
    max_iterations: u32,
}

impl AgentLoop {
    pub fn new(
        id: String,
        name: String,
        config: LLMConfig,
        tool_registry: Arc<Mutex<ToolRegistry>>,
        skill_engine: SkillEngine,
        cwd: String,
    ) -> Self {
        let provider = create_provider(config);

        let skills_ctx = skill_engine.get_skills_context();
        let system_prompt = format!(
            r#"You are an expert AI coding agent named {name}. You help users by reading files, executing commands, editing code, and writing new files.

Available tools:
- read_file: Read file contents
- write_file: Create or overwrite files
- edit_file: Make precise file edits with exact text replacement
- bash: Execute bash commands
- grep: Search for patterns in files
- glob_find: Find files matching a glob pattern
- list_dir: List directory contents
- web_fetch: Fetch content from a URL
- git_diff: Show git diff
- git_status: Show git working tree status

{skills_ctx}
Guidelines:
- Use bash for file operations like ls, rg, find, grep
- Use read_file to examine files
- Use edit_file for precise changes (each edit's oldText must match exactly)
- When changing multiple separate locations, use one edit_file call with multiple edits
- Keep edits' oldText as small as possible while still being unique in the file
- Use write_file only for new files or complete rewrites
- Be concise in your responses
- Show file paths clearly when working with files
"#,
            name = name,
            skills_ctx = skills_ctx,
        );

        let state = AgentState {
            id,
            name,
            system_prompt,
            messages: Vec::new(),
            active_tools: Vec::new(),
            active_skills: Vec::new(),
        };

        Self {
            state,
            provider,
            tool_registry,
            skill_engine,
            cwd,
            max_iterations: 50,
        }
    }

    /// Run the agent loop with a user goal
    pub async fn run(&mut self, goal: &str) -> Result<Vec<Message>, String> {
        self.state.messages.push(Message {
            role: "system".into(),
            content: self.state.system_prompt.clone(),
            tool_calls: None,
            tool_call_id: None,
        });

        self.state.messages.push(Message {
            role: "user".into(),
            content: goal.to_string(),
            tool_calls: None,
            tool_call_id: None,
        });

        for iteration in 0..self.max_iterations {
            let tools = {
                let registry = self.tool_registry.lock().await;
                registry.list_definitions()
            };

            let response = self.provider.chat(
                &self.state.messages,
                &tools,
                4096,
            ).await.map_err(|e| format!("LLM error at iteration {}: {}", iteration, e))?;

            // Add assistant message
            let has_tool_calls = response.tool_calls.as_ref().map(|t| !t.is_empty()).unwrap_or(false);
            let assistant_msg = Message {
                role: "assistant".into(),
                content: if has_tool_calls { String::new() } else { response.content.clone().unwrap_or_default() },
                tool_calls: response.tool_calls.clone(),
                tool_call_id: None,
            };
            self.state.messages.push(assistant_msg);

            // If no tool calls, agent is done (regardless of finish_reason)
            if !has_tool_calls {
                return Ok(self.state.messages.clone());
            }

            // Execute tool calls in parallel
            let tool_calls = response.tool_calls.unwrap();
            let results = {
                let registry = self.tool_registry.lock().await;
                registry.execute_parallel(&tool_calls, &self.cwd).await
            };

            // Add tool results as messages
            for result in &results {
                self.state.messages.push(Message {
                    role: "tool".into(),
                    content: format!(
                        "{}",
                        if result.success {
                            result.output.clone()
                        } else {
                            format!("Error: {}", result.error.as_deref().unwrap_or("unknown error"))
                        }
                    ),
                    tool_calls: None,
                    tool_call_id: Some(result.call_id.clone()),
                });
            }
        }

        Err(format!("Max iterations ({}) reached without completion", self.max_iterations))
    }

    /// Get the conversation for frontend display
    pub fn get_messages(&self) -> &[Message] {
        &self.state.messages
    }

    /// Clear conversation but keep system prompt
    pub fn clear(&mut self) {
        self.state.messages.clear();
    }
}
