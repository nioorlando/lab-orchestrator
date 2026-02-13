import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { listRecipes, getRecipe } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Recipe } from "@/types";

export default function ComparePage() {
  const { data: recipes = [] } = useQuery({ queryKey: ["recipes"], queryFn: listRecipes });
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filtered = useMemo(() => {
    if (!query) return recipes;
    const q = query.toLowerCase();
    return recipes.filter((recipe) => `${recipe.name} ${recipe.description} ${recipe.tags.join(" ")}`.toLowerCase().includes(q));
  }, [recipes, query]);

  const selections = useQuery({
    queryKey: ["compare", selectedIds],
    queryFn: async () => {
      const results = await Promise.all(selectedIds.map((id) => getRecipe(id)));
      return results.map((result) => result.recipe).filter(Boolean) as Recipe[];
    },
    enabled: selectedIds.length > 0
  });

  const toggle = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const selected = selections.data ?? [];

  return (
    <div className="min-h-screen bg-fog bg-hero-grid">
      <div className="mx-auto flex max-w-[1500px] gap-6 px-6 py-8">
        <aside className="w-[320px] shrink-0 space-y-4">
          <div className="rounded-2xl border border-border bg-white/90 p-4 shadow-panel">
            <div className="flex items-center justify-between">
              <h1 className="font-display text-xl font-semibold">Recipe Compare</h1>
              <Link to="/">
                <Button variant="outline" size="sm">Catalog</Button>
              </Link>
            </div>
            <p className="mt-2 text-xs text-ink/70">Pilih beberapa recipe untuk dibandingkan side-by-side.</p>
            <div className="mt-3">
              <Input placeholder="Search recipes" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white/90 p-3 shadow-panel">
            <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-2 scrollbar-thin">
              {filtered.map((recipe) => {
                const active = selectedIds.includes(recipe.id);
                return (
                  <button
                    key={recipe.id}
                    className={cn(
                      "w-full rounded-xl border border-border bg-white p-3 text-left transition hover:shadow-panel",
                      active && "border-ink shadow-panel"
                    )}
                    onClick={() => toggle(recipe.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">{recipe.name}</div>
                      {active && <Badge className="border-accent/40 bg-accent/10 text-accent">Selected</Badge>}
                    </div>
                    <div className="mt-1 text-xs text-ink/70">{recipe.description}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {recipe.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag}>{tag}</Badge>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="flex-1">
          <div className="rounded-3xl border border-border bg-white/95 p-6 shadow-panel">
            {selected.length === 0 ? (
              <div className="rounded-xl border border-border bg-white p-6 text-sm text-ink/70">
                Pilih recipe dari sidebar untuk dibandingkan.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${selected.length}, minmax(0,1fr))` }}>
                  {selected.map((recipe) => (
                    <div key={recipe.id} className="rounded-2xl border border-border bg-white p-4">
                      <div className="text-lg font-semibold">{recipe.name}</div>
                      <div className="mt-1 text-xs text-ink/70">{recipe.description}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {recipe.tags.map((tag) => (
                          <Badge key={tag}>{tag}</Badge>
                        ))}
                        <Badge className="border-accent/40 bg-accent/10 text-accent">{recipe.difficulty}</Badge>
                      </div>
                      <div className="mt-3 text-xs text-ink/60">ID: {recipe.id}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-border bg-white p-4">
                  <h2 className="text-sm font-semibold">Variables</h2>
                  <div className="mt-4 grid gap-4" style={{ gridTemplateColumns: `repeat(${selected.length}, minmax(0,1fr))` }}>
                    {selected.map((recipe) => (
                      <div key={recipe.id} className="space-y-2">
                        {recipe.variables.map((variable) => (
                          <div key={variable.key} className="rounded-lg border border-border bg-white/80 p-3">
                            <div className="text-sm font-semibold">{variable.key}</div>
                            <div className="text-xs text-ink/70">{variable.label}</div>
                            <div className="mt-1 text-xs">Default: {variable.default}</div>
                            {variable.options && variable.options.length > 0 && (
                              <div className="mt-1 text-xs text-ink/60">Options: {variable.options.join(", ")}</div>
                            )}
                            {variable.secret && <Badge className="mt-2 border-red-200 bg-red-50 text-red-700">secret</Badge>}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-white p-4">
                  <h2 className="text-sm font-semibold">Templates</h2>
                  <div className="mt-4 grid gap-4" style={{ gridTemplateColumns: `repeat(${selected.length}, minmax(0,1fr))` }}>
                    {selected.map((recipe) => (
                      <div key={recipe.id} className="rounded-lg border border-border bg-white/80 p-3 text-xs text-ink/70">
                        <div>Compose length: {recipe.composeTemplate.length} chars</div>
                        <div>Env length: {recipe.envTemplate.length} chars</div>
                        <div>README length: {recipe.readmeTemplate.length} chars</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
