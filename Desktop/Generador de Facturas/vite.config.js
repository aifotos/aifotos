import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  // --- Ajustes requeridos por Tauri ---
  // Tauri usa un puerto fijo y falla si no esta disponible.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      // No vigilar la carpeta de Rust: dispara rebuilds infinitos.
      ignored: ['**/src-tauri/**'],
    },
  },
})
