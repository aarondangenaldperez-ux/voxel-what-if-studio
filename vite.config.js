import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this project from /<repository-name>/.
export default defineConfig({
  plugins: [react()],
  base: '/voxel-what-if-studio/',
  server: {
    proxy: {
      '/api': {
        target: process.env.AI_API_SERVER_URL || 'http://127.0.0.1:8787',
        changeOrigin: true
      }
    }
  }
});
