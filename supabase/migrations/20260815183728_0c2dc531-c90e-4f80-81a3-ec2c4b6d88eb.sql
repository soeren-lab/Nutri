ALTER TABLE public.meal_plan_entries
  ADD COLUMN IF NOT EXISTS quick_entry_name text,
  ADD COLUMN IF NOT EXISTS quick_entry_calories numeric,
  ADD COLUMN IF NOT EXISTS quick_entry_protein_g numeric,
  ADD COLUMN IF NOT EXISTS quick_entry_carbs_g numeric,
  ADD COLUMN IF NOT EXISTS quick_entry_fat_g numeric;

CREATE TABLE public.quick_entry_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  calories numeric NOT NULL,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  use_count integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quick_entry_templates TO authenticated;
GRANT ALL ON public.quick_entry_templates TO service_role;

ALTER TABLE public.quick_entry_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own quick entry templates" ON public.quick_entry_templates
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_quick_entry_templates_updated_at
  BEFORE UPDATE ON public.quick_entry_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();