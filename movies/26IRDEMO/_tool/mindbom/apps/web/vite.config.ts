/// <reference types="vitest/config" />
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
      $features: path.resolve(__dirname, 'src/lib/features')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 4503
  },
  test: {
    // .svelte.ts도 잡는다 — 룬($state/$derived)을 쓰는 상태머신의 테스트는
    // 그 확장자여야 컴파일러가 룬을 처리한다.
    include: ['src/**/*.{test,spec}.{js,ts}', 'src/**/*.{test,spec}.svelte.ts']
  }
})
