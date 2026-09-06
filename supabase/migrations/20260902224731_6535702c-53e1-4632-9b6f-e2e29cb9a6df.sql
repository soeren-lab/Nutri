ALTER TABLE public.friend_requests ADD COLUMN IF NOT EXISTS sender_seen_at timestamptz;

CREATE POLICY "Absender markiert Annahme gesehen"
ON public.friend_requests FOR UPDATE TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS dismissed_source_updated_at timestamptz;

ALTER TABLE public.ingredients_master
  ADD COLUMN IF NOT EXISTS source_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS dismissed_source_updated_at timestamptz;