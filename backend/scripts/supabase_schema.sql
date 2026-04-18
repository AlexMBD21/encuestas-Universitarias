-- Supabase schema for Encuestas migration
-- Run this in Supabase SQL editor before running the migration script.

-- surveys table
CREATE TABLE IF NOT EXISTS public.surveys (
    id text PRIMARY KEY,
    title text,
    description text,
    questions jsonb,
    projects jsonb,
    rubric jsonb,
    owner_id uuid, -- Changed to UUID for better RLS performance
    owner_legacy text,
    owner_uid text,
    published boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    published_at timestamptz,
    type text,
    allowed_categories jsonb
);

ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

-- Policies for surveys
DROP POLICY IF EXISTS "Public read for published surveys" ON public.surveys;
CREATE POLICY "Public read for published surveys" ON public.surveys
    FOR SELECT USING (
        published = true 
        OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
        OR auth.uid()::text = owner_id::text
        OR (auth.jwt() ->> 'email') = owner_id::text
        OR (auth.jwt() ->> 'email') = owner_legacy::text
    );

DROP POLICY IF EXISTS "Owners can insert their own surveys" ON public.surveys;
CREATE POLICY "Owners can insert their own surveys" ON public.surveys
    FOR INSERT WITH CHECK (
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
        OR auth.uid()::text = owner_id::text
        OR (auth.jwt() ->> 'email') = owner_id::text
        OR (auth.jwt() ->> 'email') = owner_legacy::text
    );

DROP POLICY IF EXISTS "Owners can update their own surveys" ON public.surveys;
CREATE POLICY "Owners can update their own surveys" ON public.surveys
    FOR UPDATE USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
        OR auth.uid()::text = owner_id::text
        OR (auth.jwt() ->> 'email') = owner_id::text
        OR (auth.jwt() ->> 'email') = owner_legacy::text
    );

DROP POLICY IF EXISTS "Owners can delete their own surveys" ON public.surveys;
CREATE POLICY "Owners can delete their own surveys" ON public.surveys
    FOR DELETE USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
        OR auth.uid()::text = owner_id::text
        OR (auth.jwt() ->> 'email') = owner_id::text
        OR (auth.jwt() ->> 'email') = owner_legacy::text
    );

-- Migration: add missing columns to existing tables (safe to run multiple times)
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS projects jsonb;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS rubric jsonb;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS owner_email text;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS link_token text;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS link_expires_at text;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS satisfaccion_token text;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS satisfaccion_expires_at timestamptz;

-- Backfill owner_email for existing surveys that have an auth UUID as owner_uid/owner_id
-- but no owner_email yet. Reads from auth.users (requires service role or superuser).
UPDATE public.surveys s
SET owner_email = u.email
FROM auth.users u
WHERE (s.owner_uid = u.id::text OR s.owner_id::text = u.id::text)
  AND (s.owner_email IS NULL OR s.owner_email = '');

-- RPC function to resolve owner UUIDs to emails for any authenticated user.
-- SECURITY DEFINER allows it to read auth.users without exposing the table directly.
CREATE OR REPLACE FUNCTION public.resolve_owner_emails(uids text[])
RETURNS TABLE(uid text, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT id::text AS uid, email FROM auth.users WHERE id::text = ANY(uids);
$$;
GRANT EXECUTE ON FUNCTION public.resolve_owner_emails TO authenticated;

-- ============================================================
-- STORAGE: bucket "avatars"
-- Ejecutar en Supabase Dashboard > Storage > New bucket:
--   Nombre: avatars | Public: true
-- O ejecutar este SQL (requiere permisos de superuser/service_role):
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies para el bucket avatars
DROP POLICY IF EXISTS avatars_select ON storage.objects;
CREATE POLICY avatars_select ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS avatars_insert ON storage.objects;
CREATE POLICY avatars_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS avatars_update ON storage.objects;
CREATE POLICY avatars_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS avatars_delete ON storage.objects;
CREATE POLICY avatars_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- MIGRATION: survey_reports cascade on survey deletion
-- Run this in Supabase SQL editor to fix orphaned reports and
-- ensure future survey deletions automatically remove reports.
-- ============================================================

-- Step 1: Remove orphaned survey_reports where the survey no longer exists
DELETE FROM public.survey_reports
WHERE survey_id NOT IN (SELECT id FROM public.surveys);

-- Step 2: Update survey_reports_delete RLS policy to also allow:
--   a) The reporter to delete their own report
--   b) Survey owner matched even when owner_id stores email (identity fallback)
DROP POLICY IF EXISTS survey_reports_delete ON public.survey_reports;
CREATE POLICY survey_reports_delete ON public.survey_reports
  FOR DELETE USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR auth.uid()::text = reporter_id
    OR EXISTS (
      SELECT 1 FROM public.surveys s
      WHERE s.id = survey_id AND (
        s.owner_uid = auth.uid()::text
        OR s.owner_id = auth.uid()::text
      )
    )
  );

-- Step 3: Add FK with ON DELETE CASCADE so deleting a survey automatically
--         removes all its reports at the database level (no RLS blocking).
ALTER TABLE public.survey_reports
  DROP CONSTRAINT IF EXISTS fk_survey_reports_survey;
