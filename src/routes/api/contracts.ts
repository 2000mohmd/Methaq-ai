import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import { AI_NOT_CONFIGURED, aiError, aiFetch } from "@/lib/ai-provider";
import { allow, TOO_MANY } from "@/lib/rate-limit";
import { loadChunks } from "@/lib/legal/retrieve";
import { GROUNDED, SYSTEM, UNGROUNDED } from "@/lib/legal/prompt";
import { expandReferences, rank, verifyAnswer, type Source } from "@/lib/legal/legal";

/**
 * Generates a contract server-side and stores it as pending lawyer review.
 * The draft is never returned to the client (per-instance review model, see the
 * contract_review migration): the response carries only the new contract id.
 */
export const Route = createFileRoute("/api/contracts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace("Bearer ", "");
        if (!token) return new Response("Unauthorized", { status: 401 });
        const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false },
        });
        const { data: u, error } = await sb.auth.getUser(token);
        if (error || !u.user) return new Response("Unauthorized", { status: 401 });
        if (!allow(u.user.id, "contracts", 5)) return new Response(TOO_MANY, { status: 429 });

        const b = (await request.json()) as { title?: string; contract_type?: string; language?: string; inputs?: Record<string, string>; prompt?: string };
        if (!b.title || !b.contract_type || !b.prompt || b.prompt.length > 20_000) return new Response("Bad request", { status: 400 });

        let sources: Source[] = [];
        try {
          const chunks = await loadChunks(sb);
          sources = expandReferences(rank(b.prompt, chunks, 6, "Saudi Arabia"), chunks);
        } catch {
          /* library is optional */
        }
        const ctx = sources.length
          ? GROUNDED + sources.map((x) => `[S${x.id}] ${x.title}${x.ref ? ` — Article ${x.ref}` : ""} (${x.status})\n${x.text}`).join("\n\n")
          : UNGROUNDED;
        const system = `${SYSTEM}\nPrimary jurisdiction: Saudi Arabia.\nTask mode: contract: ${b.contract_type}.${ctx}`;

        const res = await aiFetch({ max_tokens: 8000, messages: [{ role: "system", content: system }, { role: "user", content: b.prompt }] });
        if (res.status === 503) return new Response(AI_NOT_CONFIGURED, { status: 503 });
        if (!res.ok) return aiError(res);
        const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const draft = verifyAnswer(String(j.choices?.[0]?.message?.content ?? ""), sources);
        if (!draft.text.trim()) return new Response("AI error", { status: 502 });

        const { data: prof } = await sb.from("profiles").select("organization_id").eq("id", u.user.id).maybeSingle();
        const { data: row, error: insErr } = await sb
          .from("contracts")
          .insert({ title: b.title.slice(0, 200), contract_type: b.contract_type, language: b.language ?? "ar", inputs: b.inputs ?? {}, body: draft.text, organization_id: prof?.organization_id ?? null })
          .select("id")
          .single();
        if (insErr) return new Response(insErr.message, { status: 500 });

        await sb.from("audit_logs").insert({
          user_id: u.user.id,
          action: "contract.generated",
          resource: "contracts",
          resource_id: row.id,
          metadata: { contract_type: b.contract_type, grounded: draft.grounded, stripped: draft.stripped },
        });
        return Response.json({ id: row.id, status: "pending_review" });
      },
    },
  },
});
