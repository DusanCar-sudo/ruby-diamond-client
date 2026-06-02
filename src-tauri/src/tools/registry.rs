use crate::types::{ToolCall, ToolDef, ToolResult};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;

/// Trait for executable tools
#[async_trait]
pub trait Tool: Send + Sync {
    fn definition(&self) -> ToolDef;
    async fn execute(&self, call: &ToolCall, cwd: &str) -> ToolResult;
}

/// Registry of all available tools
pub struct ToolRegistry {
    tools: HashMap<String, Arc<dyn Tool>>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self { tools: HashMap::new() }
    }

    pub fn register(&mut self, tool: Arc<dyn Tool>) {
        let def = tool.definition();
        self.tools.insert(def.name.clone(), tool);
    }

    pub fn list_definitions(&self) -> Vec<ToolDef> {
        self.tools.values().map(|t| t.definition()).collect()
    }

    pub fn get(&self, name: &str) -> Option<&Arc<dyn Tool>> {
        self.tools.get(name)
    }

    pub async fn execute(&self, call: &ToolCall, cwd: &str) -> ToolResult {
        match self.tools.get(&call.name) {
            Some(tool) => tool.execute(call, cwd).await,
            None => ToolResult {
                call_id: call.id.clone(),
                tool_name: call.name.clone(),
                success: false,
                output: String::new(),
                error: Some(format!("Unknown tool: {}", call.name)),
            },
        }
    }

    /// Execute multiple tool calls in parallel
    pub async fn execute_parallel(
        &self,
        calls: &[ToolCall],
        cwd: &str,
    ) -> Vec<ToolResult> {
        let futures: Vec<_> = calls
            .iter()
            .map(|call| self.execute(call, cwd))
            .collect();
        futures::future::join_all(futures).await
    }
}
