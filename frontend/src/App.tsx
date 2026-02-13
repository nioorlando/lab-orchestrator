import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Editor from "@monaco-editor/react";
import yaml from "js-yaml";
import { toast } from "sonner";
import { listRecipes, getRecipe, createRecipe, updateRecipe, deleteRecipe, validateRecipe, generateProject, listGenerated, getGenerated } from "@/lib/api";
import type { Recipe, RecipeSummary, RecipeVariable, GeneratedRecord } from "@/types";
import { RecipeSchema } from "@/lib/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { Clipboard, Plus, RefreshCcw, Trash2, Wand2, FilePlus2, FileText } from "lucide-react";
import { Link } from "react-router-dom";

const defaultRecipe: Recipe = {
  id: "new-recipe",
  name: "New Recipe",
  description: "Describe what this lab provides.",
  tags: ["kafka"],
  difficulty: "easy",
  variables: [],
  composeTemplate: "version: '3.8'\nservices:\n  app:\n    image: busybox\n    command: ['sh', '-c', 'echo hello']\n",
  envTemplate: "# ENV vars\n",
  readmeTemplate: "# Lab Instructions\n\nRun with `docker compose up -d`.\n"
};

const stackTags = ["kafka", "nifi", "spark", "db", "k8s", "monitoring"]; // for filters

type RecipeErrors = Record<string, string>;

function useRecentGenerates() {
  const [items, setItems] = useState<GeneratedRecord[]>(() => {
    const raw = localStorage.getItem("lab-orchestrator.recent");
    return raw ? (JSON.parse(raw) as GeneratedRecord[]) : [];
  });

  const add = (record: GeneratedRecord) => {
    const updated = [record, ...items].slice(0, 10);
    setItems(updated);
    localStorage.setItem("lab-orchestrator.recent", JSON.stringify(updated));
  };

  return { items, add, setItems };
}

function highlightText(text: string, query: string) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const normalized = query.toLowerCase();
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, idx) =>
        part.toLowerCase() === normalized ? (
          <span key={idx} className="mark-highlight">
            {part}
          </span>
        ) : (
          <span key={idx}>{part}</span>
        )
      )}
    </span>
  );
}

function getRecipeErrors(recipe: Recipe): RecipeErrors {
  const result = RecipeSchema.safeParse(recipe);
  if (result.success) return {};
  const errors: RecipeErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path.join(".")] = issue.message;
  }
  return errors;
}

function CodeEditor({ value, language, onChange, height = 320 }: { value: string; language: string; onChange?: (value: string) => void; height?: number }) {
  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-sm">
      <Editor
        height={height}
        language={language}
        value={value}
        theme="vs-light"
        options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: "on" }}
        onChange={(val) => onChange?.(val ?? "")}
      />
    </div>
  );
}

