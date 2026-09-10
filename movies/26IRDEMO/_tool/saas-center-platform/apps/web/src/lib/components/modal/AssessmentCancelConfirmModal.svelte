<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import Button from '$lib/components/Button.svelte'
  import { snackbarStore } from '$lib/stores/snackbar'
  import Warning from '../../assets/Warning.svelte'
  import WarningIcon from '../../assets/WarningIcon.svelte'
  import TriangleWarningIcon54 from '../../assets/TriangleWarningIcon54.svelte'

  type ActionType = 'cancel' | 'delete'
  /** 진행 전: 아직 시작 전 / in_progress: 이미 진행 중 */
  type ProgressState = 'pending' | 'in_progress'

  interface Props {
    modalId?: string
    assessmentName?: string
    actionType?: ActionType
    /** 검사(케이스) 진행 상태 — 설명 문구 분기용. 없으면 in_progress로 간주 */
    progressState?: ProgressState
    /** 커스텀 설명 문구 — 전달 시 기본 분기 로직 대신 사용 */
    customDescription?: string
    closeModal?: () => void
    onConfirm?: (reason: string) => void
  }

  let {
    assessmentName = '',
    actionType = 'cancel',
    progressState = 'in_progress',
    customDescription,
    closeModal,
    onConfirm
  }: Props = $props()

  let reason = $state('')

  const title = $derived(
    actionType === 'cancel'
      ? `[${assessmentName}] 검사를 중단할까요?`
      : `[${assessmentName}] 검사를 삭제할까요?`
  )

  const description = $derived.by(() => {
    if (customDescription) return customDescription
    if (actionType === 'delete') {
      return '검사를 삭제하면 모든 데이터가 영구적으로 제거되며 복구할 수 없어요.'
    }
    // 취소: 진행 상태에 따라 안내 문구 분기 (문장 단위 줄바꿈으로 가독성 확보)
    if (progressState === 'in_progress') {
      return '검사를 중단하면 진행이 멈추지만, 나중에 되돌릴 수 있어요.'
    }
    return '검사를 중단하면 진행이 멈추지만, 나중에 되돌릴 수 있어요.'
  })

  const reasonPlaceholder = '중단 사유를 입력해주세요'

  /** 삭제는 사유 불필요, 취소만 사유 필요 */
  const needsReason = $derived(actionType === 'cancel')

  const confirmButtonText = $derived(
    actionType === 'cancel' ? '중단할게요' : '삭제할게요'
  )

  function handleConfirm() {
    if (needsReason && !reason.trim()) {
      snackbarStore.warning('중단 사유를 입력해주세요.', null)
      return
    }
    onConfirm?.(reason.trim())
    closeModal?.()
  }

  function handleCancel() {
    closeModal?.()
  }
</script>

<div class="flex flex-col items-center p-5">
  <!-- 경고 아이콘 (주황색 삼각형) -->

  <TriangleWarningIcon54 />

  <!-- 제목 -->
  <Typography
    variant="headline-02-semibold"
    color="text-gray-900"
    className="text-center mb-3 mt-4"
  >
    {title}
  </Typography>

  <!-- 설명: 적정 줄 길이 + 문장 단위 줄바꿈으로 가독성 확보 -->
  <Typography
    variant="body-01-reading-regular"
    color="text-gray-700"
    className="w-full max-w-[320px] mx-auto text-center mb-6 break-words whitespace-pre-line leading-relaxed"
  >
    {description}
  </Typography>

  <!-- 사유 입력 (취소 시에만 표시) -->
  {#if needsReason}
    <input
      type="text"
      bind:value={reason}
      placeholder={reasonPlaceholder}
      class="field-input w-full mb-6"
    />
  {/if}

  <!-- 버튼 -->
  <div class="flex w-full gap-3">
    <Button
      class="flex-1 h-11 rounded-[8px] border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
      onclick={handleCancel}
    >
      <Typography variant="body-01-normal-medium" color="text-gray-700">
        계속 진행할게요
      </Typography>
    </Button>
    <Button
      class="flex-1 h-11 rounded-[8px] border border-gray-200 bg-white hover:bg-gray-50"
      onclick={handleConfirm}
    >
      <Typography variant="body-01-normal-medium" color="text-etc-red-pink">
        {confirmButtonText}
      </Typography>
    </Button>
  </div>
</div>
