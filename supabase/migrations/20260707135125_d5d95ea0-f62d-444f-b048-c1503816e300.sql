
CREATE POLICY "recipe-images auth read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'recipe-images');
CREATE POLICY "recipe-images owner insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recipe-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "recipe-images owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'recipe-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "recipe-images owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'recipe-images' AND auth.uid()::text = (storage.foldername(name))[1]);
