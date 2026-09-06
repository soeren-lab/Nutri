import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { cookbookQuery } from "@/lib/cookbooks";
import { CookbookForm } from "@/components/CookbookForm";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/cookbooks/$id/edit")({
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(cookbookQuery(params.id));
  },
  component: EditCookbookPage,
  pendingComponent: () => <Skeleton className="mx-auto h-96 max-w-2xl" />,
});

function EditCookbookPage() {
  const { id } = Route.useParams();
  const { data: cookbook } = useSuspenseQuery(cookbookQuery(id));
  useNavigate();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Kochbuch bearbeiten</h1>
      </div>
      <CookbookForm existing={cookbook} />
    </div>
  );
}
