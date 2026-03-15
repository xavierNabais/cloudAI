import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

function copyDir(src, dest) {
  if (!existsSync(src)) return;
  
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  
  const entries = readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

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
          try {
            copyDir(apiSource, apiDest);
            console.log('Pasta api copiada com sucesso para dist/');
          } catch (e) {
            console.warn('Erro ao copiar pasta api:', e);
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
