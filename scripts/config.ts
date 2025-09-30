/**
 * @file packages/context-slicer-app/scripts/config.ts
 * @stamp {"ts":"2025-09-29T00:04:30Z"}
 * @architectural-role Configuration Hub
 *
 * @description
 * This file is the single source of truth for all Node.js-specific configuration
 * for the source dump generation script. It defines all critical path constants,
 * URL bases, and file content markers.
 *
 * It is also responsible for defining the master lists for file filtering.
 * It combines shared, browser-safe patterns with Node.js-specific overrides to
 * produce the final, authoritative configuration that the build scripts consume.
 *
 * @contract
 * - MUST export all paths and constants needed by other build scripts.
 * - MUST NOT contain any dynamic logic; it is for static configuration only.
 * - Any rules defined here are considered the highest level of authority for
 *   the build process.
 */
import path from 'path';
import { fileURLToPath } from 'url';
// This now needs to be a `.js` import because NodeNext module resolution in TS
// requires the extension when importing from a TS file into another TS file
// that is treated as a module.
import { 
  EXPLICIT_DENY_PATTERNS as importedDenyPatterns,
  MANDATORY_INCLUSION_PATTERNS // Import the new rule
} from '../src/features/context-slicer/config/sanitation.config.js';

// --- Path Calculations ---
const __dirname: string = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT: string = path.resolve(__dirname, '../../..');
export const PUBLIC_DIR: string = path.join(REPO_ROOT, 'packages', 'context-slicer-app', 'public');
export const DUMP_ROOT: string = path.join(PUBLIC_DIR, 'source-dump', '_full-dump');
export const FOLDERS_DIR: string = path.join(DUMP_ROOT, 'folders');

// --- URL Constants (for the manifest) ---
export const DUMP_BASE_URL: string = '/source-dump/_full-dump';
export const CONCAT_TXT_URL_BASE: string = 'source-dump.txt';
export const CONCAT_ZIP_URL_BASE: string = 'source-dump.zip';
export const FOLDERS_BASE_URL: string = 'folders';

// --- Filesystem Targets ---
export const CONCAT_TXT_PATH: string = path.join(DUMP_ROOT, CONCAT_TXT_URL_BASE);
export const CONCAT_ZIP_PATH: string = path.join(DUMP_ROOT, CONCAT_ZIP_URL_BASE);

// --- File Content Markers ---
export const BEGIN_SIG: string = '@@FILE: ';
export const END_SIG: string = '@@END_FILE@@';

/**
 * The final list of deny patterns is a combination of the shared patterns
 * plus a CRITICAL inclusion rule (`!docs/**`) to ensure the target repository's
 * documentation is always included, overriding any `.gitignore` that might
 * exclude it.
 */
export const EXPLICIT_DENY_PATTERNS: string[] = [
  ...importedDenyPatterns,  
];

// --- Re-export the imported mandatory inclusion patterns for use in ignore-handler.ts ---
export { MANDATORY_INCLUSION_PATTERNS };