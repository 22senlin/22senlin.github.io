import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// User page (22senlin.github.io) -> served at root, so base '/' is correct.
export default defineConfig({
  plugins: [react()],
  base: '/',
})
