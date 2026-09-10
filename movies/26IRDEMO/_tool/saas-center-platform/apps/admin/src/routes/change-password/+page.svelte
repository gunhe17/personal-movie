<script lang="ts">
  import { goto } from '$app/navigation'
  import Typography from '$lib/components/Typography.svelte'
  import axios from 'axios'

  let currentPassword = $state('')
  let newPassword = $state('')
  let newPasswordConfirm = $state('')
  let error = $state('')
  let loading = $state(false)

  const PASSWORD_RULES = [
    '12자 이상',
    '영문 대문자 포함',
    '영문 소문자 포함',
    '특수문자 포함',
    '연속된 숫자 사용 불가 (예: 123, 111)'
  ]

  async function handleSubmit(e: Event) {
    e.preventDefault()
    error = ''

    if (newPassword !== newPasswordConfirm) {
      error = '새 비밀번호가 일치하지 않습니다.'
      return
    }

    loading = true

    try {
      const res = await axios.post('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirm: newPasswordConfirm
      })

      if (res.data.success) {
        goto('/dashboard')
      } else {
        error = res.data.message || '비밀번호 변경에 실패했습니다.'
      }
    } catch (err: any) {
      error = err.response?.data?.message || '서버 연결에 실패했습니다.'
    } finally {
      loading = false
    }
  }
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-50">
  <div class="w-full max-w-sm">
    <!-- Header -->
    <div class="mb-8 text-center">
      <div
        class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-white"
      >
        <svg
          class="h-7 w-7"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
          />
        </svg>
      </div>
      <Typography variant="headline-01-normal-bold" tag="h1"
        >비밀번호 변경</Typography
      >
      <Typography
        variant="body-03-normal-regular"
        tag="p"
        color="text-gray-500"
        className="mt-1"
      >
        보안을 위해 비밀번호를 변경해주세요.
      </Typography>
    </div>

    <form
      onsubmit={handleSubmit}
      class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      {#if error}
        <div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      {/if}

      <div class="mb-4">
        <Typography
          variant="body-03-normal-medium"
          tag="label"
          color="text-gray-700"
          className="mb-1.5 block"
        >
          현재 비밀번호
        </Typography>
        <input
          type="password"
          bind:value={currentPassword}
          required
          placeholder="현재 비밀번호 입력"
          class="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none transition-colors
            focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        />
      </div>

      <div class="mb-4">
        <Typography
          variant="body-03-normal-medium"
          tag="label"
          color="text-gray-700"
          className="mb-1.5 block"
        >
          새 비밀번호
        </Typography>
        <input
          type="password"
          bind:value={newPassword}
          required
          placeholder="새 비밀번호 입력"
          class="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none transition-colors
            focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        />
      </div>

      <div class="mb-4">
        <Typography
          variant="body-03-normal-medium"
          tag="label"
          color="text-gray-700"
          className="mb-1.5 block"
        >
          새 비밀번호 확인
        </Typography>
        <input
          type="password"
          bind:value={newPasswordConfirm}
          required
          placeholder="새 비밀번호 다시 입력"
          class="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none transition-colors
            focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        />
      </div>

      <!-- 비밀번호 규칙 안내 -->
      <div class="mb-6 rounded-lg bg-gray-50 px-4 py-3">
        <Typography
          variant="body-03-medium"
          tag="p"
          color="text-gray-500"
          className="mb-1.5"
        >
          비밀번호 규칙
        </Typography>
        <ul class="space-y-0.5">
          {#each PASSWORD_RULES as rule}
            <li class="text-xs text-gray-400">· {rule}</li>
          {/each}
        </ul>
      </div>

      <button
        type="submit"
        disabled={loading}
        class="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors
          hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? '변경 중...' : '비밀번호 변경'}
      </button>
    </form>
  </div>
</div>
