// ============================================================================
// Ruby Diamond — Provider with Tool Support (DeepSeek)
// ============================================================================

import { TOOLS } from "./agent";

export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

// ============================================================================
// Streaming Chat (text only)
// ============================================================================

export async function* streamChat(
  messages: ChatMessage[],
  apiKey: string
): AsyncGenerator<{ text?: string; done?: boolean; error?: string }> {
  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      stream: true,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "Unknown error");
    yield { error: `API error (${response.status}): ${err}` };
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) { yield { error: "No response body" }; return; }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") { yield { done: true }; return; }
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;
        if (delta?.content) yield { text: delta.content };
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            yield {
              text: `\n<tool id="${tc.id || '0'}" name="${tc.function?.name || ''}">${tc.function?.arguments || ''}</tool>\n`,
            };
          }
        }
      } catch { /* skip */ }
    }
  }
  yield { done: true };
}

// ============================================================================
// Agent Turn — one LLM call with tools, returns text + tool calls
// ============================================================================

export interface AgentTurnResult {
  text: string;
  toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  finishReason: string;
}

export async function agentTurn(
  messages: ChatMessage[],
  apiKey: string
): Promise<AgentTurnResult> {
  // Convert tools to DeepSeek format
  const dsTools = TOOLS.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(
          Object.entries(t.parameters).map(([k, v]) => [k, { type: v.type, description: v.description }])
        ),
        required: t.required,
      },
    },
  }));

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages,
      tools: dsTools,
      tool_choice: "auto",
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "Unknown");
    return { text: `API error (${response.status}): ${err}`, toolCalls: [], finishReason: "error" };
  }

  const data = await response.json() as {
    choices: Array<{
      message: {
        content: string | null;
        tool_calls?: Array<{
          id: string;
          function: { name: string; arguments: string };
        }>;
      };
      finish_reason: string;
    }>;
  };

  const choice = data.choices?.[0];
  if (!choice) return { text: "", toolCalls: [], finishReason: "error" };

  const text = choice.message.content || "";
  const toolCalls = (choice.message.tool_calls || []).map((tc) => {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(tc.function.arguments); } catch { /* empty args */ }
    return { id: tc.id, name: tc.function.name, arguments: args };
  });

  return { text, toolCalls, finishReason: choice.finish_reason };
}
