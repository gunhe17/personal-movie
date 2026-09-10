<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
    onConfirm?: () => void
    /** 기본: "검사를 종료할까요?" */
    title?: string
    /** 기본: "현재 검사 세션이 종료되고\n검사 목록으로 이동해요" */
    description?: string
    /** 확인 버튼 문구. 기본: "나가기" */
    confirmButtonText?: string
  }

  const DEFAULT_TITLE = '검사를 종료할까요?'
  const DEFAULT_DESCRIPTION = `현재 검사 세션이 종료되고
검사 목록으로 이동해요`
  const DEFAULT_CONFIRM_BUTTON = '나가기'

  let {
    modalId = '',
    closeModal = () => {},
    onConfirm = () => {},
    title = DEFAULT_TITLE,
    description = DEFAULT_DESCRIPTION,
    confirmButtonText = DEFAULT_CONFIRM_BUTTON
  }: Props = $props()

  const handleConfirm = () => {
    onConfirm()
    closeModal()
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={false}
  showFooterBorder={false}
  showCloseButton={false}
  bodyClass="p-5"
  footerClass="px-5 pt-4 pb-5"
>
  {#snippet body()}
    <div class="flex flex-col items-center">
      <!-- 녹색 원 + 흰색 느낌표 아이콘 -->
      <div
        class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-green-500"
        aria-hidden="true"
      >
        <svg
          class="h-9 w-9 text-white"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 8v4" />
          <circle cx="12" cy="16" r="1.5" fill="currentColor" />
        </svg>
      </div>
      <Typography
        variant="headline-02-semibold"
        color="text-gray-800"
        className="mt-4 mb-3"
      >
        {title}
      </Typography>
      <Typography
        variant="body-01-reading-regular"
        color="text-gray-600"
        className="text-center whitespace-pre-line"
      >
        {description}
      </Typography>
    </div>
  {/snippet}
  {#snippet footer()}
    <div class="w-full grid grid-cols-2 gap-2">
      <button
        type="button"
        onclick={() => closeModal()}
        class="flex-center h-11 w-full rounded-lg border border-gray-200 hover:border-gray-300 duration-200"
      >
        <Typography variant="body-01-normal-medium" color="text-gray-600">
          취소
        </Typography>
      </button>
      <button
        type="button"
        onclick={handleConfirm}
        class="flex-center h-11 w-full rounded-lg border border-gray-200 hover:bg-[#D23E461A] duration-200"
      >
        <Typography variant="body-01-normal-medium" color="text-[#E83328]">
          {confirmButtonText}
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
