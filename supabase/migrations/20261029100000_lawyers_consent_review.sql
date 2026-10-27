-- Builds on 20261028100000_contract_review.sql (run that first; both are safe to re-run).
-- 1. Every AI-generated document (contract builder, workflows, chat drafting) goes through review.
-- 2. Approved documents carry the approving lawyer's name + licence; users can hide but not erase them.
-- 3. Lawyer accounts apply with licence details; a platform admin verifies them. A verified lawyer's
--    own documents are approved under their own name and licence (they are the reviewing lawyer).
-- 4. Consent records at sign-up, and in-app account deletion.

-- ---------- documents under review ----------
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'contract',
  ADD COLUMN IF NOT EXISTS reviewer_name text,
  ADD COLUMN IF NOT EXISTS reviewer_licence text,
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz;
DO $$ BEGIN
  ALTER TABLE public.contracts ADD CONSTRAINT contracts_kind_check CHECK (kind IN ('contract', 'workflow', 'chat_draft'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT (kind, reviewer_name, reviewer_licence, hidden_at) ON public.contracts TO authenticated;
GRANT INSERT (kind) ON public.contracts TO authenticated;
-- Users may hide a document from their list; the approved record itself is kept.
REVOKE DELETE ON public.contracts FROM authenticated;
DROP POLICY IF EXISTS "contracts own delete" ON public.contracts;
CREATE OR REPLACE FUNCTION public.hide_contract(_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.contracts SET hidden_at = now() WHERE id = _id AND created_by = auth.uid()
$$;

-- ---------- lawyer verification ----------
CREATE TABLE IF NOT EXISTS public.lawyer_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  licence_no text NOT NULL,
  licence_expiry date,
  phone text,
  city text,
  specialties text[] NOT NULL DEFAULT '{}',
  licence_file text,            -- storage path in the lawyer-licences bucket
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lawyer_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lawyer_profiles FROM anon, authenticated;
GRANT SELECT ON public.lawyer_profiles TO authenticated;
GRANT INSERT (user_id, full_name, licence_no, licence_expiry, phone, city, specialties, licence_file) ON public.lawyer_profiles TO authenticated;
GRANT UPDATE (full_name, licence_no, licence_expiry, phone, city, specialties, licence_file) ON public.lawyer_profiles TO authenticated;
DROP POLICY IF EXISTS "lawyer own read" ON public.lawyer_profiles;
DROP POLICY IF EXISTS "lawyer own insert" ON public.lawyer_profiles;
DROP POLICY IF EXISTS "lawyer own update" ON public.lawyer_profiles;
CREATE POLICY "lawyer own read" ON public.lawyer_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "lawyer own insert" ON public.lawyer_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
-- Editing details sends the application back to pending (trigger below).
CREATE POLICY "lawyer own update" ON public.lawyer_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.lawyer_profile_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  IF current_setting('mithaq.reviewing', true) IS DISTINCT FROM 'on' THEN
    NEW.status := 'pending'; NEW.reviewed_by := NULL; NEW.reviewed_at := NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS lawyer_profile_touch ON public.lawyer_profiles;
CREATE TRIGGER lawyer_profile_touch BEFORE UPDATE ON public.lawyer_profiles FOR EACH ROW EXECUTE FUNCTION public.lawyer_profile_touch();

CREATE OR REPLACE FUNCTION public.is_verified_lawyer(_uid uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.lawyer_profiles WHERE user_id = _uid AND status = 'approved'
    AND (licence_expiry IS NULL OR licence_expiry >= current_date))
$$;

-- Licence copies: private bucket; the lawyer manages their own folder, platform admins can read all.
INSERT INTO storage.buckets (id, name, public) VALUES ('lawyer-licences', 'lawyer-licences', false) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "licence own read" ON storage.objects;
DROP POLICY IF EXISTS "licence own upload" ON storage.objects;
DROP POLICY IF EXISTS "licence own update" ON storage.objects;
CREATE POLICY "licence own read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'lawyer-licences' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_platform_admin()));
CREATE POLICY "licence own upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lawyer-licences' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "licence own update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'lawyer-licences' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.lawyer_applications()
RETURNS TABLE (user_id uuid, email text, full_name text, licence_no text, licence_expiry date, phone text, city text,
  specialties text[], licence_file text, status text, review_note text, reviewed_at timestamptz, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not a platform admin'; END IF;
  RETURN QUERY
    SELECT l.user_id, u.email::text, l.full_name, l.licence_no, l.licence_expiry, l.phone, l.city, l.specialties,
      l.licence_file, l.status, l.review_note, l.reviewed_at, l.created_at
    FROM public.lawyer_profiles l LEFT JOIN auth.users u ON u.id = l.user_id
    ORDER BY (l.status = 'pending') DESC, l.created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.review_lawyer(_user uuid, _decision text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not a platform admin'; END IF;
  IF _decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'bad decision'; END IF;
  PERFORM set_config('mithaq.reviewing', 'on', true);
  UPDATE public.lawyer_profiles SET status = _decision, review_note = nullif(trim(coalesce(_note, '')), ''),
    reviewed_by = auth.uid(), reviewed_at = now() WHERE user_id = _user;
  IF NOT FOUND THEN RAISE EXCEPTION 'application not found'; END IF;
  INSERT INTO public.audit_logs (user_id, action, resource, resource_id, metadata)
  VALUES (auth.uid(), 'lawyer.' || _decision, 'lawyer_profiles', _user::text, jsonb_build_object('note', _note));
END $$;

-- Platform reviewers need a licence too (an admin without one can view but not approve).
ALTER TABLE public.platform_staff ADD COLUMN IF NOT EXISTS licence_no text;

CREATE OR REPLACE FUNCTION public.review_contract(_id uuid, _decision text, _body text, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _name text; _lic text;
BEGIN
  IF NOT public.is_reviewer() THEN RAISE EXCEPTION 'not a reviewer'; END IF;
  IF _decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'bad decision'; END IF;
  SELECT coalesce(l.full_name, s.name), coalesce(nullif(s.licence_no, ''), l.licence_no) INTO _name, _lic
    FROM public.platform_staff s LEFT JOIN public.lawyer_profiles l ON l.user_id = s.user_id AND l.status = 'approved'
    WHERE s.user_id = auth.uid();
  IF _decision = 'approved' AND coalesce(_lic, '') = '' THEN RAISE EXCEPTION 'reviewer licence number missing'; END IF;
  IF _decision = 'approved' AND coalesce(trim(_body), '') = '' THEN RAISE EXCEPTION 'approved text is empty'; END IF;
  UPDATE public.contracts SET
    status = _decision,
    approved_body = CASE WHEN _decision = 'approved' THEN _body ELSE NULL END,
    review_note = nullif(trim(coalesce(_note, '')), ''),
    reviewer_name = CASE WHEN _decision = 'approved' THEN _name END,
    reviewer_licence = CASE WHEN _decision = 'approved' THEN _lic END,
    reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE id = _id AND status = 'pending_review';
  IF NOT FOUND THEN RAISE EXCEPTION 'contract not found or already decided'; END IF;
  INSERT INTO public.audit_logs (user_id, action, resource, resource_id, metadata)
  VALUES (auth.uid(), 'contract.' || _decision, 'contracts', _id::text,
    jsonb_build_object('note', _note, 'body_md5', md5(coalesce(_body, ''))));
END $$;

-- A verified lawyer approves their own generated document under their own name and licence.
CREATE OR REPLACE FUNCTION public.self_approve_contract(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.lawyer_profiles;
BEGIN
  IF NOT public.is_verified_lawyer() THEN RAISE EXCEPTION 'not a verified lawyer'; END IF;
  SELECT * INTO l FROM public.lawyer_profiles WHERE user_id = auth.uid();
  UPDATE public.contracts SET status = 'approved', approved_body = body,
    reviewer_name = l.full_name, reviewer_licence = l.licence_no,
    reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
  WHERE id = _id AND created_by = auth.uid() AND status = 'pending_review';
  IF NOT FOUND THEN RAISE EXCEPTION 'contract not found'; END IF;
  INSERT INTO public.audit_logs (user_id, action, resource, resource_id, metadata)
  VALUES (auth.uid(), 'contract.self_approved', 'contracts', _id::text, '{}');
END $$;

-- Queue now includes the document kind; drop first because the return type changed.
DROP FUNCTION IF EXISTS public.review_queue();
CREATE FUNCTION public.review_queue()
RETURNS TABLE (id uuid, created_by uuid, kind text, title text, contract_type text, language text, inputs jsonb,
  body text, status text, approved_body text, review_note text, reviewer_name text, reviewer_licence text,
  reviewed_at timestamptz, created_at timestamptz, author_email text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_reviewer() THEN RAISE EXCEPTION 'not a reviewer'; END IF;
  RETURN QUERY
    SELECT c.id, c.created_by, c.kind, c.title, c.contract_type, c.language, c.inputs, c.body, c.status,
      c.approved_body, c.review_note, c.reviewer_name, c.reviewer_licence, c.reviewed_at, c.created_at, u.email::text
    FROM public.contracts c LEFT JOIN auth.users u ON u.id = c.created_by
    ORDER BY (c.status = 'pending_review') DESC, c.created_at DESC
    LIMIT 200;
END $$;

-- ---------- consent + account deletion ----------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS privacy_version text,
  ADD COLUMN IF NOT EXISTS consented_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_processing_consent boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  INSERT INTO public.audit_logs (user_id, action, resource, resource_id, metadata)
  VALUES (_uid, 'account.deleted', 'auth.users', _uid::text, '{}');
  -- Supabase blocks direct deletes on storage tables: the app removes the user's files via the Storage API first.
  DELETE FROM auth.users WHERE id = _uid;
END $$;

-- ---------- analytics: pending lawyer applications ----------
CREATE OR REPLACE FUNCTION public.platform_stats_lawyers()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not a platform admin'; END IF;
  RETURN (SELECT coalesce(jsonb_object_agg(status, n), '{}') FROM (SELECT status, count(*) AS n FROM public.lawyer_profiles GROUP BY 1) x);
END $$;

REVOKE ALL ON FUNCTION public.hide_contract(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_verified_lawyer(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lawyer_applications() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_lawyer(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_contract(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.self_approve_contract(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_queue() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_stats_lawyers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hide_contract(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_verified_lawyer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lawyer_applications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_lawyer(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_contract(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.self_approve_contract(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_queue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_stats_lawyers() TO authenticated;
