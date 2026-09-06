ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS experimental_glass_ui boolean NOT NULL DEFAULT false;
