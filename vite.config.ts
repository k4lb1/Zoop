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
    alias: {
      events: 'events',
      util: 'util',
      stream: 'readable-stream',
    },
    dedupe: ['readable-stream', 'stream'],
  },
  optimizeDeps: {
    include: ['events', 'util', 'readable-stream', 'buffer', 'simple-peer'],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
})
