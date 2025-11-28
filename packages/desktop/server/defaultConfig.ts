/**
 * @file packages/desktop/server/defaultConfig.ts
 * @stamp {"ts":"2025-11-28T02:04:00Z"}
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
# ===================================================================

version: 1

# ===================================================================
# SECTION 1: PROJECT DEFINITION
# ===================================================================
project:
  # The relative path from this file to the root of the project to analyze.
  # Use '.' if this file is in the root.
  targetProjectRoot: '.'

# ===================================================================
# SECTION 2: SANITATION RULES
# ===================================================================
sanitation:
  maxUploadSizeMb: 500

  # Whitelist of allowed file extensions.
  acceptedExtensions:
    - html
    - css
    - js
    - jsx
    - ts
    - tsx
    - json
    - yaml
    - md
    - py
    - go
    - java
    - c
    - cpp
    - h
    - sql
    - rs
    - toml

  # Blacklist of files and folders (gitignore syntax).
  # Since we do not read .gitignore automatically, you MUST list everything here.
  denyPatterns:
    # Version Control
    - ".git/"
    - ".svn/"
    - ".hg/"
    
    # Dependencies
    - "node_modules/"
    - "bower_components/"
    
    # Build Outputs
    - "dist/"
    - "build/"
    - "out/"
    - ".next/"
    - ".nuxt/"
    - ".output/"
    
    # Caches & Logs
    - ".cache/"
    - "coverage/"
    - "*.log"
    - "npm-debug.log*"
    - "yarn-debug.log*"
    - "yarn-error.log*"
    - ".pnpm-debug.log*"
    
    # System
    - ".DS_Store"
    - "Thumbs.db"
    
    # Secrets
    - ".env"
    - ".env.local"
    - "*.pem"
    - "*.key"

# ===================================================================
# SECTION 3: PRESETS
# ===================================================================
presets:
  - id: "config-files"
    name: "Configuration"
    category: "Setup"
    summary: "All configuration files in the root."
    patterns:
      - "*.json"
      - "*.yaml"
      - "*.js"
      - "*.ts"
    exclusions:
      - "package-lock.json"
      - "pnpm-lock.yaml"

liveDevelopment:
  watchDebounceMs: 2000
  staleRefetchDelayMs: 5000
`;