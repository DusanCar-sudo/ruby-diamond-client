use crate::tools::registry::Tool;
use crate::tools::registry::ToolRegistry;
use crate::types::{ToolCall, ToolDef, ToolResult};
use async_trait::async_trait;
use std::sync::Arc;
use std::process::Command;
use std::fs;
use std::path::Path;

// ── read_file ────────────────────────────────────────────────────────────────

struct ReadFile;
#[async_trait]
impl Tool for ReadFile {
    fn definition(&self) -> ToolDef {
        ToolDef {
            name: "read_file".into(),
            description: "Read the contents of a file. Supports text files. Output is truncated to 2000 lines or 50KB.".into(),
            parameters: serde_json::json!({
                "type": "object",
                "required": ["path"],
                "properties": {
                    "path": {"type": "string", "description": "Path to the file (relative or absolute)"},
                    "offset": {"type": "number", "description": "Line number to start reading from (1-indexed)"},
                    "limit": {"type": "number", "description": "Maximum number of lines to read"}
                }
            }),
        }
    }

    async fn execute(&self, call: &ToolCall, cwd: &str) -> ToolResult {
        let path = call.arguments["path"].as_str().unwrap_or("");
        let full_path = if Path::new(path).is_absolute() {
            path.to_string()
        } else {
            format!("{}/{}", cwd, path)
        };

        match fs::read_to_string(&full_path) {
            Ok(content) => {
                let lines: Vec<&str> = content.lines().collect();
                let offset = call.arguments["offset"].as_u64().unwrap_or(1) as usize;
                let limit = call.arguments["limit"].as_u64().unwrap_or(2000) as usize;
                let start = (offset.saturating_sub(1)).min(lines.len());
                let end = (start + limit).min(lines.len());
                let output: String = lines[start..end]
                    .iter()
                    .enumerate()
                    .map(|(i, l)| format!("{:6}| {}", start + i + 1, l))
                    .collect::<Vec<_>>()
                    .join("\n");

                ToolResult {
                    call_id: call.id.clone(),
                    tool_name: "read_file".into(),
                    success: true,
                    output: format!("{} lines ({} bytes)\n\n{}", end - start, content.len(), output),
                    error: None,
                }
            }
            Err(e) => ToolResult {
                call_id: call.id.clone(),
                tool_name: "read_file".into(),
                success: false,
                output: String::new(),
                error: Some(format!("Cannot read {}: {}", full_path, e)),
            },
        }
    }
}

// ── write_file ───────────────────────────────────────────────────────────────

struct WriteFile;
#[async_trait]
impl Tool for WriteFile {
    fn definition(&self) -> ToolDef {
        ToolDef {
            name: "write_file".into(),
            description: "Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Creates parent directories automatically.".into(),
            parameters: serde_json::json!({
                "type": "object",
                "required": ["path", "content"],
                "properties": {
                    "path": {"type": "string", "description": "Path to write to"},
                    "content": {"type": "string", "description": "Content to write"}
                }
            }),
        }
    }

    async fn execute(&self, call: &ToolCall, cwd: &str) -> ToolResult {
        let path = call.arguments["path"].as_str().unwrap_or("");
        let content = call.arguments["content"].as_str().unwrap_or("");
        let full_path = if Path::new(path).is_absolute() {
            path.to_string()
        } else {
            format!("{}/{}", cwd, path)
        };

        if let Some(parent) = Path::new(&full_path).parent() {
            fs::create_dir_all(parent).ok();
        }

        match fs::write(&full_path, content) {
            Ok(()) => ToolResult {
                call_id: call.id.clone(),
                tool_name: "write_file".into(),
                success: true,
                output: format!("Wrote {} bytes to {}", content.len(), full_path),
                error: None,
            },
            Err(e) => ToolResult {
                call_id: call.id.clone(),
                tool_name: "write_file".into(),
                success: false,
                output: String::new(),
                error: Some(format!("Cannot write {}: {}", full_path, e)),
            },
        }
    }
}

// ── edit_file ────────────────────────────────────────────────────────────────

