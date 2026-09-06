ALTER TABLE public.points_log
  ADD COLUMN IF NOT EXISTS season_id uuid REFERENCES public.seasons(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS points_log_user_season_date_idx
  ON public.points_log (user_id, season_id, date);

UPDATE public.points_log pl
SET season_id = s.id
FROM public.seasons s
WHERE pl.season_id IS NULL
  AND pl.date >= s.start_date
  AND pl.date <= s.end_date;

CREATE OR REPLACE FUNCTION public.season_rank_key(_points integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _points >= 33000 THEN 'unreal_2'
    WHEN _points >= 30000 THEN 'unreal_1'
    WHEN _points >= 25500 THEN 'champion_3'
    WHEN _points >= 22000 THEN 'champion_2'
    WHEN _points >= 18500 THEN 'champion_1'
    WHEN _points >= 15400 THEN 'elite_3'
    WHEN _points >= 13000 THEN 'elite_2'
    WHEN _points >= 11000 THEN 'elite_1'
    WHEN _points >= 9200 THEN 'diamond_3'
    WHEN _points >= 7600 THEN 'diamond_2'
    WHEN _points >= 6200 THEN 'diamond_1'
    WHEN _points >= 5000 THEN 'platinum_3'
    WHEN _points >= 4000 THEN 'platinum_2'
    WHEN _points >= 3200 THEN 'platinum_1'
    WHEN _points >= 2500 THEN 'gold_3'
    WHEN _points >= 1900 THEN 'gold_2'
    WHEN _points >= 1400 THEN 'gold_1'
    WHEN _points >= 1000 THEN 'silver_3'
    WHEN _points >= 700 THEN 'silver_2'
    WHEN _points >= 450 THEN 'silver_1'
    WHEN _points >= 250 THEN 'bronze_3'
    WHEN _points >= 100 THEN 'bronze_2'
    ELSE 'bronze_1'
  END
$function$;

CREATE OR REPLACE FUNCTION public.ensure_current_season()
RETURNS TABLE(id uuid, name text, start_date date, end_date date, season_number integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _s public.seasons;
  _guard integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet';
  END IF;

  SELECT * INTO _s FROM public.seasons WHERE is_active LIMIT 1;
  IF _s.id IS NULL THEN
    INSERT INTO public.seasons (name, start_date, end_date, is_active, season_number)
    VALUES (
      'Season ' || (COALESCE((SELECT MAX(season_number) FROM public.seasons), 0) + 1),
      CURRENT_DATE, CURRENT_DATE + 70, true,
      COALESCE((SELECT MAX(season_number) FROM public.seasons), 0) + 1
    )
    RETURNING * INTO _s;
  END IF;

  WHILE _s.end_date < CURRENT_DATE AND _guard < 50 LOOP
    _guard := _guard + 1;

    -- Endstand aller Nutzer der ablaufenden Season sichern
    INSERT INTO public.season_history (user_id, season_id, final_points, final_rank, final_placement_among_friends)
    SELECT up.user_id, _s.id, up.total_points + up.bonus_points,
           public.season_rank_key(up.total_points + up.bonus_points),
           (
             SELECT 1 + COUNT(*)
             FROM public.user_points other
             JOIN public.friendships f
               ON (f.user_id_a = LEAST(up.user_id, other.user_id)
               AND f.user_id_b = GREATEST(up.user_id, other.user_id))
             WHERE other.user_id <> up.user_id
               AND (other.total_points + other.bonus_points) > (up.total_points + up.bonus_points)
           )
    FROM public.user_points up
    ON CONFLICT (user_id, season_id) DO NOTHING;

    UPDATE public.seasons SET is_active = false WHERE id = _s.id;

    INSERT INTO public.seasons (name, start_date, end_date, is_active, season_number)
    VALUES (
      'Season ' || (COALESCE((SELECT MAX(season_number) FROM public.seasons), 0) + 1),
      _s.end_date + 1, _s.end_date + 71, true,
      COALESCE((SELECT MAX(season_number) FROM public.seasons), 0) + 1
    )
    RETURNING * INTO _s;

    -- Punktestand für die neue Season zurücksetzen
    UPDATE public.user_points
    SET total_points = 0,
        bonus_points = 0,
        current_streak_days = 0,
        last_points_date = NULL,
        current_season_id = _s.id,
        updated_at = now();
  END LOOP;

  UPDATE public.user_points
  SET current_season_id = _s.id, updated_at = now()
  WHERE user_id = auth.uid()
    AND (current_season_id IS DISTINCT FROM _s.id);

  RETURN QUERY SELECT _s.id, _s.name, _s.start_date, _s.end_date, _s.season_number;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_friend_season_comparison(_season_id uuid)
RETURNS TABLE(user_id uuid, username text, avatar_url text, total_points integer, current_streak_days integer, is_self boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH people AS (
    SELECT auth.uid() AS uid, true AS self
    WHERE auth.uid() IS NOT NULL
    UNION ALL
    SELECT CASE WHEN f.user_id_a = auth.uid() THEN f.user_id_b ELSE f.user_id_a END, false
    FROM public.friendships f
    WHERE auth.uid() IS NOT NULL
      AND (f.user_id_a = auth.uid() OR f.user_id_b = auth.uid())
  )
  SELECT p.uid, pr.username, pr.avatar_url,
         (COALESCE(up.total_points, 0) + COALESCE(up.bonus_points, 0))::integer,
         COALESCE(up.current_streak_days, 0)::integer,
         p.self
  FROM people p
  LEFT JOIN public.user_profile pr ON pr.user_id = p.uid
  LEFT JOIN public.user_points up ON up.user_id = p.uid
  WHERE p.self OR pr.username IS NOT NULL
$function$;

REVOKE ALL ON FUNCTION public.ensure_current_season() FROM anon, public;
REVOKE ALL ON FUNCTION public.get_friend_season_comparison(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.ensure_current_season() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friend_season_comparison(uuid) TO authenticated;