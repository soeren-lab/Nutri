CREATE POLICY "ingredient-images published read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'ingredient-images'
  AND EXISTS (
    SELECT 1 FROM public.ingredients_master im
    WHERE im.image_url = storage.objects.name
      AND im.is_published = true
  )
);