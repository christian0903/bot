import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import pkg from './package.json'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
