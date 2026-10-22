import { createFileRoute, redirect } from "@tanstack/react-router";

// Der Einkauf ist jetzt ein Unter-Tab des Kühlschranks (alte Links und Lesezeichen führen dorthin).
export const Route = createFileRoute("/_authenticated/shopping-list")({
  beforeLoad: () => {
    throw redirect({ to: "/fridge", search: { tab: "shopping" }, replace: true });
  },
});
