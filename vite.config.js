import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    open: true,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
});
