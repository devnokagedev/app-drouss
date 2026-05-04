
-- diwanes
CREATE TABLE IF NOT EXISTS public.diwanes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.diwanes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read diwanes" ON public.diwanes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage diwanes" ON public.diwanes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- diwane_admins
CREATE TABLE IF NOT EXISTS public.diwane_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diwane_id uuid NOT NULL REFERENCES public.diwanes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (diwane_id, user_id)
);
ALTER TABLE public.diwane_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own diwane links" ON public.diwane_admins
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage diwane_admins" ON public.diwane_admins
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- profiles: nouvelles colonnes
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS diwane text,
  ADD COLUMN IF NOT EXISTS diwane_id uuid REFERENCES public.diwanes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_diwane_id ON public.profiles(diwane_id);
CREATE INDEX IF NOT EXISTS idx_diwane_admins_user ON public.diwane_admins(user_id);
