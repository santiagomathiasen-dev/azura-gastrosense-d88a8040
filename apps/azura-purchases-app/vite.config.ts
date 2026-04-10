import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@azura/purchases': path.resolve(__dirname, '../../packages/azura-purchases/src/index.ts'),
    },
  },
});
