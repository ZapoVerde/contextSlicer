/**
 * @file packages/desktop/server/defaultConfig.ts
 * @stamp {"ts":"2026-02-16T12:05:00Z"}
 * @architectural-role Configuration
 * @description
 * Defines the immutable default configuration template used when initializing
 * the application via the CLI (`--init`). It provides the baseline settings
 * for sanitation, project root, and live development behavior.
 *
 * @core-principles
 * 1. IS the source of truth for the default `slicer-config.yaml` structure.
 * 2. MUST be kept in sync with the application's configuration schema expectations.
 * 3. IS strictly read-only and immutable.
 *
 * @api-declaration
 *   export const DEFAULT_CONFIG_YAML: string;
 *
 * @contract
 *   assertions:
 *     purity: read-only
 *     state_ownership: none
 *     external_io: none
 */

export const DEFAULT_CONFIG_YAML = `# ===================================================================
# CONTEXT SLICER CONFIGURATION
#
# This is the single source of truth for the Context Slicer's logic.
# You can safely edit the lists in this file to change the slicer's
# behavior without needing to touch the application code.
# ===================================================================

# --- A version number for this config file ---
version: 1

# ===================================================================
# SECTION 1: PROJECT DEFINITION
#
# This section defines the external project that the Context Slicer
# should analyze.
# ===================================================================
project:
  # DESCRIPTION: This is the single most important setting. It defines
  # the relative path from THIS slicer-config.yaml file to the root
  # of the project you want to analyze.
  #
  # EXAMPLE: If your project structure is:
  #   /my-cool-project
  #     /packages
  #       /context-slicer-app  <-- This tool is here
  #         /public
  #           /slicer-config.yaml
  #   The value should be '../../../' to point to /my-cool-project.
  #
  # EDIT THIS VALUE:
  targetProjectRoot: '.'

# ===================================================================
# SECTION 2: SANITATION RULES
#
# These rules act as the main security and relevance filter for
# user-uploaded ZIP files. They answer the question:
# "Which files are safe and relevant to even consider?"
# ===================================================================
sanitation:
  # DESCRIPTION: The absolute maximum size, in megabytes (MB), for
  # any user-uploaded ZIP file. The app will reject any file
  # larger than this before processing it.
  #
  # EDIT THIS VALUE:
  maxUploadSizeMb: 200

  # -----------------------------------------------------------------
  # Whitelist of allowed file extensions.
  #
  # HOW TO EDIT:
  # This is a list of text items. The dash (-) signifies a new
  # list item. To add a new extension, just add a new line at the
  # end, starting with a dash and a space.
  #
  # EDIT THIS LIST:
  acceptedExtensions:
    - html
    - css
    - scss
    - less
    - js
    - jsx
    - ts
    - tsx
    - mjs
    - cjs
    - json
    - yaml
    - yml
    - toml
    - ini
    - xml
    - env
    - sh
    - bash
    - ps1
    - firebaserc
    - gitignore
    - npmrc
    - nix
    - md
    - mdx
    - txt
    - rst
    - py
    - go
    - java
    - rb
    - php
    - cs
    - c
    - cpp
    - h
    - hpp
    - csv
    - sql
    - rules         # For Firebase security rules
    - lock          # For Nix flake.lock
    - code-workspace # For VS Code workspace config

  # -----------------------------------------------------------------
  # Blacklist of files and folders to always ignore.
  # This uses the same wildcard syntax as a .gitignore file.
  # NOTE: The build script automatically ignores its own output
  # directory. You do not need to add it here.
  #
  # HOW TO EDIT:
  # Just like the list above, add a new line starting with a dash
  # and a space to add a new pattern.
  #
  # EDIT THIS LIST:
  denyPatterns:
    # --- Version Control ---
    - ".git/"
    - ".git/**"

    # --- Dependencies & Lockfiles ---
    - "**/node_modules/**"
    - "**/pnpm-lock.yaml"
    - "**/package-lock.yaml"

    # --- Build Artifacts & Caches ---
    - "**/dist/**"
    - "**/lib/**"
    - "**.tsbuildinfo"
    - ".cache/"
    - ".cache/**"
    - ".firebase/"
    - "storybook-static/" # From .gitignore
    - "coverage/"         # From .gitignore
    - ".nyc_output/"      # From .gitignore
    - ".turbo/"           # From .gitignore

    # --- Logs ---
    - "logs/"             # From .gitignore
    - "*.log"             # From .gitignore
    - "*-debug.log*"      # From .gitignore

    # --- Secrets & Sensitive Files ---
    - "*.pem"
    - "*.key"
    - "*serviceAccount*.json"
    - ".env"              # From .gitignore
    - ".env.*"            # From .gitignore
    - "!.env.example"     # From .gitignore

    # --- Editor & OS Specific ---
    - ".idea/"
    - ".DS_Store"
    - "*.suo"
    - "*.ntvs*"
    - "*.njsproj"
    - "*.sln"
    - "*.sw?"

    # --- Project Specific Exclusions ---
    - "**/context-slicer-app/public/source-dump/**"
    - "!packages/context-slicer-app/public/source-dump/.gitkeep"

# ===================================================================
# SECTION 3: PRESETS
#
# Each item below (starting with a dash) is a one-click "Preset"
# button in the UI. A preset is a powerful shortcut for selecting
# a complex group of related files.
# ===================================================================
presets:
  - id: "config-files"
    name: "Configuration"
    category: "Setup"
    summary: "All configuration files."
    rationale: "Captures the project's build, linting, infrastructure, and dependency definitions to provide a complete operational context."
    useCases:
      - "Understanding project setup and tooling."
      - "Debugging build or environment issues."
    patterns:
      - "*.json"
      - "README.md"
      - "*.yaml"
      - "*.js"
      - "*.ts"
      - ".idx/**"
      - "**/*eslint*"
      - "*eslint*"
      - "tsconfig*"
      - "**/tsconfig*"
      - "vite*"
      - "**/vite*"
      - "package.json"
      - "**/package.json"
      - "firestore*"
      - "firebase*"
      - "Dockerfile"
      - "docker-compose*"
      - ".prettier*"
    exclusions:
      - "package-lock.json"
      - "pnpm-lock.yaml"

# --- To add a new preset copy the block above (from one dash to the next). ---

# ===================================================================
# SECTION 4: SANITATION OVERRIDES
#
# These rules have the final say in the sanitation process, ensuring
# certain files are always included, regardless of other rules.
# ===================================================================
sanitationOverrides:
  # DESCRIPTION: A list of .gitignore-style patterns that MUST be
  # included in the source dump, even if they are excluded by a
  # .gitignore file. The '!' prefix is critical as it signifies an
  # inclusion rule. This is the "final word" on what gets included.
  #
  # EDIT THIS LIST:
  mandatoryInclusions:
    - "!docs"
    - "!docs/**"

# ===================================================================
# SECTION 5: OUTPUT FORMATTING
#
# These rules define the specific format of the generated text files.
# ===================================================================
output:
  # DESCRIPTION: The text marker that is prepended to each file's
  # content in the concatenated text dumps.
  beginMarker: "@@FILE: "

  # DESCRIPTION: The text marker that is appended after each file's
  # content in the concatenated text dumps.
  endMarker: "@@END_FILE@@"

# ===================================================================
# SECTION 6: LIVE DEVELOPMENT BEHAVIOR
#
# These values control the timing and behavior of the live-reloading
# features when running in development mode.
# ===================================================================
liveDevelopment:
  # DESCRIPTION: The delay in milliseconds (ms) that the Node.js file
  # watcher waits after detecting a change before starting a new build.
  # This prevents rapid-fire rebuilds when saving multiple files.
  watchDebounceMs: 2000

  # DESCRIPTION: The delay in milliseconds (ms) that the web application
  # waits after detecting that its source is stale before automatically
  # fetching the latest version.
  staleRefetchDelayMs: 5000
`;