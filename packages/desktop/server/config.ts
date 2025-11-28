/**
 * @file packages/desktop/server/config.ts
 * @stamp {"ts":"2025-11-28T10:15:00Z"}
 * @architectural-role Configuration
 * @description
 * Manages the resolution and loading of the application's runtime configuration.
 * It determines the root directory for scanning and parses the `slicer-config.yaml`
 * file from the disk on demand.
 *
 * @core-principles
 * 1. OWNS the resolution of the runtime environment variables (CWD, Port, Config Path).
 * 2. MUST provide a dynamic view of the configuration to support live settings updates.
 * 3. ENFORCES safe default fallback values if the configuration file is missing or invalid.
 *
 * @api-declaration
 *   export const RUNTIME_CWD: string;
 *   export const CONFIG_PATH: string;
 *   export const PORT: number;
 *   export interface AppConfig {
 *     repoRoot: string;
 *     sanitation: {
 *       denyPatterns: string[];
 *       acceptedExtensions: string[] | null;
 *       maxUploadSizeMb: number;
 *     };
 *     rawConfig: any;
 *   }
 *   export function getRuntimeConfig(): AppConfig;
 *
 * @contract
 *   assertions:
 *     purity: read-only # Reads from disk, does not mutate global state.
 *     state_ownership: none
 *     external_io: none # Local filesystem only.
 */

import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import { DEFAULT_CONFIG_YAML } from './defaultConfig.js';

// The directory where the executable/script is launched
export const RUNTIME_CWD = process.cwd();
export const CONFIG_PATH = path.join(RUNTIME_CWD, 'slicer-config.yaml');
export const PORT = Number(process.env.PORT) || 3000;

export interface AppConfig {
  repoRoot: string; // Absolute path to the scan target
  sanitation: {
    denyPatterns: string[];
    acceptedExtensions: string[] | null;
    maxUploadSizeMb: number;
  };
  rawConfig: any; // The full raw YAML object to send to the frontend
}

/**
 * Reads the config file from disk (or uses defaults) and resolves the target path.
 * This is called on every request to ensure freshness.
 */
export function getRuntimeConfig(): AppConfig {
  let userConfig: any = null;

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      userConfig = yaml.load(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (e) {
      console.error(`[Config] Failed to parse slicer-config.yaml:`, e);
      // Fallback to empty object to trigger defaults below
      userConfig = {};
    }
  } else {
    // If no file exists, parse the default template to use as memory fallback
    try {
      userConfig = yaml.load(DEFAULT_CONFIG_YAML);
    } catch {
      userConfig = {};
    }
  }

  // Resolve target root relative to the CWD
  // Default to '.' (Current Directory) if not specified
  const relativeTarget = userConfig?.project?.targetProjectRoot || '.';
  const repoRoot = path.resolve(RUNTIME_CWD, relativeTarget);

  // Default sanitation if missing or partial
  // We enforce a baseline safety net to prevent scanning the entire OS or massive folders
  const sanitation = {
    denyPatterns: userConfig?.sanitation?.denyPatterns || [
      '.git/',
      'node_modules/',
      'dist/',
    ],
    acceptedExtensions: userConfig?.sanitation?.acceptedExtensions || null,
    maxUploadSizeMb: userConfig?.sanitation?.maxUploadSizeMb || 500,
  };

  return {
    repoRoot,
    sanitation,
    rawConfig: userConfig || {},
  };
}