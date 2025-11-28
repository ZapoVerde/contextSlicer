import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react() as any],
  root: '.', // Build from package root to find index.html
  build: {
    // Output the React app to 'dist/public'
    outDir: 'dist/public', 
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  define: {
    // Polyfill 'process' for Babel libraries running in the browser
    'process.env': {},
    'process.platform': '"browser"',
    'process.version': '"0.0.0"',
  },
});
