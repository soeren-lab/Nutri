CREATE TABLE public.ai_suggestion_cache (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_slot text NOT NULL,
  date date NOT NULL,
  kcal_bucket integer NOT NULL,
  protein_bucket integer NOT NULL,
  carbs_bucket integer NOT NULL,
  fat_bucket integer NOT NULL,
  suggestions jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '30 minutes'),
  UNIQUE (user_id, meal_slot, date, kcal_bucket, protein_bucket, carbs_bucket, fat_bucket)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_suggestion_cache TO authenticated;
GRANT ALL ON public.ai_suggestion_cache TO service_role;

ALTER TABLE public.ai_suggestion_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own ai suggestion cache"
  ON public.ai_suggestion_cache FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX ai_suggestion_cache_expires_idx ON public.ai_suggestion_cache (expires_at);