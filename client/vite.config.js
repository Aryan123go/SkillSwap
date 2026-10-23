
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Socket.IO's ESM entry can become stale in Vite's optimized-dependency cache
  // during reconnect/HMR cycles. Keep it out of that cache; its package ships ESM.
  
  optimizeDeps: {
  include: ['socket.io-client'],
},
  server: {
    proxy: {
      '/socket.io': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
