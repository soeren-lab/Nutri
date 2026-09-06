DO $migration$
DECLARE
  _season_id uuid;
BEGIN
  SELECT id INTO _season_id
  FROM public.seasons
  WHERE is_active
  ORDER BY start_date DESC
  LIMIT 1;

  IF _season_id IS NULL THEN
    RAISE EXCEPTION 'Keine aktive Season gefunden';
  END IF;

  -- Die parallelen Season-Logs enthalten bereits die mit 90/75/45/45/45
  -- berechneten Basispunkte. Pro Tag werden nur Basis und Perfect-Day-Bonus
  -- ersetzt; Streak, Nachtrag und Meilenstein bleiben aus points_log erhalten.
  UPDATE public.points_log pl
  SET breakdown = jsonb_set(
                    jsonb_set(
                      pl.breakdown,
                      '{base_points}',
                      to_jsonb((spl.breakdown->>'base_points')::integer),
                      true
                    ),
                    '{bonus_points}',
                    to_jsonb(COALESCE((spl.breakdown->>'bonus_points')::integer, 0)),
                    true
                  ),
      points_earned = (
        ROUND(
          (
            (spl.breakdown->>'base_points')::numeric
            + COALESCE((spl.breakdown->>'bonus_points')::numeric, 0)
          )
          * COALESCE((pl.breakdown->>'multiplier')::numeric, 1)
          * COALESCE((pl.breakdown->>'late_factor')::numeric, 1)
        )
        + COALESCE((pl.breakdown->>'milestone_bonus')::numeric, 0)
      )::integer,
      points_multiplier_applied = ROUND(
        COALESCE((pl.breakdown->>'multiplier')::numeric, 1)
        * COALESCE((pl.breakdown->>'late_factor')::numeric, 1),
        2
      )
  FROM public.season_points_log spl
  WHERE pl.user_id = spl.user_id
    AND pl.season_id = spl.season_id
    AND pl.date = spl.date
    AND pl.season_id = _season_id;

  -- Der kanonische Season-Stand ist die Summe des korrigierten points_log.
  UPDATE public.user_points up
  SET total_points = totals.total_points,
      current_season_id = _season_id,
      updated_at = now()
  FROM (
    SELECT user_id, COALESCE(SUM(points_earned), 0)::integer AS total_points
    FROM public.points_log
    WHERE season_id = _season_id
    GROUP BY user_id
  ) totals
  WHERE up.user_id = totals.user_id;
END
$migration$;