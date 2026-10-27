// Server-only: the chunks the assistant may cite = the shared legal corpus (curated, same for everyone)
// plus the caller's own library notes (RLS-scoped).
import type { SupabaseClient } from "@supabase/supabase-js";

import { chunkByArticle, type Chunk } from "./legal";
import type { RegistryRow } from "./registry";

// The corpus is identical for every user, so keep it in memory for a few minutes instead of re-reading it per request.
// ponytail: whole corpus in memory + lexical ranking; move to a DB full-text/vector index when it passes ~20k articles.
let corpusCache: { at: number; chunks: Chunk[] } | null = null;
const TTL_MS = 10 * 60_000;

async function loadCorpus(sb: SupabaseClient): Promise<Chunk[]> {
  if (corpusCache && Date.now() - corpusCache.at < TTL_MS) return corpusCache.chunks;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = sb as any;
  const { data: sources } = await db.from("legal_sources").select("id,title,jurisdiction,source_url,status");
  const { data: arts } = await db.from("legal_articles").select("source_id,ref,text,position").order("position").limit(30000);
  const byId = new Map<string, { title: string; jurisdiction: string; source_url: string; status: string }>(
    ((sources ?? []) as { id: string; title: string; jurisdiction: string; source_url: string; status: string }[]).map((s) => [s.id, s]),
  );
  const chunks: Chunk[] = ((arts ?? []) as { source_id: string; ref: string; text: string }[]).flatMap((a) => {
    const s = byId.get(a.source_id);
    return s ? [{ title: s.title, jurisdiction: s.jurisdiction, status: s.status, ref: a.ref, text: a.text.slice(0, 3000), sourceUrl: s.source_url }] : [];
  });
  corpusCache = { at: Date.now(), chunks };
  return chunks;
}

async function loadOwnLibrary(sb: SupabaseClient): Promise<Chunk[]> {
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

export async function loadChunks(sb: SupabaseClient): Promise<Chunk[]> {
  const [corpus, own] = await Promise.all([loadCorpus(sb).catch(() => [] as Chunk[]), loadOwnLibrary(sb).catch(() => [] as Chunk[])]);
  return [...corpus, ...own];
}

// Registry of official sources (pointers). Same for every user, so cached like the corpus.
let registryCache: { at: number; rows: RegistryRow[] } | null = null;

export async function loadRegistry(sb: SupabaseClient): Promise<RegistryRow[]> {
  if (registryCache && Date.now() - registryCache.at < TTL_MS) return registryCache.rows;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).from("legal_source_registry").select("authority,source_name,legal_domain,ai_agent_use,priority_tier,url,notes");
  const rows = ((data ?? []) as RegistryRow[]) ?? [];
  if (rows.length) registryCache = { at: Date.now(), rows };
  return rows;
}
