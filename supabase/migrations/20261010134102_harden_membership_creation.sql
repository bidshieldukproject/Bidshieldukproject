-- Close the tenant-boundary escalation caused by caller-controlled users INSERTs.
-- New workspaces are created together with their authenticated owner's membership.
-- Any future invitation acceptance must use a separately validated invite flow;
-- authenticated clients must not insert arbitrary rows into public.users.

BEGIN;

CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  p_organization_name text,
  p_display_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  new_organization_id uuid;
  normalized_name text := btrim(p_organization_name);
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to create an organization.'
      USING ERRCODE = '28000';
  END IF;

  IF normalized_name IS NULL OR char_length(normalized_name) < 2 THEN
    RAISE EXCEPTION 'Organization name must contain at least two characters.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.users AS existing_membership
    WHERE existing_membership.auth_user_id = caller_id
  ) THEN
    RAISE EXCEPTION 'This account already has an organization membership.'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.organizations (name, created_by)
  VALUES (normalized_name, caller_id)
  RETURNING id INTO new_organization_id;

  INSERT INTO public.users (auth_user_id, organization_id, role, display_name)
  VALUES (
    caller_id,
    new_organization_id,
    'owner',
    nullif(btrim(p_display_name), '')
  );

  RETURN new_organization_id;
END;
$function$;

-- The browser may only trigger the narrowly scoped, caller-bound onboarding flow.
REVOKE ALL ON FUNCTION public.create_organization_with_owner(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_organization_with_owner(text, text)
  TO authenticated;

REVOKE INSERT ON TABLE public.users FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS users_insert_own_membership ON public.users;

COMMIT;
