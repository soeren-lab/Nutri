
ALTER TABLE public.ingredients_master
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS image_url text;

-- Storage policies for ingredient-images (user-scoped by folder = user_id)
CREATE POLICY "ingredient-images own read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ingredient-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ingredient-images own insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ingredient-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ingredient-images own update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'ingredient-images' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'ingredient-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ingredient-images own delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ingredient-images' AND (storage.foldername(name))[1] = auth.uid()::text);
