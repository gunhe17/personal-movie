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
  import WarningTriangleYellow54 from '../../assets/WarningTriangleYellow54.svelte'
  import WarningIcon54 from '../../assets/WarningIcon54.svelte'
  import GreenCircleCheck54 from '../../assets/GreenCircleCheck54.svelte'
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import { postVerifyPassword } from '$lib/hooks/actions/auth.action'

  /**
   * 비밀번호 확인이 필요한 confirm 다이얼로그.
   * ConfirmModal과 같은 계약('confirmed' | 'cancelled')으로 resolve하되,
   * 확인 전에 계정 비밀번호 검증(POST /auth/verify-password)을 통과해야 한다.
   * 위험도(type) 3단계·아이콘·버튼 색 규칙은 §Components>popup을 그대로 따른다.
   */
  interface Props {
    modalId?: string
    title?: string
    description?: string
    message?: string
    closeModal?: () => void
    cancelText?: string
    confirmText?: string
    /** 비밀번호 입력 라벨 */
    passwordLabel?: string
    placeholder?: string
    type?: 'info' | 'warning' | 'danger'
    /** 타입 기본 아이콘 대신 쓸 아이콘 */
    icon?: any
    _modalResolve?: (value: string | null) => void
    _modalReject?: (reason?: unknown) => void
  }

  let {
    modalId = '',
    title = '확인',
    description = '',
    message = '',
    closeModal = () => {},
    cancelText = '닫기',
    confirmText = '확인',
    passwordLabel = '본인 확인을 위해 비밀번호를 입력해주세요',
    placeholder = '계정 비밀번호를 입력해주세요',
    type = 'warning',
    icon = undefined,
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
      _modalResolve('confirmed')
      closeModal()
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number } }
      errorMessage =
        axiosError?.response?.status === 403
          ? '비밀번호가 일치하지 않아요'
          : '비밀번호 확인에 실패했어요'
      triggerShake()
    } finally {
      isVerifying = false
    }
  }

  const handleCancel = () => {
    _modalResolve('cancelled')
    closeModal()
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm()
  }

  // 타입별 확인 버튼 색 — ConfirmModal과 동일 규칙(레드는 danger에만)
  const PRIMARY_BTN = {
    btn: 'bg-primary-500 hover:bg-primary-600',
    btnText: 'text-white'
  }
  const styleConfig = {
    info: PRIMARY_BTN,
    warning: PRIMARY_BTN,
    danger: {
      btn: 'border border-gray-200 hover:border-gray-300',
      btnText: 'text-red-600'
    }
  }

  const config = $derived(styleConfig[type] ?? styleConfig.info)

  const TypeIcon = $derived(
    icon ??
      (type === 'danger'
        ? WarningIcon54
        : type === 'warning'
          ? WarningTriangleYellow54
          : GreenCircleCheck54)
  )
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={false}
  showFooterBorder={false}
  showCloseButton={false}
  bodyClass="p-5 pb-3"
  footerClass="px-5 pt-4 pb-5"
>
  {#snippet body()}
    <div class="flex flex-col items-center text-center">
      <!-- 아이콘 (타입별) -->
      <TypeIcon />
      <!-- 타이틀 -->
      <Typography
        variant="headline-02-semibold"
        color="text-gray-800"
        className="mt-4 {description || message ? 'mb-2' : 'mb-3'}"
      >
        {title}
      </Typography>
      <!-- 설명 -->
      {#if description}
        <Typography
          variant="body-01-reading-regular"
          color="text-gray-500"
          className="mb-1 whitespace-pre-line"
        >
          {description}
        </Typography>
      {/if}
    </div>

    <!-- 메시지 -->
    {#if message}
      <div class="w-full px-4 mt-3 text-center">
        <Typography
          variant="body-01-reading-regular"
          color="text-gray-600"
          className="whitespace-pre-line"
        >
          {message}
        </Typography>
      </div>
    {/if}

    <!-- 비밀번호 확인 (§Components>text-field 한 벌) -->
    <div class="field-group mt-4 {isShaking ? 'shake' : ''}">
      {#if passwordLabel}
        <label class="field-label" for="password-confirm-input">
          {passwordLabel}
        </label>
      {/if}
      <input
        id="password-confirm-input"
        type="password"
        autocomplete="current-password"
        bind:value={password}
        onkeydown={handleKeydown}
        {placeholder}
        class="field-input {errorMessage ? 'is-error' : ''}"
      />
      {#if errorMessage}
        <p class="field-help is-error">{errorMessage}</p>
      {/if}
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="w-full grid grid-cols-2 gap-3">
      {#if cancelText}
        <button
          type="button"
          onclick={handleCancel}
          class="flex-center h-11 w-full rounded-lg border border-gray-200 hover:border-gray-300 duration-200"
        >
          <Typography variant="body-01-normal-medium" color="text-gray-600">
            {cancelText}
          </Typography>
        </button>
      {/if}
      <button
        type="button"
        onclick={handleConfirm}
        disabled={!password.trim() || isVerifying}
        class="flex-center h-11 w-full rounded-lg duration-200 disabled:opacity-40 disabled:cursor-not-allowed {config.btn}"
      >
        <Typography variant="body-01-normal-medium" color={config.btnText}>
          {isVerifying ? '확인 중' : confirmText}
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
