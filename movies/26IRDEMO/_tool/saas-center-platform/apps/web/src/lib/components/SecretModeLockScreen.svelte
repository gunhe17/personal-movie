<style>
  /* ── 진입 ── */
  .lock-screen {
    opacity: 0;
    transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .lock-screen--visible {
    opacity: 1;
  }

  /* ── 퇴장 ── */
  .lock-screen--exiting {
    opacity: 0;
    transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* 배경 비디오 */
  .lock-video {
    z-index: 0;
  }

  /* ── 카드 진입: 아래에서 스르륵 올라옴 ── */
  .lock-card {
    transform: translateY(40px) scale(0.92);
    opacity: 0;
    transition:
      transform 0.8s cubic-bezier(0.22, 1, 0.36, 1),
      opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    transition-delay: 0.15s;
  }
  .lock-card--visible {
    transform: translateY(0) scale(1);
    opacity: 1;
  }

  /* ── 카드 퇴장: 위로 날아감 ── */
  .lock-card--exiting {
    transform: translateY(-30px) scale(1.04);
    opacity: 0;
    transition:
      transform 0.5s cubic-bezier(0.4, 0, 1, 1),
      opacity 0.4s ease;
    transition-delay: 0s;
  }

  /* 잠금 아이콘 배경 */
  .lock-icon-bg {
    background: linear-gradient(135deg, #f59e0b, #d97706);
    position: relative;
    z-index: 1;
  }

  /* 아이콘 펄스 링 */
  .lock-icon-ring {
    position: absolute;
    inset: -8px;
    border-radius: 20px;
    border: 2px solid rgba(245, 158, 11, 0.3);
    animation: pulse-ring 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  .lock-icon-wrap {
    position: relative;
  }

  @keyframes pulse-ring {
    0%,
    100% {
      transform: scale(1);
      opacity: 0.5;
    }
    50% {
      transform: scale(1.15);
      opacity: 0;
    }
  }

  /* 잠금 아이콘 호흡 */
  .lock-icon {
    animation: breathe 4s ease-in-out infinite;
  }

  @keyframes breathe {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.08);
    }
  }

  /* 플로팅 파티클 */
  .particle {
    position: absolute;
    bottom: -10px;
    left: var(--x);
    width: var(--size);
    height: var(--size);
    background: rgba(245, 158, 11, 0.15);
    border-radius: 50%;
    animation: float-up var(--duration) ease-in-out infinite;
    animation-delay: var(--delay);
  }

  @keyframes float-up {
    0% {
      transform: translateY(0) scale(0);
      opacity: 0;
    }
    10% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    90% {
      opacity: 0.3;
    }
    100% {
      transform: translateY(-100vh) scale(0.5);
      opacity: 0;
    }
  }

  /* 에러 흔들림 */
  .shake {
    animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97);
  }

  @keyframes shake {
    0%,
    100% {
      transform: translateX(0);
    }
    10%,
    30%,
    50%,
    70%,
    90% {
      transform: translateX(-4px);
    }
    20%,
    40%,
    60%,
    80% {
      transform: translateX(4px);
    }
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { secretModeStore } from '$lib/stores/secret-mode.store'
  import { centerStore } from '$lib/stores/center.store'
  import { auth } from '$lib/stores/auth'
  import { snackbarStore } from '$lib/stores/snackbar'
  import Typography from '@common/components/Typography.svelte'
  import secretVideo from '$lib/assets/SecretCompress.mp4'
  import LockGrayIcon24 from '../assets/LockGrayIcon24.svelte'
  import LockGrayIcon28 from '../assets/LockGrayIcon28.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'

  let { onexited }: { onexited?: () => void } = $props()

  let phase = $state<'entering' | 'visible' | 'exiting'>('entering')
  let password = $state('')
  let errorMessage = $state('')
  let isVerifying = $state(false)
  let shakeError = $state(false)

  onMount(() => {
    // 다음 프레임에서 진입 애니메이션 트리거
    const raf = requestAnimationFrame(() => {
      phase = 'visible'
    })
    return () => cancelAnimationFrame(raf)
  })

  async function handleUnlock() {
    if (!password.trim() || isVerifying) return
    isVerifying = true
    errorMessage = ''

    try {
      const { postVerifyPassword } = await import(
        '$lib/hooks/actions/auth.action'
      )
      await postVerifyPassword().request({ password })

      // 퇴장 애니메이션 시작과 동시에 상태 정리 (blur 해제도 동시 진행)
      phase = 'exiting'

      const authState = get(auth)
      const accountId = authState.user?.email || authState.user?.id
      const centerId = centerStore.getCurrentCenterId()

      if (accountId && centerId) {
        localStorage.setItem(`secret-mode-${accountId}-${centerId}`, 'false')
      }
      secretModeStore.clear()
      snackbarStore.success('시크릿 모드가 해제되었습니다')

      // 퇴장 애니메이션 완료 후 DOM 제거 알림
      setTimeout(() => {
        onexited?.()
      }, 600)
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number } }
      if (axiosError?.response?.status === 403) {
        errorMessage = '비밀번호가 일치하지 않습니다'
      } else {
        errorMessage = '비밀번호 확인에 실패했습니다'
      }
      password = ''
      shakeError = true
      setTimeout(() => (shakeError = false), 600)
    } finally {
      isVerifying = false
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && password.trim()) {
      handleUnlock()
    }
  }
