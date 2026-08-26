import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves a project site from /<repo>/, so production builds need
// that as the base or every asset 404s. CI sets it automatically; local builds
// stay at '/'. Override with VITE_BASE if the repo is ever renamed or the app
// moves to a custom domain (where the correct value is '/').
const base = process.env.VITE_BASE ?? (process.env.GITHUB_ACTIONS ? '/gnomonkey-randomizer-subtember/' : '/')

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
})
