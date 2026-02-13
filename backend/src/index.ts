import Fastify from "fastify";
import { z } from "zod";
import { ensureDirectories, getRecipeById, listRecipes, parseRecipeYaml, saveRecipe, updateRecipe, deleteRecipe } from "./recipes";
import { GenerateRequestSchema, RecipeSchema, ValidateRequestSchema } from "./schema";
import { generateProject, getMissingRequired, redactVariables } from "./generator";
import { appendGeneratedRecord, readGeneratedFiles, readGeneratedIndex } from "./generated";

const server = Fastify({ logger: true });

server.addHook("onRequest", async (request, reply) => {
  reply.header("Access-Control-Allow-Origin", "*");
  reply.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  reply.header("Access-Control-Allow-Headers", "Content-Type");
  if (request.method === "OPTIONS") {
    reply.code(204).send();
  }
});

server.get("/api/recipes", async () => {
  return listRecipes();
});

server.get("/api/recipes/:id", async (request, reply) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const result = await getRecipeById(params.id);
  if (!result.recipe) {
    reply.code(404);
  }
  return result;
});

server.post("/api/recipes", async (request, reply) => {
  const parsed = ValidateRequestSchema.parse(request.body);
  const recipeResult = parsed.recipe ? RecipeSchema.safeParse(parsed.recipe) : parseRecipeYaml(parsed.yamlText ?? "");
  if (!recipeResult.success) {
    reply.code(400);
    return { ok: false, errors: recipeResult.error.issues.map((issue) => issue.message) };
  }
  const validated = recipeResult.data;
  await saveRecipe(validated);
  return { ok: true, recipe: validated };
});

server.put("/api/recipes/:id", async (request, reply) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  const parsed = ValidateRequestSchema.parse(request.body);
  const recipeResult = parsed.recipe ? RecipeSchema.safeParse(parsed.recipe) : parseRecipeYaml(parsed.yamlText ?? "");
  if (!recipeResult.success) {
    reply.code(400);
    return { ok: false, errors: recipeResult.error.issues.map((issue) => issue.message) };
  }
  const validated = recipeResult.data;
  if (validated.id !== params.id) {
    reply.code(400);
    return { ok: false, errors: ["Recipe id mismatch"] };
  }
  await updateRecipe(params.id, validated);
  return { ok: true, recipe: validated };
});

server.delete("/api/recipes/:id", async (request, reply) => {
  const params = z.object({ id: z.string() }).parse(request.params);
  await deleteRecipe(params.id);
  return { ok: true };
});

server.post("/api/recipes/validate", async (request, reply) => {
  const parsed = ValidateRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(400);
    return { ok: false, errors: parsed.error.issues.map((issue) => issue.message) };
  }
  const recipeResult = parsed.data.recipe ? RecipeSchema.safeParse(parsed.data.recipe) : parseRecipeYaml(parsed.data.yamlText ?? "");
  if (!recipeResult.success) {
    reply.code(400);
    return { ok: false, errors: recipeResult.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) };
  }
  return { ok: true, recipe: recipeResult.data };
});

server.post("/api/generate", async (request, reply) => {
  const parsed = GenerateRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    reply.code(400);
    return { ok: false, errors: parsed.error.issues.map((issue) => issue.message) };
  }
  const data = parsed.data;
  const recipeResult = await getRecipeById(data.recipeId);
  if (!recipeResult.recipe) {
    reply.code(404);
    return { ok: false, errors: ["Recipe not found"] };
  }
  const missing = getMissingRequired(recipeResult.recipe, data.variables ?? {});
  if (missing.length) {
    reply.code(400);
    return { ok: false, errors: ["Missing required variables"], missing };
  }
  const result = await generateProject(recipeResult.recipe, data.projectName, data.variables ?? {});
  await appendGeneratedRecord({
    projectName: data.projectName,
    recipeId: recipeResult.recipe.id,
    createdAt: new Date().toISOString(),
    path: result.projectDir,
    variables: redactVariables(recipeResult.recipe, data.variables ?? {})
  });
  return { ok: true, project: result.projectDir, files: result.files };
});

server.get("/api/generated", async () => {
  return readGeneratedIndex();
});

server.get("/api/generated/:name", async (request, reply) => {
  const params = z.object({ name: z.string() }).parse(request.params);
  try {
    const files = await readGeneratedFiles(params.name);
    return { ok: true, files };
  } catch {
    reply.code(404);
    return { ok: false, errors: ["Generated project not found"] };
  }
});

const start = async () => {
  await ensureDirectories();
  try {
    await server.listen({ port: 4000, host: "0.0.0.0" });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
