import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['img/icons/todo-icon.svg', 'img/icons/pwa-192x192.png', 'img/icons/pwa-512x512.png'],
      manifest: {
        name: 'Todo',
        short_name: 'Todo',
        description: 'Todo',
        theme_color: '#2564cf',
        background_color: '#faf9f8',
        display: 'standalone',
        icons: [
          {
            src: 'img/icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'img/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
  ],
  base: '/todo/',
  build: {
    chunkSizeWarningLimit: 550,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          const firebasePackage = id.match(/node_modules\/((?:@firebase|firebase)\/[^/]+)/)?.[1]
          if (firebasePackage) return firebasePackage.replaceAll('/', '-')
          return undefined
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
