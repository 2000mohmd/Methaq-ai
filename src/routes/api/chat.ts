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
        const system =
          SYSTEM +
          (body.jurisdiction ? `\nPrimary jurisdiction: ${body.jurisdiction}.` : "") +
          (body.mode ? `\nTask mode: ${body.mode}.` : "");

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
