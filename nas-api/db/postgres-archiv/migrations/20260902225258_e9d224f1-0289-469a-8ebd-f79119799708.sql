CREATE OR REPLACE FUNCTION public.get_friend_comparison()
RETURNS TABLE(
  user_id uuid,
  username text,
  avatar_url text,
  total_points integer,
  current_streak_days integer,
  week_avg_points numeric,
  week_days integer,
  achievement_count integer,
  is_self boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH people AS (
    SELECT auth.uid() AS uid, true AS self
    WHERE auth.uid() IS NOT NULL
    UNION ALL
    SELECT CASE WHEN f.user_id_a = auth.uid() THEN f.user_id_b ELSE f.user_id_a END, false
    FROM public.friendships f
    WHERE auth.uid() IS NOT NULL
      AND (f.user_id_a = auth.uid() OR f.user_id_b = auth.uid())
  ),
  week AS (
    SELECT pl.user_id, SUM(pl.points_earned) AS sum_points, COUNT(*) AS days
    FROM public.points_log pl
    WHERE pl.date >= CURRENT_DATE - 6
    GROUP BY pl.user_id
  ),
  ach AS (
    SELECT a.user_id, COUNT(*) AS cnt
    FROM public.achievements a
    GROUP BY a.user_id
  )
  SELECT p.uid,
         pr.username,
         pr.avatar_url,
         (COALESCE(up.total_points, 0) + COALESCE(up.bonus_points, 0))::integer,
         COALESCE(up.current_streak_days, 0)::integer,
         ROUND(COALESCE(w.sum_points, 0)::numeric / 7, 1),
         COALESCE(w.days, 0)::integer,
         COALESCE(ach.cnt, 0)::integer,
         p.self
  FROM people p
  LEFT JOIN public.user_profile pr ON pr.user_id = p.uid
  LEFT JOIN public.user_points up ON up.user_id = p.uid
  LEFT JOIN week w ON w.user_id = p.uid
  LEFT JOIN ach ON ach.user_id = p.uid
  WHERE p.self OR pr.username IS NOT NULL
$$;

REVOKE EXECUTE ON FUNCTION public.get_friend_comparison() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_friend_comparison() TO authenticated;