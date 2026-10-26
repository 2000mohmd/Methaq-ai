// Server-only. One place that knows which LLM provider we call (OpenAI-compatible chat/completions).
// Own key (AI_API_KEY / ANTHROPIC_API_KEY) wins -> Anthropic by default. With no own key but LOVABLE_API_KEY
// (running on Lovable), the Lovable AI gateway is used. Override anything with AI_BASE_URL / AI_MODEL.

const env = (k: string) => process.env[k];
const ownKey = () => env("AI_API_KEY") ?? env("ANTHROPIC_API_KEY");
const onLovable = () => !ownKey() && !!env("LOVABLE_API_KEY");

const url = () => `${env("AI_BASE_URL") ?? (onLovable() ? "https://ai.gateway.lovable.dev/v1" : "https://api.anthropic.com/v1")}/chat/completions`;
const model = () => env("AI_MODEL") ?? (onLovable() ? "google/gemini-3-flash-preview" : "claude-sonnet-5-5");

// ponytail: council defaults to one vendor's tiers; set AI_COUNCIL_MODELS to other vendors' models for real diversity.
export const councilModels = () =>
  (env("AI_COUNCIL_MODELS") ?? (onLovable() ? "google/gemini-2.5-pro,openai/gpt-5,google/gemini-3-flash-preview" : "claude-opus-5-5,claude-sonnet-5-5,claude-haiku-5-5")).split(",");

export function aiHeaders(): Record<string, string> {
  const key = ownKey() ?? env("LOVABLE_API_KEY");
  if (!key) throw new Error("No AI key set: add ANTHROPIC_API_KEY (or AI_API_KEY) to .env");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export const AI_NOT_CONFIGURED = "AI is not configured on the server (set ANTHROPIC_API_KEY).";

/** Never throws: with no key it returns a 503 Response so routes can report it cleanly. */
export const aiFetch = async (body: Record<string, unknown>): Promise<Response> => {
  if (!ownKey() && !env("LOVABLE_API_KEY")) return new Response(AI_NOT_CONFIGURED, { status: 503 });
  return fetch(url(), { method: "POST", headers: aiHeaders(), body: JSON.stringify({ model: model(), ...body }) });
};

/** Turns a failed provider response into a readable error for the user (never includes keys). */
export async function aiError(res: Response): Promise<Response> {
  let msg = "";
  try {
    const j = (await res.json()) as { error?: { message?: string } };
    msg = j.error?.message ?? "";
  } catch {
    /* non-JSON body */
  }
  if (/credit balance/i.test(msg)) msg = "The AI provider account has no credit left. Add credit in the provider billing page.";
  else if (res.status === 401 || res.status === 403) msg = "The AI key was rejected. Check ANTHROPIC_API_KEY.";
  return new Response(msg ? `AI error: ${msg}` : "AI error", { status: 502 });
}
