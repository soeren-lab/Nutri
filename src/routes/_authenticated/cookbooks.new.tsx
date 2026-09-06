import { createFileRoute } from "@tanstack/react-router";
import { CookbookForm } from "@/components/CookbookForm";

export const Route = createFileRoute("/_authenticated/cookbooks/new")({
  component: NewCookbookPage,
});

function NewCookbookPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Neues Kochbuch</h1>
        <p className="text-sm text-muted-foreground">Erstelle eine Sammlung deiner Lieblingsrezepte.</p>
      </div>
      <CookbookForm />
    </div>
  );
}
