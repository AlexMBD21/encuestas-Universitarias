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
  owner_id text,
  owner_legacy text,
  owner_uid text,
  published boolean DEFAULT false,
  created_at timestamptz,
  published_at timestamptz,
  type text
);

-- Migration: add missing columns to existing tables (safe to run multiple times)
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS projects jsonb;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS rubric jsonb;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS owner_email text;

-- Backfill owner_email for existing surveys that have an auth UUID as owner_uid/owner_id
-- but no owner_email yet. Reads from auth.users (requires service role or superuser).
UPDATE public.surveys s
SET owner_email = u.email
FROM auth.users u
WHERE (s.owner_uid = u.id::text OR s.owner_id = u.id::text)
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

-- RPC function: returns owner_uid + email for every published survey owner.
-- Works for any authenticated user (SECURITY DEFINER reads auth.users).
-- Does NOT depend on owner_email backfill.
CREATE OR REPLACE FUNCTION public.get_published_survey_owners()
RETURNS TABLE(owner_uid text, email text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT DISTINCT
    COALESCE(s.owner_uid, s.owner_id) AS owner_uid,
    COALESCE(s.owner_email, u.email)  AS email
  FROM public.surveys s
  LEFT JOIN auth.users u
    ON u.id::text = s.owner_uid
    OR u.id::text = s.owner_id
  WHERE s.published = true
    AND COALESCE(s.owner_uid, s.owner_id) IS NOT NULL
    AND COALESCE(s.owner_uid, s.owner_id) <> '';
$$;
GRANT EXECUTE ON FUNCTION public.get_published_survey_owners TO authenticated;

-- survey_responses table
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id text PRIMARY KEY,
  survey_id text REFERENCES public.surveys(id) ON DELETE CASCADE,
  project_id text,
  user_id text,
  respondent text,
  answers jsonb,
  answers_list jsonb,
  submitted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_id ON public.survey_responses (survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_user_id ON public.survey_responses (user_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_project_id ON public.survey_responses (project_id);

-- Migration: add missing columns to existing tables (safe to run multiple times)
ALTER TABLE public.survey_responses ADD COLUMN IF NOT EXISTS project_id text;

-- notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id text PRIMARY KEY,
  title text,
  message text,
  type text,
  survey_id text,
  read boolean DEFAULT false,
  created_at timestamptz
);

-- app_users table (preserve RTDB keys and metadata)
CREATE TABLE IF NOT EXISTS public.app_users (
  legacy_key text PRIMARY KEY,
  email text,
  role text,
  created_at timestamptz
);

-- Optional: survey_reports table (if you use it in the app)
CREATE TABLE IF NOT EXISTS public.survey_reports (
  id text PRIMARY KEY,
  survey_id text,
  reporter_id text,
  reporter_email text,
  comment text,
  created_at timestamptz,
  payload jsonb
);

-- Migration: add missing columns to survey_reports (safe to run multiple times)
ALTER TABLE public.survey_reports ADD COLUMN IF NOT EXISTS reporter_id text;
ALTER TABLE public.survey_reports ADD COLUMN IF NOT EXISTS reporter_email text;
ALTER TABLE public.survey_reports ADD COLUMN IF NOT EXISTS comment text;
ALTER TABLE public.survey_reports ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public.survey_reports ADD COLUMN IF NOT EXISTS payload jsonb;
-- Reload PostgREST schema cache so new columns are recognized immediately
NOTIFY pgrst, 'reload schema';

-- Enable Realtime for surveys and survey_reports so the app gets live updates without page reload
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.surveys; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.survey_reports; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN others THEN NULL; END $$;

-- ============================================================
-- RLS POLICIES
-- Run these after creating the tables.
-- The role is stored in user_metadata.role inside the JWT.
-- ============================================================

-- Helper: is the current JWT user an admin?
-- Uses user_metadata.role (set by the app when creating users).
-- If you use app_metadata instead, change 'user_metadata' to 'app_metadata'.

-- SURVEYS
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS surveys_select ON public.surveys;
CREATE POLICY surveys_select ON public.surveys
  FOR SELECT USING (
    published = true
    OR auth.uid()::text = owner_uid
    OR auth.uid()::text = owner_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS surveys_insert ON public.surveys;
CREATE POLICY surveys_insert ON public.surveys
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS surveys_update ON public.surveys;
CREATE POLICY surveys_update ON public.surveys
  FOR UPDATE USING (
    auth.uid()::text = owner_uid
    OR auth.uid()::text = owner_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS surveys_delete ON public.surveys;
CREATE POLICY surveys_delete ON public.surveys
  FOR DELETE USING (
    auth.uid()::text = owner_uid
    OR auth.uid()::text = owner_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- SURVEY_RESPONSES: authenticated users can insert/select their own
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS survey_responses_select ON public.survey_responses;
CREATE POLICY survey_responses_select ON public.survey_responses
  FOR SELECT USING (
    auth.uid()::text = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.surveys s
      WHERE s.id = survey_id AND (
        s.owner_uid = auth.uid()::text
        OR s.owner_id = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS survey_responses_insert ON public.survey_responses;
CREATE POLICY survey_responses_insert ON public.survey_responses
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS survey_responses_delete ON public.survey_responses;
CREATE POLICY survey_responses_delete ON public.survey_responses
  FOR DELETE USING (
    auth.uid()::text = user_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- SURVEY_REPORTS
ALTER TABLE public.survey_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS survey_reports_select ON public.survey_reports;
CREATE POLICY survey_reports_select ON public.survey_reports
  FOR SELECT USING (
    auth.uid()::text = reporter_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.surveys s
      WHERE s.id = survey_id AND (
        s.owner_uid = auth.uid()::text
        OR s.owner_id = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS survey_reports_insert ON public.survey_reports;
CREATE POLICY survey_reports_insert ON public.survey_reports
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS survey_reports_delete ON public.survey_reports;
CREATE POLICY survey_reports_delete ON public.survey_reports
  FOR DELETE USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.surveys s
      WHERE s.id = survey_id AND (
        s.owner_uid = auth.uid()::text
        OR s.owner_id = auth.uid()::text
      )
    )
  );

-- NOTIFICATIONS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT USING (true);

DROP POLICY IF EXISTS notifications_insert ON public.notifications;
CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS notifications_delete ON public.notifications;
CREATE POLICY notifications_delete ON public.notifications
  FOR DELETE USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ============================================================
-- PROFILES (display_name + avatar_url por usuario)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id   text PRIMARY KEY,
  display_name text DEFAULT '',
  avatar_url   text DEFAULT '',
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS profiles_upsert ON public.profiles;
CREATE POLICY profiles_upsert ON public.profiles
  FOR ALL USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

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
