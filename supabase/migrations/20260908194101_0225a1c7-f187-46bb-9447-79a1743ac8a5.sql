ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS experimental_glass_variant text NOT NULL DEFAULT 'dark';
