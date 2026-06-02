use crate::types::Skill;
use std::fs;
use std::path::Path;
use std::collections::HashMap;

/// Skill engine — loads SKILL.md files from skill directories
#[derive(Clone)]
pub struct SkillEngine {
    skill_dirs: Vec<String>,
}

impl SkillEngine {
    pub fn new(skill_dirs: Vec<String>) -> Self {
        Self { skill_dirs }
    }

    /// Discover and load all skills
    pub fn discover(&self) -> Vec<Skill> {
        let mut skills = Vec::new();

        for dir in &self.skill_dirs {
            let path = Path::new(dir);
            if !path.exists() {
                continue;
            }

            // Check for SKILL.md in subdirectories
            if let Ok(entries) = fs::read_dir(path) {
                for entry in entries.filter_map(|e| e.ok()) {
                    let skill_dir = entry.path();
                    if !skill_dir.is_dir() { continue; }

                    let skill_md = skill_dir.join("SKILL.md");
                    if skill_md.exists() {
                        if let Some(skill) = Self::load_skill_file(&skill_md, &skill_dir) {
                            skills.push(skill);
                        }
                    }
                }
            }

            // Also check for direct SKILL.md (not in subdir)
            let direct = Path::new(dir).join("SKILL.md");
            if direct.exists() {
                if let Some(skill) = Self::load_skill_file(&direct, Path::new(dir)) {
                    skills.push(skill);
                }
            }
        }

        skills
    }

    fn load_skill_file(skill_md_path: &Path, skill_dir: &Path) -> Option<Skill> {
        let content = fs::read_to_string(skill_md_path).ok()?;
        let metadata = parse_frontmatter(&content);

        let name = metadata.get("name")
            .cloned()
            .unwrap_or_else(|| {
                skill_dir.file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "unknown".into())
            });

        let description = metadata.get("description")
            .cloned()
            .unwrap_or_else(|| "No description".into());

        Some(Skill {
            name,
            description,
            path: skill_md_path.display().to_string(),
            content: content.clone(),
            metadata,
        })
    }

    /// Get formatted skill context for the system prompt
    pub fn get_skills_context(&self) -> String {
        let skills = self.discover();
        if skills.is_empty() {
            return String::new();
        }

        let mut ctx = String::from("<available_skills>\n");
        for skill in &skills {
            ctx.push_str(&format!(
                "  <skill>\n    <name>{}</name>\n    <description>{}</description>\n    <location>{}</location>\n  </skill>\n",
                skill.name, skill.description, skill.path
            ));
        }
        ctx.push_str("</available_skills>\n");
        ctx
    }
}

/// Parse YAML-like frontmatter from markdown (between --- delimiters)
fn parse_frontmatter(content: &str) -> HashMap<String, String> {
    let mut meta = HashMap::new();

    if !content.starts_with("---") {
        return meta;
    }

    let parts: Vec<&str> = content.splitn(3, "---").collect();
    if parts.len() < 2 {
        return meta;
    }

    for line in parts[1].lines() {
        let line = line.trim();
        if line.is_empty() { continue; }
        if let Some((key, value)) = line.split_once(':') {
            let key = key.trim().to_lowercase();
            let value = value.trim().trim_matches('"').trim_matches('\'').to_string();
            meta.insert(key, value);
        }
    }

    meta
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_frontmatter() {
        let content = "---\nname: test-skill\ndescription: A test skill\n---\n# Body";
        let meta = parse_frontmatter(content);
        assert_eq!(meta.get("name").unwrap(), "test-skill");
        assert_eq!(meta.get("description").unwrap(), "A test skill");
    }
}
