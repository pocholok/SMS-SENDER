import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
        '/proxy': {
          target: 'http://8.219.42.83:20003',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/proxy/, ''),
          secure: false,
        }
      }
  }
})
