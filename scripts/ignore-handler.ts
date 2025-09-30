/**
 * @file packages/context-slicer-app/scripts/ignore-handler.ts
 * @stamp {"ts":"2025-09-29T00:05:55Z"}
 * @architectural-role Configuration Assembler / Filter Engine
 *
 * @description
 * This module is responsible for creating the single, authoritative file filtering
 * engine for the entire source dump build process. It acts as the central
 * "gatekeeper," determining which files from the repository are allowed into the
 * final source package.
 *
 * It achieves this by intelligently composing rules from multiple sources in a
 * strict, hierarchical order: it begins with a hardcoded master blocklist, then
 * traverses the filesystem to discover and apply the root `.gitignore` file plus
 * all nested `.gitignore` files. Finally, it applies a non-negotiable set of
 * mandatory inclusion rules from the central configuration file.
 *
 * This "monorepo-aware" approach is the most critical feature of this module,
 * ensuring that package-specific ignore rules are correctly respected while still
 * allowing for global overrides. The final output is a single, comprehensive
 * `ignore` instance that is consumed by the file collection scripts.
 *
 * @core-principles
 * 1.  THE HIERARCHY OF RULES IS SACROSANCT: The final filtering logic MUST be
 *     applied in a specific, non-negotiable order to function correctly:
 *     1.  The hardcoded `EXPLICIT_DENY_PATTERNS` are applied first as a baseline.
 *     2.  All discovered `.gitignore` files are parsed and added.
 *     3.  The `MANDATORY_INCLUSION_PATTERNS` from the config are applied LAST,
 *         ensuring they have the final say.
 *
 * 2.  IT MUST BE MONOREPO-AWARE: The script MUST recursively traverse the entire
 *     repository structure to find and correctly parse all `.gitignore` files,
 *     applying their rules relative to their specific location.
 *
 * 3.  IT MUST BE CONFIGURATION-DRIVEN: All high-level overrides (like the mandatory
 *     inclusion of the docs folder) MUST be driven by configuration imported
 *     from `config.ts`, not by hardcoded values in this file.
 */
import fs from 'fs';
import path from 'path';
import ignore from 'ignore';
// --- START OF CHANGE: Import the new mandatory inclusion patterns ---
import { REPO_ROOT, MANDATORY_INCLUSION_PATTERNS } from './config.js'; 
import { EXPLICIT_DENY_PATTERNS } from '../src/features/context-slicer/config/sanitation.config.js';
// --- END OF CHANGE ---

const ig = ignore.default();

// 1. Add the hardcoded, high-priority deny patterns first.
ig.add(EXPLICIT_DENY_PATTERNS);


// 2. Recursively find and apply all .gitignore files in the monorepo.
function findAndApplyGitignores(startPath: string): void {
  const entries = fs.readdirSync(startPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath: string = path.join(startPath, entry.name);
    
    const relativePath: string = path.relative(REPO_ROOT, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory() && ig.ignores(relativePath)) {
      continue;
    }

    if (entry.name === '.gitignore') {
      const gitignoreContent: string = fs.readFileSync(fullPath, 'utf8');
      const baseDir: string = path.dirname(relativePath);

      const patterns: string[] = gitignoreContent
        .split('\n')
        .map(p => p.trim())
        .filter((p): p is string => !!(p && !p.startsWith('#')));

      const relativePatterns: string[] = patterns.map(p => {
        const isNegated: boolean = p.startsWith('!');
        const pattern: string = isNegated ? p.substring(1) : p;
        const resolvedPattern: string = pattern.startsWith('/')
          ? path.join(baseDir, pattern.substring(1)).replace(/\\/g, '/')
          : path.join(baseDir, pattern).replace(/\\/g, '/');
        
        return isNegated ? `!${resolvedPattern}` : resolvedPattern;
      });

      ig.add(relativePatterns);

    } else if (entry.isDirectory()) {
      findAndApplyGitignores(fullPath);
    }
  }
}

// Start the search from the repository root.
findAndApplyGitignores(REPO_ROOT);


// --- START OF CONFIGURABLE "BOSS RULE" IMPLEMENTATION ---
// 3. The Mandatory Inclusion rules are now added LAST.
// By importing this from the central config and adding it after all .gitignore
// files are processed, we guarantee it has the final say and overrides any
// other rule. This replaces the old, hardcoded `ig.add('!docs/**');` line.
ig.add(MANDATORY_INCLUSION_PATTERNS);
// --- END OF CONFIGURABLE "BOSS RULE" IMPLEMENTATION ---


export default ig;