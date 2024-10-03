import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import UnoCSS from 'unocss/vite'
import extractorSvelte from '@unocss/extractor-svelte'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 8001,
    hmr: {
      overlay: true
    }
  },
  plugins: [
  UnoCSS({
        configFile: './uno.config.ts',
      }),
    svelte()
  ]
})
