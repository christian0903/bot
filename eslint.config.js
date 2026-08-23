import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // `react-refresh/only-export-components` veut qu'un fichier n'exporte que
    // des composants, pour que le rechargement à chaud sache quoi remplacer.
    //
    // Deux familles de fichiers dérogent à cette règle par convention, et non
    // par négligence :
    //   - les primitives shadcn/ui, qui exportent leurs `variants` à côté du
    //     composant — c'est la forme livrée en amont, que les mises à jour du
    //     générateur réécrivent ;
    //   - les contextes, qui exposent leur hook `useXxx` juste après le
    //     Provider, là où on le cherche.
    //
    // Les séparer coûterait un fichier de plus par composant pour un confort
    // de développement, jamais pour la justesse du code. La règle est donc
    // éteinte ici, et nulle part ailleurs.
    files: ['src/components/ui/**/*.tsx', 'src/contexts/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
