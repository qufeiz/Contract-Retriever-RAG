// DeepSeek client (OpenAI-compatible chat completions). Key is env-only.
const BASE = process.env.LLM_BASE_URL ?? "https://api.deepseek.com";
const MODEL = process.env.LLM_MODEL ?? "deepseek-chat";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export function llmConfigured(): boolean {
  return Boolean(process.env.LLM_API_KEY);
}

export async function chat(
  messages: ChatMessage[],
  opts: { json?: boolean; temperature?: number } = {}
): Promise<string> {
  const key = process.env.LLM_API_KEY;
  if (!key) throw new Error("LLM_API_KEY not set");
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: opts.temperature ?? 0,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DeepSeek ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as any;
  return data.choices?.[0]?.message?.content ?? "";
}
