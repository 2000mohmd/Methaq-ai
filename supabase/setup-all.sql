-- Mithaq database setup: paste this whole file into Supabase SQL Editor and click Run (once).
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;

-- ===== 20260928180528_bcef3cb4-bfdf-4dfa-bd40-52fcf24910ad.sql =====
CREATE TYPE public.app_role AS ENUM ('owner','admin','lawyer','paralegal','accountant','client','viewer');
CREATE TYPE public.account_type AS ENUM ('lawyer','law_firm','in_house','individual');

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_ar text,
  account_type public.account_type NOT NULL DEFAULT 'law_firm',
  jurisdictions text[] NOT NULL DEFAULT '{}',
  default_language text NOT NULL DEFAULT 'en',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  avatar_url text,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  account_type public.account_type,
  language text NOT NULL DEFAULT 'en',
  numerals text NOT NULL DEFAULT 'western',
  jurisdictions text[] NOT NULL DEFAULT '{}',
  onboarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id, role)
);
GRANT SELECT, INSERT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  resource text,
  resource_id text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_user_id uuid, _org uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND organization_id = _org AND role = _role)
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR organization_id = public.current_org_id());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "org read" ON public.organizations FOR SELECT TO authenticated USING (id = public.current_org_id() OR created_by = auth.uid());
CREATE POLICY "org insert" ON public.organizations FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "org update" ON public.organizations FOR UPDATE TO authenticated
  USING (public.has_org_role(auth.uid(), id, 'owner') OR public.has_org_role(auth.uid(), id, 'admin') OR created_by = auth.uid())
  WITH CHECK (public.has_org_role(auth.uid(), id, 'owner') OR public.has_org_role(auth.uid(), id, 'admin') OR created_by = auth.uid());

CREATE POLICY "roles read own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR organization_id = public.current_org_id());
CREATE POLICY "roles insert self on own org" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = organization_id AND o.created_by = auth.uid()));

CREATE POLICY "audit read admins" ON public.audit_logs FOR SELECT TO authenticated
  USING (organization_id = public.current_org_id() AND (public.has_org_role(auth.uid(), organization_id, 'owner') OR public.has_org_role(auth.uid(), organization_id, 'admin')));
