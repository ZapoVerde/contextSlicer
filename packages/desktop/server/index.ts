/**
 * @file packages/desktop/server/index.ts
 * @stamp 2025-11-24T16:00:00Z
 * @architectural-role Application Entry Point
 * @description
 * The main entry point for the Desktop/Executable backend. It establishes an Express
 * server to act as the bridge between the React UI and the local filesystem.
 * It serves both the static UI assets (in production) and the REST API endpoints
 * required for file system traversal and reading.
 *
 * @core-principles
 * 1. IS the single entry point for the local Node.js process.
 * 2. ORCHESTRATES the `express` app, middleware, and route definitions.
 * 3. DELEGATES specific file operations to the `service/scanner` module.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Starts a network listener.
 *     state_ownership: none
 *     external_io: http # Listens on localhost.
 */

import yaml from 'js-yaml';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url'; // Required for ESM __dirname
import { dirname } from 'path';      // Required for ESM __dirname

// Handle CJS import for istextorbinary
import isTextOrBinary from 'istextorbinary';
const { isText } = isTextOrBinary;

import { CONFIG } from './config.js';
import { scanRepository } from './service/scanner.js';

// --- ESM Polyfills ---
// Node.js ESM mode does not provide __dirname by default.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

app.use(cors());
app.use(express.json());

// --- API ROUTES ---

// 1. Config Endpoint
app.get('/api/config', (req, res) => {
  // Return the runtime configuration so the UI knows the rules
  res.json({
    // We construct a partial SlicerConfig here
    version: 1,
    project: { targetProjectRoot: CONFIG.repoRoot },
    sanitation: CONFIG.sanitation,
    presets: [], // Could load these from yaml if we parse it fully
    // ... other defaults
  });
});

// 2. File List Endpoint
app.get('/api/files', (req, res) => {
  try {
    const files = scanRepository();
    res.json(files);
  } catch (e) {
    res.status(500).json({ error: 'Failed to scan repository' });
  }
});

// 3. File Content Endpoint
// FIX: Use Regex to handle wildcards in Express 5.0 (Bypasses path-to-regexp string rules)
app.get(/^\/api\/file\/(.+)$/, async (req, res) => {
  // Capture the first group from the regex match (everything after /api/file/)
  const relativePath = (req.params as any)[0];
  
  // Guard against missing path
  if (!relativePath) {
    res.status(400).send('Missing file path');
    return;
  }

  const fullPath = path.join(CONFIG.repoRoot, relativePath);

  // Security: Prevent directory traversal
  if (!fullPath.startsWith(CONFIG.repoRoot)) {
    res.status(403).send('Access denied');
    return;
  }

  if (!fs.existsSync(fullPath)) {
    res.status(404).send('File not found');
    return;
  }

  try {
    // Check if binary
    const checkIsText = isText(fullPath); 
    
    if (checkIsText) {
      const content = fs.readFileSync(fullPath, 'utf8');
      res.set('Content-Type', 'text/plain');
      res.send(content);
    } else {
      res.status(415).send('Binary file detected');
    }
  } catch (e) {
    res.status(500).send('Error reading file');
  }
});

// 4. Update Config Endpoint
app.post('/api/config', async (req, res) => {
  try {
    const newConfig = req.body;
    const configPath = path.join(CONFIG.repoRoot, 'slicer-config.yaml');
    
    // Convert JSON back to YAML
    const yamlStr = yaml.dump(newConfig);
    
    fs.writeFileSync(configPath, yamlStr, 'utf8');
    
    console.log('[Server] Config updated via UI');
    
    // We don't need to manually trigger a re-scan. 
    // If you have a file watcher running (future feature), it would pick this up.
    // For now, we just respond success.
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// --- STATIC UI SERVING ---

// In production (Exe), the UI is built into 'dist/public'
const UI_ROOT = path.join(__dirname, '../public');

if (fs.existsSync(UI_ROOT)) {
  app.use(express.static(UI_ROOT));
  // Use Regex /.*/ to match all remaining routes (SPA Fallback)
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(UI_ROOT, 'index.html'));
  });
} else {
  // In Dev mode (concurrently), Vite serves the UI, so this is just a fallback/API server
  console.log('> UI Root not found (Normal for Dev Mode):', UI_ROOT);
  app.get('/', (req, res) => res.send('Context Slicer Server Running (UI served via Vite in Dev)'));
}

// --- STARTUP ---

app.listen(CONFIG.port, '0.0.0.0', async () => {
  const url = `http://localhost:${CONFIG.port}`;
  console.log(`\n> Context Slicer running at: ${url}`);
  console.log(`> Scanning: ${CONFIG.repoRoot}`);
  
  // Only open browser if not in a cloud env (optional check)
  if (!process.env.IDX_WORKSPACE_URL) {
    // await open(url); 
  }
});