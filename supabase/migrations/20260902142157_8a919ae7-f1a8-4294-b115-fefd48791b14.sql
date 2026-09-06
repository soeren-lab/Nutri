ALTER TABLE public.user_points ADD COLUMN IF NOT EXISTS bonus_points integer NOT NULL DEFAULT 0;

INSERT INTO public.user_points (user_id, bonus_points)
SELECT u.id, 300 FROM auth.users u
ON CONFLICT (user_id) DO UPDATE SET bonus_points = public.user_points.bonus_points + 300;