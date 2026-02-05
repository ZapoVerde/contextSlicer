// ----- packages/desktop/server/index.ts -----
/**
 * @file packages/desktop/server/index.ts
 * @stamp {"ts":"2025-12-05T14:40:00Z"}
 * @architectural-role Feature Entry Point
 *
 * @description
 * The main entry point for the Desktop/Executable backend. It establishes an Express
 * server to act as the bridge between the React UI and the local filesystem.
 * It has been refactored to use asynchronous, non-blocking I/O for file system
 * operations and integrates with the newly asynchronous `scanRepository`.
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
// TYPE-GUARD-REASON: We use fs/promises here, but the check for CONFIG_PATH still needs the sync fs.
import fs from 'fs'; 
import fsp from 'fs/promises'; // NEW: Use fs/promises for non-blocking I/O
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { isText } from 'istextorbinary';

import { getRuntimeConfig, RUNTIME_CWD, CONFIG_PATH, PORT } from './config.js';
// The import of scanRepository is now an asynchronous function
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
let _dirname: string;
if (typeof __dirname !== 'undefined') {
  _dirname = __dirname;
} else {
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
 * Refactored to be ASYNCHRONOUS to handle the non-blocking scanRepository.
 */
app.get('/api/files', async (req, res) => {
  try {
    const config = getRuntimeConfig();
    // ASYNC I/O: Await the non-blocking scanner service
    const result = await scanRepository(config);

    if (result.error) {
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
 * Refactored to use ASYNCHRONOUS I/O.
 */
app.get('/api/fs/browse', async (req, res) => {
  try {
    const targetPath = (req.query.path as string) || RUNTIME_CWD;

    // Use synchronous check here to avoid a try/catch block if the path is wildly wrong.
    if (!fs.existsSync(targetPath)) { 
      return res.status(404).json({ error: 'Path not found' });
    }
    
    // ASYNC I/O: Use promises for stat and readdir
    const stats = await fsp.stat(targetPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Not a directory' });
    }

    const entries = await fsp.readdir(targetPath, { withFileTypes: true });

    // Filter for directories only, as we are picking a root folder.
    const folders = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name);

    res.json({
      current: path.resolve(targetPath),
      parent: path.dirname(path.resolve(targetPath)),
      folders: folders.sort(),
      // Use synchronous check here for simplicity on a single file check.
      isProjectRoot: fs.existsSync(path.join(targetPath, 'package.json')),
    });
  } catch (e) {
    console.error('[API] Browse failed:', e);
    res.status(500).json({ error: 'Failed to browse filesystem' });
  }
});

/**
 * Retrieves the content of a specific file.
 * Refactored to use ASYNCHRONOUS I/O.
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
  // Use synchronous check here for simplicity on a single file check.
  if (!fs.existsSync(fullPath)) {
    return res.status(404).send('Not found');
  }

  try {
    // ASYNC I/O: Use fs.promises.readFile for non-blocking content retrieval
    const buffer = await fsp.readFile(fullPath);
    
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
 * Refactored to use ASYNCHRONOUS I/O.
 */
app.post('/api/config', async (req, res) => {
  try {
    const newConfig = req.body;
    const yamlStr = yaml.dump(newConfig);
    // ASYNC I/O: Use fs.promises.writeFile
    await fsp.writeFile(CONFIG_PATH, yamlStr, 'utf8');

    console.log('[Server] Config updated via UI');
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// --- STATIC UI SERVING ---
const UI_ROOT = path.join(_dirname, '../public');
const INDEX_HTML = path.join(UI_ROOT, 'index.html');

// Check for index.html existence using sync for process startup
if (fs.existsSync(UI_ROOT) && fs.existsSync(INDEX_HTML)) {
  app.use(express.static(UI_ROOT));
  app.get(/.*/, (req, res) => res.sendFile(INDEX_HTML));
} else {
  console.log('> UI Root not found (Normal for Dev Mode):', UI_ROOT);
  app.get('/', (req, res) => res.send('Context Slicer API Running. Use the Vite server for UI.'));
}

// --- STARTUP ---
app.listen(PORT, '0.0.0.0', async () => {
  const startupConfig = getRuntimeConfig();
  console.log(`\n> Context Slicer running at: http://localhost:${PORT}`);
  console.log(`> Scanning: ${startupConfig.repoRoot}`);
  console.log(`> Tip: Run with --init to generate a config file.`);
});