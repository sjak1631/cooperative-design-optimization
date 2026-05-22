import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/ex3-season2-slide-app/' : '/',
  plugins: [react()],
  server: {
    port: 5174,
    host: '0.0.0.0',
  },
})
