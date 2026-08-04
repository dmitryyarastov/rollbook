/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative base so the build works at any mount path (GitHub Pages
  // serves this app from /rollbook/, not the domain root).
  base: './',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  test: { environment: 'node' },
})
