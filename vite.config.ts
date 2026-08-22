import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/fi-quotation-web/',
  plugins: [react()],
})
