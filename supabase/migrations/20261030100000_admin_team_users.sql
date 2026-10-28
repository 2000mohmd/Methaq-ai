-- Admin panel: manage the platform team (admins / lawyers) and view + verify users.
-- Everything goes through admin-only SECURITY DEFINER functions; the tables stay closed to clients.

-- ---------- team ----------
CREATE OR REPLACE FUNCTION public.admin_list_staff()
RETURNS TABLE (user_id uuid, email text, role text, name text, licence_no text, created_at timestamptz, last_sign_in_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not a platform admin'; END IF;
  RETURN QUERY
    SELECT s.user_id, u.email::text, s.role, s.name, s.licence_no, s.created_at, u.last_sign_in_at
    FROM public.platform_staff s JOIN auth.users u ON u.id = s.user_id
    ORDER BY s.role, s.created_at;
END $$;

-- Adds or updates a team member by email. The person must already have an account.
CREATE OR REPLACE FUNCTION public.admin_upsert_staff(_email text, _role text, _name text, _licence text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not a platform admin'; END IF;
  IF _role NOT IN ('admin', 'lawyer') THEN RAISE EXCEPTION 'bad role'; END IF;
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(trim(_email));
  IF _uid IS NULL THEN RAISE EXCEPTION 'no account with this email'; END IF;
  IF _role = 'lawyer' AND coalesce(trim(_licence), '') = '' THEN RAISE EXCEPTION 'licence number required for lawyers'; END IF;
  IF _uid = auth.uid() AND _role <> 'admin' THEN RAISE EXCEPTION 'you cannot remove your own admin role'; END IF;
  INSERT INTO public.platform_staff (user_id, role, name, licence_no)
  VALUES (_uid, _role, nullif(trim(_name), ''), nullif(trim(_licence), ''))
  ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, licence_no = EXCLUDED.licence_no;
  INSERT INTO public.audit_logs (user_id, action, resource, resource_id, metadata)
  VALUES (auth.uid(), 'staff.upsert', 'platform_staff', _uid::text, jsonb_build_object('role', _role));
  RETURN _uid;
END $$;

CREATE OR REPLACE FUNCTION public.admin_remove_staff(_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not a platform admin'; END IF;
  IF _user = auth.uid() THEN RAISE EXCEPTION 'you cannot remove yourself'; END IF;
  DELETE FROM public.platform_staff WHERE user_id = _user;
  INSERT INTO public.audit_logs (user_id, action, resource, resource_id, metadata)
  VALUES (auth.uid(), 'staff.remove', 'platform_staff', _user::text, '{}');
END $$;

-- ---------- users ----------
-- Admin verification of a user account (separate table: users can edit their own profile row).
CREATE TABLE IF NOT EXISTS public.user_verifications (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  verified boolean NOT NULL DEFAULT false,
  note text,
  verified_by uuid REFERENCES auth.users(id),
  verified_at timestamptz
);
ALTER TABLE public.user_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_verifications FROM anon, authenticated;
GRANT SELECT ON public.user_verifications TO authenticated;
DROP POLICY IF EXISTS "verification own read" ON public.user_verifications;
CREATE POLICY "verification own read" ON public.user_verifications FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.admin_users(_search text DEFAULT NULL, _limit int DEFAULT 50, _offset int DEFAULT 0)
RETURNS TABLE (user_id uuid, email text, full_name text, account_type text, organization text, created_at timestamptz,
  last_sign_in_at timestamptz, email_confirmed boolean, onboarded boolean, consented_at timestamptz, ai_consent boolean,
  lawyer_status text, staff_role text, verified boolean, verification_note text, verified_at timestamptz,
  conversations bigint, documents bigint, contracts bigint, total bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not a platform admin'; END IF;
  RETURN QUERY
    WITH base AS (
      SELECT u.id, u.email::text AS email, p.full_name, p.account_type::text AS account_type, o.name AS organization,
        u.created_at, u.last_sign_in_at, u.email_confirmed_at IS NOT NULL AS email_confirmed,
        coalesce(p.onboarded, false) AS onboarded, p.consented_at, coalesce(p.ai_processing_consent, false) AS ai_consent,
        l.status AS lawyer_status, s.role AS staff_role, coalesce(v.verified, false) AS verified, v.note, v.verified_at
      FROM auth.users u
      LEFT JOIN public.profiles p ON p.id = u.id
      LEFT JOIN public.organizations o ON o.id = p.organization_id
      LEFT JOIN public.lawyer_profiles l ON l.user_id = u.id
      LEFT JOIN public.platform_staff s ON s.user_id = u.id
      LEFT JOIN public.user_verifications v ON v.user_id = u.id
      WHERE _search IS NULL OR _search = ''
        OR u.email ILIKE '%' || _search || '%' OR p.full_name ILIKE '%' || _search || '%'
    )
    SELECT b.id, b.email, b.full_name, b.account_type, b.organization, b.created_at, b.last_sign_in_at, b.email_confirmed,
      b.onboarded, b.consented_at, b.ai_consent, b.lawyer_status, b.staff_role, b.verified, b.note, b.verified_at,
      (SELECT count(*) FROM public.conversations c WHERE c.user_id = b.id),
      (SELECT count(*) FROM public.documents d WHERE d.created_by = b.id),
      (SELECT count(*) FROM public.contracts k WHERE k.created_by = b.id),
      count(*) OVER ()
    FROM base b
    ORDER BY b.created_at DESC
    LIMIT least(greatest(_limit, 1), 200) OFFSET greatest(_offset, 0);
END $$;

CREATE OR REPLACE FUNCTION public.admin_verify_user(_user uuid, _verified boolean, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not a platform admin'; END IF;
  INSERT INTO public.user_verifications (user_id, verified, note, verified_by, verified_at)
  VALUES (_user, _verified, nullif(trim(coalesce(_note, '')), ''), auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE SET verified = EXCLUDED.verified, note = EXCLUDED.note,
    verified_by = EXCLUDED.verified_by, verified_at = EXCLUDED.verified_at;
  INSERT INTO public.audit_logs (user_id, action, resource, resource_id, metadata)
  VALUES (auth.uid(), CASE WHEN _verified THEN 'user.verified' ELSE 'user.unverified' END, 'auth.users', _user::text,
    jsonb_build_object('note', _note));
END $$;

REVOKE ALL ON FUNCTION public.admin_list_staff() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_upsert_staff(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_remove_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_users(text, int, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_verify_user(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_staff(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_users(text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_user(uuid, boolean, text) TO authenticated;
