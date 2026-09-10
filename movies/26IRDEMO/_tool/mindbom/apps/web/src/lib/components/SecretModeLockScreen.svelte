<script lang="ts">
  /**
   * 시크릿 모드 잠금 화면 — 전체 화면을 덮는 오버레이.
   * 차분한 indigo/slate 다크 톤으로, 임상·연구 환경에 어울리는 정돈된 분위기.
   *
   * `secretModeType === 'lockscreen'` 일 때만 마운트되어야 한다.
   */
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { secretModeStore } from '$lib/stores/secret-mode.store.svelte'
  import { institutionStore } from '$lib/stores/institution.store'
  import { auth } from '$lib/stores/auth'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { appInstance } from '$lib/services/api/instances'

  let { onexited }: { onexited?: () => void } = $props()

  let phase = $state<'entering' | 'visible' | 'exiting'>('entering')
  let password = $state('')
  let errorMessage = $state('')
  let isVerifying = $state(false)
  let shakeError = $state(false)

  onMount(() => {
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
      await appInstance.post('/auth/verify-password', { password })

      phase = 'exiting'

      const authState = get(auth)
      const accountId = authState.user?.id
      const institutionId = institutionStore.getCurrentInstitutionId()
      if (accountId && institutionId) {
        localStorage.removeItem(`secret-mode-${accountId}-${institutionId}`)
      }
      secretModeStore.clear()
      snackbarStore.success('시크릿 모드가 해제되었습니다')

      setTimeout(() => onexited?.(), 600)
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number } }
      errorMessage =
        axiosError?.response?.status === 403
          ? '비밀번호가 일치하지 않습니다'
          : '비밀번호 확인에 실패했습니다'
      password = ''
      shakeError = true
      setTimeout(() => (shakeError = false), 600)
    } finally {
      isVerifying = false
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && password.trim()) handleUnlock()
  }
</script>

<div
  class="lock-screen fixed inset-0 z-lock flex items-center justify-center"
  class:lock-screen--visible={phase === 'visible'}
  class:lock-screen--exiting={phase === 'exiting'}
