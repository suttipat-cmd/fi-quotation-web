import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const environment = (globalThis as {
  process?: { env?: Record<string, string | undefined> }
}).process?.env || {}
const buildId = environment.GITHUB_SHA || environment.VITE_BUILD_ID || 'local'
const buildVersionFile = (): Plugin => ({
  name: 'forward-insight-build-version',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: JSON.stringify({ build: buildId }),
    })
  },
})

export default defineConfig({
  base: '/fi-quotation-web/',
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [react(), buildVersionFile()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "ag-grid": ["ag-grid-community", "ag-grid-react"],
        },
      },
    },
  },
})
