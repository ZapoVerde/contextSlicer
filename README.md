
[![CI Status](https://img.shields.io/github/actions/workflow/status/ZapoVerde/contextSlicer/ci.yml?branch=main)](https://github.com/ZapoVerde/contextSlicer/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/ZapoVerde/contextSlicer)](https://github.com/ZapoVerde/contextSlicer/blob/main/LICENSE)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/ZapoVerde/contextSlicer)](https://github.com/ZapoVerde/contextSlicer/releases/latest)
[![Release Desktop App](https://github.com/ZapoVerde/contextSlicer/actions/workflows/release.yml/badge.svg)](https://github.com/ZapoVerde/contextSlicer/actions/workflows/release.yml)

# Context Slicer

**A developer tool for creating targeted, token-efficient context packs from modern TypeScript/JS projects for use with Large Language Models (LLMs).**

---

**For developers using LLMs on large JS/TS codebases.**

When your project grows beyond a few dozen files, providing context to an AI becomes a bottleneck. Pasting your whole repo is impossible. Manually hunting down every relevant file for a single task is slow and error-prone.

**Context Slicer automates that hunt.**

It creates token-efficient "context packs" by understanding your code's structure. Its core feature is **dependency-aware tracing**: give it a starting point, and it spiders through your import graph to find exactly what the AI needs to understand that file.

---

## 🚀 Quick Start (No Installation Required)

The easiest way to use Context Slicer is the standalone desktop application. It runs locally on your machine and requires no Node.js installation.

### 1. Download
Go to the **[Latest Release Page](https://github.com/ZapoVerde/contextSlicer/releases/latest)** and download the executable for your OS:
*   **Windows:** `desktop-win.exe`
*   **Linux:** `desktop-linux`

### 2. Run
Place the executable in the **root folder of the project you want to analyze** and run it.

*   **Linux:** You may need to grant execution permissions first:
    ```bash
    chmod +x desktop-linux
    ./desktop-linux
    ```
*   **Windows:** Just double-click `desktop-win.exe`.

### 3. Slice
The tool will start a local server and automatically open your browser to `http://localhost:3000`. It will immediately scan the current directory and be ready for use.

---

## ⚙️ Configuration

The Context Slicer works out-of-the-box, but you can customize it by creating a `slicer-config.yaml` file in the same directory as the executable.

**Common Configurations:**
*   **`sanitation.denyPatterns`**: Ignore specific folders (e.g., `dist`, `coverage`, `__generated__`).
*   **`presets`**: Create one-click buttons to select specific architectural layers of your app.

**Example `slicer-config.yaml`:**
```yaml
version: 1
sanitation:
  maxUploadSizeMb: 500
  denyPatterns:
    - ".git"
    - "node_modules"
    - "**/__generated__/**"
presets:
  - id: "auth-flow"
    name: "Auth Flow"
    patterns:
      - "src/features/auth/**"
```

---

## 🛠 Features

*   **Dependency-Aware Tracing:** Select a file, and the Slicer finds all imports and dependents automatically using a real AST graph.
*   **Smart Sanitation:** Automatically filters out `node_modules`, lockfiles, and binary assets to keep context packs lean.
*   **Token Estimation:** See the token count of your selected context in real-time before copying.
*   **Live Mode:** When running the desktop app, the file list updates as you save files in your project.
*   **Docblock Extraction:** Option to export *only* the JSDoc/comments from files to generate high-level architectural summaries.

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
This starts the UI server and the file-watching backend simultaneously.
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
