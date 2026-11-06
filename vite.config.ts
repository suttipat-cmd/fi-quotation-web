import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

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
const omitPublishedApksFromAndroid = (): Plugin => ({
  name: 'omit-published-apks-from-android',
  closeBundle() {
    if (environment.CAPACITOR_BUILD === '1') rmSync(resolve('dist/android'), { recursive: true, force: true })
  },
})

export default defineConfig({
  base: environment.CAPACITOR_BUILD === '1' ? '/' : '/fi-quotation-web/',
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [react(), buildVersionFile(), omitPublishedApksFromAndroid()],
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
