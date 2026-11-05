import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // The web build is served from a subfolder (GitHub Pages: /Table/), set by
  // the deploy workflow. The desktop app and dev server use the root.
  base: loadEnv(mode, '.', 'TABLE_').TABLE_BASE || '/',
  // Tauri expects a fixed port and shows its own errors.
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      // Don't watch the Rust side: cargo's build output (src-tauri/target)
      // holds locked files on Windows and crashes the watcher.
      ignored: ['**/src-tauri/**'],
    },
  },
}))
