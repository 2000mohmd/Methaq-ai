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

export const aiFetch = (body: Record<string, unknown>) =>
  fetch(url(), { method: "POST", headers: aiHeaders(), body: JSON.stringify({ model: model(), ...body }) });
