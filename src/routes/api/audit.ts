import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import { AI_NOT_CONFIGURED, aiError, aiFetch } from "@/lib/ai-provider";
import { parseAudit, type Clause } from "@/lib/legal/audit";
import { rank, type Source } from "@/lib/legal/legal";
import { allow, TOO_MANY } from "@/lib/rate-limit";
import { loadChunks } from "@/lib/legal/retrieve";

const SYSTEM = `You are a senior Saudi-law contract auditor. For EACH clause you are given, assess its legal risk under Saudi law for the party the user represents (neutral if not stated).
Return ONLY a JSON array, one object per clause: {"n": <clause number>, "risk": "high"|"medium"|"low"|"ok", "issue": "<what is wrong or risky and why, 1-3 sentences>", "basis": [<ids of the numbered SOURCES that support the finding>], "redline": "<complete replacement text for the clause, or empty string if risk is ok>"}.
Rules:
- Write issue and redline in the same language as the clause.
- "basis" may contain ONLY ids from the SOURCES list. Never cite a source that is not listed and never invent article numbers. If no listed source supports a finding, leave basis empty.
- Flag clauses that conflict with mandatory Saudi rules, are one-sided, vague, unenforceable, missing essentials (governing law, dispute forum, termination, notice) or contrary to Sharia principles (e.g. riba, gharar).
- Keep redlines faithful to the commercial intent; change only what the risk requires.`;

export const Route = createFileRoute("/api/audit")({
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

        if (!allow(u.user.id, "audit", 20)) return new Response(TOO_MANY, { status: 429 });
        const body = (await request.json()) as { clauses?: Clause[]; jurisdiction?: string; party?: string };
        const clauses = (body.clauses ?? []).filter((c) => c && typeof c.text === "string").slice(0, 8).map((c) => ({ n: Number(c.n), text: c.text.slice(0, 6000) }));
        if (clauses.length === 0) return new Response("Bad request", { status: 400 });

        // Retrieve library sources per clause, merged into one numbered list for this call.
        const chunks = await loadChunks(sb).catch(() => []);
        const sources: Source[] = [];
        for (const c of clauses) {
          for (const s of rank(c.text, chunks, 2, body.jurisdiction ?? "Saudi Arabia")) {
            if (!sources.some((x) => x.title === s.title && x.ref === s.ref)) sources.push({ ...s, id: sources.length + 1 });
          }
        }
        const srcText = sources.length
          ? sources.map((s) => `[${s.id}] ${s.title}${s.ref ? ` — Article ${s.ref}` : ""} (${s.status})\n${s.text}`).join("\n\n")
          : "(no library sources matched — set basis to [] for every finding)";

        await sb.from("audit_logs").insert({ user_id: u.user.id, action: "ai.contract_audit", resource: "audit", metadata: { clauses: clauses.length, sources: sources.length } });

        const res = await aiFetch({
          max_tokens: 4000,
          messages: [
            { role: "system", content: SYSTEM + (body.party ? `\nThe user represents: ${body.party}.` : "") },
            { role: "user", content: `SOURCES:\n${srcText}\n\nCLAUSES:\n${clauses.map((c) => `#${c.n}\n${c.text}`).join("\n\n")}` },
          ],
        });
        if (res.status === 503) return new Response(AI_NOT_CONFIGURED, { status: 503 });
        if (res.status === 429) return new Response("Rate limited, try again shortly.", { status: 429 });
        if (!res.ok) return aiError(res);
        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const findings = parseAudit(json.choices?.[0]?.message?.content ?? "", clauses, sources);
        return Response.json({
          findings,
          sources: sources.map((s) => ({ id: s.id, title: s.title, ref: s.ref, status: s.status, url: s.sourceUrl })),
        });
      },
    },
  },
});
