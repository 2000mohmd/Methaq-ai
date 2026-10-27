import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import { allow, TOO_MANY } from "@/lib/rate-limit";
import { generateForReview } from "@/lib/legal/generate";

/**
 * Generates a contract or workflow document server-side and stores it for lawyer review.
 * The draft is never returned to the client (per-instance review model, see the
 * contract_review migration): the response carries only the new id and its status.
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

        const b = (await request.json()) as { kind?: string; title?: string; contract_type?: string; language?: string; inputs?: Record<string, string>; prompt?: string };
        if (!b.title || !b.contract_type || !b.prompt || b.prompt.length > 20_000) return new Response("Bad request", { status: 400 });

        const out = await generateForReview(sb, u.user, {
          kind: b.kind === "workflow" ? "workflow" : "contract",
          title: b.title,
          contract_type: b.contract_type,
          language: b.language ?? "ar",
          inputs: b.inputs ?? {},
          prompt: b.prompt,
        });
        if (out instanceof Response) return out;
        return Response.json({ id: out.id, status: out.status });
      },
    },
  },
});