CREATE POLICY "audit insert self" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
-- ===== 20260928180545_dacf964f-600a-4b9d-9372-7800dc9a813e.sql =====
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_org_role(uuid, uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_org_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;
-- ===== 20260928181318_8b9924dc-ea5d-4090-a405-412494e20c03.sql =====

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New conversation',
  jurisdiction text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations, public.messages TO authenticated;
GRANT ALL ON public.conversations, public.messages TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own conversations" ON public.conversations FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own messages" ON public.messages FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Practice management tables (org-scoped)
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  name text NOT NULL, email text, phone text, client_type text DEFAULT 'individual',
  kyc_status text DEFAULT 'pending', notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.matters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  title text NOT NULL, client_name text, practice_area text, court text,
  status text DEFAULT 'open', description text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  title text NOT NULL, matter text, due_date date, priority text DEFAULT 'medium', status text DEFAULT 'todo',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.hearings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  title text NOT NULL, matter text, court text, hearing_date date, location text, notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  description text NOT NULL, matter text, work_date date DEFAULT current_date, hours numeric(6,2) NOT NULL DEFAULT 0, rate numeric(10,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  number text NOT NULL, client_name text, amount numeric(12,2) NOT NULL DEFAULT 0, currency text DEFAULT 'SAR',
  due_date date, status text DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  name text NOT NULL, email text, phone text, source text, stage text DEFAULT 'new', notes text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid(),
  name text NOT NULL, position text, email text, start_date date, status text DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clients','matters','tasks','hearings','time_entries','invoices','leads','employees'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "org members read" ON public.%I FOR SELECT TO authenticated USING (organization_id = public.current_org_id())', t);
    EXECUTE format('CREATE POLICY "org members insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_org_id())', t);
    EXECUTE format('CREATE POLICY "org members update" ON public.%I FOR UPDATE TO authenticated USING (organization_id = public.current_org_id()) WITH CHECK (organization_id = public.current_org_id())', t);
    EXECUTE format('CREATE POLICY "org admins delete" ON public.%I FOR DELETE TO authenticated USING (organization_id = public.current_org_id() AND (public.has_org_role(auth.uid(), organization_id, ''owner'') OR public.has_org_role(auth.uid(), organization_id, ''admin'') OR created_by = auth.uid()))', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

CREATE POLICY "users insert own audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
GRANT INSERT ON public.audit_logs TO authenticated;

-- ===== 20260928182243_75058d51-a33d-4676-9bed-d536307c44f0.sql =====

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid DEFAULT auth.uid(),
  name text NOT NULL, storage_path text NOT NULL, mime_type text, size_bytes bigint,
  matter text, extracted_text text, analysis text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.library_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid DEFAULT auth.uid(),
  title text NOT NULL, jurisdiction text, category text DEFAULT 'law', source_url text, content text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['documents','library_items'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "org members read" ON public.%I FOR SELECT TO authenticated USING (organization_id = public.current_org_id())', t);
    EXECUTE format('CREATE POLICY "org members insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (organization_id = public.current_org_id())', t);
    EXECUTE format('CREATE POLICY "org members update" ON public.%I FOR UPDATE TO authenticated USING (organization_id = public.current_org_id()) WITH CHECK (organization_id = public.current_org_id())', t);
    EXECUTE format('CREATE POLICY "org admins delete" ON public.%I FOR DELETE TO authenticated USING (organization_id = public.current_org_id() AND (public.has_org_role(auth.uid(), organization_id, ''owner'') OR public.has_org_role(auth.uid(), organization_id, ''admin'') OR created_by = auth.uid()))', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

-- Files stored under <organization_id>/...
CREATE POLICY "org read documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.current_org_id()::text);
CREATE POLICY "org upload documents" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.current_org_id()::text);
CREATE POLICY "org delete documents" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.current_org_id()::text);

-- ===== 20260929065254_7ae47f7a-3c0a-4917-b1fb-6e75a2c0f3dc.sql =====
CREATE OR REPLACE FUNCTION public.is_portal_client(_org uuid, _client_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _client_name IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.organization_id = _org
      AND lower(c.name) = lower(_client_name)
      AND c.email IS NOT NULL
      AND lower(c.email) = lower(auth.jwt() ->> 'email')
      AND coalesce((auth.jwt() ->> 'email_verified')::boolean, (auth.jwt() -> 'user_metadata' ->> 'email_verified')::boolean, true)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_portal_client(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_portal_client(uuid, text) TO authenticated;

CREATE POLICY "Portal clients view their matters" ON public.matters FOR SELECT TO authenticated
  USING (public.is_portal_client(organization_id, client_name));
CREATE POLICY "Portal clients view their invoices" ON public.invoices FOR SELECT TO authenticated
  USING (public.is_portal_client(organization_id, client_name));

CREATE POLICY "Org admins can remove roles" ON public.user_roles FOR DELETE TO authenticated
  USING (user_id <> auth.uid() AND (public.has_org_role(auth.uid(), organization_id, 'owner') OR public.has_org_role(auth.uid(), organization_id, 'admin')));
GRANT DELETE ON public.user_roles TO authenticated;
-- ===== 20260929071158_4ff5b494-5854-4594-a127-ecaf444f8dbc.sql =====
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS clients_user_id_idx ON public.clients(user_id);

-- Let a signed-in user claim pending invitations addressed to their email.
CREATE OR REPLACE FUNCTION public.claim_invitations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
  inv record;
  _role app_role;
  _count integer := 0;
BEGIN
  _email := lower(auth.jwt() ->> 'email');
  IF _email IS NULL THEN RETURN 0; END IF;

  FOR inv IN
    SELECT * FROM public.invitations
    WHERE lower(email) = _email AND status IN ('sent', 'pending')
  LOOP
    -- Join the inviting organization (only if the user has none yet)
    UPDATE public.profiles
    SET organization_id = inv.organization_id, onboarded = true
    WHERE id = auth.uid() AND organization_id IS NULL;

    _role := CASE inv.role
      WHEN 'admin' THEN 'admin'::app_role
      WHEN 'client' THEN 'client'::app_role
      ELSE 'lawyer'::app_role
    END;

    INSERT INTO public.user_roles (user_id, organization_id, role)
    VALUES (auth.uid(), inv.organization_id, _role)
    ON CONFLICT (user_id, organization_id, role) DO NOTHING;

    UPDATE public.invitations SET status = 'accepted', error = NULL WHERE id = inv.id;
    _count := _count + 1;
  END LOOP;

  -- Link client records whose email matches this user (within their org)
  UPDATE public.clients
  SET user_id = auth.uid()
  WHERE user_id IS NULL
    AND email IS NOT NULL
    AND lower(email) = _email
    AND organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid());

  RETURN _count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_invitations() TO authenticated;

-- Portal clients can also match matters/invoices through their linked client record.
CREATE OR REPLACE FUNCTION public.is_portal_client(_org uuid, _client_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _client_name IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.organization_id = _org
      AND lower(c.name) = lower(_client_name)
      AND (
        c.user_id = auth.uid()
        OR (
          c.email IS NOT NULL
          AND lower(c.email) = lower(auth.jwt() ->> 'email')
          AND coalesce((auth.jwt() ->> 'email_verified')::boolean, (auth.jwt() -> 'user_metadata' ->> 'email_verified')::boolean, true)
        )
      )
  )
$$;
-- ===== 20260929071204_a9ea1631-0929-440f-baae-94a21ebcd0fb.sql =====
REVOKE EXECUTE ON FUNCTION public.claim_invitations() FROM anon, public;
-- ===== 20261017090000_personal_workspace.sql =====
-- Personal (individual) accounts own documents and library items directly, with no organization.
ALTER TABLE public.documents ALTER COLUMN organization_id DROP NOT NULL;
ALTER TABLE public.library_items ALTER COLUMN organization_id DROP NOT NULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['documents','library_items'] LOOP
    EXECUTE format('CREATE POLICY "personal read" ON public.%I FOR SELECT TO authenticated USING (organization_id IS NULL AND created_by = auth.uid())', t);
    EXECUTE format('CREATE POLICY "personal insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (organization_id IS NULL AND created_by = auth.uid())', t);
    EXECUTE format('CREATE POLICY "personal update" ON public.%I FOR UPDATE TO authenticated USING (organization_id IS NULL AND created_by = auth.uid()) WITH CHECK (organization_id IS NULL AND created_by = auth.uid())', t);
    EXECUTE format('CREATE POLICY "personal delete" ON public.%I FOR DELETE TO authenticated USING (organization_id IS NULL AND created_by = auth.uid())', t);
  END LOOP;
END $$;

-- Personal files live under <user_id>/...
CREATE POLICY "personal read documents" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "personal upload documents" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "personal delete documents" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ===== 20261017100000_library_status.sql =====
-- Supersession status so the assistant never presents a repealed provision as current law.
ALTER TABLE public.library_items ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'in_force'
  CHECK (status IN ('in_force','amended','repealed'));

-- ===== 20261018100000_letterhead.sql =====
-- Firm letterhead used on exported Word documents (name, address, contact, CR no.).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS letterhead jsonb;


-- ===== 20261026100000_legal_corpus.sql =====
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
