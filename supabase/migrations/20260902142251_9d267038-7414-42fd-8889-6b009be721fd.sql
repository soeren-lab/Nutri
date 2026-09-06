CREATE OR REPLACE FUNCTION public.get_public_profile(_username text)
 RETURNS TABLE(user_id uuid, username text, avatar_url text, total_points integer, current_streak_days integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.user_id,
         p.username,
         p.avatar_url,
         (COALESCE(up.total_points, 0) + COALESCE(up.bonus_points, 0))::integer,
         COALESCE(up.current_streak_days, 0)::integer
  FROM public.user_profile p
  LEFT JOIN public.user_points up ON up.user_id = p.user_id
  WHERE p.username IS NOT NULL
    AND lower(p.username) = lower(trim(_username))
    AND auth.uid() IS NOT NULL
  LIMIT 1
$function$;