import { onMount } from 'svelte'
import { goto } from '$app/navigation'
import { assessmentAuthStore } from '$lib/stores/assessment-auth.store'
import { assessmentCenterStore } from '$lib/stores/assessment-center.store'
import {
  assessmentLogin,
  fetchAssessmentCenters,
  getAssessmentRedirectUrl
} from './service'

export function useAssessmentLoginForm() {
  let id = $state('')
  let password = $state('')
  let loading = $state(false)
  let error = $state('')

  onMount(() => {
    assessmentCenterStore.initialize()
    assessmentAuthStore.checkAuth()

    const unsubscribe = assessmentAuthStore.subscribe(async (state) => {
      if (state.isLoading || !state.isAuthenticated || !state.user) return

      await fetchAssessmentCenters()
      // URL로 직접 접근 후 로그인한 경우 redirectTo가 있으면 해당 경로로, 없으면 센터 목록으로
      await goto(getAssessmentRedirectUrl())
    })

    return unsubscribe
  })

  async function handleLogin() {
    if (!id || !password) {
      error = '아이디와 비밀번호를 입력해주세요.'
      return
    }

    loading = true
    error = ''

    try {
      const result = await assessmentLogin(id, password)
      if (!result.success || !result.user) {
        error = result.error || '로그인에 실패했습니다.'
        return
      }

      await fetchAssessmentCenters(result.user.centers || [])
      await goto(getAssessmentRedirectUrl())
    } catch (err) {
      console.error('[Assessment Login] error:', err)
      error = '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.'
    } finally {
      loading = false
    }
  }

  function handleKeyPress(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleLogin()
    }
  }

  return {
    get id() { return id },
    set id(value: string) { id = value },
    get password() { return password },
    set password(value: string) { password = value },
    get loading() { return loading },
    get error() { return error },
    handleLogin,
    handleKeyPress
  }
}
