CREATE TABLE public.seasons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seasons TO authenticated;
GRANT SELECT ON public.seasons TO anon;
GRANT ALL ON public.seasons TO service_role;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seasons are viewable by everyone" ON public.seasons FOR SELECT USING (true);

INSERT INTO public.seasons (name, start_date) VALUES ('Season 1', CURRENT_DATE);

ALTER TABLE public.user_points ADD COLUMN IF NOT EXISTS current_season_id uuid REFERENCES public.seasons(id);