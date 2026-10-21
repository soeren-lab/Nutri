CREATE TABLE public.meal_plan_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  meal_slot text NOT NULL,
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  servings numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT meal_plan_entries_slot_check CHECK (meal_slot IN ('Frühstück','Mittag','Abend')),
  CONSTRAINT meal_plan_entries_unique_slot UNIQUE (user_id, date, meal_slot)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meal_plan_entries TO authenticated;
GRANT ALL ON public.meal_plan_entries TO service_role;

ALTER TABLE public.meal_plan_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own meal plan entries" ON public.meal_plan_entries
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX meal_plan_entries_user_date_idx ON public.meal_plan_entries (user_id, date);

CREATE TRIGGER update_meal_plan_entries_updated_at
  BEFORE UPDATE ON public.meal_plan_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();