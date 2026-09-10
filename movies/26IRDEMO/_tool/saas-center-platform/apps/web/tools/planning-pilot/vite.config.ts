import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'
export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: '127.0.0.1',
    port: Number(process.env.PLANNING_PILOT_PORT || 4318),
    strictPort: true,
    fs: {
      deny: [
        '.env',
        '.env.*',
        resolve('records') + '/**',
        resolve('plans') + '/**'
      ]
    }
  }
})
