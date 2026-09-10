import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  // 이미 쓰는 포트: 3502 api · 3503 web · 3504 admin · 5174 landing · 8081 Expo(mobile-client).
  // host 0.0.0.0 — 같은 망의 다른 기기에서 http://<이 PC의 IP>:3510 으로 열 수 있다.
  server: { host: '0.0.0.0', port: 3510, strictPort: true },
})
