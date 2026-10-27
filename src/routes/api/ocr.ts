import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import { allow, TOO_MANY } from "@/lib/rate-limit";
import { AI_NOT_CONFIGURED, aiError, aiFetch } from "@/lib/ai-provider";

// Reads text from scanned page images (OCR) via the configured AI provider.
export const Route = createFileRoute("/api/ocr")({
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

        if (!allow(u.user.id, "ocr", 20)) return new Response(TOO_MANY, { status: 429 });
        const body = (await request.json()) as { images?: string[] };
        const images = (body.images ?? []).filter((s) => typeof s === "string" && s.startsWith("data:image/"));
        if (images.length === 0 || images.length > 8) return new Response("Bad request", { status: 400 });

        await sb.from("audit_logs").insert({ user_id: u.user.id, action: "ai.ocr", resource: "documents", metadata: { pages: images.length } });

        // ponytail: page images go to the provider unmasked (PII inside a picture can't be regex-redacted), so this
        // call crosses the KSA boundary with raw personal data. Upgrade: run OCR in-region (e.g. a KSA-hosted
        // Tesseract/Document AI) and send only redacted text onward.
        const res = await aiFetch({
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: "Transcribe all text on these scanned document pages exactly, in the original language (Arabic or English). Keep paragraph breaks. Separate pages with a blank line. Output only the text." },
                ...images.map((url) => ({ type: "image_url", image_url: { url } })),
              ],
            },
          ],
        });
        if (res.status === 503) return new Response(AI_NOT_CONFIGURED, { status: 503 });
        if (!res.ok) return aiError(res);
        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        return Response.json({ text: json.choices?.[0]?.message?.content ?? "" });
      },
    },
  },
});
