/**
 * LLM provider abstraction for OIMO / LMA.
 *
 * Supports:
 *  - "gemini" (default): Google Gemini generateContent API via GEMINI_API_KEY
 *  - "kimi":  Moonshot AI, OpenAI-compatible chat completions via MOONSHOT_API_KEY
 *  - "grok":  xAI, OpenAI-compatible chat completions via XAI_API_KEY
 *
 * All secrets come from env bindings only. Model names are env-overridable.
 */

export type LLMProvider = "gemini" | "kimi" | "grok";

export interface LLMEnv {
  AI_PROVIDER?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  MOONSHOT_API_KEY?: string;
  KIMI_MODEL?: string;
  XAI_API_KEY?: string;
  GROK_MODEL?: string;
}

export interface LLMResult {
  provider: LLMProvider;
  model: string;
  reply: string;
}

const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";
const KIMI_DEFAULT_MODEL = "kimi-k2-0905-preview";
const GROK_DEFAULT_MODEL = "grok-3";

export function resolveProvider(provider: string | undefined, env: LLMEnv): LLMProvider {
  const p = (provider || env.AI_PROVIDER || "gemini").toLowerCase();
  if (p === "kimi" || p === "moonshot") return "kimi";
  if (p === "grok" || p === "xai") return "grok";
  return "gemini";
}

async function runGemini(
  prompt: string,
  systemInstruction: string,
  env: LLMEnv
): Promise<LLMResult> {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY secret is not configured on the worker.");
  }
  const model = env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    }
  );
  const data: any = await res.json();
  if (!res.ok) {
    throw new Error(`Gemini API error (${res.status}): ${JSON.stringify(data)}`);
  }
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";
  return { provider: "gemini", model, reply };
}

async function runOpenAICompatible(
  provider: "kimi" | "grok",
  prompt: string,
  systemInstruction: string,
  env: LLMEnv
): Promise<LLMResult> {
  const isKimi = provider === "kimi";
  const apiKey = isKimi ? env.MOONSHOT_API_KEY : env.XAI_API_KEY;
  const endpoint = isKimi
    ? "https://api.moonshot.ai/v1/chat/completions"
    : "https://api.x.ai/v1/chat/completions";
  const model = isKimi ? env.KIMI_MODEL || KIMI_DEFAULT_MODEL : env.GROK_MODEL || GROK_DEFAULT_MODEL;
  if (!apiKey) {
    throw new Error(
      `${isKimi ? "MOONSHOT_API_KEY" : "XAI_API_KEY"} secret is not configured on the worker.`
    );
  }
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt },
      ],
    }),
  });
  const data: any = await res.json();
  if (!res.ok) {
    throw new Error(
      `${isKimi ? "Moonshot" : "xAI"} API error (${res.status}): ${JSON.stringify(data)}`
    );
  }
  const reply = data?.choices?.[0]?.message?.content || "No response generated.";
  return { provider, model, reply };
}

/**
 * Run a single-turn cloud LLM call against the selected provider.
 */
export async function runCloudLLM(
  prompt: string,
  systemInstruction: string,
  provider: string | undefined,
  env: LLMEnv
): Promise<LLMResult> {
  const resolved = resolveProvider(provider, env);
  if (resolved === "gemini") return runGemini(prompt, systemInstruction, env);
  return runOpenAICompatible(resolved, prompt, systemInstruction, env);
}
