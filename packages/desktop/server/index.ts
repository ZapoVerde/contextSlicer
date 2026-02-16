/**
 * @file packages/desktop/server/index.ts
 * @stamp {"ts":"2026-02-16T22:15:00Z"}
 * @architectural-role Feature Entry Point
 *
 * @description
 * The main entry point for the Desktop/Executable backend. It establishes an Express
 * server and a WebSocket server to act as the bridge between the React UI and the 
 * local filesystem. It manages the file watcher lifecycle to broadcast changes.
 *
 * @core-principles
 * 1. IS the composition root for the local Node.js process.
 * 2. ORCHESTRATES the Express app, WebSocket server, and File Watcher.
 * 3. DELEGATES specific file operations to the service layer.
 * 4. NOTIFIES connected clients of filesystem events in real-time.
 *
 * @api-declaration
 *   CLI: --init (Generates default config)
 *   WS: / (WebSocket connection)
 *   GET /api/config
 *   POST /api/config
 *   GET /api/files (Metadata only)
 *   GET /api/bulk-files (Full Content Snapshot)
 *   GET /api/fs/browse
 *   GET /api/file/*
 *
 * @contract
 *   assertions:
 *     purity: mutates # Starts network listeners and filesystem watchers.
 *     state_ownership: [watcher, wss]
 *     external_io: [http, ws, fs, chokidar]
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { isText } from 'istextorbinary';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';

import { getRuntimeConfig, RUNTIME_CWD, CONFIG_PATH, PORT } from './config.js';
import { scanRepository, readRepositoryContent } from './service/scanner.js';
import { DEFAULT_CONFIG_YAML } from './defaultConfig.js';

// --- CLI COMMAND ORCHESTRATION ---
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
const server = http.createServer(app);
// Listen specifically on /api/watcher-ws
const wss = new WebSocketServer({ server, path: '/api/watcher-ws' });

app.use(cors());
// Increase payload limit for saving large configs if necessary, though mainly for JSON
app.use(express.json({ limit: '50mb' }));

// --- WATCHER STATE ---
let watcher: FSWatcher | null = null;

function broadcast(type: 'change' | 'add' | 'unlink', relativePath: string) {
  const message = JSON.stringify({ type, path: relativePath });
  wss.clients.forEach((client: WebSocket) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function startWatcher() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }

  const config = getRuntimeConfig();
  const { repoRoot } = config;
  const debounceMs = config.rawConfig.liveDevelopment?.watchDebounceMs || 2000;
  
  console.log(`[Watcher] Starting on: ${repoRoot} (Debounce: ${debounceMs}ms)`);

  watcher = chokidar.watch(repoRoot, {
    ignored: config.sanitation.denyPatterns,
    ignoreInitial: true,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: debounceMs,
      pollInterval: 100,
    },
  });

  const handleEvent = (type: 'change' | 'add' | 'unlink') => (fullPath: string) => {
    // Convert absolute path to repo-relative path
    const relativePath = path.relative(repoRoot, fullPath).replace(/\\/g, '/');
    console.log(`[Watcher] ${type}: ${relativePath}`);
    broadcast(type, relativePath);
  };

  watcher
  .on('add', handleEvent('add'))
  .on('change', handleEvent('change'))
  .on('unlink', handleEvent('unlink'))
  .on('error', (error: unknown) => console.error(`[Watcher] Error: ${error}`));
}

// Start watcher initially
startWatcher();

// --- API ROUTES ---

app.get('/api/config', (req, res) => {
  const config = getRuntimeConfig();
  res.json(config.rawConfig);
});

/**
 * Legacy metadata-only scan.
 */
app.get('/api/files', async (req, res) => {
  try {
    const config = getRuntimeConfig();
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
 * NEW: Bulk content retrieval.
 * Returns { "path/to/file": "content..." } for all valid text files.
 */
app.get('/api/bulk-files', async (req, res) => {
  try {
    const config = getRuntimeConfig();
    console.log('[API] Starting bulk file read...');
    console.time('BulkRead');
    
    const result = await readRepositoryContent(config);
    
    console.timeEnd('BulkRead');
    if (result.error) {
      console.warn(`[API] Bulk read completed with warning: ${result.error}`);
    }
    
    console.log(`[API] Serving ${Object.keys(result.files).length} files.`);
    res.json(result.files);
  } catch (e) {
    console.error('[API] Bulk read failed:', e);
    res.status(500).json({ error: 'Failed to read repository content' });
  }
});

app.get('/api/fs/browse', async (req, res) => {
  try {
    const targetPath = (req.query.path as string) || RUNTIME_CWD;

    if (!fs.existsSync(targetPath)) { 
      return res.status(404).json({ error: 'Path not found' });
    }
    
    const stats = await fsp.stat(targetPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Not a directory' });
    }

    const entries = await fsp.readdir(targetPath, { withFileTypes: true });
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

// Single-file fetch (Fallback/Legacy support)
app.get(/^\/api\/file\/(.+)$/, async (req, res) => {
  const relativePath = (req.params as any)[0];
  if (!relativePath) return res.status(400).send('Missing path');

  const config = getRuntimeConfig();
  const fullPath = path.join(config.repoRoot, relativePath);

  if (!fullPath.startsWith(config.repoRoot)) return res.status(403).send('Access denied');
  if (!fs.existsSync(fullPath)) return res.status(404).send('Not found');

  try {
    const buffer = await fsp.readFile(fullPath);
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

app.post('/api/config', async (req, res) => {
  try {
    const newConfig = req.body;
    const yamlStr = yaml.dump(newConfig);
    await fsp.writeFile(CONFIG_PATH, yamlStr, 'utf8');

    console.log('[Server] Config updated via UI. Restarting watcher...');
    
    // Restart watcher with new settings
    startWatcher();

    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// --- STATIC UI SERVING ---
const UI_ROOT = path.join(_dirname, '../public');
const INDEX_HTML = path.join(UI_ROOT, 'index.html');

if (fs.existsSync(UI_ROOT) && fs.existsSync(INDEX_HTML)) {
  app.use(express.static(UI_ROOT));
  app.get(/.*/, (req, res) => res.sendFile(INDEX_HTML));
} else {
  console.log('> UI Root not found (Normal for Dev Mode):', UI_ROOT);
  app.get('/', (req, res) => res.send('Context Slicer API Running. Use the Vite server for UI.'));
}

// --- STARTUP ---
server.listen(PORT, '0.0.0.0', async () => {
  const startupConfig = getRuntimeConfig();
  console.log(`\n> Context Slicer running at: http://localhost:${PORT}`);
  console.log(`> Scanning: ${startupConfig.repoRoot}`);
  console.log(`> Tip: Run with --init to generate a config file.`);
});