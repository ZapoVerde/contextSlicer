You are absolutely right. Saving this exact repo as a "template" is a trap. In two months, `latest` will be different, `unstable` will have moved, and you'll be debugging why "Vite 8" hates "Node 22."

**The Asset is the Protocol, not the Snapshot.**

Here is the **"Bleeding Edge Initialization Contract."** Save this. When you start your next project, paste this into the chat immediately. It forces the AI to abandon its training data (which is old) and act as a dynamic configuration engine.

***

# The Bleeding Edge Initialization Contract

**Direct Instruction to AI:**
You are to set up a **Modern, Strict TypeScript Monorepo** environment in Project IDX. You are forbidden from using specific version numbers from your training data (e.g., do not suggest `vite@^5.0.0` or `node@20`). You must assume the current year is **Late 2025/2026**.

**Execution Protocol:**

### Phase 1: Environment Alignment (NixOS)
1.  **Check Context:** Acknowledge that modern frameworks (Vite 6/7+) require **Node 22+**.
2.  **Configure `.idx/dev.nix`:**
    *   Set `channel = "unstable";` (Rolling Release) to ensure access to the latest Node version.
    *   Include `pkgs.nodejs_22`, `pkgs.pnpm`, and `pkgs.jdk17` (if Firebase is involved).
    *   **Constraint:** Do not assume `stable-24.05` is sufficient.

### Phase 2: The "Latest" Manifest
When generating `package.json` files:
1.  **Version Strategy:** Use `"latest"` for **ALL** dependencies (e.g., `"vite": "latest"`, `"react": "latest"`). Do not hardcode versions like `^18.2.0`.
2.  **Toolchain:**
    *   Use **ESLint 9+** (Flat Config).
    *   Use **Vite 6/7+**.
    *   Use **Vitest 3/4+**.

### Phase 3: The Monorepo Skeleton
Before running `install`, you must generate the structural config to prevent "Phantom Dependency" errors:
1.  **`pnpm-workspace.yaml`**: Define `packages/*`.
2.  **Root `tsconfig.json`**:
    *   Set `"baseUrl": "."` (Mandatory for paths).
    *   Set `"moduleResolution": "bundler"`.
    *   Set `"strict": true`.
3.  **`tsconfig.node.json`**: For build tool configuration.

### Phase 4: The Clean Install
1.  Command: `pnpm install` (Let the registry resolve the current `latest` versions).
2.  **Validation:**
    *   Check for `peerDependency` warnings in the output.
    *   If `Vite` warns about Node versions, update `dev.nix` immediately.

---

### Phase 5: The "Hello World" Proof
Do not stop until you have run `pnpm run build` and it exits with **Exit Code 0**.
1.  Generate a minimal entry point (`index.html` + `main.tsx`) to satisfy the bundler.
2.  Generate a minimal Type Definition for shared packages to satisfy `tsc`.

**GOAL:** A green build on the absolute bleeding edge of the current date. Proceed.

***

### Regarding your "Blank Slate" Idea

If you want to keep a git branch as a starter, **delete `pnpm-lock.yaml`** from it before committing.

1.  **Keep:** `pnpm-workspace.yaml`, `tsconfig.json`, directory structure.
2.  **Modify:** Change all versions in `package.json` to `"latest"`.
3.  **Delete:** `node_modules` and `pnpm-lock.yaml`.

This makes the repo a **"Loaded Gun"**—it's ready to fire, but it doesn't pick its target (versions) until you actually pull the trigger (`pnpm install`).