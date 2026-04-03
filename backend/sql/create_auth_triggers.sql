-- Cleanup if objects already exist (idempotent)
DROP TRIGGER IF EXISTS auth_user_upsert_after_insert ON auth.users;
DROP TRIGGER IF EXISTS auth_user_upsert_after_update ON auth.users;
DROP TRIGGER IF EXISTS auth_user_delete_after_delete ON auth.users;
DROP POLICY IF EXISTS allow_admin_select_app_users ON public.app_users;

-- 1) Function to upsert a row into public.app_users on auth.users INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.handle_auth_user_upsert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.email IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.app_users (legacy_key, email, role, created_at)
  VALUES (
    COALESCE(NEW.raw_user_meta_data ->> 'legacy_key', NEW.id::text),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'profesor'),
    NOW()
  )
  ON CONFLICT (legacy_key) DO UPDATE
  SET email = EXCLUDED.email,
      role = COALESCE(EXCLUDED.role, public.app_users.role);

  RETURN NEW;
END;
$$;

-- 2) Triggers for insert and update on auth.users
CREATE TRIGGER auth_user_upsert_after_insert
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_upsert();

CREATE TRIGGER auth_user_upsert_after_update
AFTER UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_upsert();

-- 3) Function and trigger to remove app_users row when auth.users row is deleted
CREATE OR REPLACE FUNCTION public.handle_auth_user_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Remove compatibility row in public.app_users when the auth user is deleted
  DELETE FROM public.app_users
  WHERE legacy_key = COALESCE(OLD.raw_user_meta_data ->> 'legacy_key', OLD.id::text)
     OR email = OLD.email;
  RETURN OLD;
END;
$$;

CREATE TRIGGER auth_user_delete_after_delete
AFTER DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_delete();

-- 3) Enable RLS and allow admins to SELECT app_users
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Remove any older select policies that relied on JWT-only claims
DROP POLICY IF EXISTS app_users_select_policy ON public.app_users;
DROP POLICY IF EXISTS allow_admin_select_app_users ON public.app_users;

-- New policy: allow SELECT if JWT claims indicate admin (including nested user_metadata),
-- or if the requester is the owner (legacy_key=sub) or matches email.
-- This avoids querying auth.users from within the policy (which can cause permission errors).
DROP POLICY IF EXISTS app_users_select_policy ON public.app_users;
CREATE POLICY allow_admin_select_app_users
ON public.app_users
FOR SELECT
USING (
  (
    jwt_claim('role'::text) = 'admin'::text
  )
  OR (
    (jwt_claim('user_metadata'::text) IS NOT NULL)
    AND ((jwt_claim('user_metadata'::text)::json ->> 'role') = 'admin')
  )
  OR (
    (jwt_claim('sub'::text) IS NOT NULL) AND (legacy_key = jwt_claim('sub'::text))
  )
  OR (
    (jwt_claim('email'::text) IS NOT NULL) AND (email = jwt_claim('email'::text))
  )
);

-- 4) Backfill existing auth.users into app_users (run once)
INSERT INTO public.app_users (legacy_key, email, role, created_at)
SELECT
  COALESCE(raw_user_meta_data ->> 'legacy_key', id::text) AS legacy_key,
  email,
  COALESCE(raw_user_meta_data ->> 'role', 'profesor') AS role,
  COALESCE((raw_user_meta_data ->> 'created_at')::timestamptz, created_at, NOW()) AS created_at
FROM auth.users u
    WHERE email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.app_users a
    WHERE a.email = u.email OR a.legacy_key = COALESCE(u.raw_user_meta_data ->> 'legacy_key', u.id::text)
  );
