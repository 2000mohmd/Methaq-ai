// Server-only. One place that knows which LLM provider we call (OpenAI-compatible chat/completions).
// Defaults to Anthropic's compatibility endpoint; override with AI_BASE_URL / AI_API_KEY / AI_MODEL.

const env = (k: string) => process.env[k];

export const AI_URL = `${env("AI_BASE_URL") ?? "https://api.anthropic.com/v1"}/chat/completions`;
export const AI_MODEL = env("AI_MODEL") ?? "claude-sonnet-5-5";
// ponytail: council defaults to three Claude tiers; set AI_COUNCIL_MODELS to other vendors' models for real diversity.
export const COUNCIL_MODELS = (env("AI_COUNCIL_MODELS") ?? "claude-opus-5-5,claude-sonnet-5-5,claude-haiku-5-5").split(",");

export function aiHeaders(): Record<string, string> {
  const key = env("AI_API_KEY") ?? env("ANTHROPIC_API_KEY");
  if (!key) throw new Error("AI_API_KEY (or ANTHROPIC_API_KEY) is not set");
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export const aiFetch = (body: Record<string, unknown>) =>
  fetch(AI_URL, { method: "POST", headers: aiHeaders(), body: JSON.stringify({ model: AI_MODEL, ...body }) });
