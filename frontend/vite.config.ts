import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'Gram Saathi — AI Rural Citizen Assistant',
        short_name: 'Gram Saathi',
        description: 'AI-Powered Rural Government Service Execution Platform for Schemes and Services',
        theme_color: '#075E54',
        background_color: '#F8F9FA',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/logo.svg',
            sizes: '192x192 512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        navigateFallback: '/index.html',
        // Strictly prevent caching of private citizen documents, uploads, or API routes
        navigateFallbackDenylist: [/^\/api\//, /^\/storage\//, /^\/documents\//, /\/document\//],
        runtimeCaching: [
          {
            // Zero-caching rule for private citizen documents, uploads, and APIs
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api') ||
              url.pathname.startsWith('/storage') ||
              url.pathname.includes('/document'),
            handler: 'NetworkOnly',
            options: {
              backgroundSync: undefined,
            },
          },
        ],
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      }
    }
  }
})
