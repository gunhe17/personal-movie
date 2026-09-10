<script lang="ts">
  import { onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/state'
  import Typography from '$lib/components/Typography.svelte'
  import { auth } from '$lib/stores/auth'
  import axios from 'axios'

  let step = $state<'credentials' | '2fa'>('credentials')
  let email = $state('')
  let password = $state('')
  let digits = $state<string[]>(['', '', '', '', '', ''])
  let pendingToken = $state('')
  let userName = $state('')
  let error = $state('')
  let loading = $state(false)
  let inputRefs: HTMLInputElement[] = []
  let remainingSeconds = $state(0)
  let timerInterval: ReturnType<typeof setInterval> | null = null

  const timerDisplay = $derived(() => {
    const min = Math.floor(remainingSeconds / 60)
    const sec = remainingSeconds % 60
    return `${min}:${sec.toString().padStart(2, '0')}`
  })
  const isExpired = $derived(step === '2fa' && remainingSeconds <= 0)

  function startTimer() {
    stopTimer()
    remainingSeconds = 5 * 60
    timerInterval = setInterval(() => {
      remainingSeconds--
      if (remainingSeconds <= 0) {
        stopTimer()
      }
    }, 1000)
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  onDestroy(() => stopTimer())

  const code = $derived(digits.join(''))

  async function handleLogin(e: Event) {
    e.preventDefault()
    error = ''
    loading = true

    try {
      const res = await axios.post('/api/auth/login', { email, password })

      if (res.data.success && !res.data.requires_2fa) {
        // DEBUG 모드: 2FA 스킵 → 바로 로그인 완료
        auth.login(res.data.user)
        if (res.data.must_change_password) {
          goto('/change-password')
        } else {
          const redirectTo = page.url.searchParams.get('redirectTo') || '/dashboard'
          goto(redirectTo)
        }
      } else if (res.data.success && res.data.requires_2fa) {
        pendingToken = res.data.pending_token
        userName = res.data.user.name
        step = '2fa'
        startTimer()
        setTimeout(() => inputRefs[0]?.focus(), 50)
      } else {
        error = res.data.message || '로그인에 실패했습니다.'
      }
    } catch (err: any) {
      error =
        err.response?.data?.message ||
        '서버 연결에 실패했습니다.'
    } finally {
      loading = false
    }
  }

  async function submitCode() {
    if (loading || isExpired) return
    error = ''
    loading = true

    try {
      const res = await axios.post('/api/auth/verify-2fa', {
        pending_token: pendingToken,
        code
      })

      if (res.data.success) {
        auth.login(res.data.user)

        if (res.data.must_change_password) {
          goto('/change-password')
        } else {
          const redirectTo =
            page.url.searchParams.get('redirectTo') || '/dashboard'
          goto(redirectTo)
        }
      } else {
        error = res.data.message || '인증에 실패했습니다.'
        resetDigits()
      }
    } catch (err: any) {
      error =
        err.response?.data?.message ||
        '서버 연결에 실패했습니다.'
      resetDigits()
    } finally {
      loading = false
    }
  }

  function handleDigitInput(index: number, e: Event) {
    const input = e.target as HTMLInputElement
    const value = input.value.replace(/\D/g, '')

    if (value.length > 0) {
      digits[index] = value.charAt(value.length - 1)
      if (index < 5) {
        inputRefs[index + 1]?.focus()
      }
    } else {
      digits[index] = ''
    }

    // 6자리 모두 입력되면 자동 인증
    if (digits.every((d) => d !== '')) {
      submitCode()
    }
  }

  function handleDigitKeydown(index: number, e: KeyboardEvent) {
    if (e.key === 'Backspace') {
      if (digits[index] === '' && index > 0) {
        inputRefs[index - 1]?.focus()
      } else {
        digits[index] = ''
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs[index + 1]?.focus()
    }
  }

  function handleDigitPaste(e: ClipboardEvent) {
    e.preventDefault()
    const pasted = (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return

    for (let i = 0; i < 6; i++) {
      digits[i] = pasted[i] ?? ''
    }

    const focusIndex = Math.min(pasted.length, 5)
    inputRefs[focusIndex]?.focus()

    if (pasted.length === 6) {
      submitCode()
    }
  }

  function resetDigits() {
    digits = ['', '', '', '', '', '']
    setTimeout(() => inputRefs[0]?.focus(), 50)
  }

  function handleBack() {
    step = 'credentials'
    digits = ['', '', '', '', '', '']
    pendingToken = ''
    error = ''
    stopTimer()
  }
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-50">
  <div class="w-full max-w-sm">
    <!-- Header -->
    <div class="mb-8 text-center">
      <div
        class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 text-white"
      >
        <svg class="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      </div>
      <Typography variant="headline-01-normal-bold" tag="h1">관리자 로그인</Typography>
      <Typography variant="body-03-normal-regular" tag="p" color="text-gray-500" className="mt-1">
        {step === 'credentials' ? '상담센터 SaaS 관리자 시스템' : '2단계 인증'}
      </Typography>
    </div>

    {#if step === 'credentials'}
      <!-- Step 1: 이메일/비밀번호 -->
      <form
        onsubmit={handleLogin}
        class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        {#if error}
          <div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        {/if}

        <div class="mb-4">
          <Typography variant="body-03-normal-medium" tag="label" color="text-gray-700" className="mb-1.5 block">
            이메일
          </Typography>
          <input
            id="email"
            type="email"
            bind:value={email}
            required
            placeholder="admin@example.com"
            class="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none transition-colors
              focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          />
        </div>

        <div class="mb-6">
          <Typography variant="body-03-normal-medium" tag="label" color="text-gray-700" className="mb-1.5 block">
            비밀번호
          </Typography>
          <input
            id="password"
            type="password"
            bind:value={password}
            required
            placeholder="비밀번호 입력"
            class="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none transition-colors
              focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          class="w-full rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors
            hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? '인증 중...' : '다음'}
        </button>
      </form>
    {:else}
      <!-- Step 2: 2FA 코드 입력 -->
      <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div class="mb-5 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <div class="flex items-center justify-between">
            <span><span class="font-medium">{userName || email}</span>님, 인증 코드를 입력해주세요.</span>
            <span
              class="ml-2 shrink-0 font-mono text-xs font-semibold {remainingSeconds <= 60 ? 'text-red-500' : 'text-blue-600'}"
            >
              {timerDisplay()}
            </span>
          </div>
        </div>

        {#if isExpired}
          <div class="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            인증 코드가 만료되었습니다. 다시 로그인해주세요.
          </div>
        {/if}

        {#if error}
          <div class="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        {/if}

        <div class="mb-6">
          <div class="flex justify-center gap-2.5">
            {#each digits as digit, i}
              <input
                bind:this={inputRefs[i]}
                type="text"
                inputmode="numeric"
                maxlength="1"
                value={digit}
                disabled={loading || isExpired}
                oninput={(e) => handleDigitInput(i, e)}
                onkeydown={(e) => handleDigitKeydown(i, e)}
                onpaste={handleDigitPaste}
                class="h-12 w-10 rounded-lg border text-center text-lg font-semibold outline-none transition-colors
                  disabled:bg-gray-50 disabled:opacity-50
                  {digit ? 'border-primary-500 bg-primary-50/30' : 'border-gray-300'}
                  focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              />
            {/each}
          </div>
        </div>

        {#if loading}
          <div class="mb-4 flex items-center justify-center gap-2 text-sm text-gray-500">
            <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
            인증 확인 중...
          </div>
        {/if}

        <button
          type="button"
          onclick={handleBack}
          class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors
            hover:bg-gray-50"
        >
          돌아가기
        </button>
      </div>
    {/if}
  </div>
</div>
