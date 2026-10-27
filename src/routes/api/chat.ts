import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import { AI_NOT_CONFIGURED, aiError, aiFetch, councilModels } from "@/lib/ai-provider";
import { allow, TOO_MANY } from "@/lib/rate-limit";
import { loadChunks, loadRegistry } from "@/lib/legal/retrieve";
import { pickRegistry, pointersBlock, registryForModel } from "@/lib/legal/registry";
import { GROUNDED, SYSTEM, UNGROUNDED } from "@/lib/legal/prompt";
import { councilDisagreement, expandReferences, rank, sourceLabel, verifyAnswer, type Source } from "@/lib/legal/legal";
import { generateForReview } from "@/lib/legal/generate";
import { restore, type RedactMap } from "@/lib/legal/redact";

const JURISDICTION = "Saudi Arabia"; // the service covers Saudi law only; any client-sent jurisdiction is ignored
const sse = (text: string) => new Response(`data: ${JSON.stringify({ mithaq_final: text })}\n\ndata: [DONE]\n\n`, { headers: { "Content-Type": "text/event-stream" } });

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

        if (!allow(userData.user.id, "chat", 30)) return new Response(TOO_MANY, { status: 429 });
        const body = (await request.json()) as {
          messages: { role: "user" | "assistant"; content: string }[];
          mode?: string;
        };
        if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 60) {
          return new Response("Bad request", { status: 400 });
        }
        if (JSON.stringify(body.messages).length > 200_000) return new Response("Message too large", { status: 413 });
        const lastQ = [...body.messages].reverse().find((m) => m.role === "user")?.content ?? "";
        const ar = /[؀-ۿ]/.test(lastQ);

        // Drafting: a draft is a document, so it goes to lawyer review instead of being streamed to the user.
        if (body.mode === "drafting") {
          if (!allow(userData.user.id, "contracts", 5)) return new Response(TOO_MANY, { status: 429 });
          const prev = body.messages
            .slice(0, -1)
            .slice(-4)
            .map((m) => `${m.role}: ${m.content.slice(0, 1000)}`)
            .join("\n");
          const out = await generateForReview(sb, userData.user, {
            kind: "chat_draft",
            title: lastQ.trim().slice(0, 80) || "Draft",
            contract_type: "chat",
            language: ar ? "ar" : "en",
            inputs: {},
            prompt: (prev ? `Earlier conversation (context only):\n${prev}\n\nRequest:\n` : "") + lastQ,
          });
          if (out instanceof Response) return out;
          if (out.status === "approved" && out.approved_body) {
            const by = ar ? `— اعتمدها: ${out.reviewer_name ?? ""} (ترخيص رقم ${out.reviewer_licence ?? ""})` : `— Approved by: ${out.reviewer_name ?? ""} (licence no. ${out.reviewer_licence ?? ""})`;
            return sse(`${out.approved_body}\n\n${by}`);
          }
          return sse(
            ar
              ? "أُرسلت المسودة إلى محامٍ مرخّص لمراجعتها. ستجدها في صفحة «العقود» ضمن «مستنداتي» بعد اعتمادها."
              : "Your draft was sent to a licensed lawyer for review. You will find it on the Contracts page under My documents once it is approved.",
          );
        }

        // Retrieval over the library (RLS keeps it scoped to the org / the individual):
        // article-level chunks, BM25 + exact-article lookup.
        let sources: Source[] = [];
        try {
          const chunks = await loadChunks(sb);
          sources = expandReferences(rank(lastQ, chunks, 6, JURISDICTION), chunks);
        } catch {
          /* library is optional */
        }

        // Official-source registry: pointers the app lists itself (the model only uses them to pick the right authority).
        const picked = pickRegistry(await loadRegistry(sb).catch(() => []), lastQ);
        const pointers = pointersBlock(picked, ar);

        if (body.mode === "council" && !allow(userData.user.id, "council", 4)) return new Response(TOO_MANY, { status: 429 });
        const libraryCtx = sources.length ? GROUNDED + sources.map((x) => `[S${x.id}] ${sourceLabel(x)}\n${x.text}`).join("\n\n") : UNGROUNDED;
        const system = SYSTEM + `\nPrimary jurisdiction: ${JURISDICTION}.` + (body.mode ? `\nTask mode: ${body.mode}.` : "") + libraryCtx;

        const uid = userData.user.id;
        await sb.from("audit_logs").insert({
          user_id: uid,
          action: "ai.chat",
          resource: "chat",
          metadata: { mode: body.mode ?? "research", jurisdiction: JURISDICTION, sources: sources.map((x) => `${x.title}#${x.ref}`) },
        });

        // PII masked inside aiFetch; the same map restores the user's own values in the final text.
        const map: RedactMap = {};
        const msgs = [{ role: "system", content: system }, ...body.messages.slice(-30)];

        // Council mode: same grounded prompt to several models, citations verified per model, disagreement surfaced.
        if (body.mode === "council") {
          const models = councilModels();
          const runs = await Promise.all(
            models.map(async (model) => {
              try {
                const r = await aiFetch({ model, messages: msgs }, map);
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
          const ids = diff.map((i) => `[S${i}]`).join(" ");
          const head = diff.length
            ? ar
              ? `⚠ خلاف بين النماذج: استندت إلى مصادر مختلفة (${ids}). يجب أن يحسم محامٍ هذا الخلاف.`
              : `⚠ Council disagreement: models cite different sources (${ids}). A lawyer must resolve this.`
            : ok.length > 1
              ? ar
                ? "المجلس: استندت جميع النماذج إلى المصادر نفسها."
                : "Council: all models relied on the same sources."
              : ar
                ? "⚠ استجاب نموذج واحد فقط من المجلس."
                : "⚠ Only one council model responded.";
          // Model ids stay in the audit log only; the user sees "Model 1/2/3".
          const text = `${head}\n\n` + ok.map((r, i) => `## ${ar ? "النموذج" : "Model"} ${i + 1}\n${r.v.text}`).join("\n\n");
          await sb.from("audit_logs").insert({ user_id: uid, action: "ai.council", resource: "chat", metadata: { models: ok.map((r) => r.model), disagreement: diff } });
          return sse(restore(text, map));
        }

        const res = await aiFetch({ stream: true, messages: msgs }, map);
        if (res.status === 503) return new Response(AI_NOT_CONFIGURED, { status: 503 });
        if (res.status === 429) return new Response("Rate limited, try again shortly.", { status: 429 });
        if (res.status === 402) return new Response("AI quota exhausted.", { status: 402 });
        if (!res.ok) return aiError(res);
        if (!res.body) return new Response("AI error", { status: 502 });

        // Pass the stream through, collect the answer, and before [DONE] send the
        // mechanically verified version (unverifiable citations stripped, masked PII restored) as a final event.
        // Streamed deltas may briefly show ⟦TOKENS⟧; the final event replaces them.
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
              ctl.enqueue(enc.encode(`data: ${JSON.stringify({ mithaq_final: restore(v.text, map) + pointers })}\n\n`));
              ctl.enqueue(enc.encode("data: [DONE]\n\n"));
              await sb.from("audit_logs").insert({
                user_id: uid,
                action: "ai.verify",
                resource: "chat",
                metadata: { grounded: v.grounded, valid: v.validCitations, stripped: v.stripped, repealed: v.repealed, unverified_articles: v.unverifiedArticles, masked: Object.keys(map).length },
              });
            },
          }),
        );
        return new Response(out, { headers: { "Content-Type": "text/event-stream" } });
      },
    },
  },
});