function RecipeCard({ recipe, isActive, onSelect, query }: { recipe: RecipeSummary; isActive: boolean; onSelect: () => void; query: string }) {
  return (
    <button
      className={cn(
        "w-full rounded-xl border border-border bg-white p-3 text-left transition hover:shadow-panel",
        isActive && "border-ink shadow-panel"
      )}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{highlightText(recipe.name, query)}</div>
        {!recipe.valid && <Badge className="border-red-300 bg-red-50 text-red-700">Invalid</Badge>}
      </div>
      <div className="mt-1 text-xs text-ink/70">{highlightText(recipe.description, query)}</div>
      <div className="mt-2 flex flex-wrap gap-1">
        {recipe.tags.map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
        <Badge className="border-accent/40 bg-accent/10 text-accent">{recipe.difficulty}</Badge>
        {recipe.hasSeed && <Badge className="border-accent2/40 bg-accent2/10 text-accent2">seed</Badge>}
      </div>
    </button>
  );
}

function RecipeEditorDialog({
  open,
  onOpenChange,
  initialRecipe,
  onSave
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRecipe: Recipe;
  onSave: (recipe: Recipe) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Recipe>(initialRecipe);
  const [yamlText, setYamlText] = useState(() => yaml.dump(initialRecipe));
  const [yamlError, setYamlError] = useState<string | null>(null);
  const errors = useMemo(() => getRecipeErrors(draft), [draft]);

  React.useEffect(() => {
    setDraft(initialRecipe);
    setYamlText(yaml.dump(initialRecipe));
    setYamlError(null);
  }, [initialRecipe, open]);

  const updateField = (field: keyof Recipe, value: Recipe[keyof Recipe]) => {
    const updated = { ...draft, [field]: value } as Recipe;
    setDraft(updated);
    setYamlText(yaml.dump(updated));
  };

  const handleYamlChange = (value: string) => {
    setYamlText(value);
    try {
      const parsed = yaml.load(value);
      const result = RecipeSchema.safeParse(parsed);
      if (result.success) {
        setDraft(result.data);
        setYamlError(null);
      } else {
        setYamlError(result.error.issues[0]?.message ?? "Invalid YAML");
      }
    } catch (error) {
      setYamlError(error instanceof Error ? error.message : "Invalid YAML");
    }
  };

  const handleSave = async () => {
    const result = RecipeSchema.safeParse(draft);
    if (!result.success) {
      toast.error("Fix validation errors before saving.");
      return;
    }
    await onSave(result.data);
  };

  const addVariable = () => {
    updateField("variables", [
      ...draft.variables,
      {
        key: "NEW_VAR",
        label: "New Variable",
        default: "",
        required: false,
        secret: false,
        description: ""
      }
    ]);
  };

  const updateVariable = (index: number, patch: Partial<RecipeVariable>) => {
    const updated = draft.variables.map((variable, idx) => (idx === index ? { ...variable, ...patch } : variable));
    updateField("variables", updated);
  };

  const moveVariable = (index: number, direction: number) => {
    const next = [...draft.variables];
    const target = next[index];
    const swap = next[index + direction];
    if (!swap) return;
    next[index] = swap;
    next[index + direction] = target;
    updateField("variables", next);
  };

  const removeVariable = (index: number) => {
    updateField(
      "variables",
      draft.variables.filter((_, idx) => idx !== index)
    );
  };

  const updateFileList = (field: "seedFiles" | "extraFiles", index: number, patch: { path?: string; content?: string }) => {
    const list = [...(draft[field] ?? [])];
    list[index] = { ...list[index], ...patch };
    updateField(field, list);
  };

  const addFileEntry = (field: "seedFiles" | "extraFiles") => {
    updateField(field, [...(draft[field] ?? []), { path: "", content: "" }]);
  };

  const removeFileEntry = (field: "seedFiles" | "extraFiles", index: number) => {
    updateField(
      field,
      (draft[field] ?? []).filter((_, idx) => idx !== index)
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Recipe Builder</DialogTitle>
          <Button variant="outline" size="sm" onClick={handleSave}>
            Save Recipe
          </Button>
        </DialogHeader>
        <div className="mt-4 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <section className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase text-ink/60">ID</label>
                  <Input value={draft.id} onChange={(event) => updateField("id", event.target.value)} />
                  {errors["id"] && <p className="text-xs text-red-600">{errors["id"]}</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-ink/60">Name</label>
                  <Input value={draft.name} onChange={(event) => updateField("name", event.target.value)} />
                  {errors["name"] && <p className="text-xs text-red-600">{errors["name"]}</p>}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-ink/60">Description</label>
                <Textarea value={draft.description} onChange={(event) => updateField("description", event.target.value)} />
                {errors["description"] && <p className="text-xs text-red-600">{errors["description"]}</p>}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase text-ink/60">Tags (comma)</label>
                  <Input
                    value={draft.tags.join(", ")}
                    onChange={(event) => updateField("tags", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase text-ink/60">Difficulty</label>
                  <select
                    className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                    value={draft.difficulty}
                    onChange={(event) => updateField("difficulty", event.target.value as Recipe["difficulty"])}
                  >
                    <option value="easy">easy</option>
                    <option value="medium">medium</option>
                    <option value="hard">hard</option>
                  </select>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Variables</h3>
                <Button variant="outline" size="sm" onClick={addVariable}>
                  <Plus className="h-4 w-4" /> Add Variable
                </Button>
              </div>
              <div className="space-y-3">
                {draft.variables.map((variable, index) => (
                  <div key={index} className="rounded-lg border border-border bg-white/80 p-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      <Input value={variable.key} onChange={(event) => updateVariable(index, { key: event.target.value })} placeholder="KEY" />
                      <Input value={variable.label} onChange={(event) => updateVariable(index, { label: event.target.value })} placeholder="Label" />
                      <Input value={variable.default} onChange={(event) => updateVariable(index, { default: event.target.value })} placeholder="Default" />
                      <Input value={variable.description ?? ""} onChange={(event) => updateVariable(index, { description: event.target.value })} placeholder="Description" />
                      <Input
                        value={(variable.options ?? []).join(", ")}
                        onChange={(event) =>
                          updateVariable(index, {
                            options: event.target.value
                              .split(",")
                              .map((item) => item.trim())
                              .filter(Boolean)
                          })
                        }
                        placeholder="Options (comma)"
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                      <label className="flex items-center gap-2">
                        <Checkbox checked={variable.required} onCheckedChange={(value) => updateVariable(index, { required: Boolean(value) })} />
                        Required
                      </label>
                      <label className="flex items-center gap-2">
                        <Checkbox checked={variable.secret} onCheckedChange={(value) => updateVariable(index, { secret: Boolean(value) })} />
                        Secret
                      </label>
                      <div className="ml-auto flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => moveVariable(index, -1)}>
                          ↑
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => moveVariable(index, 1)}>
                          ↓
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => removeVariable(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <label className="text-sm font-semibold">Compose Template</label>
                <CodeEditor value={draft.composeTemplate} language="yaml" onChange={(value) => updateField("composeTemplate", value)} />
              </div>
              <div>
                <label className="text-sm font-semibold">Env Template</label>
                <CodeEditor value={draft.envTemplate} language="shell" height={200} onChange={(value) => updateField("envTemplate", value)} />
              </div>
              <div>
                <label className="text-sm font-semibold">README Template</label>
                <CodeEditor value={draft.readmeTemplate} language="markdown" height={240} onChange={(value) => updateField("readmeTemplate", value)} />
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Seed Files</h3>
                <Button variant="outline" size="sm" onClick={() => addFileEntry("seedFiles")}>
                  Add Seed File
                </Button>
              </div>
              {(draft.seedFiles ?? []).map((file, index) => (
                <div key={index} className="rounded-lg border border-border bg-white/80 p-3">
                  <Input value={file.path} onChange={(event) => updateFileList("seedFiles", index, { path: event.target.value })} placeholder="seed/path.sql" />
                  <div className="mt-2">
                    <CodeEditor
                      value={file.content}
                      language="sql"
                      height={160}
                      onChange={(value) => updateFileList("seedFiles", index, { content: value })}
                    />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button variant="danger" size="sm" onClick={() => removeFileEntry("seedFiles", index)}>
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  </div>
                </div>
              ))}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Extra Files</h3>
                <Button variant="outline" size="sm" onClick={() => addFileEntry("extraFiles")}>
                  Add Extra File
                </Button>
              </div>
              {(draft.extraFiles ?? []).map((file, index) => (
                <div key={index} className="rounded-lg border border-border bg-white/80 p-3">
                  <Input value={file.path} onChange={(event) => updateFileList("extraFiles", index, { path: event.target.value })} placeholder="config/file.yml" />
                  <div className="mt-2">
                    <CodeEditor
                      value={file.content}
                      language="yaml"
                      height={160}
                      onChange={(value) => updateFileList("extraFiles", index, { content: value })}
                    />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button variant="danger" size="sm" onClick={() => removeFileEntry("extraFiles", index)}>
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  </div>
                </div>
              ))}
            </section>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">YAML Editor</h3>
              {yamlError ? <Badge className="border-red-300 bg-red-50 text-red-700">{yamlError}</Badge> : <Badge>valid</Badge>}
            </div>
            <CodeEditor value={yamlText} language="yaml" height={640} onChange={handleYamlChange} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function App() {
  const queryClient = useQueryClient();
  const { data: recipes = [], refetch } = useQuery({ queryKey: ["recipes"], queryFn: listRecipes });
  const { data: generated = [] } = useQuery({ queryKey: ["generated"], queryFn: listGenerated });
  const recent = useRecentGenerates();

  const [search, setSearch] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<string>("all");
  const [hasSeed, setHasSeed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorRecipe, setEditorRecipe] = useState<Recipe>(defaultRecipe);
  const [importOpen, setImportOpen] = useState(false);
  const [importYaml, setImportYaml] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const filtered = useMemo(() => {
    return recipes.filter((recipe) => {
      if (search && !`${recipe.name} ${recipe.description}`.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (selectedTags.length && !selectedTags.every((tag) => recipe.tags.includes(tag))) {
        return false;
      }
      if (difficulty !== "all" && recipe.difficulty !== difficulty) {
        return false;
      }
      if (hasSeed && !recipe.hasSeed) {
        return false;
      }
      return true;
    });
  }, [recipes, search, selectedTags, difficulty, hasSeed]);

  const selectedRecipeSummary = recipes.find((recipe) => recipe.id === selectedId) ?? filtered[0];
  const selectedRecipeId = selectedRecipeSummary?.id ?? null;

  const { data: recipeDetail } = useQuery({
    queryKey: ["recipe", selectedRecipeId],
    queryFn: () => (selectedRecipeId ? getRecipe(selectedRecipeId) : Promise.resolve({})),
    enabled: !!selectedRecipeId
  });

  const recipe = recipeDetail?.recipe;
  const yamlText = recipeDetail?.yamlText ?? "";

  const createMutation = useMutation({
    mutationFn: (payload: { recipe: Recipe }) => createRecipe(payload),
    onSuccess: async () => {
      toast.success("Recipe created");
      await queryClient.invalidateQueries({ queryKey: ["recipes"] });
      setEditorOpen(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; recipe: Recipe }) => updateRecipe(payload.id, { recipe: payload.recipe }),
    onSuccess: async () => {
      toast.success("Recipe updated");
      await queryClient.invalidateQueries({ queryKey: ["recipes"] });
      await queryClient.invalidateQueries({ queryKey: ["recipe"] });
      setEditorOpen(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRecipe(id),
    onSuccess: async () => {
      toast.success("Recipe deleted");
      await queryClient.invalidateQueries({ queryKey: ["recipes"] });
      setSelectedId(null);
    }
  });

  const generateMutation = useMutation({
    mutationFn: (payload: { recipeId: string; projectName: string; variables: Record<string, string> }) => generateProject(payload),
    onSuccess: async (data, variables) => {
      toast.success("Project generated");
      recent.add({
        projectName: variables.projectName,
        recipeId: variables.recipeId,
        createdAt: new Date().toISOString(),
        path: data.project,
        variables: variables.variables
      });
      await queryClient.invalidateQueries({ queryKey: ["generated"] });
    }
  });

  const handleSaveRecipe = async (draft: Recipe) => {
    if (recipes.some((item) => item.id === draft.id) && draft.id !== editorRecipe.id) {
      toast.error("Recipe id already exists.");
      return;
    }
    if (recipes.some((item) => item.id === draft.id)) {
      await updateMutation.mutateAsync({ id: draft.id, recipe: draft });
    } else {
      await createMutation.mutateAsync({ recipe: draft });
    }
  };

  const handleImport = async () => {
    const result = await validateRecipe({ yamlText: importYaml });
    if (!result.ok || !result.recipe) {
      toast.error("Invalid YAML. Check errors.");
      return;
    }
    await createMutation.mutateAsync({ recipe: result.recipe });
    setImportOpen(false);
    setImportYaml("");
  };

  return (
    <div className="min-h-screen bg-fog bg-hero-grid">
      <div className="mx-auto flex max-w-[1600px] gap-6 px-6 py-8">
        <aside className="w-[320px] shrink-0 space-y-4">
          <div className="rounded-2xl border border-border bg-white/90 p-4 shadow-panel">
            <div className="flex items-center justify-between">
              <h1 className="font-display text-xl font-semibold">Lab Orchestrator</h1>
              <div className="flex items-center gap-2">
                <Link to="/compare">
                  <Button variant="outline" size="sm">Compare</Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => refetch()}>
                  <RefreshCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-ink/70">Catalog and generate docker-compose labs from YAML recipes.</p>
            <div className="mt-4 space-y-2">
              <Input placeholder="Search recipes" value={search} onChange={(event) => setSearch(event.target.value)} />
              <div className="flex flex-wrap gap-2">
                {stackTags.map((tag) => (
                  <button
                    key={tag}
                    className={cn(
                      "rounded-full border border-border px-2 py-1 text-xs",
                      selectedTags.includes(tag) ? "bg-ink text-white" : "bg-white"
                    )}
                    onClick={() =>
                      setSelectedTags((prev) =>
                        prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
                      )
                    }
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <label className="text-ink/70">Difficulty</label>
                <select
                  className="h-9 flex-1 rounded-md border border-border bg-white px-2"
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value)}
                >
                  <option value="all">all</option>
                  <option value="easy">easy</option>
                  <option value="medium">medium</option>
                  <option value="hard">hard</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-ink/70">
                <Checkbox checked={hasSeed} onCheckedChange={(value) => setHasSeed(Boolean(value))} />
                Has seed files
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="accent" size="sm" onClick={() => {
                setEditorRecipe(defaultRecipe);
                setEditorOpen(true);
              }}>
                <Plus className="h-4 w-4" /> New Recipe
              </Button>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <FilePlus2 className="h-4 w-4" /> Import YAML
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white/90 p-3 shadow-panel">
            <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-2 scrollbar-thin">
              {filtered.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  isActive={recipe.id === selectedRecipeId}
                  query={search}
                  onSelect={() => setSelectedId(recipe.id)}
                />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white/90 p-4 shadow-panel">
            <h2 className="text-sm font-semibold">Recent Generates</h2>
            <div className="mt-2 space-y-2 text-xs text-ink/70">
              {[...recent.items, ...generated.filter((record) => !recent.items.find((item) => item.projectName === record.projectName))]
                .slice(0, 10)
                .map((record) => (
                  <div key={record.projectName} className="rounded-md border border-border bg-white px-2 py-1">
                    <div className="font-semibold text-ink">{record.projectName}</div>
                    <div>{record.recipeId}</div>
                  </div>
                ))}
            </div>
          </div>
        </aside>

        <main className="flex-1">
          <div className="rounded-3xl border border-border bg-white/95 p-6 shadow-panel">
            {recipe ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-2xl font-semibold">{recipe.name}</h2>
                    <p className="mt-1 text-sm text-ink/70">{recipe.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {recipe.tags.map((tag) => (
                        <Badge key={tag}>{tag}</Badge>
                      ))}
                      <Badge className="border-accent/40 bg-accent/10 text-accent">{recipe.difficulty}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditorRecipe(recipe);
                        setEditorOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button variant="outline" onClick={() => navigator.clipboard.writeText(yamlText).then(() => toast.success("YAML copied"))}>
                      <Clipboard className="h-4 w-4" /> Export YAML
                    </Button>
                    <Button variant="danger" onClick={() => deleteMutation.mutate(recipe.id)}>
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
                  <TabsList>
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="compose">Compose Template</TabsTrigger>
                    <TabsTrigger value="variables">Variables</TabsTrigger>
                    <TabsTrigger value="generate">Generate</TabsTrigger>
                    <TabsTrigger value="files">Files</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-border bg-white p-4">
                        <h3 className="text-sm font-semibold">Metadata</h3>
                        <div className="mt-2 text-sm text-ink/70">
                          <div>ID: {recipe.id}</div>
                          <div>Difficulty: {recipe.difficulty}</div>
                          <div>Variables: {recipe.variables.length}</div>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border bg-white p-4">
                        <h3 className="text-sm font-semibold">Validation</h3>
                        <p className="mt-2 text-sm text-ink/70">{recipeDetail?.errors?.length ? "Errors found" : "Recipe valid"}</p>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="compose">
                    <CodeEditor value={recipe.composeTemplate} language="yaml" height={420} />
                  </TabsContent>

                  <TabsContent value="variables">
                    <div className="grid gap-4 md:grid-cols-2">
                      {recipe.variables.map((variable) => (
                        <div key={variable.key} className="rounded-xl border border-border bg-white p-3">
                          <div className="text-sm font-semibold">{variable.key}</div>
                          <div className="text-xs text-ink/70">{variable.label}</div>
                          <div className="mt-2 text-xs">Default: {variable.default}</div>
                          {variable.required && <Badge className="mt-2">required</Badge>}
                          {variable.secret && <Badge className="mt-2 border-red-200 bg-red-50 text-red-700">secret</Badge>}
                        </div>
                      ))}
                    </div>
                  </TabsContent>

                  <TabsContent value="generate">
                    <GeneratePanel recipe={recipe} onGenerate={generateMutation.mutateAsync} />
                  </TabsContent>

                  <TabsContent value="files">
                    <GeneratedFiles recipeId={recipe.id} />
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <div className="rounded-xl border border-border bg-white p-6 text-sm text-ink/70">Select a recipe to begin.</div>
            )}
          </div>
        </main>
      </div>

      <RecipeEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initialRecipe={editorRecipe}
        onSave={handleSaveRecipe}
      />

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Recipe YAML</DialogTitle>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <CodeEditor value={importYaml} language="yaml" height={320} onChange={setImportYaml} />
            <Button variant="accent" onClick={handleImport}>
              Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GeneratePanel({ recipe, onGenerate }: { recipe: Recipe; onGenerate: (payload: { recipeId: string; projectName: string; variables: Record<string, string> }) => Promise<unknown> }) {
  const [projectName, setProjectName] = useState(`demo-${recipe.id}`);
  const [vars, setVars] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    for (const variable of recipe.variables) {
      defaults[variable.key] = variable.default;
    }
    return defaults;
  });
  const [preview, setPreview] = useState<{ compose: string; env: string; readme: string } | null>(null);

  React.useEffect(() => {
    const defaults: Record<string, string> = {};
    for (const variable of recipe.variables) {
      defaults[variable.key] = variable.default;
    }
    setVars(defaults);
    setProjectName(`demo-${recipe.id}`);
  }, [recipe.id]);

  const namePattern = /^[a-z0-9][a-z0-9-]*$/;
  const isProjectNameValid = namePattern.test(projectName);

  const missing = recipe.variables.filter((variable) => variable.required && !vars[variable.key]);

  const handlePreview = async () => {
    const rendered = await validateRecipe({ recipe: {
      ...recipe,
      composeTemplate: recipe.composeTemplate,
      envTemplate: recipe.envTemplate,
      readmeTemplate: recipe.readmeTemplate
    }});
    if (!rendered.ok) {
      toast.error("Recipe invalid. Fix before preview.");
      return;
    }
    const context = { projectName, ...vars };
    const render = (template: string) => template.replace(/{{\s*([A-Za-z0-9_]+)\s*}}/g, (_, key) => context[key] ?? "");
    setPreview({
      compose: render(recipe.composeTemplate),
      env: render(recipe.envTemplate),
      readme: render(recipe.readmeTemplate)
    });
  };

  const handleGenerate = async () => {
    if (!isProjectNameValid) {
      toast.error("Project name must be lowercase letters, numbers, and hyphens.");
      return;
    }
    if (missing.length) {
      toast.error("Missing required variables.");
      return;
    }
    await onGenerate({ recipeId: recipe.id, projectName, variables: vars });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
        <div className="rounded-2xl border border-border bg-white p-4">
          <h3 className="text-sm font-semibold">Generate Project</h3>
          <div className="mt-3 space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase text-ink/60">Project Name</label>
              <Input
                value={projectName}
                onChange={(event) => {
                  const raw = event.target.value;
                  const cleaned = raw.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/--+/g, "-");
                  setProjectName(cleaned);
                }}
              />
              {!isProjectNameValid && (
                <p className="text-xs text-red-600">Use lowercase letters, numbers, and hyphens only.</p>
              )}
            </div>
            <div className="grid gap-3">
              {recipe.variables.map((variable) => (
                <div key={variable.key}>
                  <label className="text-xs font-semibold uppercase text-ink/60">{variable.key}</label>
                  {variable.options && variable.options.length ? (
                    <select
                      className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                      value={vars[variable.key] ?? variable.default}
                      onChange={(event) => setVars((prev) => ({ ...prev, [variable.key]: event.target.value }))}
                    >
                      {variable.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      value={vars[variable.key] ?? ""}
                      onChange={(event) => setVars((prev) => ({ ...prev, [variable.key]: event.target.value }))}
                      placeholder={variable.label}
                    />
                  )}
                  {variable.required && !vars[variable.key] && <p className="text-xs text-red-600">Required</p>}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handlePreview}>
                <Wand2 className="h-4 w-4" /> Preview
              </Button>
              <Button variant="accent" onClick={handleGenerate}>
                Generate
              </Button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-white p-4">
          <h3 className="text-sm font-semibold">Preview</h3>
          {preview ? (
            <div className="mt-3 space-y-3">
              <div>
                <div className="text-xs font-semibold uppercase text-ink/60">docker-compose.yml</div>
                <CodeEditor value={preview.compose} language="yaml" height={160} />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-ink/60">.env</div>
                <CodeEditor value={preview.env} language="shell" height={120} />
              </div>
              <div>
                <div className="text-xs font-semibold uppercase text-ink/60">README.md</div>
                <CodeEditor value={preview.readme} language="markdown" height={160} />
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink/60">Generate a preview to inspect files before writing.</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-4">
        <h3 className="text-sm font-semibold">Run Commands</h3>
        <div className="mt-2 rounded-lg bg-ink/90 px-4 py-3 text-xs text-white">
          <code>cd generated/{projectName} && docker compose up -d</code>
        </div>
        <Button
          className="mt-3"
          variant="outline"
          onClick={() =>
            navigator.clipboard
              .writeText(`cd generated/${projectName} && docker compose up -d`)
              .then(() => toast.success("Run command copied"))
          }
        >
          <Clipboard className="h-4 w-4" /> Copy run commands
        </Button>
      </div>
    </div>
  );
}

function GeneratedFiles({ recipeId }: { recipeId: string }) {
  const { data: generated = [] } = useQuery({ queryKey: ["generated"], queryFn: listGenerated });
  const matching = generated.filter((item) => item.recipeId === recipeId);
  const latest = matching[0];
  const { data } = useQuery({
    queryKey: ["generated", latest?.projectName],
    queryFn: () => (latest ? getGenerated(latest.projectName) : Promise.resolve(null)),
    enabled: !!latest
  });

  if (!latest) {
    return <div className="rounded-xl border border-border bg-white p-4 text-sm text-ink/70">No generated projects yet.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-white p-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <div>
            <div className="text-sm font-semibold">{latest.projectName}</div>
            <div className="text-xs text-ink/60">{latest.createdAt}</div>
          </div>
        </div>
      </div>
      {data?.files ? (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase text-ink/60">docker-compose.yml</div>
            <CodeEditor value={data.files.compose} language="yaml" height={240} />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-ink/60">.env</div>
            <CodeEditor value={data.files.env} language="shell" height={160} />
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase text-ink/60">README.md</div>
              <CodeEditor value={data.files.readme} language="markdown" height={240} />
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-white p-4 text-sm text-ink/70">No file preview available.</div>
      )}
    </div>
  );
}

export default App;
