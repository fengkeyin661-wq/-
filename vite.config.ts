
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        secure: false, 
        rewrite: (path) => path.replace(/^\/api\/deepseek/, '')
      },
      '/api/baichuan': {
        target: 'https://api.baichuan-ai.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api\/baichuan/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
  }
})
