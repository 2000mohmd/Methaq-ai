import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const SYSTEM = `You are Mithaq, a careful, jurisdiction-aware legal AI assistant for lawyers and individuals in the Arab world (GCC, Egypt, Jordan, Lebanon and beyond).
- Answer in the user's language (Arabic or English).
- Structure answers with clear headings and short paragraphs.
- Cite the specific law, article or regulation you rely on when you know it; if you are unsure, say so plainly and never invent citations.
- When drafting, produce complete, professional documents.
- When reviewing contracts, list risks by severity with suggested redlines.
- End substantive legal advice with a brief reminder that this is not a substitute for a licensed lawyer.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace("Bearer ", "");
        if (!token) return new Response("Unauthorized", { status: 401 });
        const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false },
        });
        const { data: userData, error } = await sb.auth.getUser(token);
        if (error || !userData.user) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as {
          messages: { role: "user" | "assistant"; content: string }[];
          jurisdiction?: string;
          mode?: string;
        };
        if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 60) {
          return new Response("Bad request", { status: 400 });
        }
        // Pull the most relevant items from the firm's legal library (RLS keeps it org-scoped).
        let libraryCtx = "";
        try {
          const last = [...body.messages].reverse().find((m) => m.role === "user")?.content ?? "";
          const words = Array.from(new Set(last.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2)));
          const { data: items } = await sb.from("library_items").select("title, jurisdiction, category, source_url, content").limit(300);
          const scored = (items ?? [])
            .map((it: { title: string | null; jurisdiction: string | null; category: string | null; source_url: string | null; content: string | null }) => {
              const hay = `${it.title ?? ""} ${it.content ?? ""} ${it.jurisdiction ?? ""}`.toLowerCase();
              let s = words.reduce((a, w) => a + (hay.includes(w) ? 1 : 0), 0);
              if (body.jurisdiction && it.jurisdiction === body.jurisdiction) s += 0.5;
              return { it, s };
            })
            .filter((x) => x.s >= 1)
            .sort((a, b) => b.s - a.s)
            .slice(0, 5);
          if (scored.length) {
            libraryCtx =
              "\n\nFIRM LIBRARY — relevant items saved by this firm. Prefer them when relevant and cite them by title:\n" +
              scored
                .map(({ it }, i) => `[${i + 1}] ${it.title} (${it.jurisdiction ?? "—"}, ${it.category ?? "—"})${it.source_url ? ` ${it.source_url}` : ""}\n${(it.content ?? "").slice(0, 3000)}`)
                .join("\n\n");
          }
        } catch {
          /* library is optional */
        }
        const system =
          SYSTEM +
          (body.jurisdiction ? `\nPrimary jurisdiction: ${body.jurisdiction}.` : "") +
          (body.mode ? `\nTask mode: ${body.mode}.` : "") +
          libraryCtx;

        await sb.from("audit_logs").insert({
          user_id: userData.user.id,
          action: "ai.chat",
          resource: "chat",
          metadata: { mode: body.mode ?? "research", jurisdiction: body.jurisdiction ?? null },
        });

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            stream: true,
            messages: [{ role: "system", content: system }, ...body.messages.slice(-30)],
          }),
        });
        if (res.status === 429) return new Response("Rate limited, try again shortly.", { status: 429 });
        if (res.status === 402) return new Response("AI credits exhausted.", { status: 402 });
        if (!res.ok || !res.body) return new Response("AI error", { status: 500 });
        return new Response(res.body, { headers: { "Content-Type": "text/event-stream" } });
      },
    },
  },
});
