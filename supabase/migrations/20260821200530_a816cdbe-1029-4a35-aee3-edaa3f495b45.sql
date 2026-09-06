ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS username text;

CREATE UNIQUE INDEX IF NOT EXISTS user_profile_username_unique
  ON public.user_profile (lower(username))
  WHERE username IS NOT NULL;

CREATE OR REPLACE FUNCTION public.is_username_available(_username text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_profile
    WHERE username IS NOT NULL
      AND lower(username) = lower(trim(_username))
      AND user_id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO authenticated;