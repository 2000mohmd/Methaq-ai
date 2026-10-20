CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  contract_type text NOT NULL,
  title text NOT NULL,
  language text NOT NULL DEFAULT 'ar',
  inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contracts read" ON public.contracts FOR SELECT TO authenticated
  USING ((organization_id IS NOT NULL AND organization_id = public.current_org_id()) OR (organization_id IS NULL AND created_by = auth.uid()));
CREATE POLICY "contracts insert" ON public.contracts FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND ((organization_id IS NOT NULL AND organization_id = public.current_org_id()) OR organization_id IS NULL));
CREATE POLICY "contracts update" ON public.contracts FOR UPDATE TO authenticated
  USING ((organization_id IS NOT NULL AND organization_id = public.current_org_id()) OR (organization_id IS NULL AND created_by = auth.uid()))
  WITH CHECK ((organization_id IS NOT NULL AND organization_id = public.current_org_id()) OR (organization_id IS NULL AND created_by = auth.uid()));
CREATE POLICY "contracts delete" ON public.contracts FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR (organization_id = public.current_org_id() AND (public.has_org_role(auth.uid(), organization_id, 'owner') OR public.has_org_role(auth.uid(), organization_id, 'admin'))));
CREATE TRIGGER contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();