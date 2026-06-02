use crate::types::{LLMConfig, Message, ToolDef, ToolCall};
use serde::{Deserialize, Serialize};

/// LLM provider trait
#[async_trait::async_trait]
pub trait LLMProvider: Send + Sync {
    /// Send messages and get a completion with tool calling support
    async fn chat(
        &self,
        messages: &[Message],
        tools: &[ToolDef],
        max_tokens: u32,
    ) -> Result<LLMResponse, String>;

    /// Get provider name
    fn name(&self) -> &str;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LLMResponse {
    pub content: Option<String>,
    pub tool_calls: Option<Vec<ToolCall>>,
    pub finish_reason: String,
    pub tokens_used: u32,
}

/// OpenAI-compatible provider (works with OpenAI, DeepSeek, Groq, llama.cpp, etc.)
pub struct OpenAIProvider {
    config: LLMConfig,
    client: reqwest::Client,
}

impl OpenAIProvider {
    pub fn new(config: LLMConfig) -> Self {
        Self { config, client: reqwest::Client::new() }
    }

    fn base_url(&self) -> String {
        self.config.base_url.clone().unwrap_or_else(|| {
            match self.config.provider.as_str() {
                "deepseek" => "https://api.deepseek.com/v1".into(),
                "groq" => "https://api.groq.com/openai/v1".into(),
                "google" => "https://generativelanguage.googleapis.com/v1beta".into(),
                "xai" => "https://api.x.ai/v1".into(),
                "openrouter" => "https://openrouter.ai/api/v1".into(),
                "cerebras" => "https://api.cerebras.ai/v1".into(),
                "mistral" => "https://api.mistral.ai/v1".into(),
                "together" => "https://api.together.xyz/v1".into(),
                "fireworks" => "https://api.fireworks.ai/inference/v1".into(),
                "ollama" => "http://localhost:11434/v1".into(),
                "llamacpp" => "http://localhost:8080/v1".into(),
                _ => "https://api.openai.com/v1".into(),
            }
        })
    }
}

#[async_trait::async_trait]
impl LLMProvider for OpenAIProvider {
    async fn chat(
        &self,
        messages: &[Message],
        tools: &[ToolDef],
        max_tokens: u32,
    ) -> Result<LLMResponse, String> {
        let url = format!("{}/chat/completions", self.base_url());

        let api_messages: Vec<serde_json::Value> = messages
            .iter()
            .filter(|m| m.role != "system")  // System handled separately
            .map(|m| {
                let has_tool_calls = m.tool_calls.as_ref().map(|t| !t.is_empty()).unwrap_or(false);
                let mut msg = serde_json::json!({
                    "role": m.role,
                    "content": if has_tool_calls { "" } else { m.content.as_str() },
                });
                if has_tool_calls {
                    let formatted: Vec<serde_json::Value> = m.tool_calls.as_ref().unwrap().iter().map(|t| {
                        let args_str = if t.arguments.is_string() {
                            t.arguments.as_str().unwrap_or("{}").to_string()
                        } else {
                            t.arguments.to_string()
                        };
                        serde_json::json!({
                            "id": t.id,
                            "type": "function",
                            "function": {
                                "name": t.name,
                                "arguments": args_str
                            }
                        })
                    }).collect();
                    msg["tool_calls"] = serde_json::Value::Array(formatted);
                }
                if let Some(tcid) = &m.tool_call_id {
                    msg["tool_call_id"] = serde_json::Value::String(tcid.clone());
                }
                msg
            })
            .collect();

        let tools_json: Vec<serde_json::Value> = tools
            .iter()
            .map(|t| {
                serde_json::json!({
                    "type": "function",
                    "function": {
                        "name": t.name,
                        "description": t.description,
                        "parameters": t.parameters,
                    }
                })
            })
            .collect();

        let body = serde_json::json!({
            "model": self.config.model,
            "messages": api_messages,
            "max_tokens": max_tokens,
            "temperature": self.config.temperature,
        });

        let mut body = if !tools.is_empty() {
            let mut b = body;
            b["tools"] = serde_json::json!(tools_json);
            b["tool_choice"] = serde_json::json!("auto");
            b
        } else {
            body
        };

        let mut req = self.client.post(&url).json(&body);

        if let Some(ref key) = self.config.api_key {
            req = req.header("Authorization", format!("Bearer {}", key));
        }

        let resp = req.send().await.map_err(|e| format!("HTTP error: {}", e))?;
        let status = resp.status();

        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("API error {}: {}", status.as_u16(), text));
        }

        let json: serde_json::Value = resp.json().await.map_err(|e| format!("JSON error: {}", e))?;

        let choice = &json["choices"][0];
        let finish = choice["finish_reason"].as_str().unwrap_or("stop").to_string();
        let msg = &choice["message"];

        let content = msg["content"].as_str().map(|s| s.to_string());

        let tool_calls = if let Some(tc_array) = msg["tool_calls"].as_array() {
            Some(
                tc_array
                    .iter()
                    .map(|tc| ToolCall {
                        id: tc["id"].as_str().unwrap_or("").to_string(),
                        name: tc["function"]["name"].as_str().unwrap_or("").to_string(),
                        arguments: tc["function"]["arguments"].clone(),
                    })
                    .collect(),
            )
        } else {
            None
        };

