import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'main.html'),
        login: resolve(__dirname, 'index.html'),
      }
    }
  }
})