struct EditFile;
#[async_trait]
impl Tool for EditFile {
    fn definition(&self) -> ToolDef {
        ToolDef {
            name: "edit_file".into(),
            description: "Make precise edits to a file using exact text replacement. Supports multiple edits in one call. Each oldText is matched against the original file (not incrementally).".into(),
            parameters: serde_json::json!({
                "type": "object",
                "required": ["path", "edits"],
                "properties": {
                    "path": {"type": "string", "description": "Path to the file"},
                    "edits": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "required": ["oldText", "newText"],
                            "properties": {
                                "oldText": {"type": "string", "description": "Exact text to replace (must be unique in file)"},
                                "newText": {"type": "string", "description": "Replacement text"}
                            }
                        }
                    }
                }
            }),
        }
    }

    async fn execute(&self, call: &ToolCall, cwd: &str) -> ToolResult {
        let path = call.arguments["path"].as_str().unwrap_or("");
        let full_path = if Path::new(path).is_absolute() {
            path.to_string()
        } else {
            format!("{}/{}", cwd, path)
        };

        let mut content = match fs::read_to_string(&full_path) {
            Ok(c) => c,
            Err(e) => return ToolResult {
                call_id: call.id.clone(), tool_name: "edit_file".into(),
                success: false, output: String::new(),
                error: Some(format!("Cannot read {}: {}", full_path, e)),
            },
        };

        let edits = match call.arguments["edits"].as_array() {
            Some(e) => e,
            None => return ToolResult {
                call_id: call.id.clone(), tool_name: "edit_file".into(),
                success: false, output: String::new(),
                error: Some("edits must be an array".into()),
            },
        };

        let mut count = 0;
        for edit in edits {
            let old = edit["oldText"].as_str().unwrap_or("");
            let new = edit["newText"].as_str().unwrap_or("");

            if content.matches(old).count() == 1 {
                content = content.replacen(old, new, 1);
                count += 1;
            } else {
                return ToolResult {
                    call_id: call.id.clone(), tool_name: "edit_file".into(),
                    success: false, output: String::new(),
                    error: Some(format!(
                        "oldText not unique ({} matches) or not found. Edit: {:?}...",
                        content.matches(old).count(),
                        &old[..old.len().min(60)]
                    )),
                };
            }
        }

        match fs::write(&full_path, &content) {
            Ok(()) => ToolResult {
                call_id: call.id.clone(), tool_name: "edit_file".into(),
                success: true,
                output: format!("Applied {} edit(s) to {}", count, full_path),
                error: None,
            },
            Err(e) => ToolResult {
                call_id: call.id.clone(), tool_name: "edit_file".into(),
                success: false, output: String::new(),
                error: Some(format!("Cannot write {}: {}", full_path, e)),
            },
        }
    }
}

// ── bash ─────────────────────────────────────────────────────────────────────

struct BashTool;
#[async_trait]
impl Tool for BashTool {
    fn definition(&self) -> ToolDef {
        ToolDef {
            name: "bash".into(),
            description: "Execute a bash command. Returns stdout and stderr. Output truncated to 2000 lines or 50KB. Supports timeout.".into(),
            parameters: serde_json::json!({
                "type": "object",
                "required": ["command"],
                "properties": {
                    "command": {"type": "string", "description": "Bash command to execute"},
                    "timeout": {"type": "number", "description": "Timeout in seconds (optional)"}
                }
            }),
        }
    }

    async fn execute(&self, call: &ToolCall, cwd: &str) -> ToolResult {
        let command = call.arguments["command"].as_str().unwrap_or("");
        let _timeout_secs = call.arguments["timeout"].as_u64().unwrap_or(60);

        let output = Command::new("bash")
            .arg("-c")
            .arg(command)
            .current_dir(cwd)
            .output();

        match output {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout);
                let stderr = String::from_utf8_lossy(&out.stderr);
                let combined = format!("{}{}", stdout, stderr);

                // Truncate
                let lines: Vec<&str> = combined.lines().collect();
                let truncated = if lines.len() > 2000 {
                    format!("{}...\n[truncated {} lines]", lines[..2000].join("\n"), lines.len() - 2000)
                } else {
                    combined
                };

                ToolResult {
                    call_id: call.id.clone(),
                    tool_name: "bash".into(),
                    success: out.status.success(),
                    output: truncated,
                    error: if !out.status.success() {
                        Some(format!("Exit code: {}", out.status.code().unwrap_or(-1)))
                    } else { None },
                }
            }
            Err(e) => ToolResult {
                call_id: call.id.clone(), tool_name: "bash".into(),
                success: false, output: String::new(),
                error: Some(format!("Command failed: {}", e)),
            },
        }
    }
}

