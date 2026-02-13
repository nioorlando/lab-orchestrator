export type RecipeVariable = {
  key: string;
  label: string;
  default: string;
  required: boolean;
  options?: string[];
  secret?: boolean;
  description?: string;
};

export type RecipeFile = {
  path: string;
  content: string;
};

export type Recipe = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  difficulty: "easy" | "medium" | "hard";
  variables: RecipeVariable[];
  composeTemplate: string;
  envTemplate: string;
  readmeTemplate: string;
  seedFiles?: RecipeFile[];
  extraFiles?: RecipeFile[];
};

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

export type GeneratedRecord = {
  projectName: string;
  recipeId: string;
  createdAt: string;
  path: string;
  variables: Record<string, string>;
};
