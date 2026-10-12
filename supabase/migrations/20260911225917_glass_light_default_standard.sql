-- Liquid Glass (Variante "Hell") wird der verpflichtende Standard-Look für
-- alle Accounts. Der klassische Hell/Dunkel/System-Modus wird mit tot-
-- geschaltet (siehe use-theme.ts) und zur Sicherheit ebenfalls auf 'light'
-- gezwungen, falls der Glass-Look aus irgendeinem Grund mal nicht greift.
ALTER TABLE public.user_profile
  ALTER COLUMN experimental_glass_ui SET DEFAULT true;
ALTER TABLE public.user_profile
  ALTER COLUMN experimental_glass_variant SET DEFAULT 'light';
ALTER TABLE public.user_profile
  ALTER COLUMN theme_preference SET DEFAULT 'light';

UPDATE public.user_profile
  SET experimental_glass_ui = true,
      experimental_glass_variant = 'light',
      theme_preference = 'light';
