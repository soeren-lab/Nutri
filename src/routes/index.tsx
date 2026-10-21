import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { db } = await import("@/integrations/db/client");
    const { data } = await db.auth.getSession();
    if (data.session) throw redirect({ to: "/recipes" });
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
