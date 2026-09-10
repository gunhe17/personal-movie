<script lang="ts">
  /**
   * 시크릿 모드 해제 모달 — 비밀번호 검증 후 해제.
   * saas-center-platform 의 SecretModeDeactivateModal 이식 + mindbom 컨벤션 어댑터.
   *
   * resolve 결과: 검증 성공 시 true, 사용자 취소 시 false.
   */
  import { tick } from 'svelte'
  import { appInstance } from '$lib/services/api/instances'

  interface Props {
    modalId?: string
    closeModal?: () => void
    _modalResolve?: (value: boolean) => void
  }

  let {
    closeModal = () => {},
    _modalResolve = () => {}
  }: Props = $props()

  let password = $state('')
  let errorMessage = $state('')
  let isShaking = $state(false)
  let isVerifying = $state(false)

  async function triggerShake() {
    isShaking = false
    await tick()
    isShaking = true
  }

  async function handleConfirm() {
    if (!password.trim() || isVerifying) return
    errorMessage = ''
    isVerifying = true
    try {
      await appInstance.post('/auth/verify-password', { password })
      _modalResolve(true)
      closeModal()
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number } }
      if (axiosError?.response?.status === 403) {
        errorMessage = '비밀번호가 일치하지 않습니다'
      } else {
        errorMessage = '비밀번호 확인에 실패했습니다'
      }
      triggerShake()
    } finally {
      isVerifying = false
    }
  }

  function handleCancel() {
    _modalResolve(false)
    closeModal()
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && password.trim() && !isVerifying) {
      handleConfirm()
    }
  }
</script>

<div class="px-6 pt-10 pb-6">
  <div class="flex flex-col items-center text-center">
    <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-100">
      <span class="material-icons-round text-2xl text-orange-500">lock_open</span>
    </div>

    <h3 class="mb-3 text-lg font-semibold text-gray-800">시크릿 모드를 해제할게요</h3>
    <p class="mb-4 text-sm text-gray-500">본인 확인을 위해 비밀번호를 입력해주세요</p>

    <div class="w-full {isShaking ? 'shake' : ''}">
      <input
        type="password"
        bind:value={password}
        onkeydown={handleKeydown}
        placeholder="계정 비밀번호를 입력해주세요"
        class="h-12 w-full rounded-xl border px-4 text-sm text-gray-800 placeholder-gray-400 focus:outline-none {errorMessage
          ? 'border-red-400 focus:border-red-500'
          : 'border-gray-200 focus:border-orange-400'}"
      />
      {#if errorMessage}
        <p class="mt-1.5 text-left text-xs text-red-500">{errorMessage}</p>
      {/if}
    </div>
  </div>

  <div class="mt-6 grid grid-cols-2 gap-3">
    <button
      type="button"
      onclick={handleCancel}
      class="h-12 rounded-lg border border-gray-200 text-sm font-semibold text-gray-600 hover:border-gray-300"
    >
      닫기
    </button>
    <button
      type="button"
      onclick={handleConfirm}
      disabled={!password.trim() || isVerifying}
      class="h-12 rounded-lg border border-gray-200 text-sm font-semibold text-red-500 hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {isVerifying ? '확인 중...' : '해제'}
    </button>
  </div>
</div>

<style>
  .shake {
    animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97);
  }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-8px); }
    40%, 80% { transform: translateX(8px); }
  }
</style>
