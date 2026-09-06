ALTER TABLE public.meal_plan_entries ADD COLUMN IF NOT EXISTS batch_cook_date date;

UPDATE public.meal_plan_entries e
SET batch_cook_date = s.date
FROM public.meal_plan_entries s
WHERE s.batch_group_id = e.batch_group_id
  AND s.batch_role = 'start'
  AND e.batch_group_id IS NOT NULL
  AND e.batch_cook_date IS NULL;

CREATE INDEX IF NOT EXISTS meal_plan_entries_batch_cook_date_idx
  ON public.meal_plan_entries (user_id, batch_cook_date);