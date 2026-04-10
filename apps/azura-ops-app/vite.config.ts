import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@azura/ops': path.resolve(__dirname, '../../packages/azura-ops/src/index.ts'),
    },
  },
});
