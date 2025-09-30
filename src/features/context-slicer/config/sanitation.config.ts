/**
 * @file src/features/context-slicer/config/sanitation.config.ts
 * @architectural-role Shared Configuration
 *
 * @description
 * This file contains sanitation rules that are shared between the Node.js build
 * environment (the scripts) and the client-side browser environment (the application).
 * It MUST contain only pure, universal data structures (e.g., arrays of strings)
 * and MUST NOT import any Node.js-specific modules. This ensures it is "browser-safe."
 */

/**
 * A whitelist of file extensions that the client-side sanitation pipeline will
 * accept from a user-uploaded zip file. This acts as a primary security and
 * stability filter. The check should be performed case-insensitively.
 */
export const ACCEPTED_FILE_EXTENSIONS: string[] = [
    // Web & Frontend
    'html', 'css', 'scss', 'less', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'svg',
    
    // Config & Data
    'json', 'yaml', 'yml', 'toml', 'ini', 'xml', 'env', 'sh', 'bash', 'ps1',
    'firebaserc', 'gitignore', 'npmrc', 'nix',
  
    // Documentation
    'md', 'mdx', 'txt', 'rst',
  
    // Common Backend Languages
    'py', 'go', 'java', 'rb', 'php', 'cs', 'c', 'cpp', 'h', 'hpp',
    
    // Data Formats
    'csv', 'sql',
  ];
  
  /**
   * A blacklist of `.gitignore`-style patterns used to filter out common unwanted
   * directories and files. This is used by both the server-side build script and
   * the client-side sanitation pipeline.
   */
  export const EXPLICIT_DENY_PATTERNS: string[] = [
    '.git', '.git/**',
    'node_modules', 'node_modules/**',
    '.cache', '.cache/**',
    '*.pem', '*.key',
    '*serviceAccount*.json',
    'firebase*.json',
    '**.tsbuildinfo',
    '**package-lock.json',  
  
    // Explicitly ignore the new app's public and dist folders.
    'packages/context-slicer-app/dist/**',
    'packages/context-slicer-app/public/source-dump/',
    'packages/context-slicer-app/public/source-dump/**',
    '!packages/context-slicer-app/public/source-dump/.gitkeep',
  
    // Ignore the main client's dist folder.
    'packages/client/dist/**',
  
    // Tool state (usually local-only)
    '.firebase/',
    '.idx/',
  
    // Editor / OS
    '.vscode/*',
    '!.vscode/extensions.json',
    '.idea/',
    '.DS_Store',
    '*.suo',
    '*.ntvs*',
    '*.njsproj',
    '*.sln',
    '*.sw?',
  
    // Project-specific
    'src/ignore-me.js',
  ];

  /**
 * A curated list of `.gitignore`-style patterns that MUST be included in the
 * source dump, even if they are excluded by a `.gitignore` file.
 * The `!` prefix is critical, as it signifies an inclusion rule. This array
 * is consumed by the Node.js build script to ensure it has the final say.
 */
export const MANDATORY_INCLUSION_PATTERNS: string[] = [
    // This rule ensures that the top-level 'docs' folder and all its
    // contents are always included, overriding any broad `.gitignore` rules
    // (like ignoring 'public/') that might otherwise exclude it.
    '!docs',
    '!docs/**',
  ];