
REVOKE EXECUTE ON FUNCTION public.is_cookbook_owner(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_cookbook_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_cookbook(uuid, uuid) FROM PUBLIC, anon;
