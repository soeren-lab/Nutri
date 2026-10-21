CREATE TABLE public.user_profile (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg numeric,
  height_cm numeric,
  age integer,
  sex text,
  activity_level text NOT NULL DEFAULT 'moderate',
  goal text NOT NULL DEFAULT 'maintain',
  goal_rate text NOT NULL DEFAULT 'moderate',
  target_calories numeric,
  target_protein_g numeric,
  target_carbs_g numeric,
  target_fat_g numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_profile_sex_check CHECK (sex IS NULL OR sex IN ('male','female')),
  CONSTRAINT user_profile_activity_check CHECK (activity_level IN ('sedentary','light','moderate','active','very_active')),
  CONSTRAINT user_profile_goal_check CHECK (goal IN ('lose','maintain','gain')),
  CONSTRAINT user_profile_goal_rate_check CHECK (goal_rate IN ('slow','moderate','fast'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profile TO authenticated;
GRANT ALL ON public.user_profile TO service_role;

ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own user profile" ON public.user_profile
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_profile_updated_at
  BEFORE UPDATE ON public.user_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();