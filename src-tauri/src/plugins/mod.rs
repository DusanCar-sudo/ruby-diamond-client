use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

/// Plugin marketplace — install skills from URLs, git repos, or local paths
pub struct PluginManager {
    skills_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInfo {
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub installed: bool,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginRegistry {
    pub plugins: Vec<PluginInfo>,
    pub registry_url: String,
}

impl PluginManager {
    pub fn new(skills_dir: String) -> Self {
        Self { skills_dir }
    }

    /// List installed plugins
    pub fn list_installed(&self) -> Vec<PluginInfo> {
        let mut plugins = Vec::new();

        let skills_path = Path::new(&self.skills_dir);
        if !skills_path.exists() {
            return plugins;
        }

        if let Ok(entries) = fs::read_dir(skills_path) {
            for entry in entries.filter_map(|e| e.ok()) {
                let dir = entry.path();
                if !dir.is_dir() { continue; }

                let skill_md = dir.join("SKILL.md");
                if !skill_md.exists() { continue; }

                let content = fs::read_to_string(&skill_md).unwrap_or_default();
                let name = dir.file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();

                let (desc, version, author) = parse_plugin_metadata(&content);

                plugins.push(PluginInfo {
                    name: name.clone(),
                    version: version.unwrap_or_else(|| "1.0.0".into()),
                    description: desc.unwrap_or_else(|| "No description".into()),
                    author: author.unwrap_or_else(|| "community".into()),
                    installed: true,
                    source: dir.display().to_string(),
                });
            }
        }

        plugins
    }

    /// Fetch registry of available plugins
    pub async fn fetch_registry(&self, registry_url: &str) -> Result<PluginRegistry, String> {
        let resp = reqwest::get(registry_url)
            .await
            .map_err(|e| format!("Registry fetch failed: {}", e))?;

        let plugins: Vec<PluginInfo> = resp
            .json()
            .await
            .map_err(|e| format!("Parse error: {}", e))?;

        // Mark which are installed
        let installed = self.list_installed();
        let installed_names: Vec<&str> = installed.iter().map(|p| p.name.as_str()).collect();

        let plugins = plugins
            .into_iter()
            .map(|mut p| {
                p.installed = installed_names.contains(&p.name.as_str());
                p
            })
            .collect();

        Ok(PluginRegistry {
            plugins,
            registry_url: registry_url.to_string(),
        })
    }

    /// Install a plugin from a source
    pub async fn install(&self, name: &str, source: &str) -> Result<PluginInfo, String> {
        let target_dir = format!("{}/{}", self.skills_dir, name);
        let target = Path::new(&target_dir);

        if target.exists() {
            return Err(format!("Plugin '{}' already installed", name));
        }

        if source.starts_with("http://") || source.starts_with("https://") {
            self.install_from_url(name, source, &target_dir).await
        } else if source.starts_with("git@") || source.ends_with(".git") {
            self.install_from_git(name, source, &target_dir)
        } else if Path::new(source).exists() {
            self.install_from_local(source, &target_dir)
        } else {
            Err(format!("Unknown source type: {}", source))
        }
    }

    async fn install_from_url(&self, name: &str, url: &str, target_dir: &str) -> Result<PluginInfo, String> {
        // For now, assume URL points to a raw SKILL.md
        let resp = reqwest::get(url)
            .await
            .map_err(|e| format!("Download failed: {}", e))?;

        let content = resp.text().await.map_err(|e| format!("Read failed: {}", e))?;

        fs::create_dir_all(target_dir).map_err(|e| format!("Create dir failed: {}", e))?;

        let skill_md = format!("{}/SKILL.md", target_dir);
        fs::write(&skill_md, &content).map_err(|e| format!("Write failed: {}", e))?;

        Ok(PluginInfo {
            name: name.to_string(),
            version: "1.0.0".into(),
            description: "Installed from URL".into(),
            author: "community".into(),
            installed: true,
            source: url.to_string(),
        })
    }

    fn install_from_git(&self, _name: &str, repo: &str, target_dir: &str) -> Result<PluginInfo, String> {
        let output = std::process::Command::new("git")
            .args(["clone", "--depth", "1", repo, target_dir])
            .output()
            .map_err(|e| format!("Git clone failed: {}", e))?;

        if !output.status.success() {
            let err = String::from_utf8_lossy(&output.stderr);
            return Err(format!("Git error: {}", err));
        }

        Ok(PluginInfo {
            name: _name.to_string(),
            version: "git".into(),
            description: "Installed from git".into(),
            author: "community".into(),
            installed: true,
            source: repo.to_string(),
        })
    }

    fn install_from_local(&self, source: &str, target_dir: &str) -> Result<PluginInfo, String> {
        let src = Path::new(source);
        if !src.exists() {
            return Err(format!("Source not found: {}", source));
        }

        // Copy the directory
        copy_dir_recursive(src, Path::new(target_dir))
            .map_err(|e| format!("Copy failed: {}", e))?;

        Ok(PluginInfo {
            name: src.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default(),
            version: "local".into(),
            description: "Installed from local path".into(),
            author: "local".into(),
            installed: true,
            source: source.to_string(),
        })
    }

    /// Uninstall a plugin
    pub fn uninstall(&self, name: &str) -> Result<(), String> {
        let target = format!("{}/{}", self.skills_dir, name);
        let path = Path::new(&target);

        if !path.exists() {
            return Err(format!("Plugin '{}' not found", name));
        }

        fs::remove_dir_all(path).map_err(|e| format!("Remove failed: {}", e))
    }
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), std::io::Error> {
    fs::create_dir_all(dst)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let dst_path = dst.join(entry.file_name());

        if ty.is_dir() {
            copy_dir_recursive(&entry.path(), &dst_path)?;
        } else {
            fs::copy(entry.path(), &dst_path)?;
        }
    }

    Ok(())
}

fn parse_plugin_metadata(content: &str) -> (Option<String>, Option<String>, Option<String>) {
    let mut desc = None;
    let mut version = None;
    let mut author = None;

    for line in content.lines() {
        let line = line.trim();
        if let Some((key, value)) = line.split_once(':') {
            let key = key.trim().to_lowercase();
            let value = value.trim().trim_matches('"').trim_matches('\'').to_string();
            match key.as_str() {
                "description" => desc = Some(value),
                "version" => version = Some(value),
                "author" => author = Some(value),
                _ => {}
            }
        }
    }

    (desc, version, author)
}

// Tauri commands for plugins

#[tauri::command]
pub async fn plugin_list_installed(
   _state: tauri::State<'_, crate::AppState>,
) -> Result<Vec<PluginInfo>, String> {
    let manager = PluginManager::new("skills".into());
    Ok(manager.list_installed())
}

#[tauri::command]
pub async fn plugin_fetch_registry(
   _state: tauri::State<'_, crate::AppState>,
    registry_url: String,
) -> Result<PluginRegistry, String> {
    let manager = PluginManager::new("skills".into());
    manager.fetch_registry(&registry_url).await
}

#[tauri::command]
pub async fn plugin_install(
    state: tauri::State<'_, crate::AppState>,
    name: String,
    source: String,
) -> Result<PluginInfo, String> {
    let manager = PluginManager::new("skills".into());
    let info = manager.install(&name, &source).await?;

    // Reload skill engine
    let engine = crate::skills::SkillEngine::new(vec![
        "skills".to_string(),
        dirs::home_dir()
            .map(|h| format!("{}/.ruby-diamond/skills", h.display()))
            .unwrap_or_default(),
    ]);
    *state.skill_engine.lock().unwrap() = engine;

    Ok(info)
}

#[tauri::command]
pub async fn plugin_uninstall(
    state: tauri::State<'_, crate::AppState>,
    name: String,
) -> Result<(), String> {
    let manager = PluginManager::new("skills".into());
    manager.uninstall(&name)?;

    // Reload skill engine
    let engine = crate::skills::SkillEngine::new(vec![
        "skills".to_string(),
        dirs::home_dir()
            .map(|h| format!("{}/.ruby-diamond/skills", h.display()))
            .unwrap_or_default(),
    ]);
    *state.skill_engine.lock().unwrap() = engine;

    Ok(())
}
