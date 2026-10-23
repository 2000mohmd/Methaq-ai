// Server-only: loads the caller's library (RLS-scoped) as article-level chunks.
import type { SupabaseClient } from "@supabase/supabase-js";

import { chunkByArticle, type Chunk } from "./legal";

// ponytail: scans <=300 library items per request; add dense embeddings + a DB index when the corpus outgrows that.
export async function loadChunks(sb: SupabaseClient): Promise<Chunk[]> {
  const { data: items } = await sb.from("library_items").select("*").limit(300);
  return (items ?? []).flatMap((it: Record<string, unknown>) =>
    chunkByArticle(String(it["content"] ?? "")).map((c) => ({
      title: String(it["title"] ?? ""),
      jurisdiction: (it["jurisdiction"] as string | null) ?? null,
      status: String(it["status"] ?? "in_force"),
      ref: c.ref,
      text: c.text.slice(0, 3000),
      sourceUrl: (it["source_url"] as string | null) ?? null,
    })),
  );
}
