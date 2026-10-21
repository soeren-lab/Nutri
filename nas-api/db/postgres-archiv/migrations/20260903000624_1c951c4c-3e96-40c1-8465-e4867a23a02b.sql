-- 1. seasons erweitern
ALTER TABLE public.seasons
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS season_number integer;

UPDATE public.seasons SET end_date = start_date + 70 WHERE end_date IS NULL;
UPDATE public.seasons s SET season_number = x.rn
FROM (SELECT id, row_number() OVER (ORDER BY start_date) AS rn FROM public.seasons) x
WHERE x.id = s.id AND s.season_number IS NULL;

ALTER TABLE public.seasons ALTER COLUMN end_date SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS seasons_one_active_idx ON public.seasons (is_active) WHERE is_active;

-- 2. season_points
CREATE TABLE IF NOT EXISTS public.season_points (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  total_points integer NOT NULL DEFAULT 0,
  current_streak_days integer NOT NULL DEFAULT 0,
  last_points_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, season_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.season_points TO authenticated;
GRANT ALL ON public.season_points TO service_role;
ALTER TABLE public.season_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own season points" ON public.season_points FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_season_points_updated_at BEFORE UPDATE ON public.season_points
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. season_points_log
CREATE TABLE IF NOT EXISTS public.season_points_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  date date NOT NULL,
  points_earned integer NOT NULL DEFAULT 0,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, season_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.season_points_log TO authenticated;
GRANT ALL ON public.season_points_log TO service_role;
ALTER TABLE public.season_points_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own season points log" ON public.season_points_log FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. season_history
CREATE TABLE IF NOT EXISTS public.season_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  final_points integer NOT NULL DEFAULT 0,
  final_rank text,
  final_placement_among_friends integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, season_id)
);
GRANT SELECT ON public.season_history TO authenticated;
GRANT ALL ON public.season_history TO service_role;
ALTER TABLE public.season_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own season history" ON public.season_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 5. user_seen_seasons
CREATE TABLE IF NOT EXISTS public.user_seen_seasons (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.seasons(id) ON DELETE CASCADE,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, season_id)
);
GRANT SELECT, INSERT, DELETE ON public.user_seen_seasons TO authenticated;
GRANT ALL ON public.user_seen_seasons TO service_role;
ALTER TABLE public.user_seen_seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own seen seasons select" ON public.user_seen_seasons FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "own seen seasons insert" ON public.user_seen_seasons FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own seen seasons delete" ON public.user_seen_seasons FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 6. Season-Rang aus Punkten (Skala für 70-Tage-Zeitraum)
CREATE OR REPLACE FUNCTION public.season_rank_key(_points integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _points >= 33000 THEN 'unreal_2'
    WHEN _points >= 30000 THEN 'unreal_1'
    WHEN _points >= 27500 THEN 'champion_3'
    WHEN _points >= 25500 THEN 'champion_2'
    WHEN _points >= 23500 THEN 'champion_1'
    WHEN _points >= 21500 THEN 'elite_3'
    WHEN _points >= 19500 THEN 'elite_2'
    WHEN _points >= 17500 THEN 'elite_1'
    WHEN _points >= 15600 THEN 'diamond_3'
    WHEN _points >= 13800 THEN 'diamond_2'
    WHEN _points >= 12100 THEN 'diamond_1'
    WHEN _points >= 10500 THEN 'platinum_3'
    WHEN _points >= 9000 THEN 'platinum_2'
    WHEN _points >= 7600 THEN 'platinum_1'
    WHEN _points >= 6300 THEN 'gold_3'
    WHEN _points >= 5100 THEN 'gold_2'
    WHEN _points >= 4000 THEN 'gold_1'
    WHEN _points >= 3000 THEN 'silver_3'
    WHEN _points >= 2100 THEN 'silver_2'
    WHEN _points >= 1300 THEN 'silver_1'
    WHEN _points >= 700 THEN 'bronze_3'
    WHEN _points >= 250 THEN 'bronze_2'
    ELSE 'bronze_1'
  END
$$;
REVOKE ALL ON FUNCTION public.season_rank_key(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.season_rank_key(integer) TO authenticated, service_role;

-- 7. Season-Wechsel: abgelaufene Season abschließen, Historie schreiben, neue Season starten
CREATE OR REPLACE FUNCTION public.ensure_current_season()
RETURNS TABLE(id uuid, name text, start_date date, end_date date, season_number integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

    -- Historie für alle Teilnehmer der ablaufenden Season
    INSERT INTO public.season_history (user_id, season_id, final_points, final_rank, final_placement_among_friends)
    SELECT sp.user_id, sp.season_id, sp.total_points,
           public.season_rank_key(sp.total_points),
           (
             SELECT 1 + COUNT(*)
             FROM public.season_points other
             JOIN public.friendships f
               ON (f.user_id_a = LEAST(sp.user_id, other.user_id)
               AND f.user_id_b = GREATEST(sp.user_id, other.user_id))
             WHERE other.season_id = sp.season_id
               AND other.user_id <> sp.user_id
               AND other.total_points > sp.total_points
           )
    FROM public.season_points sp
    WHERE sp.season_id = _s.id
    ON CONFLICT (user_id, season_id) DO NOTHING;

    UPDATE public.seasons SET is_active = false WHERE id = _s.id;

    INSERT INTO public.seasons (name, start_date, end_date, is_active, season_number)
    VALUES (
      'Season ' || (COALESCE((SELECT MAX(season_number) FROM public.seasons), 0) + 1),
      _s.end_date + 1, _s.end_date + 71, true,
      COALESCE((SELECT MAX(season_number) FROM public.seasons), 0) + 1
    )
    RETURNING * INTO _s;
  END LOOP;

  RETURN QUERY SELECT _s.id, _s.name, _s.start_date, _s.end_date, _s.season_number;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_current_season() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_current_season() TO authenticated, service_role;

-- 8. Freunde-Rangliste der laufenden Season
CREATE OR REPLACE FUNCTION public.get_friend_season_comparison(_season_id uuid)
RETURNS TABLE(user_id uuid, username text, avatar_url text, total_points integer, current_streak_days integer, is_self boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
         COALESCE(sp.total_points, 0)::integer,
         COALESCE(sp.current_streak_days, 0)::integer,
         p.self
  FROM people p
  LEFT JOIN public.user_profile pr ON pr.user_id = p.uid
  LEFT JOIN public.season_points sp ON sp.user_id = p.uid AND sp.season_id = _season_id
  WHERE p.self OR pr.username IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.get_friend_season_comparison(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_friend_season_comparison(uuid) TO authenticated, service_role;

-- 9. Freunde-Rangliste einer abgeschlossenen Season
CREATE OR REPLACE FUNCTION public.get_friend_season_history(_season_id uuid)
RETURNS TABLE(user_id uuid, username text, avatar_url text, final_points integer, final_rank text, is_self boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
         COALESCE(sh.final_points, 0)::integer,
         COALESCE(sh.final_rank, public.season_rank_key(0)),
         p.self
  FROM people p
  LEFT JOIN public.user_profile pr ON pr.user_id = p.uid
  LEFT JOIN public.season_history sh ON sh.user_id = p.uid AND sh.season_id = _season_id
  WHERE (p.self OR pr.username IS NOT NULL) AND sh.id IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.get_friend_season_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_friend_season_history(uuid) TO authenticated, service_role;

-- 10. Seasons für Angemeldete lesbar (falls noch nicht vorhanden)
GRANT SELECT ON public.seasons TO authenticated;
GRANT ALL ON public.seasons TO service_role;