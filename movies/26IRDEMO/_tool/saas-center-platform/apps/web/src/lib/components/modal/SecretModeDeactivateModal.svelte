<style>
  .shake {
    animation: shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97);
  }
  @keyframes shake {
    0%,
    100% {
      transform: translateX(0);
    }
    20%,
    60% {
      transform: translateX(-8px);
    }
    40%,
    80% {
      transform: translateX(8px);
    }
  }
</style>

<script lang="ts">
  import { tick } from 'svelte'
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import UnlockOrangeIcon32 from '$lib/assets/UnlockOrangeIcon32.svelte'
  import { postVerifyPassword } from '$lib/hooks/actions/auth.action'

  interface Props {
    modalId?: string
    closeModal?: () => void
    _modalResolve?: (value: boolean) => void
    _modalReject?: (reason?: unknown) => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    _modalResolve = () => {},
    _modalReject = () => {}
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
      await postVerifyPassword().request({ password })
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

  const handleCancel = () => {
    _modalResolve(false)
    closeModal()
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && password.trim() && !isVerifying) {
      handleConfirm()
    }
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={false}
  showFooterBorder={false}
  showCloseButton={false}
  bodyClass="px-5 pt-8 pb-3"
  footerClass="px-5 pt-4 pb-5"
>
  {#snippet body()}
    <div class="flex flex-col items-center text-center">
      <!-- 잠금 해제 아이콘 -->
      <div
        class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#FFA1000F]"
      >
        <UnlockOrangeIcon32 />
      </div>

      <Typography
        variant="headline-02-semibold"
        color="text-gray-800"
        className="mb-3"
      >
        시크릿 모드를 해제할게요
      </Typography>

      <Typography
        variant="body-02-regular"
        color="text-gray-400"
        className="mb-4"
      >
        본인 확인을 위해 비밀번호를 입력해주세요
      </Typography>

      <!-- 비밀번호 입력 -->
      <div class="w-full {isShaking ? 'shake' : ''}">
        <input
          type="password"
          bind:value={password}
          onkeydown={handleKeydown}
          placeholder="계정 비밀번호를 입력해주세요"
          class="h-12 w-full rounded-[12px] border px-2.5 text-sm text-gray-800 placeholder:text-placeholder focus:outline-none {errorMessage
            ? 'border-red-400 focus:border-status-danger'
            : 'border-gray-200 focus:border-border-active'}"
        />
        {#if errorMessage}
          <p class="mt-1 text-left field-help is-error">
            {errorMessage}
          </p>
        {/if}
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="w-full grid grid-cols-2 gap-3">
      <button
        type="button"
        onclick={handleCancel}
        class="flex-center h-11 w-full rounded-lg border border-gray-200 hover:border-gray-300 duration-200"
      >
        <Typography variant="body-01-normal-medium" color="text-gray-600">
          닫기
        </Typography>
      </button>
      <button
        type="button"
        onclick={handleConfirm}
        disabled={!password.trim() || isVerifying}
        class="flex-center h-11 w-full rounded-lg border border-gray-200 hover:border-gray-300 duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Typography variant="body-01-normal-medium" color="text-etc-red-pink">
          해제
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
