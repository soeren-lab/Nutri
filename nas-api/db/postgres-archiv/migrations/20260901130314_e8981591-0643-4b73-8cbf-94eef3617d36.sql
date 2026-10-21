ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS track_protein boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS track_carbs boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS track_fat boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS track_fiber boolean NOT NULL DEFAULT true;