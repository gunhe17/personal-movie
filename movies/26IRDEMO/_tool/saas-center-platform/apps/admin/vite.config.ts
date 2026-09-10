import tailwindcss from '@tailwindcss/vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  resolve: {
    alias: {
      $stores: path.resolve(__dirname, 'src/lib/stores'),
      $utils: path.resolve(__dirname, 'src/lib/utils'),
      $types: path.resolve(__dirname, 'src/lib/types'),
      $services: path.resolve(__dirname, 'src/lib/services'),
      $components: path.resolve(__dirname, 'src/lib/components'),
      $hooks: path.resolve(__dirname, 'src/lib/hooks'),
      $root: path.resolve(__dirname, 'src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3504
  }
})
