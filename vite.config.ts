import { readFileSync, writeFileSync } from 'node:fs'
import path from "path"
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json'

// Le service worker vit dans `public/` : Vite le recopie tel quel, sans jamais
// le transformer, donc `__APP_VERSION__` ne l'atteint pas. Or son nom de cache
// était figé à 'bot-v1' — un testeur pouvait rester sur une version périmée et
// signaler un bug déjà corrigé. On y injecte donc la version à la construction :
// le cache change de nom à chaque bump, et l'ancien est purgé par `activate`.
function versionnerLeServiceWorker(): Plugin {
  return {
    name: 'versionner-le-sw',
    apply: 'build',
    writeBundle() {
      const chemin = path.resolve(__dirname, 'dist/sw.js')
      const source = readFileSync(chemin, 'utf-8')
      writeFileSync(chemin, source.replace('__SW_VERSION__', pkg.version))
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), versionnerLeServiceWorker()],
  // La version affichée dans le pied de page vient du package.json : elle était
  // figée à 1.0.0 dans le composant et n'avait plus rien à voir avec la réalité.
  // Un numéro de version faux vaut moins que pas de numéro du tout — il fausse
  // les rapports de bug.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
