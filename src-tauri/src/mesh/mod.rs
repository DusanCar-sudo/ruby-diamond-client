use crate::agent::AgentLoop;
use crate::types::{LLMConfig, Message};
use crate::tools::registry::ToolRegistry;
use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};

/// Mesh protocol types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MeshRole {
    Proposer,   // Proposes solution
    Critic,     // Reviews and critiques
    Synthesizer, // Combines best ideas
    Executor,   // Runs the final plan
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshAgent {
    pub id: String,
    pub name: String,
    pub role: MeshRole,
    pub personality: String,
    pub config: LLMConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshResult {
    pub goal: String,
    pub rounds: Vec<MeshRound>,
    pub final_output: String,
    pub agents_used: Vec<String>,
    pub total_tokens: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MeshRound {
    pub round_number: u32,
    pub agent_id: String,
    pub role: String,
    pub output: String,
    pub tool_calls: u32,
}

/// Agent Mesh Orchestrator — runs debate/review/synthesis protocols
pub struct MeshOrchestrator {
    tool_registry: Arc<Mutex<ToolRegistry>>,
    skill_engine: crate::skills::SkillEngine,
    cwd: String,
}

impl MeshOrchestrator {
    pub fn new(
        tool_registry: Arc<Mutex<ToolRegistry>>,
        skill_engine: crate::skills::SkillEngine,
        cwd: String,
    ) -> Self {
        Self { tool_registry, skill_engine, cwd }
    }

    /// DEBATE protocol: two agents argue, third judges
    pub async fn debate(
        &self,
        goal: &str,
        config_a: LLMConfig,
        config_b: LLMConfig,
        config_judge: LLMConfig,
    ) -> Result<MeshResult, String> {
        let mut rounds = Vec::new();
        let mut total_tokens = 0u32;

        // Agent A: Proposer
        let mut agent_a = AgentLoop::new(
            "mesh-debate-A".into(), "Proposer Alpha".into(),
            config_a.clone(), self.tool_registry.clone(),
            self.skill_engine.clone(), self.cwd.clone(),
        );

        let proposal = agent_a.run(
            &format!("Propose a solution for: {}\n\nBe creative and thorough. Include implementation details, trade-offs, and edge cases.", goal)
        ).await?;

        let output_a = extract_final_content(&proposal);
        rounds.push(MeshRound {
            round_number: 1, agent_id: "A".into(), role: "proposer".into(),
            output: output_a.clone(), tool_calls: count_tool_calls(&proposal),
        });

        // Agent B: Critic
        let mut agent_b = AgentLoop::new(
            "mesh-debate-B".into(), "Critic Beta".into(),
            config_b.clone(), self.tool_registry.clone(),
            self.skill_engine.clone(), self.cwd.clone(),
        );

        let critique = agent_b.run(
            &format!("Critique this proposal thoroughly. Find weaknesses, edge cases, security issues, and missing pieces. Be harsh but fair.\n\nPROPOSAL:\n{}", output_a)
        ).await?;

        let output_b = extract_final_content(&critique);
        rounds.push(MeshRound {
            round_number: 2, agent_id: "B".into(), role: "critic".into(),
            output: output_b.clone(), tool_calls: count_tool_calls(&critique),
        });

        // Agent A: Rebuttal
        let rebuttal = agent_a.run(
            &format!("Respond to this critique. Address each point. Admit valid criticisms and defend where appropriate.\n\nCRITIQUE:\n{}", output_b)
        ).await?;

        let output_rebuttal = extract_final_content(&rebuttal);
        rounds.push(MeshRound {
            round_number: 3, agent_id: "A".into(), role: "rebuttal".into(),
            output: output_rebuttal.clone(), tool_calls: count_tool_calls(&rebuttal),
        });

        // Judge: Synthesis
        let mut agent_judge = AgentLoop::new(
            "mesh-debate-judge".into(), "Judge Omega".into(),
            config_judge, self.tool_registry.clone(),
            self.skill_engine.clone(), self.cwd.clone(),
        );

        let verdict = agent_judge.run(
            &format!("You are the judge. Review the debate and produce the final, best solution.\n\nGOAL: {}\n\nPROPOSAL:\n{}\n\nCRITIQUE:\n{}\n\nREBUTTAL:\n{}\n\nSynthesize the best answer. Combine valid points from both sides. Produce a final, polished solution.", goal, output_a, output_b, output_rebuttal)
        ).await?;

        let final_output = extract_final_content(&verdict);
        rounds.push(MeshRound {
            round_number: 4, agent_id: "judge".into(), role: "synthesizer".into(),
            output: final_output.clone(), tool_calls: count_tool_calls(&verdict),
        });

        Ok(MeshResult {
            goal: goal.to_string(),
            rounds,
            final_output,
            agents_used: vec!["Proposer Alpha".into(), "Critic Beta".into(), "Judge Omega".into()],
            total_tokens,
        })
    }

    /// REVIEW protocol: one agent produces, another reviews
    pub async fn review(
        &self,
        goal: &str,
        config_author: LLMConfig,
        config_reviewer: LLMConfig,
    ) -> Result<MeshResult, String> {
        let mut rounds = Vec::new();

        // Author writes
        let mut author = AgentLoop::new(
            "mesh-review-author".into(), "Author".into(),
            config_author, self.tool_registry.clone(),
            self.skill_engine.clone(), self.cwd.clone(),
        );

        let draft = author.run(goal).await?;
        let output_draft = extract_final_content(&draft);
        rounds.push(MeshRound {
            round_number: 1, agent_id: "author".into(), role: "author".into(),
            output: output_draft.clone(), tool_calls: count_tool_calls(&draft),
        });

        // Reviewer checks
        let mut reviewer = AgentLoop::new(
            "mesh-review-reviewer".into(), "Reviewer".into(),
            config_reviewer, self.tool_registry.clone(),
            self.skill_engine.clone(), self.cwd.clone(),
        );

        let review = reviewer.run(
            &format!("Review this output for correctness, style, and completeness. List specific issues and suggest fixes.\n\nOUTPUT:\n{}", output_draft)
        ).await?;

        let output_review = extract_final_content(&review);
        rounds.push(MeshRound {
            round_number: 2, agent_id: "reviewer".into(), role: "reviewer".into(),
            output: output_review.clone(), tool_calls: count_tool_calls(&review),
        });

        // Author incorporates feedback
        let final_version = author.run(
            &format!("Incorporate this feedback into your original work. Produce the final version.\n\nORIGINAL:\n{}\n\nFEEDBACK:\n{}", output_draft, output_review)
        ).await?;

        let final_output = extract_final_content(&final_version);

        Ok(MeshResult {
            goal: goal.to_string(),
            rounds,
            final_output,
            agents_used: vec!["Author".into(), "Reviewer".into()],
            total_tokens: 0,
        })
    }

    /// ENSEMBLE protocol: N agents solve independently, then merge
    pub async fn ensemble(
        &self,
        goal: &str,
        configs: Vec<LLMConfig>,
    ) -> Result<MeshResult, String> {
        let mut rounds = Vec::new();

        // Run all agents in parallel
        let mut handles = Vec::new();
        for (i, config) in configs.iter().enumerate() {
            let goal_clone = goal.to_string();
            let config_clone = config.clone();
            let tool_reg = self.tool_registry.clone();
            let skill_eng = self.skill_engine.clone();
            let cwd = self.cwd.clone();

            handles.push(tokio::spawn(async move {
                let mut agent = AgentLoop::new(
                    format!("mesh-ensemble-{}", i),
                    format!("Agent {}", i + 1),
                    config_clone,
                    tool_reg,
                    skill_eng,
                    cwd,
                );
                let result = agent.run(&goal_clone).await;
                (i, result)
            }));
        }

        let mut outputs = Vec::new();
        for handle in handles {
            match handle.await.unwrap() {
                (i, Ok(msgs)) => {
                    let content = extract_final_content(&msgs);
                    outputs.push((i, content.clone()));
                }
                (i, Err(e)) => {
                    outputs.push((i, format!("Error: {}", e)));
                }
            }
        }

        outputs.sort_by_key(|(i, _)| *i);

        // Merge results
        let merge_prompt = outputs.iter()
            .enumerate()
            .map(|(idx, (_, out))| format!("SOLUTION {}:\n{}\n", idx + 1, out))
            .collect::<Vec<_>>()
            .join("\n---\n\n");

        let merge_config = configs[0].clone();
        let mut merger = AgentLoop::new(
            "mesh-ensemble-merger".into(), "Merger".into(),
            merge_config, self.tool_registry.clone(),
            self.skill_engine.clone(), self.cwd.clone(),
        );

        let merged = merger.run(
            &format!("You have {} independent solutions for this goal. Combine the best parts from each into one optimal solution.\n\nGOAL: {}\n\n{}",
                outputs.len(), goal, merge_prompt)
        ).await?;

        let final_output = extract_final_content(&merged);

        for (i, (_, output)) in outputs.iter().enumerate() {
            rounds.push(MeshRound {
                round_number: (i + 1) as u32,
                agent_id: format!("agent-{}", i + 1),
                role: "solver".into(),
                output: output.clone(),
                tool_calls: 0,
            });
        }

        Ok(MeshResult {
            goal: goal.to_string(),
            rounds,
            final_output,
            agents_used: (0..configs.len()).map(|i| format!("Agent {}", i + 1)).collect(),
            total_tokens: 0,
        })
    }
}

// Helper: extract the last assistant message content
fn extract_final_content(messages: &[Message]) -> String {
    messages.iter()
        .rev()
        .find(|m| m.role == "assistant" && !m.content.is_empty())
        .map(|m| m.content.clone())
        .unwrap_or_else(|| "No response".into())
}

// Helper: count tool calls across all messages
fn count_tool_calls(messages: &[Message]) -> u32 {
    messages.iter()
        .filter(|m| m.role == "assistant")
        .filter_map(|m| m.tool_calls.as_ref())
        .map(|tc| tc.len() as u32)
        .sum()
}

// Tauri commands for mesh operations

#[tauri::command]
pub async fn mesh_debate(
    state: tauri::State<'_, crate::AppState>,
    goal: String,
    config_a: LLMConfig,
    config_b: LLMConfig,
    config_judge: LLMConfig,
) -> Result<MeshResult, String> {
    let orchestrator = MeshOrchestrator::new(
        state.tool_registry.clone(),
        state.skill_engine.lock().unwrap().clone(),
        std::env::current_dir().map(|p| p.display().to_string()).unwrap_or_default(),
    );
    orchestrator.debate(&goal, config_a, config_b, config_judge).await
}

#[tauri::command]
pub async fn mesh_review(
    state: tauri::State<'_, crate::AppState>,
    goal: String,
    config_author: LLMConfig,
    config_reviewer: LLMConfig,
) -> Result<MeshResult, String> {
    let orchestrator = MeshOrchestrator::new(
        state.tool_registry.clone(),
        state.skill_engine.lock().unwrap().clone(),
        std::env::current_dir().map(|p| p.display().to_string()).unwrap_or_default(),
    );
    orchestrator.review(&goal, config_author, config_reviewer).await
}

#[tauri::command]
pub async fn mesh_ensemble(
    state: tauri::State<'_, crate::AppState>,
    goal: String,
    configs: Vec<LLMConfig>,
) -> Result<MeshResult, String> {
    let orchestrator = MeshOrchestrator::new(
        state.tool_registry.clone(),
        state.skill_engine.lock().unwrap().clone(),
        std::env::current_dir().map(|p| p.display().to_string()).unwrap_or_default(),
    );
    orchestrator.ensemble(&goal, configs).await
}
