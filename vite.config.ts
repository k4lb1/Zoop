import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
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
