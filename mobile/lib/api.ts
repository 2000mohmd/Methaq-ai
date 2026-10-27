import { fetch } from "expo/fetch";

import { API_URL, supabase } from "./supabase";

export type Msg = { role: "user" | "assistant"; content: string };

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  return { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` };
}

/** POST JSON to a website API route with the user's session. */
export async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { method: "POST", headers: await authHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Streams /api/chat (same SSE protocol as the website's src/lib/ai-stream.ts). */
export async function streamChat(
  messages: Msg[],
  opts: { mode?: string; jurisdiction?: string },
  onDelta: (s: string) => void,
  onFinal?: (verified: string) => void,
) {
  const res = await fetch(`${API_URL}/api/chat`, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ messages, ...opts }),
  });
  if (!res.ok || !res.body) throw new Error((await res.text()) || "AI error");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, i).replace(/\r$/, "");
      buf = buf.slice(i + 1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") return;
      try {
        const j = JSON.parse(json);
        if (typeof j.mithaq_final === "string") onFinal?.(j.mithaq_final);
        const c = j.choices?.[0]?.delta?.content;
        if (c) onDelta(c);
      } catch {
        buf = line + "\n" + buf;
        break;
      }
    }
  }
}
