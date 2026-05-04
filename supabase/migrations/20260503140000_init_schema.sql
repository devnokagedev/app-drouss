-- Dahira — schéma complet (tables + RLS + fonctions utilitaires)
-- Prérequis Supabase : schéma auth existant.

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

SET search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'member');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Tables (ordre des dépendances)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diwanes (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  identifiant TEXT NOT NULL UNIQUE,
  phone TEXT,
  diwane TEXT,
  diwane_id UUID REFERENCES public.diwanes (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.diwane_admins (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  diwane_id UUID NOT NULL REFERENCES public.diwanes (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, diwane_id)
);

CREATE TABLE IF NOT EXISTS public.khassidas (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.readings (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  khassida_id UUID NOT NULL REFERENCES public.khassidas (id) ON DELETE CASCADE,
  count INT NOT NULL DEFAULT 1 CHECK (count > 0),
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS readings_user_id_idx ON public.readings (user_id);
CREATE INDEX IF NOT EXISTS readings_khassida_id_idx ON public.readings (khassida_id);
CREATE INDEX IF NOT EXISTS readings_read_at_idx ON public.readings (read_at DESC);

CREATE TABLE IF NOT EXISTS public.assigned_khassidas (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  khassida_id UUID NOT NULL REFERENCES public.khassidas (id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON public.user_roles (user_id);

-- ---------------------------------------------------------------------------
-- Fonctions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.id = auth.uid()
      AND u.raw_user_meta_data->>'role' = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_diwane_admin(_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.diwane_admins da WHERE da.user_id = _uid
  );
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _uid AND ur.role = 'admin'
  )
  AND NOT public.is_diwane_admin(_uid);
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_diwane_admin_or_super(_user_id UUID, _diwane_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = _user_id AND u.raw_user_meta_data->>'role' = 'super_admin'
  ) OR EXISTS (
    SELECT 1 FROM public.diwane_admins da
    WHERE da.user_id = _user_id AND da.diwane_id = _diwane_id
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.diwanes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diwane_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.khassidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assigned_khassidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- --- diwanes ---
DROP POLICY IF EXISTS "diwanes_select_public" ON public.diwanes;
CREATE POLICY "diwanes_select_public"
  ON public.diwanes FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "diwanes_super_all" ON public.diwanes;
CREATE POLICY "diwanes_super_all"
  ON public.diwanes FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "diwanes_diwane_admin_select" ON public.diwanes;
CREATE POLICY "diwanes_diwane_admin_select"
  ON public.diwanes FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT da.diwane_id FROM public.diwane_admins da WHERE da.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "diwanes_member_select_own_section" ON public.diwanes;
CREATE POLICY "diwanes_member_select_own_section"
  ON public.diwanes FOR SELECT
  TO authenticated
  USING (
    id = (SELECT p.diwane_id FROM public.profiles p WHERE p.id = auth.uid())
  );

-- --- profiles ---
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_select_super" ON public.profiles;
CREATE POLICY "profiles_select_super"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "profiles_select_diwane_admin" ON public.profiles;
CREATE POLICY "profiles_select_diwane_admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    diwane_id IN (
      SELECT da.diwane_id FROM public.diwane_admins da WHERE da.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "profiles_select_platform_admin" ON public.profiles;
CREATE POLICY "profiles_select_platform_admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_platform_admin(auth.uid()));

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_super" ON public.profiles;
CREATE POLICY "profiles_update_super"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- --- diwane_admins ---
DROP POLICY IF EXISTS "diwane_admins_super_all" ON public.diwane_admins;
CREATE POLICY "diwane_admins_super_all"
  ON public.diwane_admins FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- --- khassidas ---
DROP POLICY IF EXISTS "khassidas_select_authenticated" ON public.khassidas;
CREATE POLICY "khassidas_select_authenticated"
  ON public.khassidas FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "khassidas_insert_authenticated" ON public.khassidas;
CREATE POLICY "khassidas_insert_authenticated"
  ON public.khassidas FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- --- readings ---
DROP POLICY IF EXISTS "readings_select" ON public.readings;
CREATE POLICY "readings_select"
  ON public.readings FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin()
    OR public.is_platform_admin(auth.uid())
    OR user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.diwane_id IN (
        SELECT da.diwane_id FROM public.diwane_admins da WHERE da.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "readings_insert_own" ON public.readings;
CREATE POLICY "readings_insert_own"
  ON public.readings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "readings_update_own" ON public.readings;
CREATE POLICY "readings_update_own"
  ON public.readings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "readings_delete_own" ON public.readings;
CREATE POLICY "readings_delete_own"
  ON public.readings FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- --- assigned_khassidas ---
DROP POLICY IF EXISTS "assigned_select_authenticated" ON public.assigned_khassidas;
CREATE POLICY "assigned_select_authenticated"
  ON public.assigned_khassidas FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "assigned_insert_staff" ON public.assigned_khassidas;
CREATE POLICY "assigned_insert_staff"
  ON public.assigned_khassidas FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin()
    OR public.is_diwane_admin(auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

-- --- user_roles ---
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
CREATE POLICY "user_roles_select_own"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
