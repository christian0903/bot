import { readFileSync, writeFileSync } from 'node:fs'
import path from "path"
import { defineConfig, loadEnv, type Plugin } from 'vite'
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

// `robots.txt` ne peut pas vivre dans `public/` : il doit dire l'inverse selon
// la cible. La vitrine de demonstration (`site.`) porte le meme contenu que le
// WordPress encore en ligne — les laisser indexer tous les deux, c'est du
// contenu duplique, et Google penalise les deux adresses. On l'ecrit donc a la
// construction, d'apres le `.env` charge.
//
// Le jour de la bascule, VITE_VITRINE_PUBLIQUE=oui ouvre l'indexation.
//
// `loadEnv` et non `process.env` : Vite ne verse PAS les fichiers `.env` dans
// `process.env`, il ne les expose qu'a `import.meta.env` dans le code client.
// Un plugin qui lirait `process.env.VITE_VITRINE` y trouverait toujours
// `undefined` — et produirait donc toujours un `Disallow`, y compris le jour
// de la bascule, ou le site resterait desindexe sans que rien ne le signale.
function ecrireRobots(mode: string): Plugin {
  return {
    name: 'ecrire-robots',
    apply: 'build',
    writeBundle() {
      const env = loadEnv(mode, __dirname, 'VITE_')
      const vitrine = env.VITE_VITRINE === 'oui'
      const publique = env.VITE_VITRINE_PUBLIQUE === 'oui'

      // L'application n'a rien a faire dans un index : ses pages exigent un
      // compte, et sa racine redirige. Seule la vitrine ouverte s'indexe.
      const corps = vitrine && publique
        ? 'User-agent: *\nAllow: /\n\nSitemap: https://backontrackstudio.be/sitemap.xml\n'
        : 'User-agent: *\nDisallow: /\n'

      writeFileSync(path.resolve(__dirname, 'dist/robots.txt'), corps)

      // Le sitemap, uniquement quand le site est indexable : `robots.txt`
      // l'annonce, et annoncer un fichier absent envoie un 404 a chaque
      // passage du robot.
      //
      // Les quatre adresses de la vitrine, ecrites a la main : elles ne
      // changent pas souvent, et les deduire du routeur demanderait de le
      // charger ici pour un gain nul.
      if (vitrine && publique) {
        const pages = ['', 'planning', 'contact']
        const jour = new Date().toISOString().slice(0, 10)
        const xml =
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          pages
            .map(
              (c) =>
                `  <url>\n    <loc>https://backontrackstudio.be/${c}</loc>\n` +
                `    <lastmod>${jour}</lastmod>\n` +
                `    <priority>${c === '' ? '1.0' : '0.8'}</priority>\n  </url>`,
            )
            .join('\n') +
          '\n</urlset>\n'
        writeFileSync(path.resolve(__dirname, 'dist/sitemap.xml'), xml)
      }
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), versionnerLeServiceWorker(), ecrireRobots(mode)],
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
}))
