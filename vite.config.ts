import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [nodePolyfills(), react()],
  // GitHub Pages: App liegt unter /Zoop/ (Repo-Name)
  base: '/Zoop/',
  define: {
    global: 'window',
  },
  resolve: {
    // simple-peer nutzt Node-Module – im Browser Polyfills verwenden
    alias: {
      events: 'events',
      util: 'util',
    },
  },
  optimizeDeps: {
    include: ['events', 'util'],
  },
})
