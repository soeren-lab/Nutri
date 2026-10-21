REVOKE ALL ON FUNCTION public.recipe_link_creates_cycle(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recipe_link_creates_cycle(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.recipe_link_creates_cycle(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recipe_link_creates_cycle(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.can_view_cookbook(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_view_cookbook(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_view_cookbook(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_cookbook(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.is_cookbook_member(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_cookbook_member(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_cookbook_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_cookbook_member(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.is_cookbook_owner(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_cookbook_owner(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_cookbook_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_cookbook_owner(uuid, uuid) TO service_role;
