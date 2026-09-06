
-- Cookbooks
CREATE TABLE public.cookbooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  cover_image_url text,
  share_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cookbooks TO authenticated;
GRANT ALL ON public.cookbooks TO service_role;
ALTER TABLE public.cookbooks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cookbook_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cookbook_id uuid NOT NULL REFERENCES public.cookbooks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner','viewer','editor')),
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cookbook_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cookbook_members TO authenticated;
GRANT ALL ON public.cookbook_members TO service_role;
ALTER TABLE public.cookbook_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cookbook_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cookbook_id uuid NOT NULL REFERENCES public.cookbooks(id) ON DELETE CASCADE,
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cookbook_id, recipe_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cookbook_recipes TO authenticated;
GRANT ALL ON public.cookbook_recipes TO service_role;
ALTER TABLE public.cookbook_recipes ENABLE ROW LEVEL SECURITY;

-- Security definer helpers to avoid recursion
CREATE OR REPLACE FUNCTION public.is_cookbook_owner(_cookbook_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.cookbooks WHERE id = _cookbook_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_cookbook_member(_cookbook_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.cookbook_members WHERE cookbook_id = _cookbook_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.can_view_cookbook(_cookbook_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_cookbook_owner(_cookbook_id, _user_id)
      OR public.is_cookbook_member(_cookbook_id, _user_id)
$$;

-- Cookbooks policies
CREATE POLICY "own or member select cookbooks" ON public.cookbooks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_cookbook_member(id, auth.uid()));
CREATE POLICY "owner insert cookbooks" ON public.cookbooks
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "owner update cookbooks" ON public.cookbooks
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "owner delete cookbooks" ON public.cookbooks
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Cookbook members policies
CREATE POLICY "self or owner select members" ON public.cookbook_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_cookbook_owner(cookbook_id, auth.uid()));
CREATE POLICY "self leave members" ON public.cookbook_members
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_cookbook_owner(cookbook_id, auth.uid()));
CREATE POLICY "owner add members" ON public.cookbook_members
  FOR INSERT TO authenticated WITH CHECK (public.is_cookbook_owner(cookbook_id, auth.uid()));

-- Cookbook recipes policies
CREATE POLICY "view cookbook recipes" ON public.cookbook_recipes
  FOR SELECT TO authenticated USING (public.can_view_cookbook(cookbook_id, auth.uid()));
CREATE POLICY "owner manage cookbook recipes" ON public.cookbook_recipes
  FOR ALL TO authenticated
  USING (public.is_cookbook_owner(cookbook_id, auth.uid()))
  WITH CHECK (public.is_cookbook_owner(cookbook_id, auth.uid()));

-- updated_at trigger for cookbooks
CREATE TRIGGER update_cookbooks_updated_at
  BEFORE UPDATE ON public.cookbooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX cookbooks_user_id_idx ON public.cookbooks(user_id);
CREATE INDEX cookbook_recipes_cookbook_id_idx ON public.cookbook_recipes(cookbook_id);
CREATE INDEX cookbook_members_user_id_idx ON public.cookbook_members(user_id);
CREATE INDEX cookbook_members_cookbook_id_idx ON public.cookbook_members(cookbook_id);
