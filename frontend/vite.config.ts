/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
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
  },
  server: {
    host: true, // Needed for Docker
    port: 5173,
    watch: {
      usePolling: true // Needed for Docker on some systems
    },
    proxy: {
      '/api': {
        // eslint-disable-next-line no-undef
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
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['lucide-react', 'recharts'],
          'vendor-maps': ['leaflet', 'react-leaflet', 'supercluster', 'use-supercluster'],
          'vendor-utils': ['axios', '@tanstack/react-query', 'zustand', '@tanstack/react-router']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})
