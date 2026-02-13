import type { GeneratedRecord, Recipe, RecipeSummary } from "@/types";

const API_BASE = "http://localhost:4000/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function listRecipes() {
  return request<RecipeSummary[]>("/recipes");
}

export function getRecipe(id: string) {
  return request<{ recipe?: Recipe; yamlText?: string; errors?: string[] }>(`/recipes/${id}`);
}

export function createRecipe(payload: { recipe?: Recipe; yamlText?: string }) {
  return request<{ ok: boolean; recipe: Recipe }>("/recipes", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function updateRecipe(id: string, payload: { recipe?: Recipe; yamlText?: string }) {
  return request<{ ok: boolean; recipe: Recipe }>(`/recipes/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export function deleteRecipe(id: string) {
  return request<{ ok: boolean }>(`/recipes/${id}`, { method: "DELETE" });
}

export function validateRecipe(payload: { recipe?: Recipe; yamlText?: string }) {
  return request<{ ok: boolean; recipe?: Recipe; errors?: Array<{ path: string; message: string }> }>("/recipes/validate", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function generateProject(payload: { recipeId: string; projectName: string; variables: Record<string, string> }) {
  return request<{ ok: boolean; project: string; files: { compose: string; env: string; readme: string } }>("/generate", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function listGenerated() {
  return request<GeneratedRecord[]>("/generated");
}

export function getGenerated(name: string) {
  return request<{ ok: boolean; files: { compose: string; env: string; readme: string } }>(`/generated/${name}`);
}
