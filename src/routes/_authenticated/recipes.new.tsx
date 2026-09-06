import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RecipeForm } from "@/components/RecipeForm";

export const Route = createFileRoute("/_authenticated/recipes/new")({
  component: NewRecipePage,
});

function NewRecipePage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Neues Rezept</h1>
        <p className="text-sm text-muted-foreground">Fülle die Felder aus, um dein Rezept zu speichern.</p>
      </div>
      <RecipeForm onDone={(id) => navigate({ to: "/recipes/$id", params: { id } })} />
    </div>
  );
}
