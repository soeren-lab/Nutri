REVOKE ALL ON FUNCTION public.is_username_available(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_username_available(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO authenticated;