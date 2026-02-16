/**
 * @file packages/desktop/vite.config.ts
 * @stamp {"ts":"2026-02-16T21:30:00Z"}
 * @architectural-role Configuration
 * @description
 * Vite configuration for the Desktop implementation. Orchestrates the 
 * build process for the React client and establishes the developer 
 * proxy for both standard REST APIs and real-time WebSocket notifications.
 *
 * @core-principles
 * 1. PLATFORM AGNOSTICISM: Uses polyfills to support Babel logic in the browser.
 * 2. PROXY ORCHESTRATION: ENFORCES correct routing for distributed notifications.
 * 3. RESOURCE EFFICIENCY: Targets 'dist/public' to match backend serving logic.
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  // The React plugin sometimes requires casting due to minor version mismatches in Vite types
  plugins: [react() as any],
  
  root: '.', 
  
  build: {
    // The Desktop server expects the UI to be served from 'dist/public'
    outDir: 'dist/public', 
    emptyOutDir: true,
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client'),
    },
  },

  server: {
    port: 5173,
    proxy: {
      // 1. Proxy standard REST calls
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      // 2. Proxy the specific watcher WebSocket path
      '/api/watcher-ws': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    }
  },

  define: {
    /**
     * Polyfill 'process' for Babel-related libraries (parser/traverse) 
     * running in the browser environment.
     */
    'process.env': {},
    'process.platform': '"browser"',
    'process.version': '"0.0.0"',
  },
});