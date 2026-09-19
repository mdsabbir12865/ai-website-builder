-- PART 25 — Vercel one-click deployment schema
-- Run this in the Supabase SQL editor for the production project.
-- Safe to re-run: uses IF NOT EXISTS / additive columns.

-- 1) Per-user Vercel Integration connection (tokens encrypted by the API)
CREATE TABLE IF NOT EXISTS public.vercel_connections (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  access_token text NOT NULL,
  configuration_id text,
  vercel_user_id text,
  vercel_username text,
  vercel_avatar_url text,
  team_id text,
  scopes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS vercel_connections_configuration_id_idx
  ON public.vercel_connections (configuration_id);

ALTER TABLE public.vercel_connections ENABLE ROW LEVEL SECURITY;

-- No client policies: browser must never read/write tokens.
-- Server uses SUPABASE_SERVICE_ROLE_KEY.

DROP POLICY IF EXISTS vercel_connections_no_client_select ON public.vercel_connections;
DROP POLICY IF EXISTS vercel_connections_no_client_write ON public.vercel_connections;

-- Explicit deny-style: no policies for authenticated role = no access via anon key.

-- 2) Deployment history
CREATE TABLE IF NOT EXISTS public.vercel_deployments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  github_repository text,
  github_branch text,
  vercel_project_id text,
  vercel_project_name text,
  deployment_id text,
  deployment_status text,
  deployment_url text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vercel_deployments_user_project_idx
  ON public.vercel_deployments (user_id, project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS vercel_deployments_deployment_id_idx
  ON public.vercel_deployments (deployment_id);

ALTER TABLE public.vercel_deployments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vercel_deployments_select_own ON public.vercel_deployments;
CREATE POLICY vercel_deployments_select_own
  ON public.vercel_deployments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Inserts/updates/deletes are performed by the service role from API routes.

-- 3) Builder project link fields for one-click redeploy
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS vercel_project_id text,
  ADD COLUMN IF NOT EXISTS vercel_project_name text,
  ADD COLUMN IF NOT EXISTS vercel_team_id text,
  ADD COLUMN IF NOT EXISTS github_repo_full_name text,
  ADD COLUMN IF NOT EXISTS github_branch text,
  ADD COLUMN IF NOT EXISTS last_deployment_id text,
  ADD COLUMN IF NOT EXISTS last_deployment_url text,
  ADD COLUMN IF NOT EXISTS last_deployed_at timestamptz,
  ADD COLUMN IF NOT EXISTS deploy_in_progress_at timestamptz;

CREATE INDEX IF NOT EXISTS projects_vercel_project_id_idx
  ON public.projects (vercel_project_id);
