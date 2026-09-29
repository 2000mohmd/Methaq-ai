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