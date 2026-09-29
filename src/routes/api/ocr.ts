import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Reads text from scanned page images (OCR) via the AI gateway.
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

        const body = (await request.json()) as { images?: string[] };
        const images = (body.images ?? []).filter((s) => typeof s === "string" && s.startsWith("data:image/"));
        if (images.length === 0 || images.length > 8) return new Response("Bad request", { status: 400 });

        await sb.from("audit_logs").insert({ user_id: u.user.id, action: "ai.ocr", resource: "documents", metadata: { pages: images.length } });

        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env["LOVABLE_API_KEY"]}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: "Transcribe all text on these scanned document pages exactly, in the original language (Arabic or English). Keep paragraph breaks. Separate pages with a blank line. Output only the text." },
                  ...images.map((url) => ({ type: "image_url", image_url: { url } })),
                ],
              },
            ],
          }),
        });
        if (!res.ok) return new Response(res.status === 402 ? "AI credits exhausted." : "OCR failed", { status: res.status === 429 || res.status === 402 ? res.status : 500 });
        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        return Response.json({ text: json.choices?.[0]?.message?.content ?? "" });
      },
    },
  },
});