>
  <!-- 배경: 어두운 슬레이트/인디고 그라디언트 -->
  <div class="absolute inset-0 bg-linear-to-br from-slate-900 via-slate-900 to-indigo-950"></div>

  <!-- 미세한 그리드 패턴 (지적·구조적 분위기) -->
  <div class="lock-grid absolute inset-0"></div>

  <!-- 부드럽게 떠 있는 라이트 (radial highlight) -->
  <div class="lock-glow lock-glow--top-left"></div>
  <div class="lock-glow lock-glow--bottom-right"></div>

  <!-- 잠금 카드 -->
  <div
    class="lock-card relative z-10 flex w-full max-w-sm flex-col items-center px-8"
    class:lock-card--visible={phase === 'visible'}
    class:lock-card--exiting={phase === 'exiting'}
  >
    <!-- 잠금 아이콘 (얇은 외곽선) -->
    <div class="lock-icon-wrap mb-7">
      <div class="lock-icon-ring"></div>
      <div class="lock-icon-bg flex h-16 w-16 items-center justify-center rounded-2xl">
        <span class="material-icons-round text-3xl text-indigo-100">lock</span>
      </div>
    </div>

    <p class="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-indigo-300/80">Secret mode</p>
    <h1 class="mb-3 text-center text-2xl font-semibold text-slate-50">화면이 잠겼어요</h1>
    <p class="mb-7 text-center text-sm leading-relaxed text-slate-400">
      비밀번호를 입력하여 잠금을 해제하세요
    </p>

    <div class="w-full" class:shake={shakeError}>
      <div class="relative">
        <!-- svelte-ignore a11y_autofocus -->
        <input
          type="password"
          bind:value={password}
          onkeydown={handleKeydown}
          placeholder="계정 비밀번호"
          disabled={isVerifying}
          autofocus
          class="h-12 w-full rounded-xl border border-white/10 bg-white/5 px-4 pr-14 text-sm text-slate-100 placeholder-slate-500 backdrop-blur-md transition-colors focus:border-indigo-400/60 focus:outline-none focus:ring-1 focus:ring-indigo-400/40 disabled:opacity-50"
        />
        <button
          type="button"
          onclick={handleUnlock}
          disabled={!password.trim() || isVerifying}
          aria-label="잠금 해제"
          class="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-indigo-500/90 text-white transition-all hover:bg-indigo-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500"
        >
          {#if isVerifying}
            <span class="material-icons-round animate-spin text-base">progress_activity</span>
          {:else}
            <span class="material-icons-round text-base">arrow_forward</span>
          {/if}
        </button>
      </div>
      {#if errorMessage}
        <p class="mt-2 text-center text-sm text-rose-300">{errorMessage}</p>
      {/if}
    </div>
  </div>
</div>

<style>
  /* ── 진입/퇴장 ── */
  .lock-screen {
    opacity: 0;
    transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .lock-screen--visible { opacity: 1; }
  .lock-screen--exiting {
    opacity: 0;
    transition: opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  }

  /* ── 카드 진입 ── */
  .lock-card {
    transform: translateY(28px) scale(0.96);
    opacity: 0;
    transition:
      transform 0.7s cubic-bezier(0.22, 1, 0.36, 1),
      opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    transition-delay: 0.15s;
  }
  .lock-card--visible {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  .lock-card--exiting {
    transform: translateY(-20px) scale(1.02);
    opacity: 0;
    transition:
      transform 0.5s cubic-bezier(0.4, 0, 1, 1),
      opacity 0.4s ease;
    transition-delay: 0s;
  }

  /* 잠금 아이콘 — 얇은 외곽선 + 깊은 인디고 */
  .lock-icon-bg {
    background:
      linear-gradient(135deg, rgba(99, 102, 241, 0.18), rgba(15, 23, 42, 0.6));
    border: 1px solid rgba(165, 180, 252, 0.25);
    box-shadow: 0 8px 32px rgba(15, 23, 42, 0.45);
    position: relative;
    z-index: 1;
  }
  .lock-icon-wrap { position: relative; }
  .lock-icon-ring {
    position: absolute;
    inset: -10px;
    border-radius: 22px;
    border: 1px solid rgba(165, 180, 252, 0.18);
    animation: pulse-ring 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  @keyframes pulse-ring {
    0%, 100% { transform: scale(1); opacity: 0.55; }
    50%      { transform: scale(1.12); opacity: 0; }
  }

  /* 그리드 패턴 — 매우 옅은 청회색 라인 */
  .lock-grid {
    background-image:
      linear-gradient(rgba(148, 163, 184, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148, 163, 184, 0.05) 1px, transparent 1px);
    background-size: 48px 48px;
    background-position: center center;
    /* 가장자리 페이드아웃 */
    mask-image: radial-gradient(ellipse at center, black 40%, transparent 75%);
    -webkit-mask-image: radial-gradient(ellipse at center, black 40%, transparent 75%);
  }

  /* 부드러운 글로우 — 화면 모서리 */
  .lock-glow {
    position: absolute;
    width: 520px;
    height: 520px;
    border-radius: 50%;
    filter: blur(80px);
    opacity: 0.35;
    pointer-events: none;
  }
  .lock-glow--top-left {
    top: -160px;
    left: -160px;
    background: radial-gradient(circle, rgba(99, 102, 241, 0.45), transparent 70%);
  }
  .lock-glow--bottom-right {
    bottom: -200px;
    right: -200px;
    background: radial-gradient(circle, rgba(56, 189, 248, 0.30), transparent 70%);
  }

  /* 에러 흔들림 */
  .shake { animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97); }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
    20%, 40%, 60%, 80% { transform: translateX(4px); }
  }
</style>
