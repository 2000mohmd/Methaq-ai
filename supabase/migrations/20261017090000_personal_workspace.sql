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
