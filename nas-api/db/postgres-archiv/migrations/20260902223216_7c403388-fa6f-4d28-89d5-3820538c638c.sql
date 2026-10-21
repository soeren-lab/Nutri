REVOKE ALL ON FUNCTION public.are_friends(uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.is_shared_with_user(text, uuid, uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.search_users(text) FROM anon, public;
REVOKE ALL ON FUNCTION public.get_my_friends() FROM anon, public;
REVOKE ALL ON FUNCTION public.get_friend_requests(text) FROM anon, public;
REVOKE ALL ON FUNCTION public.accept_friend_request(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.end_friendship(uuid) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shared_with_user(text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_friends() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friend_requests(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_friendship(uuid) TO authenticated;