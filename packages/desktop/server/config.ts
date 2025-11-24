/**
 * @file packages/desktop/server/config.ts
 * @stamp 2025-11-24T12:00:00Z
 * @architectural-role Configuration
 * @description
 * Defines the runtime environment configuration. In an executable context,
 * the "Repo Root" is the Current Working Directory (CWD).
 */

import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';

// The directory where the executable/script is launched
export const RUNTIME_CWD = process.cwd();

// Look for a config file in the user's project
const USER_CONFIG_PATH = path.join(RUNTIME_CWD, 'slicer-config.yaml');

let userConfig: any = null;

if (fs.existsSync(USER_CONFIG_PATH)) {
  try {
    userConfig = yaml.load(fs.readFileSync(USER_CONFIG_PATH, 'utf8'));
    console.log(`[Config] Loaded config from ${USER_CONFIG_PATH}`);
  } catch (e) {
    console.error(`[Config] Failed to parse slicer-config.yaml:`, e);
  }
}

// If no config, or relative path, resolve against CWD
const targetRoot = userConfig?.project?.targetProjectRoot || '.';
export const REPO_ROOT = path.resolve(RUNTIME_CWD, targetRoot);

// Port can be set via env (for IDX) or default to 3000
export const PORT = Number(process.env.PORT) || 3000;

export const CONFIG = {
  repoRoot: REPO_ROOT,
  port: PORT,
  // Default sanitation if no config found
  sanitation: userConfig?.sanitation || {
    denyPatterns: ['.git', 'node_modules', 'dist', '.DS_Store'],
    acceptedExtensions: null // Null implies "use auto-detection"
  }
};