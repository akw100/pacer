import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { pwaConfig } from './src/pwa/manifest.config'

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA(pwaConfig)],
})
