# The Context Slicer: A Comprehensive Feature Guide

This document provides a detailed walkthrough of the Context Slicer application, explaining its purpose, features, and the workflow it enables.

---

### **1. Core Purpose: The LLM Context Pack**

The primary goal of the Context Slicer is to create highly-focused, token-efficient **"context packs"** of source code for use with Large Language Models (LLMs). Instead of pasting entire monolithic files, you can build a precise package containing only the relevant functions, classes, and their dependencies, along with architectural documentation.

---

### **2. The Control Panel & Data Loading**

The top section of the application is the main control panel, responsible for loading your source code into the browser.

#### **Data Sources**

You have two ways to load code:

1.  **Live Dev Server:** When you run `pnpm dev:slicer`, a script continuously scans your repository and serves a fresh `source-dump.zip` file. The "Refresh Dev" button fetches the latest version of this dump.
2.  **Manual Zip Upload:** You can override the dev server at any time by dragging and dropping a `.zip` file onto the control panel or by using the "Override with Zip" button.

#### **The Staleness Detector**

When connected to the Live Dev Server, the tool automatically detects if you save any file in your repository.
*   The status will turn yellow ("Source is Stale") to warn you that the loaded code is out of date.
*   After a brief delay, it will automatically "Refresh Dev" to load the latest version, ensuring you are always working with fresh code.

#### **The Client-Side Sanitation Pipeline**

To prevent browser crashes from large or irrelevant files, any manually uploaded zip is automatically filtered through a robust sanitation pipeline:
*   **Size Check:** Zips larger than 50MB are rejected outright.
*   **Whitelist Filter:** Only files with common source code, documentation, or configuration extensions (e.g., `.ts`, `.md`, `.json`) are allowed. Large media files or unknown binary formats are skipped.
*   **Blacklist Filter:** Any file or folder matching the patterns in the project's ignore configuration (e.g., `node_modules`, `.git`) is skipped.
*   **Sanitation Report:** After processing, the UI will report exactly how many files were processed and how many were skipped, with a "Show Details" link to provide full transparency.

---

### **3. The Targeted Pack Generator**

This is your main workbench. The large text area is the "source of truth" for the context pack you are building. It contains a comma-separated list of all the file paths you want to include. You can edit this list directly or use the query tools below to populate it.

#### **Export Options**

*   **Copy to Clipboard:** The primary action. It formats the entire pack (with a file tree preamble) and copies it to your clipboard.
*   **Download Txt / Download Zip:** Downloads the pack as a `.txt` or `.zip` file.

#### **Special Export Modes**

*   **`[ ] Tree Only`:** Ignores file content entirely and exports only the file tree preamble. This is perfect for quickly generating a directory structure diagram for documentation or prompts.
*   **`[ ] Docblocks Only`:** Instead of the full file content, this mode extracts only the JSDoc-style block comment (`/** ... */`) from the beginning of each selected file. This is the most powerful feature for creating a high-level, "schema-only" overview of your project's architecture for an AI.

---

### **4. Context Query Tools: The Power Features**

This section provides powerful tools to populate the file list in the Targeted Pack Generator.

#### **The Workflow**

The query tools are designed as a three-step workflow:
1.  **Define Seed Files:** Select your initial points of interest.
2.  **Expand with Dependencies:** Grow your selection based on code relationships.
3.  **Exclude Files:** Prune the final results to remove noise.

#### **Step 1: Defining Seed Files**

You have three ways to select your initial files:

*   **Include Docs Folders:** The easiest way to grab high-level context. This provides shortcuts to automatically add all files from top-level folders within your `docs/` directory.
*   **Seed: Dependency Trace:** The most powerful tool. Start typing a file path or a symbol (function, class, etc.). The tool will autocomplete based on all the symbols discovered in your code.
*   **Inclusion Patterns:** A flexible bulk-selection tool. Use glob-like patterns (`*` for single directories, `**` for recursive) to add multiple files at once (e.g., `src/features/auth/**/*`).

#### **Step 2: Expanding the Selection**

Once you have your seed files, you can automatically find related code.
*   **Hops (Slider):** This determines how many steps the tracer will take through your code's dependency graph. `1` hop will find direct imports; `2` hops will find imports of imports, and so on. A value of `0` disables the trace.
*   **Trace Direction:**
    *   **Dependencies:** Finds what your seed files *depend on* (upstream).
    *   **Dependents:** Finds what *depends on* your seed files (downstream).
    *   **Both:** Traces in both directions.

#### **Step 3: Excluding Files**

The **Exclusion Patterns** field allows you to apply a final filter. Any file from the generated set that matches these wildcard patterns will be removed before the final list is created.

#### **The Action Buttons**

*   **Append to Pack:** Adds the files generated by your query to the existing list in the Targeted Pack Generator.
*   **Replace Pack:** Clears the existing list and replaces it with the files generated by your query.