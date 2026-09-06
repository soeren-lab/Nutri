REVOKE EXECUTE ON FUNCTION public.get_user_avatars(uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_avatars(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_avatars(uuid[]) TO authenticated;