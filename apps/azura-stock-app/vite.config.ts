import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// https://vite.dev/config/
// O alias abaixo garante que @azura/stock resolve direto para o
// TypeScript source do pacote local, sem precisar compilar antes.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@azura/stock': path.resolve(__dirname, '../../packages/azura-stock/src/index.ts'),
    },
  },
});
