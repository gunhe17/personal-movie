<script lang="ts">
  import { browser } from '$app/environment'
  import { assessmentAuthStore } from '$lib/stores/assessment-auth.store'

  let { children } = $props()

  // 쿠키 JWT로 user 복원 (isAuthenticated·역할 등). 표시 이름은 헤더에서 getMeAssessment(auth/me)로 조회 (AppTopBar와 동일)
  if (browser) {
    assessmentAuthStore.checkAuth()
  }
</script>

{@render children?.()}
