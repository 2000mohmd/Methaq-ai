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