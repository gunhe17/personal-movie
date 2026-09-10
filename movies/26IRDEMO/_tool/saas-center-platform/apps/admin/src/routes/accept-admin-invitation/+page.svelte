<script lang="ts">
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import { post } from '$services/api/instances'
  import { showErrorSnackbar } from '$lib/utils/errorHandler'

  const token = $derived(page.url.searchParams.get('token') ?? '')

  let password = $state('')
  let passwordConfirm = $state('')
  let isSubmitting = $state(false)
  let isDone = $state(false)

  // 비밀번호 정책 체크
  const validations = $derived({
    length: password.length >= 12,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password),
    noConsecutive: !/(\d)\1{2,}|012|123|234|345|456|567|678|789|890/.test(
      password
    )
  })

  const isPasswordValid = $derived(Object.values(validations).every(Boolean))
  const isPasswordMatch = $derived(
    password === passwordConfirm && passwordConfirm.length > 0
  )
  const canSubmit = $derived(
    isPasswordValid && isPasswordMatch && !isSubmitting && !!token
  )

  async function handleSubmit() {
    if (!canSubmit) return
    isSubmitting = true
    try {
      await post('/admin/admin-accounts/accept-invitation', { token, password })
      isDone = true
    } catch (e) {
      showErrorSnackbar(e)
    } finally {
      isSubmitting = false
    }
  }

  function handleGoLogin() {
    goto('/login')
  }
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
  <div class="w-full max-w-md">
    <!-- 로고 -->
    <div class="mb-8 text-center">
      <span class="text-2xl font-bold tracking-tight text-primary-500"
        >mind scope</span
      >
      <p class="mt-1 text-sm text-gray-400">관리자 포털</p>
    </div>

    <div class="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
      {#if !token}
        <div class="text-center">
          <p class="text-sm text-red-500">유효하지 않은 초대 링크입니다.</p>
          <button
            onclick={handleGoLogin}
            class="mt-4 text-sm text-primary-500 underline hover:text-primary-600"
          >
            로그인 페이지로 이동
          </button>
        </div>
      {:else if isDone}
        <div class="text-center">
          <div class="mb-4 flex justify-center">
            <div
              class="flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-2xl"
            >
              ✓
            </div>
          </div>
          <h2 class="mb-2 text-lg font-semibold text-gray-900">
            계정이 활성화되었습니다
          </h2>
          <p class="mb-6 text-sm text-gray-500">
            설정한 비밀번호로 로그인해주세요.
          </p>
          <button
            onclick={handleGoLogin}
            class="w-full rounded-xl bg-primary-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
          >
            로그인하기
          </button>
        </div>
      {:else}
        <h2 class="mb-1 text-lg font-semibold text-gray-900">비밀번호 설정</h2>
        <p class="mb-6 text-sm text-gray-500">
          계정 활성화를 위해 비밀번호를 설정해주세요.
        </p>

        <!-- svelte-ignore a11y_label_has_associated_control -->
        <form
          onsubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          class="space-y-4"
        >
          <!-- 비밀번호 -->
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700">
              비밀번호 <span class="text-red-500">*</span>
            </label>
            <input
              type="password"
              bind:value={password}
              placeholder="비밀번호 입력"
              class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <!-- 비밀번호 확인 -->
          <div>
            <label class="mb-1.5 block text-sm font-medium text-gray-700">
              비밀번호 확인 <span class="text-red-500">*</span>
            </label>
            <input
              type="password"
              bind:value={passwordConfirm}
              placeholder="비밀번호 재입력"
              class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              class:border-red-300={passwordConfirm.length > 0 &&
                !isPasswordMatch}
              class:border-green-300={isPasswordMatch}
            />
            {#if passwordConfirm.length > 0 && !isPasswordMatch}
              <p class="mt-1 text-xs text-red-500">
                비밀번호가 일치하지 않습니다
              </p>
            {/if}
          </div>

          <!-- 비밀번호 정책 -->
          {#if password.length > 0}
            <div class="rounded-lg bg-gray-50 p-3 text-xs space-y-1">
              <p class="font-medium text-gray-600 mb-1">비밀번호 조건</p>
              {#each [{ ok: validations.length, label: '12자 이상' }, { ok: validations.upper, label: '영문 대문자 포함' }, { ok: validations.lower, label: '영문 소문자 포함' }, { ok: validations.special, label: '특수문자 포함' }, { ok: validations.noConsecutive, label: '연속된 숫자(123, 111 등) 없음' }] as v}
                <div class="flex items-center gap-1.5">
                  <span class={v.ok ? 'text-green-500' : 'text-gray-300'}>
                    {v.ok ? '✓' : '○'}
                  </span>
                  <span class={v.ok ? 'text-green-600' : 'text-gray-400'}
                    >{v.label}</span
                  >
                </div>
              {/each}
            </div>
          {/if}

          <button
            type="submit"
            disabled={!canSubmit}
            class="w-full rounded-xl bg-primary-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? '처리 중...' : '비밀번호 설정 완료'}
          </button>
        </form>
      {/if}
    </div>
  </div>
</div>
