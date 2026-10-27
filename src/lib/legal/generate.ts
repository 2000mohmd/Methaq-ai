// Server-only. Every AI-generated document (contract builder, workflows, chat drafting) is made here and stored
// for per-instance lawyer review; the draft body is never returned to the client. A verified lawyer's own
// document is approved under their own name and licence right away (self_approve_contract).
import type { SupabaseClient, User } from "@supabase/supabase-js";

import { AI_NOT_CONFIGURED, aiError, aiFetch } from "@/lib/ai-provider";
import { loadChunks } from "./retrieve";
import { GROUNDED, SYSTEM, UNGROUNDED } from "./prompt";
import { expandReferences, rank, sourceLabel, verifyAnswer, type Source } from "./legal";
import { redactFields, restore } from "./redact";

export type DocKind = "contract" | "workflow" | "chat_draft";
export type GenerateInput = { kind: DocKind; title: string; contract_type: string; language: string; inputs: Record<string, string>; prompt: string };
export type Generated = { id: string; status: "approved" | "pending_review"; approved_body?: string | null; reviewer_name?: string | null; reviewer_licence?: string | null };

/** Returns the stored document's id/status, or an error Response for the route to pass through. */
export async function generateForReview(sb: SupabaseClient, user: User, b: GenerateInput): Promise<Generated | Response> {
  let sources: Source[] = [];
  try {
    const chunks = await loadChunks(sb);
    sources = expandReferences(rank(b.prompt, chunks, 6, "Saudi Arabia"), chunks);
  } catch {
    /* library is optional */
  }
  const ctx = sources.length ? GROUNDED + sources.map((x) => `[S${x.id}] ${sourceLabel(x)}\n${x.text}`).join("\n\n") : UNGROUNDED;
  const system = `${SYSTEM}\nPrimary jurisdiction: Saudi Arabia.\nTask mode: ${b.kind}: ${b.contract_type}.${ctx}`;

  // Party names/IDs/addresses are known fields: seed the mask map so they never reach the provider.
  const { map } = redactFields(b.inputs);
  const res = await aiFetch({ max_tokens: 8000, messages: [{ role: "system", content: system }, { role: "user", content: b.prompt }] }, map);
  if (res.status === 503) return new Response(AI_NOT_CONFIGURED, { status: 503 });
  if (res.status === 429) return new Response("Rate limited, try again shortly.", { status: 429 });
  if (!res.ok) return aiError(res);
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const draft = verifyAnswer(String(j.choices?.[0]?.message?.content ?? ""), sources);
  if (!draft.text.trim()) return new Response("AI error", { status: 502 });

  const { data: prof } = await sb.from("profiles").select("organization_id").eq("id", user.id).maybeSingle();
  const { data: row, error: insErr } = await sb
    .from("contracts")
    .insert({
      kind: b.kind,
      title: b.title.slice(0, 200),
      contract_type: b.contract_type,
      language: b.language,
      inputs: b.inputs,
      body: restore(draft.text, map),
      organization_id: prof?.organization_id ?? null,
    })
    .select("id")
    .single();
  if (insErr) return new Response(insErr.message, { status: 500 });

  await sb.from("audit_logs").insert({
    user_id: user.id,
    action: "contract.generated",
    resource: "contracts",
    resource_id: row.id,
    metadata: { kind: b.kind, contract_type: b.contract_type, grounded: draft.grounded, stripped: draft.stripped, masked: Object.keys(map).length },
  });

  const { data: lawyer } = await sb.rpc("is_verified_lawyer");
  if (lawyer === true) {
    const { error: apErr } = await sb.rpc("self_approve_contract", { _id: row.id });
    if (!apErr) {
      const { data: done } = await sb.from("contracts").select("approved_body,reviewer_name,reviewer_licence").eq("id", row.id).single();
      return { id: row.id, status: "approved", ...(done ?? {}) };
    }
  }
  return { id: row.id, status: "pending_review" };
}
