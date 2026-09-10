/**
 * Login Hooks
 * 로그인 페이지 상태 관리 (Svelte 5 Runes)
 */

import { onMount } from 'svelte'
import { auth } from '$lib/stores/auth'
import { centerStore } from '$lib/stores/center.store'
import {
  getRedirectUrl,
  tryMockLogin,
  realLogin,
  logoutFromLoginPage
} from './login-service'
import { goto } from '$app/navigation'

export function useLoginForm() {
  // 폼 상태
  let email = $state('')
  let password = $state('')
  let loading = $state(false)
  let error = $state('')
  const isDev = import.meta.env.DEV

  // handleLogin 진행 중 플래그 — onMount 구독자의 이중 호출 방지
  let isLoginInProgress = false

  // ============================================================
  // 라이프사이클: 이미 로그인된 사용자 처리
  // ============================================================

  onMount(() => {
    const unsubscribe = auth.subscribe((state) => {
      if (isLoginInProgress) return

      if (state.isAuthenticated && !state.isLoading) {
        const currentCenterId = centerStore.getCurrentCenterId()
        if (currentCenterId) {
          goto(getRedirectUrl())
        } else {
          goto('/welcome')
        }
      }
    })
    return unsubscribe
  })

  // ============================================================
  // 로그인
  // ============================================================

  async function handleLogin() {
    if (!email || !password) {
      error = '이메일과 비밀번호를 입력해주세요.'
      return
    }

    loading = true
    error = ''
    isLoginInProgress = true

    try {
      const redirectUrl = getRedirectUrl()

      // 개발 환경 Mock 로그인
      if (isDev) {
        const mockUser = tryMockLogin(email, password)
        if (mockUser) {
          if (redirectUrl.startsWith('/accept-invitation')) {
            goto(redirectUrl)
            return
          }
          goto('/welcome')
          return
        }
      }

      // 실제 API 로그인
      const result = await realLogin(email, password)
      if (!result.success) {
        error = '아이디 또는 비밀번호가 일치하지 않습니다.'
        return
      }

      if (redirectUrl.startsWith('/accept-invitation')) {
        goto(redirectUrl)
        return
      }
      goto('/welcome')
    } catch (err: unknown) {
      console.error('로그인 오류:', err)
      error = '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.'
    } finally {
      loading = false
      isLoginInProgress = false
    }
  }

  // ============================================================
  // 키 이벤트
  // ============================================================

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleLogin()
    }
  }

  // ============================================================
  // Quick Login (개발용)
  // ============================================================

  function quickLogin(presetEmail: string, presetPassword: string) {
    email = presetEmail
    password = presetPassword
    handleLogin()
  }

  return {
    // 폼 상태 (getter/setter)
    get email() { return email },
    set email(v: string) { email = v },
    get password() { return password },
    set password(v: string) { password = v },
    get loading() { return loading },
    get error() { return error },
    get isDev() { return isDev },

    // 핸들러
    handleLogin,
    handleKeyPress,
    quickLogin
  }
}
