import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import { aiFetch, COUNCIL_MODELS } from "@/lib/ai-provider";
import { loadChunks } from "@/lib/legal/retrieve";
import { councilDisagreement, expandReferences, rank, verifyAnswer, type Source } from "@/lib/legal/legal";

const SYSTEM = `You are Mithaq, a careful, jurisdiction-aware legal AI assistant for lawyers and individuals in the Arab world (GCC, Egypt, Jordan, Lebanon and beyond).
- Answer in the user's language (Arabic or English).
- Structure answers with clear headings and short paragraphs.
- Cite only sources you are given, using their [S#] markers; never invent citations or article numbers. If you are unsure, say so plainly.
- When drafting, produce complete, professional documents.
- When reviewing contracts, list risks by severity with suggested redlines.
- End substantive legal advice with a brief reminder that this is not a substitute for a licensed lawyer.`;

const GROUNDED = `

SOURCES from the verified legal library. Ground the answer ONLY in these. After every legal claim add its marker, e.g. [S1]. Never cite a source that is not listed, never invent an article number, and if the sources do not answer the question say so plainly:
`;

const UNGROUNDED = `

No library source matched this question. Answer cautiously from general knowledge, do not cite specific article numbers, and say the answer is not grounded in a verified source.`;

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

        // Retrieval over the library (RLS keeps it scoped to the org / the individual):
        // article-level chunks, BM25 + exact-article lookup.
        let sources: Source[] = [];
        try {
          const last = [...body.messages].reverse().find((m) => m.role === "user")?.content ?? "";
          const chunks = await loadChunks(sb);
          sources = expandReferences(rank(last, chunks, 6, body.jurisdiction ?? null), chunks);
        } catch {
          /* library is optional */
        }

        const libraryCtx = sources.length
          ? GROUNDED +
            sources
              .map(
                (x) =>
                  `[S${x.id}] ${x.title}${x.ref ? ` — Article ${x.ref}` : ""} (${x.jurisdiction ?? "—"}, ${x.status})${x.sourceUrl ? ` ${x.sourceUrl}` : ""}\n${x.text}`,
              )
              .join("\n\n")
          : UNGROUNDED;
        const system =
          SYSTEM +
          (body.jurisdiction ? `\nPrimary jurisdiction: ${body.jurisdiction}.` : "") +
          (body.mode ? `\nTask mode: ${body.mode}.` : "") +
          libraryCtx;

        const uid = userData.user.id;
        await sb.from("audit_logs").insert({
          user_id: uid,
          action: "ai.chat",
          resource: "chat",
          metadata: { mode: body.mode ?? "research", jurisdiction: body.jurisdiction ?? null, sources: sources.map((x) => `${x.title}#${x.ref}`) },
        });

        // Council mode: same grounded prompt to several models, citations verified per model, disagreement surfaced.
        if (body.mode === "council") {
          const models = COUNCIL_MODELS;
          const msgs = [{ role: "system", content: system }, ...body.messages.slice(-30)];
          const runs = await Promise.all(
            models.map(async (model) => {
              try {
                const r = await aiFetch({ model, messages: msgs });
                if (!r.ok) return null;
                const j = await r.json();
                return { model, v: verifyAnswer(String(j.choices?.[0]?.message?.content ?? ""), sources) };
              } catch {
                return null;
              }
            }),
          );
          const ok = runs.filter((x): x is NonNullable<typeof x> => x !== null);
          if (!ok.length) return new Response("AI error", { status: 500 });
          const cited = ok.map((r) => new Set([...r.v.text.matchAll(/\[S(\d+)\]/g)].map((m) => Number(m[1]))));
          const diff = councilDisagreement(cited);
          const head = diff.length
            ? `⚠ Council disagreement: models cite different sources (${diff.map((i) => `[S${i}]`).join(" ")}). A lawyer must resolve this.`
            : ok.length > 1
              ? "Council: all models relied on the same sources."
              : "⚠ Only one council model responded.";
          const text = `${head}\n\n` + ok.map((r, i) => `## Model ${i + 1} (${r.model})\n${r.v.text}`).join("\n\n");
          await sb.from("audit_logs").insert({ user_id: uid, action: "ai.council", resource: "chat", metadata: { models: ok.map((r) => r.model), disagreement: diff } });
          return new Response(`data: ${JSON.stringify({ mithaq_final: text })}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } });
        }

        const res = await aiFetch({ stream: true, messages: [{ role: "system", content: system }, ...body.messages.slice(-30)] });
        if (res.status === 429) return new Response("Rate limited, try again shortly.", { status: 429 });
        if (res.status === 402) return new Response("AI quota exhausted.", { status: 402 });
        if (!res.ok || !res.body) return new Response("AI error", { status: 500 });

        // Pass the stream through, collect the answer, and before [DONE] send the
        // mechanically verified version (unverifiable citations stripped) as a final event.
        const dec = new TextDecoder();
        const enc = new TextEncoder();
        let buf = "";
        let answer = "";
        const out = res.body.pipeThrough(
          new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, ctl) {
              buf += dec.decode(chunk, { stream: true });
              const lines = buf.split("\n");
              buf = lines.pop() ?? "";
              const keep: string[] = [];
              for (const line of lines) {
                if (line.trim() === "data: [DONE]") continue;
                if (line.startsWith("data: ")) {
                  try {
                    answer += JSON.parse(line.slice(6)).choices?.[0]?.delta?.content ?? "";
                  } catch {
                    /* partial json */
                  }
                }
                keep.push(line);
              }
              if (keep.length) ctl.enqueue(enc.encode(keep.join("\n") + "\n"));
            },
            async flush(ctl) {
              const v = verifyAnswer(answer, sources);
              ctl.enqueue(enc.encode(`data: ${JSON.stringify({ mithaq_final: v.text })}\n\n`));
              ctl.enqueue(enc.encode("data: [DONE]\n\n"));
              await sb.from("audit_logs").insert({
                user_id: uid,
                action: "ai.verify",
                resource: "chat",
                metadata: { grounded: v.grounded, valid: v.validCitations, stripped: v.stripped, repealed: v.repealed, unverified_articles: v.unverifiedArticles },
              });
            },
          }),
        );
        return new Response(out, { headers: { "Content-Type": "text/event-stream" } });
      },
    },
  },
});
