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
      includeAssets: ['img/icons/todo-icon.svg'],
      manifest: {
        name: 'Todo',
        short_name: 'Todo',
        description: 'Todo',
        theme_color: '#2564cf',
        background_color: '#faf9f8',
        display: 'standalone',
        icons: [
          {
            src: 'img/icons/todo-icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: 'img/icons/todo-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
  ],
  base: '/todo/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
