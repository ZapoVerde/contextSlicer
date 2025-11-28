/**
 * @file packages/desktop/server/index.ts
 * @stamp {"ts":"2025-11-28T10:30:00Z"}
 * @architectural-role Feature Entry Point
 *
 * @description
 * The main entry point for the Desktop/Executable backend. It establishes an Express
 * server to act as the bridge between the React UI and the local filesystem.
 * It handles CLI arguments, orchestrates API endpoints, and serves static assets.
 *
 * @core-principles
 * 1. IS the composition root for the local Node.js process.
 * 2. ORCHESTRATES the Express app, middleware, and route definitions.
 * 3. DELEGATES specific file operations to the service layer.
 * 4. MUST NOT contain complex business logic; it routes requests to Services.
 *
 * @api-declaration
 *   CLI: --init (Generates default config)
 *   GET /api/config
 *   POST /api/config
 *   GET /api/files
 *   GET /api/fs/browse
 *   GET /api/file/*
 *
 * @contract
 *   assertions:
 *     purity: mutates # Starts a network listener and writes to disk on specific actions.
 *     state_ownership: none
 *     external_io: http # Listens on localhost.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { isText } from 'istextorbinary';

import { getRuntimeConfig, RUNTIME_CWD, CONFIG_PATH, PORT } from './config.js';
import { scanRepository } from './service/scanner.js';
import { DEFAULT_CONFIG_YAML } from './defaultConfig.js';

// --- CLI COMMAND ORCHESTRATION ---
// Check for --init flag to generate config file before starting the server.
if (process.argv.includes('--init')) {
  if (fs.existsSync(CONFIG_PATH)) {
    console.error('\n❌ Error: slicer-config.yaml already exists in this directory.');
    console.error('   Please rename or delete it before running --init.\n');
    process.exit(1);
  }

  try {
    fs.writeFileSync(CONFIG_PATH, DEFAULT_CONFIG_YAML, 'utf8');
    console.log('\n✅ Created slicer-config.yaml');
    console.log('   You can now edit this file to customize the Context Slicer.\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error writing file:', err);
    process.exit(1);
  }
}

// --- SAFE DIRNAME RESOLUTION ---
// In the compiled CJS executable (esbuild), 'import.meta' is empty/undefined.
// We prioritize the native CJS __dirname to prevent runtime crashes.
let _dirname: string;
if (typeof __dirname !== 'undefined') {
  _dirname = __dirname;
} else {
  // This branch runs only in the ESM development environment (tsx)
  // @ts-ignore: import.meta check
  _dirname = path.dirname(fileURLToPath(import.meta.url));
}

const app = express();

app.use(cors());
app.use(express.json());

// --- API ROUTES ---

/**
 * Returns the fully resolved configuration object and the raw YAML.
 */
app.get('/api/config', (req, res) => {
  const config = getRuntimeConfig();
  res.json(config.rawConfig);
});

/**
 * Scans the target directory defined in the CURRENT configuration.
 * Re-reads config on every request to ensure freshness.
 */
app.get('/api/files', (req, res) => {
  try {
    const config = getRuntimeConfig();
    const result = scanRepository(config);

    if (result.error) {
      // We log the warning server-side but still return what we found to the UI.
      console.warn(`[API] Scan completed with warning: ${result.error}`);
    }

    res.json(result.files);
  } catch (e) {
    console.error('[API] Scan failed:', e);
    res.status(500).json({ error: 'Failed to scan repository' });
  }
});

/**
 * Allows the UI to navigate the server's filesystem to select a Root Directory.
 */
app.get('/api/fs/browse', (req, res) => {
  try {
    const targetPath = (req.query.path as string) || RUNTIME_CWD;

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ error: 'Path not found' });
    }

    const stats = fs.statSync(targetPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Not a directory' });
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });

    // Filter for directories only, as we are picking a root folder.
    const folders = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name);

    res.json({
      current: path.resolve(targetPath),
      parent: path.dirname(path.resolve(targetPath)),
      folders: folders.sort(),
      isProjectRoot: fs.existsSync(path.join(targetPath, 'package.json')),
    });
  } catch (e) {
    console.error('[API] Browse failed:', e);
    res.status(500).json({ error: 'Failed to browse filesystem' });
  }
});

/**
 * Retrieves the content of a specific file.
 * Performs path traversal security checks and binary file detection.
 */
app.get(/^\/api\/file\/(.+)$/, async (req, res) => {
  const relativePath = (req.params as any)[0];

  if (!relativePath) {
    return res.status(400).send('Missing path');
  }

  const config = getRuntimeConfig();
  const fullPath = path.join(config.repoRoot, relativePath);

  // Security: Prevent accessing files outside the targeted repo root
  if (!fullPath.startsWith(config.repoRoot)) {
    return res.status(403).send('Access denied');
  }
  if (!fs.existsSync(fullPath)) {
    return res.status(404).send('Not found');
  }

  try {
    const buffer = fs.readFileSync(fullPath);
    // isText returns null (undetermined), true (text), or false (binary).
    const checkIsText = isText(fullPath, buffer);

    if (checkIsText !== false) {
      res.set('Content-Type', 'text/plain');
      res.send(buffer);
    } else {
      res.status(415).send('Binary file detected');
    }
  } catch (e) {
    console.error(e);
    res.status(500).send('Error reading file');
  }
});

/**
 * Saves configuration changes from the UI to disk.
 * Strictly writes to 'slicer-config.yaml' in the CWD.
 */
app.post('/api/config', async (req, res) => {
  try {
    const newConfig = req.body;
    const yamlStr = yaml.dump(newConfig);
    fs.writeFileSync(CONFIG_PATH, yamlStr, 'utf8');

    console.log('[Server] Config updated via UI');
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// --- STATIC UI SERVING ---
const UI_ROOT = path.join(_dirname, '../public');

if (fs.existsSync(UI_ROOT)) {
  app.use(express.static(UI_ROOT));
  app.get(/.*/, (req, res) => res.sendFile(path.join(UI_ROOT, 'index.html')));
} else {
  console.log('> UI Root not found (Normal for Dev Mode):', UI_ROOT);
  app.get('/', (req, res) => res.send('Context Slicer API Running'));
}

// --- STARTUP ---
app.listen(PORT, '0.0.0.0', async () => {
  // We get the config once just for the log message, but it's re-read on requests.
  const startupConfig = getRuntimeConfig();
  console.log(`\n> Context Slicer running at: http://localhost:${PORT}`);
  console.log(`> Scanning: ${startupConfig.repoRoot}`);
  console.log(`> Tip: Run with --init to generate a config file.`);
});