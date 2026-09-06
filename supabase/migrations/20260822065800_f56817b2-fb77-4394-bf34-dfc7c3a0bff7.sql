ALTER TABLE public.user_profile ADD COLUMN IF NOT EXISTS avatar_url text;

DROP POLICY IF EXISTS "Avatars readable by authenticated" ON storage.objects;
CREATE POLICY "Avatars readable by authenticated" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.get_user_avatars(_user_ids uuid[])
RETURNS TABLE (user_id uuid, username text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.username, p.avatar_url
  FROM public.user_profile p
  WHERE p.user_id = ANY(_user_ids)
    AND p.username IS NOT NULL
$$;

GRANT EXECUTE ON FUNCTION public.get_user_avatars(uuid[]) TO authenticated;