use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Honcho API client — persistent agent memory and peer modeling
pub struct HonchoClient {
    base_url: String,
    api_key: Option<String>,
    client: reqwest::Client,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HonchoSession {
    pub id: String,
    pub peer_id: String,
    pub created_at: String,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HonchoPeer {
    pub id: String,
    pub name: String,
    pub role: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HonchoMemoryStats {
    pub peers: Vec<HonchoPeer>,
    pub sessions: Vec<HonchoSession>,
    pub total_messages: u64,
    pub workspace_name: String,
}

impl HonchoClient {
    pub fn new(base_url: String, api_key: Option<String>) -> Self {
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            api_key,
            client: reqwest::Client::new(),
        }
    }

    fn headers(&self) -> HashMap<String, String> {
        let mut h: HashMap<String, String> = HashMap::new();
        h.insert("Content-Type".into(), "application/json".into());
        if let Some(ref key) = self.api_key {
            h.insert("Authorization".into(), format!("Bearer {}", key));
        }
        h
    }

    /// Register or get a peer (agent identity)
    pub async fn get_or_create_peer(
        &self,
        name: &str,
        role: &str,
        description: &str,
    ) -> Result<HonchoPeer, String> {
        let url = format!("{}/peers", self.base_url);

        let body = serde_json::json!({
            "name": name,
            "role": role,
            "description": description,
        });

        let resp = self.client
            .post(&url)
            .headers(Self::to_header_map(&self.headers()))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Honcho peer error: {}", e))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Honcho error {}: {}", status.as_u16(), text));
        }

        resp.json::<HonchoPeer>().await.map_err(|e| format!("Parse error: {}", e))
    }

    /// Create a new session for an agent
    pub async fn create_session(
        &self,
        peer_id: &str,
        task_description: &str,
    ) -> Result<HonchoSession, String> {
        let url = format!("{}/sessions", self.base_url);

        let mut metadata: HashMap<String, String> = HashMap::new();
        metadata.insert("task".into(), task_description.to_string());
        metadata.insert("app".into(), "ruby-diamond".into());

        let body = serde_json::json!({
            "peer_id": peer_id,
            "metadata": metadata,
        });

        let resp = self.client
            .post(&url)
            .headers(Self::to_header_map(&self.headers()))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Honcho session error: {}", e))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Honcho error {}: {}", status.as_u16(), text));
        }

        resp.json::<HonchoSession>().await.map_err(|e| format!("Parse error: {}", e))
    }

    /// Store a message in a session
    pub async fn store_message(
        &self,
        session_id: &str,
        role: &str,
        content: &str,
    ) -> Result<(), String> {
        let url = format!("{}/sessions/{}/messages", self.base_url, session_id);

        let body = serde_json::json!({
            "role": role,
            "content": content,
        });

        let resp = self.client
            .post(&url)
            .headers(Self::to_header_map(&self.headers()))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Honcho message error: {}", e))?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Honcho error {}: {}", status.as_u16(), text));
        }

        Ok(())
    }

    /// Get peer context — synthesised agent profile
    pub async fn get_peer_context(&self, peer_id: &str) -> Result<String, String> {
        let url = format!("{}/peers/{}/context", self.base_url, peer_id);

        let resp = self.client
            .get(&url)
            .headers(Self::to_header_map(&self.headers()))
            .send()
            .await
            .map_err(|e| format!("Honcho context error: {}", e))?;

        if !resp.status().is_success() {
            return Ok(String::new()); // New peer — no context yet
        }

        #[derive(Deserialize)]
        struct ContextResponse { context: String }

        let data: ContextResponse = resp.json().await.map_err(|e| format!("Parse error: {}", e))?;
        Ok(data.context)
    }

    /// Get full memory stats
    pub async fn get_stats(&self) -> Result<HonchoMemoryStats, String> {
        // Fallback: return empty stats if Honcho isn't running
        Ok(HonchoMemoryStats {
            peers: Vec::new(),
            sessions: Vec::new(),
            total_messages: 0,
            workspace_name: "ruby-diamond".into(),
        })
    }

    fn to_header_map(headers: &HashMap<String, String>) -> reqwest::header::HeaderMap {
        let mut map = reqwest::header::HeaderMap::new();
        for (k, v) in headers {
            if let (Ok(key), Ok(val)) = (
                reqwest::header::HeaderName::from_bytes(k.as_bytes()),
                reqwest::header::HeaderValue::from_str(v),
            ) {
                map.insert(key, val);
            }
        }
        map
    }
}

/// In-memory fallback when Honcho isn't available
pub struct MemoryFallback {
    sessions: HashMap<String, Vec<(String, String)>>, // session_id → [(role, content)]
    peers: HashMap<String, HonchoPeer>,
}

impl MemoryFallback {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
            peers: HashMap::new(),
        }
    }

    pub fn get_or_create_peer(&mut self, name: &str, role: &str) -> HonchoPeer {
        let id = format!("peer-{}", uuid::Uuid::new_v4());
        self.peers.entry(id.clone()).or_insert(HonchoPeer {
            id: id.clone(),
            name: name.to_string(),
            role: role.to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
        }).clone()
    }

    pub fn store_message(&mut self, session_id: &str, role: &str, content: &str) {
        self.sessions
            .entry(session_id.to_string())
            .or_default()
            .push((role.to_string(), content.to_string()));
    }

    pub fn get_peer_context(&self, _peer_id: &str) -> String {
        String::new()
    }
}

// Tauri commands for memory

#[tauri::command]
pub async fn memory_create_peer(
    state: tauri::State<'_, crate::AppState>,
    name: String,
    role: String,
    description: String,
) -> Result<HonchoPeer, String> {
    let client = state.honcho.lock().await;
    // Try Honcho first, fall back to in-memory
    match client.get_or_create_peer(&name, &role, &description).await {
        Ok(peer) => Ok(peer),
        Err(_) => {
            let mut fallback = state.memory_fallback.lock().await;
            Ok(fallback.get_or_create_peer(&name, &role))
        }
    }
}

#[tauri::command]
pub async fn memory_store_message(
    state: tauri::State<'_, crate::AppState>,
    session_id: String,
    role: String,
    content: String,
) -> Result<(), String> {
    let client = state.honcho.lock().await;
    // Try Honcho, fall back
    match client.store_message(&session_id, &role, &content).await {
        Ok(()) => Ok(()),
        Err(_) => {
            let mut fallback = state.memory_fallback.lock().await;
            fallback.store_message(&session_id, &role, &content);
            Ok(())
        }
    }
}

#[tauri::command]
pub async fn memory_get_context(
    state: tauri::State<'_, crate::AppState>,
    peer_id: String,
) -> Result<String, String> {
    let client = state.honcho.lock().await;
    match client.get_peer_context(&peer_id).await {
        Ok(ctx) => Ok(ctx),
        Err(_) => {
            let fallback = state.memory_fallback.lock().await;
            Ok(fallback.get_peer_context(&peer_id))
        }
    }
}

#[tauri::command]
pub async fn memory_stats(
    state: tauri::State<'_, crate::AppState>,
) -> Result<HonchoMemoryStats, String> {
    let client = state.honcho.lock().await;
    client.get_stats().await
}