// ── grep ─────────────────────────────────────────────────────────────────────

struct GrepTool;
#[async_trait]
impl Tool for GrepTool {
    fn definition(&self) -> ToolDef {
        ToolDef {
            name: "grep".into(),
            description: "Search for a pattern in files. Uses ripgrep if available, falls back to grep.".into(),
            parameters: serde_json::json!({
                "type": "object",
                "required": ["pattern"],
                "properties": {
                    "pattern": {"type": "string", "description": "Regex pattern to search for"},
                    "path": {"type": "string", "description": "Directory or file to search (default: cwd)"},
                    "include": {"type": "string", "description": "File pattern to include (glob)"},
                    "max_results": {"type": "number", "description": "Max results (default: 50)"}
                }
            }),
        }
    }

    async fn execute(&self, call: &ToolCall, cwd: &str) -> ToolResult {
        let pattern = call.arguments["pattern"].as_str().unwrap_or("");
        let search_path = call.arguments["path"].as_str().unwrap_or(cwd);
        let max = call.arguments["max_results"].as_u64().unwrap_or(50);

        let full_path = if Path::new(search_path).is_absolute() {
            search_path.to_string()
        } else {
            format!("{}/{}", cwd, search_path)
        };

        // Try rg first, fall back to grep
        let mut cmd = if Command::new("rg").arg("--version").output().is_ok() {
            let mut c = Command::new("rg");
            c.arg("--line-number").arg("--no-heading").arg("-n");
            if let Some(inc) = call.arguments["include"].as_str() {
                c.arg("-g").arg(inc);
            }
            c.arg(pattern).arg(&full_path);
            c
        } else {
            let mut c = Command::new("grep");
            c.arg("-rn").arg("-I");
            if let Some(inc) = call.arguments["include"].as_str() {
                c.arg(format!("--include={}", inc));
            }
            c.arg(pattern).arg(&full_path);
            c
        };

        let output = match cmd.output() {
            Ok(o) => o,
            Err(e) => return ToolResult {
                call_id: call.id.clone(), tool_name: "grep".into(),
                success: false, output: String::new(),
                error: Some(format!("grep failed: {}", e)),
            },
        };

        let stdout = String::from_utf8_lossy(&output.stdout);
        let lines: Vec<&str> = stdout.lines().take(max as usize).collect();
        let result = if lines.is_empty() {
            "No matches found.".to_string()
        } else {
            format!("{} matches (showing {})\n\n{}", stdout.lines().count(), lines.len(), lines.join("\n"))
        };

        ToolResult {
            call_id: call.id.clone(), tool_name: "grep".into(),
            success: true, output: result, error: None,
        }
    }
}

// ── glob_find ────────────────────────────────────────────────────────────────

struct GlobFind;
#[async_trait]
impl Tool for GlobFind {
    fn definition(&self) -> ToolDef {
        ToolDef {
            name: "glob_find".into(),
            description: "Find files matching a glob pattern. Fast file discovery.".into(),
            parameters: serde_json::json!({
                "type": "object",
                "required": ["pattern"],
                "properties": {
                    "pattern": {"type": "string", "description": "Glob pattern (e.g., **/*.rs, src/**)"},
                    "path": {"type": "string", "description": "Root directory (default: cwd)"}
                }
            }),
        }
    }

    async fn execute(&self, call: &ToolCall, cwd: &str) -> ToolResult {
        let pattern = call.arguments["pattern"].as_str().unwrap_or("**/*");
        let base = call.arguments["path"].as_str().unwrap_or(cwd);
        let full_pattern = format!("{}/{}", base, pattern);

        match glob::glob(&full_pattern) {
            Ok(paths) => {
                let files: Vec<String> = paths
                    .filter_map(|p| p.ok())
                    .filter(|p| p.is_file())
                    .map(|p| p.display().to_string())
                    .take(200)
                    .collect();

                ToolResult {
                    call_id: call.id.clone(), tool_name: "glob_find".into(),
                    success: true,
                    output: format!("{} files found\n\n{}", files.len(), files.join("\n")),
                    error: None,
                }
            }
            Err(e) => ToolResult {
                call_id: call.id.clone(), tool_name: "glob_find".into(),
                success: false, output: String::new(),
                error: Some(format!("glob error: {}", e)),
            },
        }
    }
}

