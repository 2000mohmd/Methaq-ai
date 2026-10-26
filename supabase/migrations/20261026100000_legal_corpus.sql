-- Shared legal corpus: curated by administrators, readable by every signed-in user, writable only
-- through the SQL editor / service role (no INSERT/UPDATE/DELETE policies for app users).

CREATE TABLE IF NOT EXISTS public.legal_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  jurisdiction text NOT NULL DEFAULT 'Saudi Arabia',
  kind text NOT NULL DEFAULT 'law' CHECK (kind IN ('law', 'regulation', 'other')),
  source_url text NOT NULL,
  status text NOT NULL DEFAULT 'in_force' CHECK (status IN ('in_force', 'amended', 'repealed')),
  issued text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (title, kind)
);

CREATE TABLE IF NOT EXISTS public.legal_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.legal_sources(id) ON DELETE CASCADE,
  position integer NOT NULL,
  ref text NOT NULL DEFAULT '',
  text text NOT NULL,
  UNIQUE (source_id, position)
);
CREATE INDEX IF NOT EXISTS legal_articles_source_idx ON public.legal_articles (source_id);

ALTER TABLE public.legal_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "corpus read" ON public.legal_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "corpus read" ON public.legal_articles FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.legal_sources, public.legal_articles TO authenticated;
GRANT ALL ON public.legal_sources, public.legal_articles TO service_role;
