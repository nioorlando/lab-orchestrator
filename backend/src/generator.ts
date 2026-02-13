import fs from "node:fs/promises";
import path from "node:path";
import { Recipe } from "./schema";
import { paths } from "./paths";

export type GenerateResult = {
  projectDir: string;
  files: {
    compose: string;
    env: string;
    readme: string;
  };
};

const templatePattern = /{{\s*([A-Za-z0-9_]+)\s*}}/g;

export function renderTemplate(template: string, context: Record<string, string>) {
  return template.replace(templatePattern, (_, key: string) => {
    return context[key] ?? "";
  });
}

function safeJoin(base: string, target: string) {
  const targetPath = path.resolve(base, target);
  if (!targetPath.startsWith(base)) {
    throw new Error(`Invalid file path: ${target}`);
  }
  return targetPath;
}

export async function generateProject(recipe: Recipe, projectName: string, variables: Record<string, string>): Promise<GenerateResult> {
  const context: Record<string, string> = {
    projectName,
    ...Object.fromEntries(recipe.variables.map((variable) => [variable.key, variables[variable.key] ?? variable.default]))
  };

  const projectDir = path.join(paths.generatedDir, projectName);
  await fs.mkdir(projectDir, { recursive: true });

  const compose = renderTemplate(recipe.composeTemplate, context);
  const env = renderTemplate(recipe.envTemplate, context);
  const readme = renderTemplate(recipe.readmeTemplate, context);

  await fs.writeFile(path.join(projectDir, "docker-compose.yml"), compose, "utf-8");
  await fs.writeFile(path.join(projectDir, ".env"), env, "utf-8");
  await fs.writeFile(path.join(projectDir, "README.md"), readme, "utf-8");

  if (recipe.seedFiles?.length) {
    const seedDir = path.join(projectDir, "seed");
    await fs.mkdir(seedDir, { recursive: true });
    for (const file of recipe.seedFiles) {
      const renderedPath = renderTemplate(file.path, context);
      const targetPath = safeJoin(projectDir, path.join("seed", renderedPath));
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, renderTemplate(file.content, context), "utf-8");
    }
  }

  if (recipe.extraFiles?.length) {
    for (const file of recipe.extraFiles) {
      const renderedPath = renderTemplate(file.path, context);
      const targetPath = safeJoin(projectDir, renderedPath);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, renderTemplate(file.content, context), "utf-8");
    }
  }

  return {
    projectDir,
    files: {
      compose,
      env,
      readme
    }
  };
}

export function getMissingRequired(recipe: Recipe, variables: Record<string, string>) {
  return recipe.variables
    .filter((variable) => variable.required && !(variables[variable.key] ?? variable.default))
    .map((variable) => variable.key);
}

export function redactVariables(recipe: Recipe, variables: Record<string, string>) {
  const redacted: Record<string, string> = {};
  for (const variable of recipe.variables) {
    if (variable.secret) {
      redacted[variable.key] = "***";
    } else {
      redacted[variable.key] = variables[variable.key] ?? variable.default;
    }
  }
  return redacted;
}