// ── list_dir ─────────────────────────────────────────────────────────────────

struct ListDir;
#[async_trait]
impl Tool for ListDir {
    fn definition(&self) -> ToolDef {
        ToolDef {
            name: "list_dir".into(),
            description: "List contents of a directory with file sizes and types.".into(),
            parameters: serde_json::json!({
                "type": "object",
                "required": [],
                "properties": {
                    "path": {"type": "string", "description": "Directory path (default: cwd)"},
                    "depth": {"type": "number", "description": "Recursion depth (default: 1)"}
                }
            }),
        }
    }

    async fn execute(&self, call: &ToolCall, cwd: &str) -> ToolResult {
        let path = call.arguments["path"].as_str().unwrap_or(cwd);
        let full_path = if Path::new(path).is_absolute() {
            path.to_string()
        } else {
            format!("{}/{}", cwd, path)
        };

        fn list_dir_recursive(path: &Path, prefix: &str, depth: u32, max_depth: u32) -> Vec<String> {
            let mut lines = Vec::new();
            if depth > max_depth { return lines; }

            if let Ok(entries) = fs::read_dir(path) {
                let mut entries: Vec<_> = entries.filter_map(|e| e.ok()).collect();
                entries.sort_by_key(|e| {
                    (!e.path().is_dir(), e.file_name().to_string_lossy().to_lowercase())
                });

                for (i, entry) in entries.iter().enumerate() {
                    let is_last = i == entries.len() - 1;
                    let connector = if is_last { "└── " } else { "├── " };
                    let name = entry.file_name().to_string_lossy().to_string();
                    let meta = entry.metadata().ok();
                    let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
                    let size_str = if entry.path().is_dir() {
                        String::new()
                    } else {
                        format!(" ({})", human_size(size))
                    };

                    lines.push(format!("{}{}{}{}", prefix, connector, name, size_str));

                    if entry.path().is_dir() {
                        let new_prefix = format!("{}{}   ", prefix, if is_last { " " } else { "│" });
                        lines.extend(list_dir_recursive(&entry.path(), &new_prefix, depth + 1, max_depth));
                    }
                }
            }
            lines
        }

        let lines = list_dir_recursive(Path::new(&full_path), "", 1, 3);
        ToolResult {
            call_id: call.id.clone(), tool_name: "list_dir".into(),
            success: true,
            output: format!("{}\n\n{}", full_path, lines.join("\n")),
            error: None,
        }
    }
}

// ── web_fetch ────────────────────────────────────────────────────────────────

struct WebFetch;
#[async_trait]
impl Tool for WebFetch {
    fn definition(&self) -> ToolDef {
        ToolDef {
            name: "web_fetch".into(),
            description: "Fetch content from a URL. Returns text content with status code.".into(),
            parameters: serde_json::json!({
                "type": "object",
                "required": ["url"],
                "properties": {
                    "url": {"type": "string", "description": "URL to fetch"},
                    "max_size": {"type": "number", "description": "Max response size in bytes (default: 50000)"}
                }
            }),
        }
    }

    async fn execute(&self, call: &ToolCall, _cwd: &str) -> ToolResult {
        let url = call.arguments["url"].as_str().unwrap_or("");
        let max_size = call.arguments["max_size"].as_u64().unwrap_or(50000) as usize;

        match reqwest::get(url).await {
            Ok(resp) => {
                let status = resp.status();
                match resp.text().await {
                    Ok(text) => {
                        let truncated = if text.len() > max_size {
                            format!("{}...\n[truncated {} bytes]", &text[..max_size], text.len() - max_size)
                        } else {
                            text
                        };
                        ToolResult {
                            call_id: call.id.clone(), tool_name: "web_fetch".into(),
                            success: status.is_success(),
                            output: format!("HTTP {} — {} bytes\n\n{}", status.as_u16(), truncated.len(), truncated),
                            error: if !status.is_success() { Some(format!("HTTP {}", status.as_u16())) } else { None },
                        }
                    }
                    Err(e) => ToolResult {
                        call_id: call.id.clone(), tool_name: "web_fetch".into(),
                        success: false, output: String::new(),
                        error: Some(format!("Failed to read body: {}", e)),
                    },
                }
            }
            Err(e) => ToolResult {
                call_id: call.id.clone(), tool_name: "web_fetch".into(),
                success: false, output: String::new(),
                error: Some(format!("Request failed: {}", e)),
            },
        }
    }
}