ALTER TABLE public.survey_reports
  ADD CONSTRAINT fk_survey_reports_survey
  FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;

-- Step 4: Same FK cascade for notifications so they are also removed at DB level
--         when a survey is deleted, regardless of RLS policies.
-- First remove orphaned notifications whose survey no longer exists.
DELETE FROM public.notifications
WHERE survey_id IS NOT NULL
  AND survey_id NOT IN (SELECT id FROM public.surveys);
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS fk_notifications_survey;
ALTER TABLE public.notifications
  ADD CONSTRAINT fk_notifications_survey
  FOREIGN KEY (survey_id) REFERENCES public.surveys(id) ON DELETE CASCADE;

-- ============================================================
-- RPC FUNCTION: get_all_survey_responses_for_report
-- Allows everyone (professors) to see the global responses in reports
-- Bypasses RLS strictly for the report query.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_all_survey_responses_for_report(p_survey_id text)
RETURNS SETOF survey_responses
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.survey_responses WHERE survey_id = p_survey_id;
$$;

-- ============================================================
-- AUTH TRIGGERS: sync auth.users with public.app_users
-- ============================================================

-- Function to upsert a row into public.app_users on auth.users INSERT/UPDATE
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
    COALESCE(NEW.raw_app_meta_data ->> 'legacy_key', NEW.raw_user_meta_data ->> 'legacy_key', NEW.id::text),
    NEW.email,
    COALESCE(NEW.raw_app_meta_data ->> 'role', NEW.raw_user_meta_data ->> 'role', 'profesor'),
    NOW()
  )
  ON CONFLICT (legacy_key) DO UPDATE
  SET email = EXCLUDED.email,
      role = COALESCE(EXCLUDED.role, public.app_users.role);

  RETURN NEW;
END;
$$;

-- Triggers for insert and update on auth.users
DROP TRIGGER IF EXISTS auth_user_upsert_after_insert ON auth.users;
CREATE TRIGGER auth_user_upsert_after_insert
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_upsert();

DROP TRIGGER IF EXISTS auth_user_upsert_after_update ON auth.users;
CREATE TRIGGER auth_user_upsert_after_update
AFTER UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_upsert();

-- Function and trigger to remove app_users row when auth.users row is deleted
CREATE OR REPLACE FUNCTION public.handle_auth_user_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.app_users
  WHERE legacy_key = COALESCE(OLD.raw_app_meta_data ->> 'legacy_key', OLD.raw_user_meta_data ->> 'legacy_key', OLD.id::text)
     OR email = OLD.email;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS auth_user_delete_after_delete ON auth.users;
CREATE TRIGGER auth_user_delete_after_delete
AFTER DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_delete();

-- ==============================================================================
-- MIGRACIÓN: SISTEMA DE ENCUESTAS DE SATISFACCIÓN
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.encuestas_satisfaccion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encuesta_id TEXT NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
    participante_email TEXT NOT NULL,
    participante_id TEXT,
    token UUID UNIQUE DEFAULT gen_random_uuid(),
    respondida BOOLEAN DEFAULT FALSE,
    respuestas_json JSONB DEFAULT '{}'::jsonb,
    token_expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    respondida_en TIMESTAMPTZ,
    UNIQUE (encuesta_id, participante_email)
);

-- Ensure foreign key exists if table was already created
DO $$ BEGIN
  ALTER TABLE public.encuestas_satisfaccion 
  ADD CONSTRAINT encuestas_satisfaccion_encuesta_id_fkey FOREIGN KEY (encuesta_id) REFERENCES public.surveys(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Force cast of UUID to TEXT in case it was created as UUID recently
DO $$ BEGIN ALTER TABLE public.encuestas_satisfaccion ALTER COLUMN participante_id TYPE TEXT USING participante_id::TEXT; EXCEPTION WHEN others THEN NULL; END $$;


ALTER TABLE public.encuestas_satisfaccion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read via token" ON public.encuestas_satisfaccion;
CREATE POLICY "Public read via token" 
    ON public.encuestas_satisfaccion FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public update via token" ON public.encuestas_satisfaccion;
CREATE POLICY "Public update via token" 
    ON public.encuestas_satisfaccion FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public insert for identification" ON public.encuestas_satisfaccion;
CREATE POLICY "Public insert for identification" 
    ON public.encuestas_satisfaccion FOR INSERT WITH CHECK (true);

-- TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.fn_trigger_genera_satisfaccion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.published = true AND OLD.published = false THEN
        INSERT INTO public.encuestas_satisfaccion (encuesta_id, participante_email, participante_id, token_expires_at)
        SELECT DISTINCT 
            NEW.id,
            COALESCE(r.respondent, r.user_id::text, 'anonimo@sistema.com'),
            r.user_id::text,
            now() + interval '7 days'
        FROM public.survey_responses r
        WHERE r.survey_id = NEW.id
        ON CONFLICT (encuesta_id, participante_email) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_genera_satisfaccion ON public.surveys;
CREATE TRIGGER trigger_genera_satisfaccion
AFTER UPDATE ON public.surveys
FOR EACH ROW
EXECUTE FUNCTION public.fn_trigger_genera_satisfaccion();
