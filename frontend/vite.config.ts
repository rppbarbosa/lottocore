import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3003',
        changeOrigin: true,
        // Respostas binárias (PDF) sem transformação
        configure(proxy) {
          proxy.on('proxyRes', (proxyRes) => {
            const ct = proxyRes.headers['content-type']
            if (
              typeof ct === 'string' &&
              (ct.includes('application/pdf') ||
                ct.includes('image/png') ||
                ct.includes('image/jpeg'))
            ) {
              delete proxyRes.headers['content-encoding']
            }
          })
        },
      },
      '/ws': {
        target: 'ws://localhost:3003',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
