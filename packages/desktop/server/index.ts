/**
 * @file packages/desktop/server/index.ts
 * @stamp {"ts":"2025-11-27T15:30:00Z"}
 * @architectural-role Feature Entry Point
 *
 * @description
 * The main entry point for the Desktop/Executable backend. It establishes an Express
 * server to act as the bridge between the React UI and the local filesystem.
 *
 * @core-principles
 * 1. IS the composition root for the local Node.js process.
 * 2. ORCHESTRATES the Express app, middleware, and route definitions.
 * 3. DELEGATES specific file operations to the service layer.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Starts a network listener.
 *     state_ownership: none
 *     external_io: http # Listens on localhost.
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

// --- MODERN IMPORT ---
// Upgraded istextorbinary to v9.5.0 eliminates the dynamic require issues.
import { isText } from 'istextorbinary';

import { CONFIG } from './config.js';
import { scanRepository } from './service/scanner.js';

// --- SAFE DIRNAME RESOLUTION ---
// In the compiled CJS executable (esbuild), we use the native __dirname.
// In the ESM development environment (tsx), we use import.meta.url.
let _dirname: string;
if (typeof __dirname !== 'undefined') {
 _dirname = __dirname;
} else {
 // @ts-ignore: import.meta defined in ESM
 _dirname = path.dirname(fileURLToPath(import.meta.url));
}

const app = express();

app.use(cors());
app.use(express.json());

// --- API ROUTES ---

app.get('/api/config', (req, res) => {
 res.json({
   version: 1,
   project: { targetProjectRoot: CONFIG.repoRoot },
   sanitation: CONFIG.sanitation,
   presets: [],
 });
});

app.get('/api/files', (req, res) => {
 try {
   const files = scanRepository();
   res.json(files);
 } catch (e) {
   res.status(500).json({ error: 'Failed to scan repository' });
 }
});

app.get(/^\/api\/file\/(.+)$/, async (req, res) => {
 const relativePath = (req.params as any)[0];
 
 if (!relativePath) { return res.status(400).send('Missing path'); }

 const fullPath = path.join(CONFIG.repoRoot, relativePath);

 if (!fullPath.startsWith(CONFIG.repoRoot)) { return res.status(403).send('Access denied'); }
 if (!fs.existsSync(fullPath)) { return res.status(404).send('Not found'); }

 try {
   const buffer = fs.readFileSync(fullPath);
   // isText in v9 returns null | boolean.
   // We check explicitly if it is NOT false (so true or null are treated as text).
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
   const configPath = path.join(CONFIG.repoRoot, 'slicer-config.yaml');
   const yamlStr = yaml.dump(newConfig);
   fs.writeFileSync(configPath, yamlStr, 'utf8');
   console.log('[Server] Config updated');
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

app.listen(CONFIG.port, '0.0.0.0', async () => {
 console.log(`\n> Context Slicer running at: http://localhost:${CONFIG.port}`);
 console.log(`> Scanning: ${CONFIG.repoRoot}`);
});