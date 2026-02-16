[![CI Status](https://img.shields.io/github/actions/workflow/status/ZapoVerde/contextSlicer/ci.yml?branch=main)](https://github.com/ZapoVerde/contextSlicer/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/ZapoVerde/contextSlicer)](https://github.com/ZapoVerde/contextSlicer/blob/main/LICENSE)
[![GitHub release (latest by date)](https://img.shields.io/github/v/release/ZapoVerde/contextSlicer)](https://github.com/ZapoVerde/contextSlicer/releases/latest)
[![Release Desktop App](https://github.com/ZapoVerde/contextSlicer/actions/workflows/release.yml/badge.svg)](https://github.com/ZapoVerde/contextSlicer/actions/workflows/release.yml)

# Context Slicer

**A tool for creating token-efficient context packs from TypeScript/JS projects.**

---

Context Slicer is designed for developers who use Large Language Models (LLMs) to write or refactor code.

When providing context to an AI, including the full implementation of every dependency wastes tokens and adds noise. However, providing no context causes the AI to hallucinate types and import paths.

Context Slicer solves this by generating a "Context Pack" that contains your target code along with the specific type definitions required to make that code valid. This allows the AI to understand the shape of your data and dependencies without needing to read the entire repository.

---

## Quick Start

You can run Context Slicer as a standalone binary. No Node.js installation is required.

**Linux / macOS / WSL**
```bash
curl -L -o slicer https://github.com/ZapoVerde/contextSlicer/releases/latest/download/desktop-linux && chmod +x slicer && ./slicer
```

**Windows**
Download `desktop-win.exe` from the [Latest Releases](https://github.com/ZapoVerde/contextSlicer/releases/latest).

---

## How It Works

Context Slicer analyzes your project structure to generate a three-part document.

### 1. Spatial Map
An ASCII tree of the included files to provide structural context.

### 2. Boundary Library
This layer ensures type safety.
*   The tool scans your selected files for imports that reference code *outside* your current selection.
*   It performs a shallow read of those external files.
*   It extracts only the relevant type definitions (interfaces, types, enums, class signatures).
*   **Result:** The AI receives the exact "contract" of your dependencies without the implementation details.

### 3. Source Logic
The full source code of the files you want to edit.
*   **Logical Tracing:** The tracer identifies "barrel" files (index files that re-export symbols) and treats them as zero-cost steps. This allows the tool to find the actual source of a dependency without filling the context window with intermediate exports.
*   **Resolution Gradient:** You can configure the tool to include immediate dependencies as full source code, while summarizing more distant dependencies as API signatures.

---

## Features

*   **Logic-Aware Tracing:** Distinguishes between files that just move data (re-exports) and files that contain logic to calculate dependency depth accurately.
*   **Scent Tracking:** Follows variable renaming and aliasing through the dependency graph to locate the true origin of a symbol.
*   **Full-File Fidelity:** Designed for workflows where you paste a full file, ask the AI to rewrite it, and paste it back. The Boundary Library ensures the rewrite respects existing project interfaces.
*   **Monorepo Support:** Resolves `tsconfig` paths and aliases (e.g. `@prism/shared/*`) to support boundary scanning across packages.
*   **Live Mode:** The desktop application watches your filesystem via WebSocket. Changes made in your IDE are reflected in the Slicer immediately.

---

## Usage

### 1. Initialize
Generate a default configuration file in your project root.
```bash
./slicer --init
```

### 2. Run
Start the application.
```bash
./slicer
```
Open your browser to the local server (typically `http://localhost:5173`).

### 3. Generate Pack
1.  **Select Seed:** Type a filename or symbol (e.g. `AuthService`).
2.  **Expand:** Adjust the slider to pull in dependencies if necessary.
3.  **Generate:** Click **"Copy to Clipboard"**.
4.  **Execute:** Paste the context into your LLM prompt.

---

## Development

**Prerequisites:** Node.js v22+, pnpm.

```bash
# Install
git clone https://github.com/ZapoVerde/contextSlicer.git
cd contextSlicer
pnpm install

# Run (Frontend + Backend Watcher)
pnpm dev:desktop

# Build Binary
pnpm package:desktop
```

---

### License
MIT License.
