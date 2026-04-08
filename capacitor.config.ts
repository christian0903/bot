import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'be.backontrackstudio.app',
  appName: 'Back on Track',
  webDir: 'dist',
  // Charger directement l'URL de production pour bénéficier des mises à jour
  // sans repasser par les stores. Commenter pour utiliser le build local (dist/).
  server: {
    url: 'https://desk.backontrackstudio.be',
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
  },
  android: {
    backgroundColor: '#0a0a0a',
  },
}

export default config
