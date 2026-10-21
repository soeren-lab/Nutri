import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { db } from "@/integrations/db/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = db.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    db.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return { session, user: session?.user ?? null as User | null, loading };
}
