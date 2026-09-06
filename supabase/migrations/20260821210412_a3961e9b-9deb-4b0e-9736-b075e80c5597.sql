CREATE OR REPLACE FUNCTION public.get_usernames(_user_ids uuid[])
RETURNS TABLE(user_id uuid, username text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT user_id, username
  FROM public.user_profile
  WHERE username IS NOT NULL
    AND user_id = ANY(_user_ids)
$$;

REVOKE ALL ON FUNCTION public.get_usernames(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_usernames(uuid[]) TO authenticated;