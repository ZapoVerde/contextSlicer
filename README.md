[![CI Status](https://img.shields.io/github/actions/workflow/status/ZapoVerde/contextSlicer/ci.yml?branch=main)](https://github.com/ZapoVerde/contextSlicer/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/ZapoVerde/contextSlicer)](https://github.com/ZapoVerde/contextSlicer/blob/main/LICENSE)

# Context Slicer

**A developer tool for creating targeted, token-efficient context packs from modern TypeScript/JS projects for use with Large Language Models (LLMs).**

---

The Context Slicer is a web-based utility designed to solve a common problem in AI-assisted development: providing a Large Language Model with the precise code and documentation it needs to understand a task, without wasting tokens on irrelevant files.

Instead of manually copying and pasting dozens of files, you can use the Slicer's powerful query tools to intelligently select files based on dependencies, folder structure, or architectural role, and then export them as a single, clean context pack.

### Key Features

*   **Dependency-Aware Tracing:** Select a single file or function, and the Slicer will traverse your code's dependency graph to automatically find all related files (both dependencies and dependents).
*   **Architectural "Docblock" Extraction:** Export a high-level summary of your project by extracting only the JSDoc-style comment blocks from the top of each file.
*   **Wildcard & Folder Selection:** Quickly grab entire features or architectural layers using glob-style patterns (e.g., `src/features/auth/**/*`).
*   **Client-Side Sanitation:** Safely drop a "dirty" `.zip` file of a repository, and the Slicer will automatically filter out `node_modules`, `.git`, large binary assets, and other noise, protecting your browser from memory crashes.
*   **Live Development Mode:** Connects to a file-watching script that automatically serves a fresh, up-to-date version of your repository's source code as you work. 

### Project Status: Beta
The Context Slicer is currently in a stable beta. It is actively used for the development of the AI Anvil project. Feedback and contributions are welcome!

---

### The Core Workflow

The user experience is designed as a simple, three-step process:

1.  **Load Your Source Code:**
    *   **For Live Development:** Run the built-in file watcher (`pnpm dev`) which continuously serves a fresh `source-dump.zip` of your project. The Slicer app will load this automatically.
    *   **For Any Repository:** Download a repository as a `.zip` file and simply drag-and-drop it onto the Slicer's control panel. The app will sanitize it and load it into the browser's memory.

2.  **Build Your Query:**
    *   Use the query tools to compose your context pack. Start with a broad wildcard search (e.g., `packages/client/src/**/*`) and then append the precise results of a dependency trace for a specific file.
    *   The large text area in the **Targeted Pack Generator** is the source of truth for your pack. You can always edit the comma-separated list of files directly.

3.  **Export the Result:**
    *   Click **Copy to Clipboard** to get a single, formatted text block containing a file tree diagram followed by the content of every selected file.
    *   Use the **`[x] Docblocks Only`** or **`[x] Tree Only`** checkboxes for specialized exports.

---

### How It Works: A Two-Phase System

The Context Slicer operates using a powerful two-phase architecture that moves all heavy processing into the browser.

1.  **Phase 1: Build-Time Generation (Node.js)**
    *   An optional file-watching script (`scripts/generate-dump.ts`) can be run locally. It scans a project directory, respects `.gitignore` rules, and packages all relevant source code into a single `source-dump.zip` file. This zip is then served to the front-end application.

2.  **Phase 2: Run-Time Consumption (React & In-Browser Parsing)**
    *   The React application fetches this `source-dump.zip` (or receives one from a user upload) and unpacks it entirely within the browser's memory using `JSZip`.
    *   Crucially, it then uses `@babel/parser` to parse all JavaScript and TypeScript files into an **Abstract Syntax Tree (AST)**.
    *   This AST is used to build a **Symbol Dependency Graph**, which maps the relationships between every file, function, and class in your project. This in-browser graph is what powers the dependency tracing feature, allowing for instant, powerful code analysis with no backend server required.

---

### Local Development Setup

To run the Context Slicer on your own machine:

**Prerequisites:**
*   Node.js (v18 or higher)
*   `pnpm`

**Installation:**
1.  Clone the repository.
2.  Install dependencies from the root of the project:
    ```bash
    pnpm install
    ```

**Running the Development Server:**
*   This command starts the Vite dev server for the React UI and runs the file-watching script in parallel.
    ```bash
    pnpm dev
    ```
*   The application will be available at `http://localhost:5174`.

**Building for Production:**
*   This command type-checks the code and builds a static, optimized version of the application in the `dist/` directory.
    ```bash
    pnpm build
    ```

---

### License

This project is licensed under the MIT License.
