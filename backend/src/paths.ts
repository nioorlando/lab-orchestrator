import path from "node:path";

const cwd = process.cwd();
const rootDir = path.basename(cwd) === "backend" ? path.resolve(cwd, "..") : cwd;

export const paths = {
  root: rootDir,
  recipesDir: path.join(rootDir, "recipes"),
  historyDir: path.join(rootDir, "recipes", ".history"),
  generatedDir: path.join(rootDir, "generated"),
  generatedIndex: path.join(rootDir, "generated", "index.json")
};
