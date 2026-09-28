
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
