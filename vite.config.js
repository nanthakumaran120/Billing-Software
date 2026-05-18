import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 3005,
    open: true,
    proxy: {
      '/customers': 'http://localhost:3002',
      '/products': 'http://localhost:3002',
      '/invoices': 'http://localhost:3002',
      '/settings': 'http://localhost:3002',
      '/api': 'http://localhost:3002',
    }
  },
})
