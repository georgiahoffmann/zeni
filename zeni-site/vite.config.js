import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Teste do ZENI no celular: o Web Bluetooth exige HTTPS. `npx cloudflared tunnel --url http://localhost:5173` dá um
  // endereço https://….trycloudflare.com que aponta para o servidor de desenvolvimento.
  server: { allowedHosts: ['.trycloudflare.com'] },
})
