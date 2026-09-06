-- ============ friend_requests ============
CREATE TABLE public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT friend_requests_not_self CHECK (sender_id <> receiver_id),
  CONSTRAINT friend_requests_unique_pair UNIQUE (sender_id, receiver_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_requests TO authenticated;
GRANT ALL ON public.friend_requests TO service_role;
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Beteiligte sehen Anfragen"
  ON public.friend_requests FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Nutzer senden eigene Anfragen"
  ON public.friend_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND sender_id <> receiver_id);

CREATE POLICY "Empfaenger beantwortet Anfrage"
  ON public.friend_requests FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id OR auth.uid() = sender_id)
  WITH CHECK (auth.uid() = receiver_id OR auth.uid() = sender_id);

CREATE POLICY "Beteiligte loeschen Anfrage"
  ON public.friend_requests FOR DELETE TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE INDEX idx_friend_requests_receiver ON public.friend_requests (receiver_id, status);
CREATE INDEX idx_friend_requests_sender ON public.friend_requests (sender_id, status);

-- ============ friendships ============
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_ordered CHECK (user_id_a < user_id_b),
  CONSTRAINT friendships_unique UNIQUE (user_id_a, user_id_b)
);

GRANT SELECT, INSERT, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Beteiligte sehen Freundschaft"
  ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = user_id_a OR auth.uid() = user_id_b);

CREATE POLICY "Beteiligte beenden Freundschaft"
  ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() = user_id_a OR auth.uid() = user_id_b);

CREATE INDEX idx_friendships_a ON public.friendships (user_id_a);
CREATE INDEX idx_friendships_b ON public.friendships (user_id_b);

-- ============ Freundschafts-Helfer ============
CREATE OR REPLACE FUNCTION public.are_friends(_user_a uuid, _user_b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE user_id_a = LEAST(_user_a, _user_b)
      AND user_id_b = GREATEST(_user_a, _user_b)
  )
$$;

-- ============ shared_with_friends ============
CREATE TABLE public.shared_with_friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('recipe','ingredient')),
  content_id uuid NOT NULL,
  shared_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shared_with_friends_not_self CHECK (owner_user_id <> friend_user_id),
  CONSTRAINT shared_with_friends_unique UNIQUE (owner_user_id, friend_user_id, content_type, content_id)
);

GRANT SELECT, INSERT, DELETE ON public.shared_with_friends TO authenticated;
GRANT ALL ON public.shared_with_friends TO service_role;
ALTER TABLE public.shared_with_friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Beteiligte sehen Freigaben"
  ON public.shared_with_friends FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id OR auth.uid() = friend_user_id);

CREATE POLICY "Besitzer teilt mit Freunden"
  ON public.shared_with_friends FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_user_id
    AND public.are_friends(owner_user_id, friend_user_id)
  );

CREATE POLICY "Besitzer entfernt Freigabe"
  ON public.shared_with_friends FOR DELETE TO authenticated
  USING (auth.uid() = owner_user_id);

CREATE INDEX idx_shared_with_friends_friend ON public.shared_with_friends (friend_user_id, content_type);
CREATE INDEX idx_shared_with_friends_content ON public.shared_with_friends (content_type, content_id);

-- ============ Sichtbarkeit geteilter Inhalte ============
CREATE OR REPLACE FUNCTION public.is_shared_with_user(
  _content_type text,
  _content_id uuid,
  _user_id uuid
)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shared_with_friends
    WHERE content_type = _content_type
      AND content_id = _content_id
      AND friend_user_id = _user_id
  )
$$;

CREATE POLICY "Mit mir geteilte Rezepte sichtbar"
  ON public.recipes FOR SELECT TO authenticated
  USING (public.is_shared_with_user('recipe', id, auth.uid()));

CREATE POLICY "Mit mir geteilte Zutaten sichtbar"
  ON public.ingredients_master FOR SELECT TO authenticated
  USING (public.is_shared_with_user('ingredient', id, auth.uid()));

-- Zutatenlisten, Schritte und Komponenten geteilter Rezepte mitsichtbar machen
CREATE OR REPLACE FUNCTION public.can_view_recipe(_recipe_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.recipes r WHERE r.id = _recipe_id AND (r.user_id = _user_id OR r.is_published))
      OR public.is_shared_with_user('recipe', _recipe_id, _user_id)
      OR EXISTS (
        SELECT 1 FROM public.cookbook_recipes cr
        WHERE cr.recipe_id = _recipe_id
          AND public.can_view_cookbook(cr.cookbook_id, _user_id)
      )
