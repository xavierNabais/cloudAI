import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-api',
      closeBundle() {
        // Copiar pasta api para dist
        const apiSource = join(process.cwd(), 'api');
        const apiDest = join(process.cwd(), 'dist', 'api');
        
        if (existsSync(apiSource)) {
          const { execSync } = require('child_process');
          try {
            execSync(`xcopy /E /I /Y "${apiSource}" "${apiDest}"`, { shell: true });
          } catch (e) {
            // Fallback para sistemas Unix
            try {
              execSync(`cp -r "${apiSource}" "${apiDest}"`, { shell: true });
            } catch (e2) {
              console.warn('Não foi possível copiar a pasta api:', e2);
            }
          }
        }
      }
    }
  ],
  build: {
    outDir: 'dist',
  },
  publicDir: 'public',
});
