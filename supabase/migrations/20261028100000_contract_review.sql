-- Review model (decided by the owner, 2026-10-27): PER-INSTANCE lawyer review.
-- Any user may generate a contract, but the AI draft (body) is never readable by the
-- client. A platform reviewer (our lawyer) edits and approves it; only then is
-- approved_body visible to the client to read, copy or download.

CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  title text NOT NULL,
  contract_type text NOT NULL,
  language text NOT NULL DEFAULT 'ar',
  inputs jsonb NOT NULL DEFAULT '{}',
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected')),
  approved_body text,
  review_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- Platform lawyers who review contracts. Managed only from the SQL editor:
--   INSERT INTO public.platform_reviewers (user_id, name)
--   SELECT id, 'Lawyer name' FROM auth.users WHERE email = 'lawyer@example.com';
CREATE TABLE IF NOT EXISTS public.platform_reviewers (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_reviewers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_reviewers FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_reviewer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_reviewers WHERE user_id = auth.uid())
$$;

-- Clients: column-level grants hide the draft (body) and block changing review fields.
REVOKE ALL ON public.contracts FROM anon, authenticated;
GRANT SELECT (id, created_by, organization_id, title, contract_type, language, inputs, status,
  approved_body, review_note, reviewed_at, created_at, updated_at) ON public.contracts TO authenticated;
GRANT INSERT (organization_id, title, contract_type, language, inputs, body) ON public.contracts TO authenticated;
GRANT DELETE ON public.contracts TO authenticated;

DROP POLICY IF EXISTS "contracts own read" ON public.contracts;
DROP POLICY IF EXISTS "contracts own insert" ON public.contracts;
DROP POLICY IF EXISTS "contracts own delete" ON public.contracts;
CREATE POLICY "contracts own read" ON public.contracts FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY "contracts own insert" ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (organization_id IS NULL OR organization_id = public.current_org_id()));
CREATE POLICY "contracts own delete" ON public.contracts FOR DELETE TO authenticated USING (created_by = auth.uid());

-- Reviewers: read the queue (including the hidden draft) and decide, only via these functions.
CREATE OR REPLACE FUNCTION public.review_queue()
RETURNS TABLE (id uuid, created_by uuid, title text, contract_type text, language text, inputs jsonb,
  body text, status text, approved_body text, review_note text, reviewed_at timestamptz, created_at timestamptz, author_email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_reviewer() THEN RAISE EXCEPTION 'not a reviewer'; END IF;
  RETURN QUERY
    SELECT c.id, c.created_by, c.title, c.contract_type, c.language, c.inputs, c.body, c.status,
      c.approved_body, c.review_note, c.reviewed_at, c.created_at, u.email::text
    FROM public.contracts c LEFT JOIN auth.users u ON u.id = c.created_by
    ORDER BY (c.status = 'pending_review') DESC, c.created_at DESC
    LIMIT 200;
END $$;

CREATE OR REPLACE FUNCTION public.review_contract(_id uuid, _decision text, _body text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_reviewer() THEN RAISE EXCEPTION 'not a reviewer'; END IF;
  IF _decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'bad decision'; END IF;
  IF _decision = 'approved' AND coalesce(trim(_body), '') = '' THEN RAISE EXCEPTION 'approved text is empty'; END IF;
  UPDATE public.contracts SET
    status = _decision,
    approved_body = CASE WHEN _decision = 'approved' THEN _body ELSE NULL END,
    review_note = nullif(trim(coalesce(_note, '')), ''),
    reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract not found'; END IF;
  INSERT INTO public.audit_logs (user_id, action, resource, resource_id, metadata)
  VALUES (auth.uid(), 'contract.' || _decision, 'contracts', _id::text, jsonb_build_object('note', _note));
END $$;

REVOKE ALL ON FUNCTION public.is_reviewer() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_queue() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_contract(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_reviewer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_queue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_contract(uuid, text, text, text) TO authenticated;
