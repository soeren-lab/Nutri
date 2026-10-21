ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS is_fixed_batch boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS batch_servings numeric;

ALTER TABLE public.meal_plan_entries
  ADD COLUMN IF NOT EXISTS batch_group_id uuid,
  ADD COLUMN IF NOT EXISTS batch_role text NOT NULL DEFAULT 'none';

ALTER TABLE public.meal_plan_entries
  DROP CONSTRAINT IF EXISTS meal_plan_entries_batch_role_check;
ALTER TABLE public.meal_plan_entries
  ADD CONSTRAINT meal_plan_entries_batch_role_check
  CHECK (batch_role IN ('none', 'start', 'leftover'));

CREATE INDEX IF NOT EXISTS meal_plan_entries_batch_group_idx
  ON public.meal_plan_entries (batch_group_id);