        let tokens = json["usage"]["total_tokens"].as_u64().unwrap_or(0) as u32;

        Ok(LLMResponse { content, tool_calls, finish_reason: finish, tokens_used: tokens })
    }

    fn name(&self) -> &str { &self.config.provider }
}

/// Create a provider from config
pub fn create_provider(config: LLMConfig) -> Box<dyn LLMProvider> {
    match config.provider.as_str() {
        "anthropic" => Box::new(AnthropicProvider::new(config, "https://api.anthropic.com/v1/messages".into())),
        "mimo" => Box::new(AnthropicProvider::new(config, "https://token-plan-sgp.xiaomimimo.com/v1/messages".into())),
        "mimo-cn" => Box::new(AnthropicProvider::new(config, "https://token-plan-cn.xiaomimimo.com/v1/messages".into())),
        "mimo-ams" => Box::new(AnthropicProvider::new(config, "https://token-plan-ams.xiaomimimo.com/v1/messages".into())),
        "mimo-sgp" => Box::new(AnthropicProvider::new(config, "https://token-plan-sgp.xiaomimimo.com/v1/messages".into())),
        _ => Box::new(OpenAIProvider::new(config)),
    }
}

// ============================================================================
// Anthropic Provider (different API format)
// ============================================================================

pub struct AnthropicProvider {
    config: LLMConfig,
    client: reqwest::Client,
    base_url: String,
}

impl AnthropicProvider {
    pub fn new(config: LLMConfig, base_url: String) -> Self {
        Self { config, client: reqwest::Client::new(), base_url }
    }
}

#[async_trait::async_trait]
impl LLMProvider for AnthropicProvider {
    async fn chat(
        &self,
        messages: &[Message],
        tools: &[ToolDef],
        max_tokens: u32,
    ) -> Result<LLMResponse, String> {
        // Separate system message from conversation
        let system = messages.iter()
            .find(|m| m.role == "system")
            .map(|m| m.content.clone())
            .unwrap_or_default();

        let conversation: Vec<serde_json::Value> = messages
            .iter()
            .filter(|m| m.role != "system")
            .map(|m| {
                let mut msg = serde_json::json!({
                    "role": if m.role == "tool" { "user" } else { m.role.as_str() },
                    "content": m.content,
                });
                if let Some(ref tc) = m.tool_calls {
                    let tc_json: Vec<serde_json::Value> = tc.iter().map(|t| serde_json::json!({
                        "type": "tool_use",
                        "id": t.id,
                        "name": t.name,
                        "input": t.arguments,
                    })).collect();
                    msg["content"] = tc_json.into();
                }
                msg
            })
            .collect();

        let tools_anthropic: Vec<serde_json::Value> = tools.iter().map(|t| {
            serde_json::json!({
                "name": t.name,
                "description": t.description,
                "input_schema": t.parameters,
            })
        }).collect();

        let mut body = serde_json::json!({
            "model": self.config.model,
            "system": system,
            "messages": conversation,
            "max_tokens": max_tokens,
        });

        if !tools_anthropic.is_empty() {
            body["tools"] = serde_json::json!(tools_anthropic);
        }

        let key = self.config.api_key.clone().unwrap_or_default();
        let resp = self.client
            .post(&self.base_url)
            .header("x-api-key", &key)
            .header("anthropic-version", "2023-06-01")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("HTTP error: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Anthropic API error ({}): {} — URL: {}", status, &text[..text.len().min(200)], self.base_url));
        }

        let json: serde_json::Value = resp.json().await.map_err(|e| format!("JSON: {}", e))?;

        // Parse Anthropic response format
        let mut content = String::new();
        let mut tool_calls: Vec<ToolCall> = Vec::new();

        if let Some(blocks) = json["content"].as_array() {
            for block in blocks {
                match block["type"].as_str() {
                    Some("text") => {
                        if let Some(t) = block["text"].as_str() {
                            content.push_str(t);
                        }
                    }
                    Some("tool_use") => {
                        tool_calls.push(ToolCall {
                            id: block["id"].as_str().unwrap_or("").to_string(),
                            name: block["name"].as_str().unwrap_or("").to_string(),
                            arguments: block["input"].clone(),
                        });
                    }
                    _ => {}
                }
            }
        }

        let finish = json["stop_reason"].as_str().unwrap_or("end_turn").to_string();
        let tokens_in = json["usage"]["input_tokens"].as_u64().unwrap_or(0) as u32;
        let tokens_out = json["usage"]["output_tokens"].as_u64().unwrap_or(0) as u32;

        Ok(LLMResponse {
            content: if content.is_empty() { None } else { Some(content) },
            tool_calls: if tool_calls.is_empty() { None } else { Some(tool_calls) },
            finish_reason: finish,
            tokens_used: tokens_in + tokens_out,
        })
    }

    fn name(&self) -> &str { "anthropic" }
}
