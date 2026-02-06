import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Für GitHub Pages: base auf Repo-Namen setzen, z.B. base: '/p2pNostr/'
  base: '/',
})