$$;

-- ============ Nutzersuche ============
CREATE OR REPLACE FUNCTION public.search_users(_query text)
RETURNS TABLE(user_id uuid, username text, avatar_url text, total_points integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id,
         p.username,
         p.avatar_url,
         (COALESCE(up.total_points, 0) + COALESCE(up.bonus_points, 0))::integer
  FROM public.user_profile p
  LEFT JOIN public.user_points up ON up.user_id = p.user_id
  WHERE auth.uid() IS NOT NULL
    AND p.user_id <> auth.uid()
    AND p.username IS NOT NULL
    AND length(trim(_query)) >= 2
    AND p.username ILIKE '%' || trim(_query) || '%'
  ORDER BY p.username
  LIMIT 25
$$;

-- ============ Freundesliste & Anfragen mit Profildaten ============
CREATE OR REPLACE FUNCTION public.get_my_friends()
RETURNS TABLE(
  user_id uuid,
  username text,
  avatar_url text,
  total_points integer,
  current_streak_days integer,
  friends_since timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id,
         p.username,
         p.avatar_url,
         (COALESCE(up.total_points, 0) + COALESCE(up.bonus_points, 0))::integer,
         COALESCE(up.current_streak_days, 0)::integer,
         f.created_at
  FROM public.friendships f
  JOIN public.user_profile p
    ON p.user_id = CASE WHEN f.user_id_a = auth.uid() THEN f.user_id_b ELSE f.user_id_a END
  LEFT JOIN public.user_points up ON up.user_id = p.user_id
  WHERE auth.uid() IS NOT NULL
    AND (f.user_id_a = auth.uid() OR f.user_id_b = auth.uid())
  ORDER BY p.username
$$;

CREATE OR REPLACE FUNCTION public.get_friend_requests(_direction text)
RETURNS TABLE(
  request_id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  total_points integer,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT fr.id,
         p.user_id,
         p.username,
         p.avatar_url,
         (COALESCE(up.total_points, 0) + COALESCE(up.bonus_points, 0))::integer,
         fr.created_at
  FROM public.friend_requests fr
  JOIN public.user_profile p
    ON p.user_id = CASE WHEN _direction = 'incoming' THEN fr.sender_id ELSE fr.receiver_id END
  LEFT JOIN public.user_points up ON up.user_id = p.user_id
  WHERE auth.uid() IS NOT NULL
    AND fr.status = 'pending'
    AND (
      (_direction = 'incoming' AND fr.receiver_id = auth.uid())
      OR (_direction = 'outgoing' AND fr.sender_id = auth.uid())
    )
  ORDER BY fr.created_at DESC
$$;

-- ============ Anfrage annehmen / Freundschaft beenden ============
CREATE OR REPLACE FUNCTION public.accept_friend_request(_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sender uuid;
  _receiver uuid;
BEGIN
  SELECT sender_id, receiver_id INTO _sender, _receiver
  FROM public.friend_requests
  WHERE id = _request_id AND receiver_id = auth.uid() AND status = 'pending';

  IF _sender IS NULL THEN
    RAISE EXCEPTION 'Anfrage nicht gefunden';
  END IF;

  UPDATE public.friend_requests
  SET status = 'accepted', responded_at = now()
  WHERE id = _request_id;

  INSERT INTO public.friendships (user_id_a, user_id_b)
  VALUES (LEAST(_sender, _receiver), GREATEST(_sender, _receiver))
  ON CONFLICT (user_id_a, user_id_b) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.end_friendship(_other_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'Nicht angemeldet';
  END IF;

  DELETE FROM public.friendships
  WHERE user_id_a = LEAST(_me, _other_user_id)
    AND user_id_b = GREATEST(_me, _other_user_id);

  DELETE FROM public.shared_with_friends
  WHERE (owner_user_id = _me AND friend_user_id = _other_user_id)
     OR (owner_user_id = _other_user_id AND friend_user_id = _me);

  DELETE FROM public.friend_requests
  WHERE (sender_id = _me AND receiver_id = _other_user_id)
     OR (sender_id = _other_user_id AND receiver_id = _me);
END;
$$;

GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shared_with_user(text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_friends() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friend_requests(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_friendship(uuid) TO authenticated;