import fs from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";
import { paths } from "./paths";
import { Recipe, RecipeSchema } from "./schema";

export type RecipeSummary = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  difficulty: Recipe["difficulty"];
  hasSeed: boolean;
  valid: boolean;
  errors?: string[];
};

const recipeFilePath = (id: string) => path.join(paths.recipesDir, `${id}.yml`);

export async function ensureDirectories() {
  await fs.mkdir(paths.recipesDir, { recursive: true });
  await fs.mkdir(paths.historyDir, { recursive: true });
  await fs.mkdir(paths.generatedDir, { recursive: true });
  try {
    await fs.access(paths.generatedIndex);
  } catch {
    await fs.writeFile(paths.generatedIndex, JSON.stringify([], null, 2), "utf-8");
  }
}

export async function listRecipeFiles(): Promise<string[]> {
  const entries = await fs.readdir(paths.recipesDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".yml"))
    .map((entry) => entry.name);
}

export async function loadRecipeFromFile(fileName: string): Promise<Recipe> {
  const filePath = path.join(paths.recipesDir, fileName);
  const raw = await fs.readFile(filePath, "utf-8");
  const parsed = yaml.load(raw);
  return RecipeSchema.parse(parsed);
}

export async function getRecipeById(id: string): Promise<{ recipe?: Recipe; yamlText?: string; errors?: string[] }>{
  const filePath = recipeFilePath(id);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = yaml.load(raw);
    const result = RecipeSchema.safeParse(parsed);
    if (!result.success) {
      return { yamlText: raw, errors: result.error.issues.map((issue) => issue.message) };
    }
    return { recipe: result.data, yamlText: raw };
  } catch {
    return { errors: [`Recipe '${id}' not found`] };
  }
}

export async function listRecipes(): Promise<RecipeSummary[]> {
  const files = await listRecipeFiles();
  const summaries: RecipeSummary[] = [];
  for (const file of files) {
    try {
      const raw = await fs.readFile(path.join(paths.recipesDir, file), "utf-8");
      const parsed = yaml.load(raw);
      const result = RecipeSchema.safeParse(parsed);
      if (result.success) {
        summaries.push({
          id: result.data.id,
          name: result.data.name,
          description: result.data.description,
          tags: result.data.tags,
          difficulty: result.data.difficulty,
          hasSeed: (result.data.seedFiles ?? []).length > 0,
          valid: true
        });
      } else {
        summaries.push({
          id: file.replace(/\.yml$/, ""),
          name: file,
          description: "Invalid recipe",
          tags: [],
          difficulty: "easy",
          hasSeed: false,
          valid: false,
          errors: result.error.issues.map((issue) => issue.message)
        });
      }
    } catch (error) {
      summaries.push({
        id: file.replace(/\.yml$/, ""),
        name: file,
        description: "Failed to read recipe",
        tags: [],
        difficulty: "easy",
        hasSeed: false,
        valid: false,
        errors: [error instanceof Error ? error.message : "Unknown error"]
      });
    }
  }
  return summaries.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveRecipe(recipe: Recipe): Promise<void> {
  const yamlText = yaml.dump(recipe, { lineWidth: 120 });
  await fs.writeFile(recipeFilePath(recipe.id), yamlText, "utf-8");
}

export async function updateRecipe(id: string, recipe: Recipe): Promise<void> {
  const filePath = recipeFilePath(id);
  const existing = await fs.readFile(filePath, "utf-8");
  const historyPath = path.join(paths.historyDir, id);
  await fs.mkdir(historyPath, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await fs.writeFile(path.join(historyPath, `${timestamp}.yml`), existing, "utf-8");
  await fs.writeFile(filePath, yaml.dump(recipe, { lineWidth: 120 }), "utf-8");
}

export async function deleteRecipe(id: string): Promise<void> {
  await fs.unlink(recipeFilePath(id));
}

export function parseRecipeYaml(yamlText: string) {
  const parsed = yaml.load(yamlText);
  return RecipeSchema.safeParse(parsed);
}
