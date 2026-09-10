<script lang="ts">
  import WarningTriangleYellow54 from '../../assets/WarningTriangleYellow54.svelte'
  import WarningIcon54 from '../../assets/WarningIcon54.svelte'
  import GreenCircleCheck54 from '../../assets/GreenCircleCheck54.svelte'
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    modalId?: string
    title?: string
    description?: string
    message?: string
    items?: string[]
    closeModal?: () => void
    cancelText?: string
    confirmText?: string
    onCancel?: () => void
    onConfirm?: () => void
    type?: 'info' | 'warning' | 'danger'
    /** 타입 기본 아이콘 대신 쓸 아이콘 (완료 확정처럼 경고가 아닌 맥락용) */
    icon?: any
    _modalResolve?: (value: string | null) => void
    _modalReject?: (reason?: unknown) => void
  }

  let {
    modalId = '',
    title = '확인',
    description = '',
    message = '',
    items = [],
    closeModal = () => {},
    cancelText = '취소',
    confirmText = '확인',
    onCancel = () => {},
    onConfirm = () => {},
    type = 'info',
    icon = undefined,
    _modalResolve = () => {},
    _modalReject = () => {}
  }: Props = $props()

  const handleConfirm = () => {
    _modalResolve('confirmed')
    onConfirm()
    closeModal()
  }

  const handleCancel = () => {
    _modalResolve('cancelled')
    onCancel()
    closeModal()
  }

  // 타입별 스타일 (칩/확인버튼 색 — 모두 디자인 토큰)
  // 확인 버튼: 메인 액션이므로 기본은 Primary solid.
  // 레드(아웃라인)는 삭제처럼 되돌릴 수 없는 파괴적 액션(danger)에만.
  const PRIMARY_BTN = {
    btn: 'bg-primary-500 hover:bg-primary-600',
    btnText: 'text-white'
  }
  const styleConfig = {
    info: {
      chipBg: 'bg-primary-50',
      chipText: 'text-primary-600',
      chipBorder: 'border-primary-200',
      ...PRIMARY_BTN
    },
    warning: {
      chipBg: 'bg-amber-50',
      chipText: 'text-amber-700',
      chipBorder: 'border-amber-200',
      ...PRIMARY_BTN
    },
    danger: {
      chipBg: 'bg-status-danger-bg',
      chipText: 'text-red-600',
      chipBorder: 'border-red-200',
      btn: 'border border-gray-200 hover:border-gray-300',
      btnText: 'text-red-600'
    }
  }

  const config = $derived(styleConfig[type] ?? styleConfig.info)

  // 아이콘: 호출부 지정이 우선, 없으면 타입별 기본.
  // '!' 경고 삼각형은 위험(파괴적·비가역) 확인에만 — 중립 확인(info)은 체크 아이콘.
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
  bodyClass="px-5 pt-8 pb-3"
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
      <!-- 설명 (타이틀 바로 아래, 부연 텍스트) -->
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
    <!-- 메시지 (배경 카드로 분리된 안내 영역) -->
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

    <!-- 칩 목록 -->
    {#if items.length > 0}
      <div class="mt-3 flex flex-wrap justify-center gap-2">
        {#each items as item}
          <span
            class="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border {config.chipBg} {config.chipText} {config.chipBorder}"
          >
            {item}
          </span>
        {/each}
      </div>
    {/if}
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
        class="flex-center h-11 w-full rounded-lg duration-200 {config.btn}"
      >
        <Typography variant="body-01-normal-medium" color={config.btnText}>
          {confirmText}
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