</script>

<div
  class="lock-screen fixed inset-0 z-[9999] flex items-center justify-center"
  class:lock-screen--visible={phase === 'visible'}
  class:lock-screen--exiting={phase === 'exiting'}
>
  <!-- 배경: 비디오 -->
  <video
    class="lock-video absolute inset-0 h-full w-full object-cover"
    src={secretVideo}
    autoplay
    muted
    loop
    playsinline
    preload="auto"
  ></video>

  <!-- 플로팅 파티클 -->
  <div class="particles absolute inset-0 overflow-hidden pointer-events-none">
    {#each Array(20) as _, i}
      <div
        class="particle"
        style="--delay: {i * 0.5}s; --x: {Math.random() * 100}%; --size: {2 +
          Math.random() * 4}px; --duration: {8 + Math.random() * 12}s;"
      ></div>
    {/each}
  </div>

  <!-- 잠금 카드 -->
  <div
    class="lock-card relative z-10 flex flex-col items-center w-full max-w-sm mx-4"
    class:lock-card--visible={phase === 'visible'}
    class:lock-card--exiting={phase === 'exiting'}
  >
    <!-- 잠금 아이콘 (애니메이션) -->
    <!-- <div class="lock-icon-wrap mb-8">
      <div class="lock-icon-ring"></div>
      <div
        class="lock-icon-bg flex h-20 w-20 items-center justify-center rounded-lg"
      >
        
      </div>
    </div> -->

    <div class="w-13 h-13 rounded-full bg-[#A2A2A21F] flex-center mb-4">
      <LockGrayIcon28 />
    </div>

    <!-- 텍스트 -->
    <Typography
      variant="headline-02-normal-semibold"
      color="text-gray-800"
      className="mb-3 text-center"
    >
      화면이 잠겼어요
    </Typography>
    <Typography
      variant="body-01-normal-regular"
      color="text-gray-600"
      className="mb-4 text-center"
    >
      비밀번호를 입력하여 잠금을 해제하세요
    </Typography>

    <!-- 비밀번호 입력 -->
    <div class="w-full px-2" class:shake={shakeError}>
      <div class="relative">
        <input
          type="password"
          bind:value={password}
          onkeydown={handleKeydown}
          placeholder="계정 비밀번호를 입력해주세요"
          disabled={isVerifying}
          class="field-input pr-12 text-gray-400 placeholder backdrop-blur-sm focus:border-white/40 focus:outline-none transition-all duration-200 disabled:opacity-50"
        />
        <Tooltip text="잠금 해제">
          <button
            type="button"
            onclick={handleUnlock}
            disabled={!password.trim() || isVerifying}
            class="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 text-white transition-all duration-200 hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="잠금 해제"
          >
            {#if isVerifying}
              <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            {:else}
              <svg
                class="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                />
              </svg>
            {/if}
          </button>
        </Tooltip>
      </div>
      {#if errorMessage}
        <p class="mt-2 text-center text-sm text-red-300">
          {errorMessage}
        </p>
      {/if}
    </div>
  </div>
</div>
