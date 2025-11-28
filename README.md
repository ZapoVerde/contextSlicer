
[![CI Status](https://img.shields.io/github/actions/workflow/status/ZapoVerde/contextSlicer/ci.yml?branch=main)](https://github.com/ZapoVerde/contextSlicer/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/ZapoVerde/contextSlicer)](https://github.com/ZapoVerde/contextSlicer/blob/main/LICENSE)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/ZapoVerde/contextSlicer)](https://github.com/ZapoVerde/contextSlicer/releases/latest)
[![Release Desktop App](https://github.com/ZapoVerde/contextSlicer/actions/workflows/release.yml/badge.svg)](https://github.com/ZapoVerde/contextSlicer/actions/workflows/release.yml)

# Context Slicer

**A developer tool for creating targeted, token-efficient context packs from modern TypeScript/JS projects for use with Large Language Models (LLMs).**

---

> **For developers using LLMs on large JS/TS codebases.**
>
> When your project grows beyond a few dozen files, providing context to an AI becomes a bottleneck. Pasting your whole repo is impossible. Manually hunting down every relevant file for a single task is slow and error-prone.

**Context Slicer automates that hunt.**

It creates token-efficient "context packs" by understanding your code's structure. Its core feature is **dependency-aware tracing**: give it a starting point, and it spiders through your import graph to find exactly what the AI needs to understand that file.

---

## 🚀 Quick Start

You can run Context Slicer as a standalone desktop application. No Node.js installation is required.

### Option A: Browser Download
1.  Go to the **[Latest Release Page](https://github.com/ZapoVerde/contextSlicer/releases/latest)**.
2.  Download `desktop-win.exe` (Windows) or `desktop-linux` (Linux/WSL).
3.  Place it in your project root and run it.

### Option B: Command Line (Linux / macOS / WSL)
Run this one-liner to download the latest version, make it executable, and rename it to `slicer`:

```bash
curl -L -o slicer https://github.com/ZapoVerde/contextSlicer/releases/latest/download/desktop-linux && chmod +x slicer
```

**To use it:**
```bash
./slicer
```

### Option C: GitHub CLI
If you have `gh` installed:

```bash
gh release download --pattern "desktop-linux" --clobber
chmod +x desktop-linux
./desktop-linux
```

---

## ⚙️ Configuration

Context Slicer is highly configurable. It uses a `slicer-config.yaml` file as the single source of truth for exclusion rules, file extensions, and presets.

### 1. Initialize Configuration
To customize the tool (e.g., to ignore specific folders), generate a default configuration file in your project root:

```bash
./slicer --init
```

This creates a well-documented `slicer-config.yaml`.

### 2. Edit via UI (Recommended)
You do not need to edit the YAML file manually.
1.  Run the app: `./slicer`
2.  Click the **Settings (Gear Icon)** in the top right.
3.  **Project Tab:** Change the root directory using the visual Folder Browser.
4.  **Exclusions Tab:** Add or remove ignored folders (e.g., `dist/`, `node_modules/`).
5.  **Extensions Tab:** Toggle allowed file types.

**Changes made in the UI are automatically saved to `slicer-config.yaml`.**

---

## 🛠 Features

*   **Dependency-Aware Tracing:** Select a file, and the Slicer finds all imports and dependents automatically using a real AST graph.
*   **Smart Sanitation:**
    *   **Desktop Mode:** Configurable via `slicer-config.yaml`. Explicitly excludes noise like `node_modules` and `.git`.
    *   **Web Mode:** Supports "Volatile Configuration," allowing you to filter a loaded Zip file in-memory without modifying the file itself.
*   **Live Mode:** The desktop app watches your filesystem. Changes you make in your IDE are instantly reflected in the Slicer.
*   **Docblock Extraction:** Option to export *only* the JSDoc/comments from files to generate high-level architectural summaries.
*   **Presets:** Create one-click buttons (via config) to select specific architectural layers (e.g., "Auth System", "Database Schema").

---

## 👨‍💻 Contributing (Development Setup)

If you want to modify the source code of Context Slicer itself, follow these steps.

**Prerequisites:**
*   Node.js v22+
*   pnpm

### 1. Install Dependencies
```bash
git clone https://github.com/ZapoVerde/contextSlicer.git
cd contextSlicer
pnpm install
```

### 2. Run in Development Mode
This starts the UI server (Vite) and the file-watching backend (Express) simultaneously.
```bash
pnpm dev:desktop
```

### 3. Build Release Executables
To create the standalone binaries locally:
```bash
pnpm package:desktop
```
The output files will be located in `packages/desktop/release/`.

---

### License
MIT License.
