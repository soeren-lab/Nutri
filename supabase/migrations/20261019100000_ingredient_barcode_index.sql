-- Schneller Barcode-Abgleich beim Scan (Duplikat-Prüfung pro User).
create index if not exists ingredients_master_user_barcode_idx
  on public.ingredients_master (user_id, source_barcode)
  where source_barcode is not null;
