import { useState } from "react";
import { useStore } from "../store";
import type { LLMConfig } from "../lib/api";
import { Brain, Send, Zap, GitMerge, Play, Loader } from "lucide-react";

async function callLLM(config: LLMConfig, systemPrompt: string, userMessage: string): Promise<string> {
  const isAnthropic = config.provider === "mimo" || config.provider === "anthropic";
  
  if (isAnthropic) {
    // Anthropic-compatible API (MiMo, Anthropic)
    const baseUrl = config.base_url || "https://token-plan-sgp.xiaomimimo.com/v1";
    const resp = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.api_key || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
        max_tokens: 2048,
      }),
    });
    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`API ${resp.status}: ${err.slice(0, 200)}`);
    }
    const data = await resp.json() as any;
    return data.content?.map((b: any) => b.text).join("") || "(no response)";
  }
  
  // OpenAI-compatible API
  const baseUrl = config.base_url || "https://api.deepseek.com/v1";
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.api_key}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 2048,
      temperature: config.temperature,
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`API ${resp.status}: ${err.slice(0, 200)}`);
  }
  const data = await resp.json() as any;
  return data.choices?.[0]?.message?.content || "(no response)";
}

export function MeshPanel() {
  const { agents } = useStore();
  const [goal, setGoal] = useState("");
  const [mode, setMode] = useState<"debate" | "review" | "ensemble">("debate");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Array<{ role: string; output: string }>>([]);
  const [log, setLog] = useState("");

  // Get API config from first agent with an API key
  const agentWithKey = agents.find((a) => (a as any)._config?.api_key);
  const config: LLMConfig | undefined = agentWithKey ? (agentWithKey as any)._config : undefined;

  const handleRun = async () => {
    if (!goal.trim() || !config) return;
    setRunning(true);
    setResults([]);
    setLog("Starting debate...");

    try {
      if (mode === "debate") {
        // Proposer
        setLog("Proposer thinking...");
        const proposal = await callLLM(config,
          "You are the PROPOSER. Argue for the best solution to the goal. Be thorough and creative.",
          goal
        );
        setResults((r) => [...r, { role: "Proposer", output: proposal }]);

        // Critic
        setLog("Critic reviewing...");
        const critique = await callLLM(config,
          "You are the CRITIC. Find flaws, edge cases, and risks in the proposal. Be harsh but fair.",
          `Goal: ${goal}\n\nProposal:\n${proposal}\n\nCritique this proposal.`
        );
        setResults((r) => [...r, { role: "Critic", output: critique }]);

        // Judge
        setLog("Judge synthesizing...");
        const verdict = await callLLM(config,
          "You are the JUDGE. Synthesize the proposal and critique into a final, actionable plan. Take the best from both.",
          `Goal: ${goal}\n\nProposal:\n${proposal}\n\nCritique:\n${critique}\n\nSynthesize into a final plan.`
        );
        setResults((r) => [...r, { role: "Judge", output: verdict }]);
        setLog("✅ Debate complete");
      } else if (mode === "review") {
        const author = await callLLM(config,
          "You are an expert developer. Write the best solution to the goal.",
          goal
        );
        setResults((r) => [...r, { role: "Author", output: author }]);

        const reviewer = await callLLM(config,
          "You are a code reviewer. Find bugs, improvements, and edge cases.",
          `Goal: ${goal}\n\nCode:\n${author}\n\nReview this thoroughly.`
        );
        setResults((r) => [...r, { role: "Reviewer", output: reviewer }]);
        setLog("✅ Review complete");
      } else {
        // Ensemble: run 3 times with different temps
        setLog("Running ensemble (3 agents)...");
        const a = await callLLM({ ...config, temperature: 0.2 }, "You are Agent A. Be practical and minimal.", goal);
        setResults((r) => [...r, { role: "Agent A (cold)", output: a }]);

        const b = await callLLM({ ...config, temperature: 0.7 }, "You are Agent B. Be creative and bold.", goal);
        setResults((r) => [...r, { role: "Agent B (creative)", output: b }]);

        const c = await callLLM({ ...config, temperature: 0.5 }, "You are Agent C. Be balanced and thorough.", goal);
        setResults((r) => [...r, { role: "Agent C (balanced)", output: c }]);

        const merge = await callLLM(config,
          "Combine the best ideas from these three solutions into one optimal answer.",
          `Goal: ${goal}\n\nSolution A:\n${a}\n\nSolution B:\n${b}\n\nSolution C:\n${c}\n\nMerge the best parts.`
        );
        setResults((r) => [...r, { role: "Merger", output: merge }]);
        setLog("✅ Ensemble complete");
      }
    } catch (e: any) {
      setLog(`❌ ${e.message || e}`);
    }
    setRunning(false);
  };

  return (
    <div className="panel-right" style={{ width: 400 }}>
      <div className="panel-header">
        <Brain size={14} /> Agent Mesh
      </div>

      <div className="panel-body" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {!config ? (
          <div style={{ fontSize: 11, color: "var(--fg-dim)", padding: 12, textAlign: "center" }}>
            Create an agent with an API key first (click + in titlebar)
          </div>
        ) : (
          <>
            {/* Mode selector */}
            <div style={{ display: "flex", gap: 4 }}>
              {(["debate", "review", "ensemble"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    flex: 1, padding: "6px 8px", borderRadius: 4, fontSize: 11,
                    background: mode === m ? "var(--accent)" : "var(--bg-input)",
                    color: mode === m ? "white" : "var(--fg-dim)",
                    border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, justifyContent: "center",
                  }}
                >
                  {m === "debate" ? <Zap size={10} /> : m === "review" ? <GitMerge size={10} /> : <Play size={10} />}
                  {m}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 10, color: "var(--fg-dim)", lineHeight: 1.4 }}>
              {mode === "debate" && "Proposer → Critic → Judge (3 LLM calls)"}
              {mode === "review" && "Author → Reviewer (2 LLM calls)"}
              {mode === "ensemble" && "3 agents + merger (4 LLM calls)"}
            </div>

            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Design a rate limiter for a REST API"
              rows={2}
              className="input"
              style={{ resize: "vertical", fontSize: 12 }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleRun(); } }}
            />

            <button className="btn-primary" onClick={handleRun} disabled={running || !goal.trim()}>
              {running ? <><Loader size={12} style={{ animation: "spin 1s linear infinite" }} /> {log}</> : <><Send size={12} /> Run {mode}</>}
            </button>

            {log && !running && (
              <div style={{ fontSize: 10, color: log.startsWith("✅") ? "var(--green)" : "var(--ruby)", fontFamily: "var(--font-mono)" }}>
                {log}
              </div>
            )}

            {/* Results */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {results.map((r, i) => (
                <details key={i} style={{ marginBottom: 6 }} open>
                  <summary style={{ fontSize: 11, cursor: "pointer", color: "var(--copper)", fontWeight: 600, padding: "4px 0" }}>
                    {r.role}
                  </summary>
                  <pre style={{ fontSize: 10, whiteSpace: "pre-wrap", margin: 0, color: "var(--fg-dim)", background: "var(--bg-input)", padding: 8, borderRadius: 4, maxHeight: 200, overflow: "auto" }}>
                    {r.output.slice(0, 800)}
                  </pre>
                </details>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
