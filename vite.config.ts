import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { config as dotenvConfig } from 'dotenv'
import path from 'path'

// Load local env (if present) so FUNCTIONS_PORT can be set in .env.local
dotenvConfig({ path: path.resolve(process.cwd(), '.env.local') })

const FUNCTIONS_PORT = process.env.FUNCTIONS_PORT || '8787'
const FUNCTIONS_HOST = `http://localhost:${FUNCTIONS_PORT}`

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: '.',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: FUNCTIONS_HOST,
        changeOrigin: true,
        secure: false,
        ws: false
      }
    }
  }
})
