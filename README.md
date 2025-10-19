[![CI Status](https://img.shields.io/github/actions/workflow/status/ZapoVerde/contextSlicer/ci.yml?branch=main)](https://github.com/ZapoVerde/contextSlicer/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/ZapoVerde/contextSlicer)](https://github.com/ZapoVerde/contextSlicer/blob/main/LICENSE)

# Context Slicer

**A developer tool for creating targeted, token-efficient context packs from modern TypeScript/JS projects for use with Large Language Models (LLMs).**

---

> **For developers using LLMs on large JS/TS codebases.**
>
> When your project grows beyond a few dozen files, providing context to an AI becomes a bottleneck. Pasting your whole repo is impossible. Manually hunting down every relevant file for a single task—a component, its store, its types, the services it calls—is slow, error-prone, and kills your workflow. You miss one file, and the AI's response is useless.

**Context Slicer automates that hunt.**

It's a specialized tool that creates token-efficient "context packs" by understanding your code's structure. Its core feature is **dependency-aware tracing**. Give it a starting point, and it spiders through your import graph to find every file it touches, and every file that touches it.

**Stop curating context by hand. Start slicing it intelligently.**

### Key Features

*   **Dependency-Aware Tracing:** Select a single file or function, and the Slicer will traverse your code's dependency graph to automatically find all related files (both dependencies and dependents).
*   **Configurable Behavior via YAML:** The tool's core logic is not hardcoded. Sanitation rules, UI presets, and live-reload timings are all defined in a simple `slicer-config.yaml` file, making it easy to tailor the tool to your project's specific needs.
*   **Wildcard & Folder Selection:** Quickly grab entire features or architectural layers using glob-style patterns (e.g., `src/features/auth/**/*`).
*   **Configurable Client-Side Sanitation:** Safely drop a "dirty" `.zip` file of a repository, and the Slicer will automatically filter out `node_modules`, `.git`, and other noise based on rules you can edit, protecting your browser from memory crashes.
*   **Live Development Mode:** Connects to a file-watching script that automatically serves a fresh, up-to-date version of your repository's source code as you work.
*   **Architectural "Docblock" Extraction:** Export a high-level summary of your project by extracting only the JSDoc-style comment blocks from the top of each file.

### Project Status: Beta
The Context Slicer is currently in a stable beta. It is actively used for the development of its parent project. Feedback and contributions are welcome!

---

### The Core Workflow

The user experience is designed as a simple, three-step process:

1.  **Load Your Source Code:**
    *   **For Live Development:** Run the built-in file watcher (`pnpm dev`) which continuously serves a fresh `source-dump.zip` of your project. The Slicer app will load this automatically.
    *   **For Any Repository:** Download a repository as a `.zip` file and simply drag-and-drop it onto the Slicer's control panel. The app will sanitize it and load it into the browser's memory.

2.  **Build Your Query:**
    *   Use the query tools to compose your context pack. Start with a one-click **Preset** (e.g., "Project Environment") and then append the precise results of a dependency trace for a specific file.
    *   The large text area in the **Targeted Pack Generator** is the source of truth for your pack. You can always edit the comma-separated list of files directly.

3.  **Export the Result:**
    *   Click **Copy to Clipboard** to get a single, formatted text block containing a file tree diagram followed by the content of every selected file.
    *   Use the **`[x] Docblocks Only`** or **`[x] Tree Only`** checkboxes for specialized exports.

---

### How It Works: A Three-Phase System

The Context Slicer operates using a powerful architecture that moves all heavy processing into the browser.

1.  **Phase 1: Configuration Loading (Browser)**
    *   On startup, the application first fetches and parses the `/public/slicer-config.yaml` file. This object becomes the single source of truth for all subsequent logic, including sanitation rules and the presets that appear in the UI.

2.  **Phase 2: Source Code Generation (Optional, Node.js)**
    *   An optional file-watching script (`scripts/generate-dump.ts`) can be run locally. It scans a project directory, respects `.gitignore` rules, and packages all relevant source code into a single `source-dump.zip` file. This zip is then served to the front-end application.

3.  **Phase 3: Run-Time Consumption (React & In-Browser Parsing)**
    *   The React application fetches this `source-dump.zip` (or receives one from a user upload) and unpacks it entirely within the browser's memory using `JSZip`.
    *   Crucially, it then uses `@babel/parser` to parse all JavaScript and TypeScript files into an **Abstract Syntax Tree (AST)**.
    *   This AST is used to build a **Symbol Dependency Graph**, which maps the relationships between every file, function, and class in your project. This in-browser graph is what powers the dependency tracing feature, allowing for instant, powerful code analysis with no backend server required.

---

### **First-Time Configuration & Usage**

The Context Slicer is a standalone tool designed to be pointed at any external TypeScript/JS project. To use it on your own codebase, you must complete a one-time configuration to tell the Slicer where your project is located.

#### **1. Pointing the Slicer at Your Project**

The entire build process is controlled by a single configuration file.

*   **File Location:** `packages/context-slicer-app/public/slicer-config.yaml`

Open this file. The most critical setting is `targetProjectRoot` at the very top. You must change this value to the correct **relative path** from the `slicer-config.yaml` file to the root directory of the project you want to analyze.

**Example:**

Imagine your projects are structured like this:

```text
/my-workspace/
├── my-awesome-project/      <-- This is the project you want to analyze
│   ├── src/
│   └── package.json
└── context-slicer-project/  <-- This is the Context Slicer tool
    └── packages/
        └── context-slicer-app/
            └── public/
                └── slicer-config.yaml
```

To get from `slicer-config.yaml` to `my-awesome-project`, you need to go up four levels (`../`) to reach `/my-workspace/` and then down into `my-awesome-project/`.

The correct setting in `slicer-config.yaml` would be:

```yaml
project:
  targetProjectRoot: '../../../../my-awesome-project'
```

#### **2. Running in Live Development Mode**

The "Live Development Mode" provides a seamless workflow where the Slicer automatically updates with your latest code as you work. This requires running **two processes in two separate terminals**.

**Terminal 1: Start the Backend File Watcher**

This script is the engine. It watches your target project for file changes and continuously regenerates the source package that the UI consumes.

```bash
# From the root of the context-slicer-project repository:
pnpm --filter @aianvil/context-slicer-app exec ts-node scripts/generate-dump.ts --watch```

Wait for the initial build to complete. You will see a summary of the generated files in the console.

**Terminal 2: Start the Frontend UI Server**

This command serves the Context Slicer's web interface.

```bash
# From the root of the context-slicer-project repository:
pnpm dev
```

The application will open at `http://localhost:5174`. It will automatically load the source package generated by the watcher. Now, any time you save a file in your target project, the Slicer's UI will detect the change and automatically refresh its data.

#### **3. (Optional) Customizing Behavior**

The `slicer-config.yaml` file is the single source of truth for the tool's behavior. You can customize it to fit your project's needs:

*   **`sanitation.denyPatterns`**: Add any additional files or directories you want the Slicer to always ignore (e.g., `**/__generated__/**`).
*   **`presets`**: Create your own one-click preset buttons in the UI to quickly select common architectural slices of your project. Copy an existing preset and modify its `patterns` to get started.
---

### License

This project is licensed under the MIT License.
