/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function getGitVersion(): string {
  try {
    return execSync('git describe --tags --always 2>/dev/null').toString().trim().replace(/^v/, '')
  } catch {
    return 'dev'
  }
}

function getGitSha(): string {
  try {
    return execSync('git rev-parse --short HEAD 2>/dev/null').toString().trim()
  } catch {
    return 'unknown'
  }
}

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || getGitVersion()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __BUILD_ENV__: JSON.stringify(process.env.NODE_ENV || 'development'),
    __GIT_SHA__: JSON.stringify(process.env.GIT_SHA || getGitSha())
  },
  resolve: {
    alias: {
      '@assessment/rorschach': path.resolve(__dirname, 'assessment/rorschach'),
      '@common': path.resolve(__dirname, 'common'),
      $stores: path.resolve(__dirname, 'src/lib/stores'),
      $actions: path.resolve(__dirname, 'src/lib/actions'),
      $routes: path.resolve(__dirname, 'src/routes'),
      $utils: path.resolve(__dirname, 'src/lib/utils'),
      $types: path.resolve(__dirname, 'src/lib/types'),
      $hooks: path.resolve(__dirname, 'src/lib/hooks'),
      $assets: path.resolve(__dirname, 'src/assets'),
      $services: path.resolve(__dirname, 'src/lib/services'),
      $components: path.resolve(__dirname, 'src/lib/components'),
      $storage: path.resolve(__dirname, 'src/lib/services/storage'),
      $root: path.resolve(__dirname, 'src')
    }
  },
  server: {
    // '::' = 듀얼스택. '0.0.0.0'은 IPv4 전용이라 브라우저가 localhost를 ::1로 먼저 잡으면
    // ERR_CONNECTION_REFUSED가 난다. '::'는 LAN 접속(다른 기기)도 그대로 된다.
    host: '::',
    port: 3503,
    // 3503이 점유되면 조용히 3504로 옮겨가지 않고 에러로 멈춘다
    // (포트가 말없이 바뀌면 "사이트 연결 끊김"으로 보인다)
    strictPort: true,
    proxy: {
      '/external-api': {
        // 특정 개발자 LAN IP 하드코딩 금지 — 그 머신이 없으면 externalGet 화면(전송 내역 등)이 전부 500
        target: process.env.EXTERNAL_API_TARGET || 'http://localhost:3502',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/external-api/, '/api/v1')
      }
    },
    fs: {
      allow: [
        // 프로젝트 루트
        '.',
        // common 및 assessment 폴더 허용
        'common',
        'assessment',
        // 온톨로지 모델 정본 (레포 루트) — terms.ts가 프로필 JSON을 주입받는다
        '../../ontology'
      ]
    }
  },
  test: {
    expect: {
      requireAssertions: true
    },
    projects: [
      {
        extends: './vite.config.ts',
        test: {
          name: 'client',
          environment: 'browser',
          browser: {
            enabled: true,
            provider: 'playwright',
            instances: [
              {
                browser: 'chromium'
              }
            ]
          },
          include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
          exclude: ['src/lib/server/**'],
          setupFiles: ['./vitest-setup-client.ts']
        }
      },
      {
        extends: './vite.config.ts',
        test: {
          name: 'server',
          environment: 'node',
          include: ['src/**/*.{test,spec}.{js,ts}'],
          exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
        }
      }
    ]
  }
})
