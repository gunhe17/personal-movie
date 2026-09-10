<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Button from '../Button.svelte'
  import Typography from '@common/components/Typography.svelte'
  import { snackbarStore } from '$lib/stores/snackbar'

  interface Props {
    modalId?: string
    closeModal?: () => void
    onConfirm?: (data: {
      assessmentKorName: string
      assessmentEnName: string
      requestReason: string
    }) => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    onConfirm = () => {}
  }: Props = $props()

  // 폼 상태
  let assessmentKorName = $state('')
  let assessmentEnName = $state('')
  let requestReason = $state('')

  // 유효성 검사 - 모든 필드가 채워졌는지 확인
  let isValid = $derived(
    assessmentKorName.trim().length > 0 &&
      assessmentEnName.trim().length > 0 &&
      requestReason.trim().length > 0
  )

  // 검사 도입 요청하기 버튼 핸들러
  function handleSubmit() {
    if (!isValid) return

    onConfirm({
      assessmentKorName: assessmentKorName.trim(),
      assessmentEnName: assessmentEnName.trim(),
      requestReason: requestReason.trim()
    })

    // 스낵바 표시
    snackbarStore.request('검사 도입을 요청했어요!')

    closeModal()
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={false}
  showFooterBorder={false}
  showCloseButton={false}
  size="lg"
  bodyClass="p-5 pb-7"
  footerClass="px-5 pt-4 pb-5"
  title="검사 도입을 요청할게요"
>
  {#snippet body()}
    <div class="space-y-6">
      <!-- 검사 명명 이유 -->
      <div class="space-y-2">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle"
          >검사 영문 이름</Typography
        >
        <input
          type="text"
          bind:value={assessmentEnName}
          placeholder="검사 영문 이름을 입력해주세요"
          class="field-input"
        />
      </div>

      <!-- 검사 관련 이름 -->
      <div class="space-y-2">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle"
          >검사 한글 이름</Typography
        >
        <input
          type="text"
          bind:value={assessmentKorName}
          placeholder="예)집-나무-사람 검사"
          class="field-input"
        />
      </div>

      <!-- 요청 사유 -->
      <div class="space-y-2">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle"
          >요청 사유</Typography
        >
        <input
          type="text"
          bind:value={requestReason}
          placeholder="요청 사유를 자유롭게 작성해주세요!"
          class="field-input"
        />
      </div>
    </div>
  {/snippet}

  {#snippet footer()}
    <Button
      class="h-11 flex-1 rounded-[10px] bg-gray-100 transition-colors hover:bg-gray-200"
      onclick={closeModal}
    >
      <Typography variant="body-01-normal-medium" color="text-gray-500"
        >닫기</Typography
      >
    </Button>
    <Button
      class="h-11 flex-1 rounded-[10px] bg-primary-500 transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-primary-500"
      onclick={handleSubmit}
      disabled={!isValid}
    >
      <Typography variant="body-01-normal-medium" color="text-white"
        >검사 도입 요청</Typography
      >
    </Button>
  {/snippet}
</BaseModal>