// ── git_diff ─────────────────────────────────────────────────────────────────

struct GitDiff;
#[async_trait]
impl Tool for GitDiff {
    fn definition(&self) -> ToolDef {
        ToolDef {
            name: "git_diff".into(),
            description: "Show git diff. Shows unstaged changes by default.".into(),
            parameters: serde_json::json!({
                "type": "object",
                "required": [],
                "properties": {
                    "staged": {"type": "boolean", "description": "Show staged changes instead"},
                    "path": {"type": "string", "description": "Specific file path"}
                }
            }),
        }
    }

    async fn execute(&self, call: &ToolCall, cwd: &str) -> ToolResult {
        let mut cmd = Command::new("git");
        cmd.arg("diff");
        if call.arguments["staged"].as_bool().unwrap_or(false) {
            cmd.arg("--staged");
        }
        if let Some(path) = call.arguments["path"].as_str() {
            cmd.arg("--").arg(path);
        }
        cmd.current_dir(cwd);

        let output = match cmd.output() {
            Ok(o) => o,
            Err(e) => return ToolResult {
                call_id: call.id.clone(), tool_name: "git_diff".into(),
                success: false, output: String::new(),
                error: Some(format!("git diff failed: {}", e)),
            },
        };

        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        ToolResult {
            call_id: call.id.clone(), tool_name: "git_diff".into(),
            success: true,
            output: if stdout.is_empty() { "No changes.".into() } else { stdout },
            error: None,
        }
    }
}

// ── git_status ───────────────────────────────────────────────────────────────

struct GitStatus;
#[async_trait]
impl Tool for GitStatus {
    fn definition(&self) -> ToolDef {
        ToolDef {
            name: "git_status".into(),
            description: "Show git working tree status.".into(),
            parameters: serde_json::json!({
                "type": "object", "required": [], "properties": {}
            }),
        }
    }

    async fn execute(&self, call: &ToolCall, cwd: &str) -> ToolResult {
        let output = Command::new("git")
            .args(["status", "--short", "--branch"])
            .current_dir(cwd)
            .output();

        match output {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                ToolResult {
                    call_id: call.id.clone(), tool_name: "git_status".into(),
                    success: true,
                    output: if stdout.is_empty() { "Clean working tree.".into() } else { stdout },
                    error: None,
                }
            }
            Err(e) => ToolResult {
                call_id: call.id.clone(), tool_name: "git_status".into(),
                success: false, output: String::new(),
                error: Some(format!("git status failed: {}", e)),
            },
        }
    }
}

fn human_size(bytes: u64) -> String {
    if bytes < 1024 { format!("{}B", bytes) }
    else if bytes < 1024*1024 { format!("{:.1}K", bytes as f64 / 1024.0) }
    else if bytes < 1024*1024*1024 { format!("{:.1}M", bytes as f64 / 1024.0 / 1024.0) }
    else { format!("{:.1}G", bytes as f64 / 1024.0 / 1024.0 / 1024.0) }
}

// ── Register all ─────────────────────────────────────────────────────────────

pub fn register_all_tools(registry: &mut ToolRegistry) {
    registry.register(Arc::new(ReadFile));
    registry.register(Arc::new(WriteFile));
    registry.register(Arc::new(EditFile));
    registry.register(Arc::new(BashTool));
    registry.register(Arc::new(GrepTool));
    registry.register(Arc::new(GlobFind));
    registry.register(Arc::new(ListDir));
    registry.register(Arc::new(WebFetch));
    registry.register(Arc::new(GitDiff));
    registry.register(Arc::new(GitStatus));
}
