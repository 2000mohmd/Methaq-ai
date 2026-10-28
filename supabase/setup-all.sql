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

-- ===== 20261027100000_legal_source_registry.sql =====
-- Registry of official Saudi legal sources: pointers to where to verify (NOT law text; law text lives in legal_articles).
-- Shared by every user; read-only for the app. Change it only from the SQL editor / service role.
CREATE TABLE IF NOT EXISTS public.legal_source_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq_no text,
  authority text NOT NULL,
  source_name text NOT NULL,
  legal_domain text NOT NULL,
  content_type text,
  ai_agent_use text,
  priority_tier text NOT NULL CHECK (priority_tier IN ('P1','P2','P3','P4')),
  source_nature text,
  access_type text,
  retrieval_ease text,
  rag_suitable text,
  requires_login text,
  last_verified date,
  url text NOT NULL,
  notes text,
  jurisdiction text NOT NULL DEFAULT 'SA',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (authority, source_name)
);
ALTER TABLE public.legal_source_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "registry read" ON public.legal_source_registry FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.legal_source_registry TO authenticated;
GRANT ALL ON public.legal_source_registry TO service_role;

INSERT INTO public.legal_source_registry (seq_no, authority, source_name, legal_domain, content_type, ai_agent_use, priority_tier, source_nature, access_type, retrieval_ease, rag_suitable, requires_login, last_verified, url, notes, jurisdiction) VALUES
($r$1$r$, $r$هيئة الخبراء بمجلس الوزراء$r$, $r$بوابة الأنظمة السعودية$r$, $r$عام / جميع الأنظمة$r$, $r$أنظمة وتنظيمات ولوائح وقرارات$r$, $r$المصدر التشريعي المركزي للتحقق من نص النظام وحالته وتعديلاته وربط الإجابة بالنص الرسمي.$r$, $r$P1$r$, $r$تشريع رسمي نافذ/مرجعي$r$, $r$HTML قابل للبحث$r$, $r$ممتازة$r$, $r$نعم$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://laws.boe.gov.sa/$r$, $r$يُستخدم كمرجع أساسي قبل الاعتماد على الشروحات أو الأدلة.$r$, $r$SA$r$),
($r$2$r$, $r$وزارة العدل$r$, $r$البوابة القانونية - الأنظمة العدلية$r$, $r$تقاضي / عدلي$r$, $r$تشريعات عدلية$r$, $r$البحث في الأنظمة واللوائح العدلية بحسب الاسم والنص والحالة والتاريخ.$r$, $r$P1$r$, $r$تشريع رسمي$r$, $r$HTML + بحث متقدم$r$, $r$ممتازة$r$, $r$نعم$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://laws.moj.gov.sa/$r$, $r$مفيد جدًا للبحث النصي السريع داخل الأنظمة العدلية.$r$, $r$SA$r$),
($r$3$r$, $r$وزارة العدل$r$, $r$البوابة القانونية - الأحكام القضائية$r$, $r$قضاء عام وتجاري$r$, $r$أحكام قضائية منشورة$r$, $r$الوصول إلى أحكام محاكم الدرجة الأولى النهائية والاستئناف والمحكمة العليا المنشورة بالبوابة.$r$, $r$P2$r$, $r$مصدر قضائي رسمي$r$, $r$HTML قابل للبحث$r$, $r$ممتازة$r$, $r$نعم مع تصنيف الحكم$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://laws.moj.gov.sa/$r$, $r$لا يُعامل الحكم القضائي كنص تشريعي؛ يستخدم للتفسير والاستدلال القضائي.$r$, $r$SA$r$),
($r$4$r$, $r$وزارة العدل$r$, $r$التقرير الشهري لمستجدات الأنظمة واللوائح والقرارات$r$, $r$تحديثات عدلية$r$, $r$تقرير تحديثات$r$, $r$رصد المستجدات التشريعية والتنظيمية المنشورة ضمن خدمات البوابة القانونية.$r$, $r$P3$r$, $r$رصد رسمي للتحديثات$r$, $r$HTML / تقارير$r$, $r$جيدة$r$, $r$نعم للمراقبة$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://laws.moj.gov.sa/$r$, $r$مفيد لطبقة مراقبة التغييرات وليس بديلًا عن النص النهائي.$r$, $r$SA$r$),
($r$5$r$, $r$ديوان المظالم$r$, $r$المدونات القضائية$r$, $r$قضاء إداري$r$, $r$مبادئ وسوابق وأحكام إدارية$r$, $r$استرجاع مبادئ المحكمة الإدارية العليا والسوابق والأحكام الإدارية المنشورة.$r$, $r$P2$r$, $r$مصدر قضائي رسمي$r$, $r$HTML + PDF / بحث$r$, $r$جيدة جدًا$r$, $r$نعم$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://www.bog.gov.sa/knowledge-center/JudicialBlogs/Pages/default.aspx$r$, $r$يحتوي مجموعات قضائية تاريخية وحديثة؛ يلزم مراعاة تاريخ الحكم والنظام المطبق.$r$, $r$SA$r$),
($r$6$r$, $r$جريدة أم القرى$r$, $r$الجريدة الرسمية السعودية$r$, $r$عام / نفاذ الأنظمة$r$, $r$نشر رسمي للأنظمة واللوائح والقرارات$r$, $r$التحقق من النشر الرسمي وتاريخ النفاذ والقرارات واللوائح المنشورة.$r$, $r$P1$r$, $r$جريدة رسمية$r$, $r$HTML / أعداد منشورة$r$, $r$جيدة$r$, $r$نعم للتحقق$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://www.uqn.gov.sa/$r$, $r$مرجع مهم عند اختلاف تاريخ الإصدار والنشر والنفاذ.$r$, $r$SA$r$),
($r$7$r$, $r$وزارة التجارة$r$, $r$الأنظمة واللوائح$r$, $r$تجاري / شركات / سجل / امتياز$r$, $r$أنظمة ولوائح قطاعية$r$, $r$الوصول السريع للأنظمة التجارية وروابطها وأرشيفها مثل الشركات والسجل التجاري والامتياز والرهن التجاري.$r$, $r$P2$r$, $r$مصدر تنظيمي قطاعي رسمي$r$, $r$HTML قائمة وبحث$r$, $r$جيدة جدًا$r$, $r$نعم$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://mc.gov.sa/ar/Regulations/pages/default.aspx$r$, $r$عند الحاجة للنص النهائي يُراجع أيضًا مصدر هيئة الخبراء.$r$, $r$SA$r$),
($r$8$r$, $r$وزارة الاستثمار$r$, $r$نظام الاستثمار المحدث$r$, $r$استثمار$r$, $r$نص نظام + أسئلة وأجوبة$r$, $r$استرجاع مواد نظام الاستثمار المحدث وشرح الإجراءات والحقوق والتسجيل والأنشطة المستثناة.$r$, $r$P1$r$, $r$نظام رسمي منشور من الجهة المختصة$r$, $r$HTML نصي مباشر$r$, $r$ممتازة$r$, $r$نعم$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://eservices.misa.gov.sa/ar/resources/updatedInvestmentLaw$r$, $r$من أفضل مصادر الوكيل في استفسارات الاستثمار الأجنبي لأنه يجمع النص والأسئلة الإجرائية.$r$, $r$SA$r$),
($r$9$r$, $r$وزارة الاستثمار$r$, $r$مركز المصادر - الأنظمة واللوائح$r$, $r$استثمار / تأسيس$r$, $r$مصادر وأنظمة وأدلة$r$, $r$الوصول إلى القوانين والأنظمة ذات الصلة بالمستثمر والتقارير والمنشورات.$r$, $r$P2$r$, $r$مصدر قطاعي رسمي$r$, $r$HTML$r$, $r$جيدة$r$, $r$نعم$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://eservices.misa.gov.sa/ar/resources/resourcesOverview$r$, $r$يستخدم لاكتشاف المصدر ثم يفضل ربط الإجابة بالوثيقة الأصلية.$r$, $r$SA$r$),
($r$10$r$, $r$المركز السعودي للأعمال$r$, $r$منصة الأعمال والأدلة$r$, $r$تأسيس وتشغيل المنشآت$r$, $r$إجراءات وأدلة خدمات$r$, $r$الوصول إلى أدلة الإجراءات ومتطلبات الخدمات التجارية والتراخيص ورحلة المستثمر.$r$, $r$P3$r$, $r$مصدر إجرائي رسمي$r$, $r$HTML + PDF$r$, $r$جيدة$r$, $r$نعم للإجراءات$r$, $r$جزئيًا للخدمات$r$, $r$2026-09-21$r$::date, $r$https://business.sa/$r$, $r$المحتوى المفتوح مناسب للمعرفة؛ تنفيذ بعض الخدمات يتطلب الدخول.$r$, $r$SA$r$),
($r$11$r$, $r$وزارة الموارد البشرية والتنمية الاجتماعية$r$, $r$اللوائح والإجراءات - قطاع العمل$r$, $r$عمل$r$, $r$نظام ولوائح وقرارات وأدلة$r$, $r$الوصول لنظام العمل واللائحة التنفيذية والقرارات والأدلة المرتبطة بسوق العمل.$r$, $r$P1$r$, $r$مصدر رسمي قطاعي$r$, $r$HTML + تنزيل$r$, $r$ممتازة$r$, $r$نعم$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://www.hrsd.gov.sa/knowledge-centre/labour-education-regulation-and-procedures$r$, $r$يجب مراعاة تعديلات 2025 وما بعدها وعدم الاعتماد على نسخ قديمة.$r$, $r$SA$r$),
($r$12$r$, $r$هيئة الزكاة والضريبة والجمارك$r$, $r$الأنظمة واللوائح$r$, $r$زكاة / ضريبة / جمارك$r$, $r$أنظمة ولوائح واتفاقيات$r$, $r$مرجع قطاعي للزكاة وضريبة الدخل والقيمة المضافة والانتقائية والجمارك والاتفاقيات.$r$, $r$P1$r$, $r$مصدر رسمي قطاعي$r$, $r$HTML + وثائق$r$, $r$ممتازة$r$, $r$نعم$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://zatca.gov.sa/ar/RulesRegulations/Pages/rules.aspx$r$, $r$يستخدم للنصوص الضريبية والزكوية والجمركية مع تتبع آخر تحديث.$r$, $r$SA$r$),
($r$13$r$, $r$هيئة الزكاة والضريبة والجمارك$r$, $r$الأنظمة واللوائح الزكوية$r$, $r$زكاة$r$, $r$لوائح وقواعد وقرارات زكوية$r$, $r$استرجاع اللائحة التنفيذية لجباية الزكاة والقواعد والقرارات الزكوية المتخصصة.$r$, $r$P1$r$, $r$مصدر رسمي قطاعي$r$, $r$HTML$r$, $r$ممتازة$r$, $r$نعم$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://zatca.gov.sa/ar/Pages/Zakat.aspx$r$, $r$مفيد لتقليل الضوضاء عند كون السؤال زكويًا بحتًا.$r$, $r$SA$r$),
($r$14$r$, $r$البنك المركزي السعودي$r$, $r$SAMA Rulebook$r$, $r$مصرفي / تمويل / مدفوعات / AML$r$, $r$قواعد ولوائح وتعليمات وتعاميم$r$, $r$استرجاع نصوص تنظيمية محدثة مع حالة النفاذ والإصدارات في البنوك والتمويل والمدفوعات وحماية العملاء ومكافحة غسل الأموال.$r$, $r$P1$r$, $r$مصدر تنظيمي رسمي$r$, $r$HTML نصي + إصدارات + PDF$r$, $r$ممتازة$r$, $r$نعم$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://rulebook.sama.gov.sa/ar/entiresection/8320$r$, $r$من أفضل المصادر للـAI بسبب النص القابل للبحث وإظهار الحالة والإصدارات.$r$, $r$SA$r$),
($r$15$r$, $r$هيئة السوق المالية$r$, $r$اللوائح التنفيذية والقواعد$r$, $r$سوق مالية / شركات مدرجة$r$, $r$لوائح تنفيذية وقواعد$r$, $r$الرجوع إلى لوائح السوق المالية والحوكمة والاندماج والاستحواذ ومؤسسات السوق وغيرها.$r$, $r$P1$r$, $r$مصدر تنظيمي رسمي$r$, $r$HTML / PDF$r$, $r$جيدة$r$, $r$نعم$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://cma.org.sa/RulesRegulations/Regulations/Pages/default.aspx$r$, $r$قد تكون بعض الوثائق PDF؛ يجب الاعتماد على أحدث نسخة منشورة على موقع الهيئة.$r$, $r$SA$r$),
($r$16$r$, $r$هيئة السوق المالية$r$, $r$التعاميم$r$, $r$سوق مالية$r$, $r$تعاميم تنظيمية$r$, $r$رصد التعليمات والتعاميم التنفيذية التي تؤثر على الأشخاص المرخص لهم والشركات والجهات الخاضعة.$r$, $r$P2$r$, $r$مصدر تنظيمي رسمي$r$, $r$HTML + ملفات$r$, $r$جيدة جدًا$r$, $r$نعم$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://cma.org.sa/RulesRegulations/circulars/Pages/default.aspx$r$, $r$مفيد لطبقة التحديث بعد اللوائح الأساسية.$r$, $r$SA$r$),
($r$17$r$, $r$الهيئة السعودية للبيانات والذكاء الاصطناعي - حوكمة البيانات$r$, $r$نظام حماية البيانات الشخصية$r$, $r$خصوصية / بيانات$r$, $r$نص نظام$r$, $r$الرجوع المباشر إلى مواد نظام حماية البيانات الشخصية وتعريفاته والتزاماته.$r$, $r$P1$r$, $r$تشريع رسمي عبر الجهة المختصة$r$, $r$HTML نصي مباشر$r$, $r$ممتازة$r$, $r$نعم$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/details/PDPL$r$, $r$ملائم جدًا للاسترجاع المباشر مادةً بنص.$r$, $r$SA$r$),
($r$18$r$, $r$الهيئة السعودية للبيانات والذكاء الاصطناعي - حوكمة البيانات$r$, $r$اللائحة التنفيذية لنظام حماية البيانات الشخصية$r$, $r$خصوصية / بيانات$r$, $r$لائحة تنفيذية$r$, $r$استرجاع تفاصيل الامتثال والمعالجة والتسويق المباشر والحقوق والإجراءات التنفيذية.$r$, $r$P1$r$, $r$لائحة رسمية$r$, $r$HTML نصي مباشر$r$, $r$ممتازة$r$, $r$نعم$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/details/PDPL2$r$, $r$يُسترجع مع النظام عند تقديم رأي امتثال عملي.$r$, $r$SA$r$),
($r$19$r$, $r$الهيئة السعودية للملكية الفكرية$r$, $r$الأنظمة واللوائح$r$, $r$ملكية فكرية$r$, $r$أنظمة ولوائح وقواعد$r$, $r$الوصول لأنظمة العلامات وبراءات الاختراع وحقوق المؤلف والتصاميم واللوائح المرتبطة.$r$, $r$P1$r$, $r$مصدر رسمي قطاعي$r$, $r$HTML + عرض/تحميل + بحث$r$, $r$ممتازة$r$, $r$نعم$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://saip.gov.sa/ar/resources/lows-and-regulations/systems-and-regulations$r$, $r$يوفر تصنيفًا وبحثًا وعرضًا وتنزيلًا للوثائق.$r$, $r$SA$r$),
($r$20$r$, $r$الهيئة السعودية للملكية الفكرية$r$, $r$مركز الموارد$r$, $r$ملكية فكرية$r$, $r$أدلة / أدوات بحث / نشرات / بيانات$r$, $r$استخدام الأدلة ومحركات البحث والصحيفة والبيانات المفتوحة كمصادر مساندة للتحقق والبحث.$r$, $r$P3$r$, $r$مصدر معرفي رسمي$r$, $r$HTML + أدوات$r$, $r$جيدة$r$, $r$نعم كمساند$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://saip.gov.sa/ar/resources$r$, $r$لا يُقدَّم الدليل الإرشادي على نص النظام عند التعارض.$r$, $r$SA$r$),
($r$21$r$, $r$الهيئة العامة للعقار$r$, $r$الأنظمة واللوائح والأدلة$r$, $r$عقار$r$, $r$أنظمة ولوائح وأدلة وضوابط$r$, $r$الوصول لنظام الوساطة العقارية والتسجيل العيني والمساهمات العقارية والبيع على الخارطة وتملك غير السعوديين واللوائح المرتبطة.$r$, $r$P1$r$, $r$مصدر تنظيمي رسمي$r$, $r$HTML + تصفية + PDF$r$, $r$ممتازة$r$, $r$نعم$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://rega.gov.sa/الأنظمة-والقرارات/الأنظمة-واللوائح-والأدلة/$r$, $r$يعرض حالة التشريع وتصنيفه وتاريخ النشر في صفحات الوثائق.$r$, $r$SA$r$),
($r$22$r$, $r$الهيئة العامة للغذاء والدواء$r$, $r$الأنظمة واللوائح$r$, $r$غذاء / دواء / أجهزة / تجميل$r$, $r$أنظمة ولوائح ومتطلبات وإجراءات$r$, $r$استرجاع اللوائح الفنية والتنفيذية والمتطلبات والإجراءات للقطاعات الخاضعة للهيئة.$r$, $r$P1$r$, $r$مصدر تنظيمي رسمي$r$, $r$HTML + بحث/فلترة + تحميل$r$, $r$ممتازة$r$, $r$نعم$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://sfda.gov.sa/ar/regulations$r$, $r$مهم للأنشطة المنظمة مثل الأجهزة الطبية والدواء والتجميل والغذاء.$r$, $r$SA$r$),
($r$23$r$, $r$هيئة التأمين$r$, $r$اللوائح والقواعد والتعليمات$r$, $r$تأمين$r$, $r$لوائح وقواعد وتعاميم ووثائق نموذجية$r$, $r$الوصول إلى الأنظمة واللوائح والتعليمات والتعاميم والوثائق النموذجية المنظمة لقطاع التأمين.$r$, $r$P1$r$, $r$مصدر تنظيمي رسمي$r$, $r$HTML + PDF + بحث$r$, $r$جيدة جدًا$r$, $r$نعم$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://www.ia.gov.sa/ar/regulations$r$, $r$يُستخدم لقطاع التأمين مع مراعاة انتقال الاختصاصات التنظيمية الحديثة.$r$, $r$SA$r$),
($r$24$r$, $r$لجنة الإفلاس$r$, $r$نظام الإفلاس والوثائق النظامية$r$, $r$إفلاس$r$, $r$نظام ولائحة وقواعد وقرارات وأدلة$r$, $r$الوصول إلى نظام الإفلاس واللائحة التنفيذية والقواعد والوثائق النظامية والأدلة الإرشادية.$r$, $r$P1$r$, $r$مصدر رسمي متخصص$r$, $r$HTML ديناميكي + PDF$r$, $r$متوسطة$r$, $r$نعم مع فهرسة الملفات$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://bankruptcy.gov.sa/$r$, $r$الموقع غني لكن بعض الصفحات ديناميكية؛ الأفضل تحميل الوثائق المهمة وفهرستها محليًا داخل الـRAG.$r$, $r$SA$r$),
($r$25$r$, $r$لجنة الإفلاس$r$, $r$الإعلانات وسجل الإفلاس$r$, $r$إفلاس / تحقق واقعي$r$, $r$إعلانات وسجلات$r$, $r$التحقق من وجود إعلانات أو إجراءات إفلاس منشورة بشأن مدين أو إجراء محدد.$r$, $r$P2$r$, $r$بيانات وسجل رسمي$r$, $r$بوابة ديناميكية$r$, $r$متوسطة$r$, $r$نعم للتحقق الواقعي$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://bankruptcy.gov.sa/$r$, $r$مفيد للـAgent كأداة تحقق وليس كمصدر لصياغة حكم نظامي.$r$, $r$SA$r$),
($r$26$r$, $r$المركز السعودي للتحكيم التجاري$r$, $r$مركز المعرفة$r$, $r$تحكيم / وساطة$r$, $r$قواعد وأدلة وتنظيمات وأحكام ودراسات$r$, $r$مكتبة متخصصة لقواعد التحكيم والوساطة والأدلة وصياغة الشروط والتنظيمات وأحكام قضائية سعودية ذات صلة.$r$, $r$P2$r$, $r$مصدر مؤسسي متخصص$r$, $r$HTML + تنزيل$r$, $r$ممتازة$r$, $r$نعم كمساند متخصص$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://sadr.org/knowledge-center$r$, $r$قواعد المركز تطبق عند اتفاق الأطراف أو تحقق شروط تطبيقها، وليست بديلًا عن نظام التحكيم.$r$, $r$SA$r$),
($r$27$r$, $r$المركز السعودي للتحكيم التجاري$r$, $r$قواعد التحكيم 2023 وإجراءات القضايا الصغيرة$r$, $r$تحكيم$r$, $r$قواعد مؤسسية$r$, $r$الرجوع لقواعد المركز المطبقة على القضايا المسجلة وفق نطاقها، بما في ذلك إجراءات القضايا الصغيرة النافذة في 2026.$r$, $r$P2$r$, $r$قواعد مؤسسية تعاقدية$r$, $r$HTML نصي مباشر$r$, $r$ممتازة$r$, $r$نعم$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://sadr.org/arbitration-rules/2023-arbitration-rules$r$, $r$يجب التفريق بين قواعد المركز ونظام التحكيم السعودي.$r$, $r$SA$r$),
($r$28$r$, $r$المركز السعودي للتحكيم التجاري$r$, $r$قواعد الوساطة 2026$r$, $r$وساطة$r$, $r$قواعد مؤسسية$r$, $r$الرجوع إلى قواعد الوساطة المؤسسية السارية لدى المركز منذ 1 أغسطس 2026.$r$, $r$P2$r$, $r$قواعد مؤسسية تعاقدية$r$, $r$HTML نصي مباشر$r$, $r$ممتازة$r$, $r$نعم$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://sadr.org/mediation-rules/2026-mediation-rules$r$, $r$تستخدم عند الوساطة الخاضعة لقواعد المركز.$r$, $r$SA$r$),
($r$29$r$, $r$منصة بلدي$r$, $r$الأنشطة التجارية والاشتراطات البلدية$r$, $r$بلدي / تراخيص$r$, $r$اشتراطات حسب النشاط وISIC$r$, $r$الاستعلام عن الاشتراطات البلدية الخاصة بالنشاط التجاري وربطها بتصنيف النشاط الاقتصادي.$r$, $r$P2$r$, $r$مصدر إجرائي رسمي$r$, $r$بوابة استعلام ديناميكية$r$, $r$جيدة$r$, $r$نعم كأداة استعلام$r$, $r$قد يتطلب لبعض الخدمات$r$, $r$2026-09-21$r$::date, $r$https://balady.gov.sa/ar/services/الأنشطة-التجارية-والاشتراطات-البلدية$r$, $r$مهم للـAgent الإجرائي، لكن نتائج النشاط المحدد قد تعتمد على مدخلات المستخدم.$r$, $r$SA$r$),
($r$30$r$, $r$هيئة الاتصالات والفضاء والتقنية$r$, $r$الأنظمة واللوائح والتنظيمات$r$, $r$اتصالات / تقنية / منصات رقمية$r$, $r$أنظمة ولوائح وتنظيمات$r$, $r$الوصول إلى تنظيمات الاتصالات والفضاء والتقنية ومنصات المحتوى الرقمي واللوائح المرتبطة.$r$, $r$P1$r$, $r$مصدر تنظيمي رسمي$r$, $r$HTML نصي + PDF$r$, $r$ممتازة$r$, $r$نعم$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://www.cst.gov.sa/$r$, $r$الموقع يعرض نصوص تنظيمية مباشرة وبعضها يتضمن حالة التعديل والنص الأصلي.$r$, $r$SA$r$),
($r$31$r$, $r$المركز الوطني للتنافسية$r$, $r$منصة استطلاع$r$, $r$مشاريع الأنظمة واللوائح$r$, $r$مشاريع قبل الاعتماد$r$, $r$رصد مشاريع الأنظمة واللوائح المطروحة للعموم قبل اعتمادها لاكتشاف التغييرات القادمة.$r$, $r$P4$r$, $r$مشروع غير نافذ / رصد فقط$r$, $r$HTML$r$, $r$جيدة$r$, $r$مراقبة فقط$r$, $r$لا$r$, $r$2026-09-21$r$::date, $r$https://istitlaa.ncc.gov.sa/$r$, $r$لا يجوز للـAgent عرض مشروع في استطلاع على أنه نظام نافذ.$r$, $r$SA$r$)
ON CONFLICT (authority, source_name) DO UPDATE SET url = EXCLUDED.url, last_verified = EXCLUDED.last_verified, notes = EXCLUDED.notes, priority_tier = EXCLUDED.priority_tier;

-- ===== 20261028100000_contract_review.sql =====
-- Admin panel roles + per-instance contract review.
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

-- Platform staff (our team, not customers). Managed only from the SQL editor:
--   INSERT INTO public.platform_staff (user_id, role, name)
--   SELECT id, 'admin', 'Owner' FROM auth.users WHERE email = 'owner@example.com';
-- role 'admin' = analytics + contract review; role 'lawyer' = contract review only.
CREATE TABLE IF NOT EXISTS public.platform_staff (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'lawyer')),
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_staff ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_staff FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_reviewer()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_staff WHERE user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_staff WHERE user_id = auth.uid() AND role = 'admin')
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
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_queue() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_contract(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_reviewer() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_queue() TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_contract(uuid, text, text, text) TO authenticated;

-- Platform analytics for the admin panel (admins only). Aggregates only, plus the latest sign-ups.
CREATE OR REPLACE FUNCTION public.platform_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'not a platform admin'; END IF;
  SELECT jsonb_build_object(
    'users_total', (SELECT count(*) FROM auth.users),
    'users_7d', (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '7 days'),
    'users_30d', (SELECT count(*) FROM auth.users WHERE created_at > now() - interval '30 days'),
    'active_7d', (SELECT count(DISTINCT user_id) FROM public.audit_logs WHERE created_at > now() - interval '7 days'),
    'account_types', (SELECT coalesce(jsonb_object_agg(coalesce(t::text, 'unset'), n), '{}') FROM
      (SELECT account_type AS t, count(*) AS n FROM public.profiles GROUP BY 1) x),
    'organizations', (SELECT count(*) FROM public.organizations),
    'conversations', (SELECT count(*) FROM public.conversations),
    'messages', (SELECT count(*) FROM public.messages),
    'documents', (SELECT count(*) FROM public.documents),
    'library_items', (SELECT count(*) FROM public.library_items),
    'contracts', (SELECT coalesce(jsonb_object_agg(status, n), '{}') FROM
      (SELECT status, count(*) AS n FROM public.contracts GROUP BY 1) x),
    'ai_actions_30d', (SELECT coalesce(jsonb_object_agg(action, n), '{}') FROM
      (SELECT action, count(*) AS n FROM public.audit_logs WHERE created_at > now() - interval '30 days' GROUP BY 1) x),
    'daily', (SELECT coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'signups', su, 'ai', ai) ORDER BY d), '[]') FROM (
      SELECT d,
        (SELECT count(*) FROM auth.users u WHERE u.created_at >= d AND u.created_at < d + interval '1 day') AS su,
        (SELECT count(*) FROM public.audit_logs l WHERE l.action LIKE 'ai.%' AND l.created_at >= d AND l.created_at < d + interval '1 day') AS ai
      FROM generate_series(date_trunc('day', now()) - interval '29 days', date_trunc('day', now()), interval '1 day') d) x),
    'recent_users', (SELECT coalesce(jsonb_agg(x ORDER BY x.created_at DESC), '[]') FROM (
      SELECT u.email, u.created_at, p.full_name, p.account_type
      FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
      ORDER BY u.created_at DESC LIMIT 25) x)
  ) INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.platform_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_stats() TO authenticated;

-- ===== 20261029100000_lawyers_consent_review.sql =====
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
DROP POLICY IF EXISTS "licence own delete" ON storage.objects;
CREATE POLICY "licence own delete" ON storage.objects FOR DELETE TO authenticated
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

-- ===== 20261030100000_admin_team_users.sql =====
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
