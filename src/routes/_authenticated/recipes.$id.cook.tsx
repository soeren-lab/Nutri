import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { recipeQuery } from "@/lib/recipes";
import { CookModeView } from "@/components/CookModeView";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/recipes/$id/cook")({
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(recipeQuery(params.id));
  },
  component: CookPage,
  pendingComponent: () => (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <Skeleton className="h-32 w-64" />
    </div>
  ),
  head: () => ({
    meta: [{ title: "Kochmodus" }, { name: "robots", content: "noindex" }],
  }),
});

function CookPage() {
  const { id } = Route.useParams();
  const { data: recipe } = useSuspenseQuery(recipeQuery(id));
  return <CookModeView recipe={recipe} />;
}
