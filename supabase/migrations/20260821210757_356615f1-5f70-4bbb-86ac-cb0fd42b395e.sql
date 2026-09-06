CREATE TABLE public.target_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_calories NUMERIC,
  target_protein_g NUMERIC,
  target_carbs_g NUMERIC,
  target_fat_g NUMERIC,
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, valid_from)
);

CREATE INDEX idx_target_history_user_date ON public.target_history (user_id, valid_from DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.target_history TO authenticated;
GRANT ALL ON public.target_history TO service_role;

ALTER TABLE public.target_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own target history"
  ON public.target_history FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO public.target_history (user_id, target_calories, target_protein_g, target_carbs_g, target_fat_g, valid_from)
SELECT p.user_id,
       p.target_calories,
       p.target_protein_g,
       p.target_carbs_g,
       p.target_fat_g,
       LEAST(
         COALESCE((SELECT MIN(e.date) FROM public.meal_plan_entries e WHERE e.user_id = p.user_id), p.created_at::date),
         p.created_at::date
       )
FROM public.user_profile p
ON CONFLICT (user_id, valid_from) DO NOTHING;