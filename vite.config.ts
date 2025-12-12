
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy all requests starting with /api/deepseek to the actual API
      '/api/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        secure: false, // Allow self-signed certs if necessary
        rewrite: (path) => path.replace(/^\/api\/deepseek/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
  }
})
