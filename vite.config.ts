import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  // This is a documented exception. Due to a subtle type mismatch between Vite
  // and its React plugin versions, a standard type assertion fails. We use 'any'
  // here as a pragmatic escape hatch and disable the linter for this line only,
  // acknowledging that we are intentionally overriding the type check.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [react() as any],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
  },
  server: {
    port: 5174,
    open: true,
    host: '0.0.0.0',
    hmr: {
      // This is the definitive fix for the Cloud Workstation environment.
      // It tells the HMR client (in the browser) to connect to the standard
      // public HTTPS port (443), which the proxy knows how to forward correctly.
      clientPort: 443,
    },
  },
  define: {
    'process.env': {},
  },
});