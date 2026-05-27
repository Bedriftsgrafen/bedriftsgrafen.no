/// <reference types="vitest" />
import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
      routeFileIgnorePrefix: '-',
      quoteStyle: 'single',
    }),
    react(),
    visualizer({
      open: false,
      filename: 'stats.html',
      gzipSize: true,
      brotliSize: true,
    })
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    exclude: [...configDefaults.exclude, 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/routeTree.gen.ts',
        'src/main.tsx',
        'src/setupTests.ts'
      ]
    }
  },
  server: {
    host: true, // Needed for Docker
    port: 5173,
    open: true,
    watch: {
      usePolling: true // Needed for Docker on some systems
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://bedriftsgrafen-backend:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  preview: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  },
  build: {
    sourcemap: false, // Remove if issues arise
    rolldownOptions: {
      output: {
        manualChunks(id) {
          // Rollup CJS interop helper (getDefaultExportFromCjs) — tiny (~100B) but
          // shared by many chunks. Without this rule Vite places it in whichever CJS
          // chunk is largest (leaflet), which forces EVERY route to preload 157KB of
          // leaflet just for this one helper function.
          if (id.includes('commonjsHelpers')) {
            return 'vendor-react'
          }
          // react-dom/server is only used by map marker rendering. Keep it with the
          // lazy map route instead of the app-wide React runtime chunk.
          if (id.includes('node_modules/react-dom/server') || id.includes('node_modules/react-dom/cjs/react-dom-server')) {
            return
          }
          // Core framework — always needed on every page
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'vendor-react'
          }
          // Router + query + state — always needed on every page
          if (id.includes('@tanstack/react-query') || id.includes('@tanstack/react-router') || id.includes('zustand') || id.includes('axios')) {
            return 'vendor-utils'
          }
          // Shared micro-deps used by both Recharts AND Leaflet — must be in a neutral
          // chunk to prevent Vite from placing them in the leaflet chunk and forcing
          // every Recharts consumer to download 154KB of leaflet code
          if (id.includes('node_modules/clsx/')) {
            return 'vendor-utils'
          }
          // Maps, charts, and icons are route-local. Manual chunks for these packages
          // can make the app shell preload code that only lazy routes need.
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})
