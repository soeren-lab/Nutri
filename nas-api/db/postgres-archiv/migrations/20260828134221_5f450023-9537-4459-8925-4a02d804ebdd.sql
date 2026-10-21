CREATE TABLE public.shopping_list_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ingredient_master_id uuid REFERENCES public.ingredients_master(id) ON DELETE SET NULL,
  name text NOT NULL,
  amount numeric,
  unit text,
  category text NOT NULL DEFAULT 'Sonstiges',
  is_checked boolean NOT NULL DEFAULT false,
  is_manual boolean NOT NULL DEFAULT false,
  source_recipe_ids text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shopping_list_items TO authenticated;
GRANT ALL ON public.shopping_list_items TO service_role;

ALTER TABLE public.shopping_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own shopping list items"
ON public.shopping_list_items FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX shopping_list_items_user_idx ON public.shopping_list_items (user_id, category, is_checked);

CREATE TRIGGER update_shopping_list_items_updated_at
BEFORE UPDATE ON public.shopping_list_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();