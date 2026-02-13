# Lab Orchestrator

Lab Orchestrator is a local, offline web app for managing a catalog of **single-container lab recipes** (YAML) and generating runnable **docker-compose** projects. It includes a fast recipe browser, editor, validation, previews, generation output, and a **Compare** page to evaluate recipes side‑by‑side.

> This project intentionally has **no AI features** and runs fully offline.

## Highlights
- Recipe catalog stored as YAML files under `recipes/`
- Strict schema validation (zod)
- CRUD + history backups (`recipes/.history/`)
- Project generation into `generated/<projectName>/`
- Live previews for compose/env/README
- Compare page to evaluate recipes side‑by‑side
- All recipes are **single-container / single-node** (easy to combine later)

---

## Repo Structure
```
lab-orchestrator/
  backend/
  frontend/
  recipes/
  generated/
  scripts/
  README.md
  package.json
```

---

## Prerequisites
- Node.js 20+
- Docker Desktop

---

## Install (Parent-Level node_modules)
**Important:** `node_modules` must live one level above this repo.

```bash
cd ..
# from parent directory of lab-orchestrator
bash lab-orchestrator/scripts/install_parent_deps.sh
bash lab-orchestrator/scripts/setup_symlinks.sh
```

This creates symlinks:
```
lab-orchestrator/backend/node_modules -> ../node_modules
lab-orchestrator/frontend/node_modules -> ../node_modules
```

---

## Run (Dev)
```bash
# Terminal 1
bash scripts/dev_backend.sh

# Terminal 2
bash scripts/dev_frontend.sh
```

- Backend API: `http://localhost:4000`
- Frontend UI: `http://localhost:5173`
- Compare Page: `http://localhost:5173/compare`

---

## How Generation Works
When you click **Generate**:
- Templates are rendered using placeholders like `{{projectName}}` and `{{VAR_NAME}}`.
- Files are written into `generated/<projectName>/`:
  - `docker-compose.yml`
  - `.env`
  - `README.md`
  - optional `seed/` and `extra` files
- A record is stored in `generated/index.json` (secrets are redacted).

Run a generated project:
```bash
cd generated/<projectName>
docker compose up -d
```

---

## Recipe Schema (YAML)
Each recipe **must** include:
- `id`: kebab-case string
- `name`, `description`
- `tags`: string[]
- `difficulty`: `easy | medium | hard`
- `variables`: list of variables
- `composeTemplate`, `envTemplate`, `readmeTemplate`

Optional:
- `seedFiles`: list of `{ path, content }` written to `generated/<project>/seed/`
- `extraFiles`: list of `{ path, content }` written under `generated/<project>/...`

Variable format:
```
- key: VAR_NAME
  label: Human Label
  default: "value"
  required: true|false
  secret: true|false   # optional
  options: ["v1", "v2"]  # optional dropdown in UI
  description: "..."     # optional
```

---

## Recipe Authoring
- All recipes are YAML files in `recipes/`
- Editing a recipe creates a backup at:
  `recipes/.history/<id>/<timestamp>.yml`
- Validation errors are shown inline in the UI

---

## Compare Page
Use `/compare` to:
- Search recipes
- Select multiple recipes
- Compare metadata, variables, and template size side‑by‑side

---

## Scripts
- `scripts/install_parent_deps.sh`: install deps into `../node_modules`
- `scripts/setup_symlinks.sh`: create node_modules symlinks
- `scripts/dev_backend.sh`: start Fastify API
- `scripts/dev_frontend.sh`: start Vite UI

---

## Troubleshooting
**Vite error: `no such file or directory ... frontend/node_modules/.vite`**
- Your symlink is missing. Run:
```bash
bash scripts/setup_symlinks.sh
```

**Generate fails (invalid project name)**
- Project name must match: `^[a-z0-9][a-z0-9-]*$`

---

## License
MIT

