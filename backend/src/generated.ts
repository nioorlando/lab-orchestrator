import fs from "node:fs/promises";
import path from "node:path";
import { paths } from "./paths";

export type GeneratedRecord = {
  projectName: string;
  recipeId: string;
  createdAt: string;
  path: string;
  variables: Record<string, string>;
};

export async function readGeneratedIndex(): Promise<GeneratedRecord[]> {
  try {
    const raw = await fs.readFile(paths.generatedIndex, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as GeneratedRecord[];
    }
    return [];
  } catch {
    return [];
  }
}

export async function appendGeneratedRecord(record: GeneratedRecord) {
  const existing = await readGeneratedIndex();
  const updated = [record, ...existing].slice(0, 100);
  await fs.writeFile(paths.generatedIndex, JSON.stringify(updated, null, 2), "utf-8");
}

export async function readGeneratedFiles(projectName: string) {
  const projectDir = path.join(paths.generatedDir, projectName);
  const [compose, env, readme] = await Promise.all([
    fs.readFile(path.join(projectDir, "docker-compose.yml"), "utf-8"),
    fs.readFile(path.join(projectDir, ".env"), "utf-8"),
    fs.readFile(path.join(projectDir, "README.md"), "utf-8")
  ]);
  return { compose, env, readme };
}
