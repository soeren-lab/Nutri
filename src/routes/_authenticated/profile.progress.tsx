import { createFileRoute, redirect } from "@tanstack/react-router";

/** Fortschritt ist jetzt ein Sub-Tab auf /profile. */
export const Route = createFileRoute("/_authenticated/profile/progress")({
  beforeLoad: () => {
    throw redirect({ to: "/profile", search: { tab: "progress" } });
  },
  component: () => null,
});
