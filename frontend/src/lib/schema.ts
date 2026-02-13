import { z } from "zod";

export const RecipeVariableSchema = z.object({
  key: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  label: z.string().min(1),
  default: z.string(),
  required: z.boolean(),
  options: z.array(z.string().min(1)).optional(),
  secret: z.boolean().optional(),
  description: z.string().optional()
});

export const RecipeFileSchema = z.object({
  path: z.string().min(1),
  content: z.string()
});

export const RecipeSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string().min(1)),
  difficulty: z.enum(["easy", "medium", "hard"]),
  variables: z.array(RecipeVariableSchema),
  composeTemplate: z.string().min(1),
  envTemplate: z.string().min(1),
  readmeTemplate: z.string().min(1),
  seedFiles: z.array(RecipeFileSchema).optional(),
  extraFiles: z.array(RecipeFileSchema).optional()
});

export type RecipeSchemaType = z.infer<typeof RecipeSchema>;
