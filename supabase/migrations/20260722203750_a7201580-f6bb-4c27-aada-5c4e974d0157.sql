ALTER TABLE public.ingredients_master
ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS ingredients_master_archived_idx
ON public.ingredients_master (user_id, archived);