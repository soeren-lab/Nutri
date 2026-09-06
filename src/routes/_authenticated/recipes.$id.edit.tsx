import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { recipeQuery } from "@/lib/recipes";
import { RecipeForm } from "@/components/RecipeForm";

export const Route = createFileRoute("/_authenticated/recipes/$id/edit")({
  loader: ({ context, params }) => {
    context.queryClient.ensureQueryData(recipeQuery(params.id));
  },
  component: EditRecipePage,
});

function EditRecipePage() {
  const { id } = Route.useParams();
  const { data: recipe } = useSuspenseQuery(recipeQuery(id));
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Rezept bearbeiten</h1>
      </div>
      <RecipeForm
        existing={recipe}
        onDone={(rid) => navigate({ to: "/recipes/$id", params: { id: rid } })}
      />
    </div>
  );
}
