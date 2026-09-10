<script lang="ts">
  import type { AssessmentStatusRow } from '$lib/types/assessmentStatus'
  import { snackbarStore } from '$lib/stores/snackbar'

  import Button from '../Button.svelte'
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import CloseIcon from '../../assets/CloseIcon.svelte'
  import LinkIcon from '$lib/assets/LinkIcon.svelte'
  import BaroLinkTextWithIcon from '../../assets/BaroLinkTextWithIcon.svelte'

  interface SendHistory {
    sentAt: string
    recipientName: string
    daysLeft: number
    expiryDate: string
  }

  interface Props {
    modalId?: string
    rowData?: AssessmentStatusRow
    closeModal?: () => void
    onResend?: () => void
  }

  let { modalId, closeModal = () => {}, rowData, onResend }: Props = $props()

  function handleResend() {
    onResend?.()
    closeModal()
    snackbarStore.success('바로링크를 재전송했습니다')
  }

  // 더미 전송 기록 데이터 (실제로는 API에서 가져옴)
  const sendHistory: SendHistory[] = [
    {
      sentAt: '2025.10.07 (화) 15:10',
      recipientName: '이영자',
      daysLeft: 28,
      expiryDate: '2025.10.07 (화)'
    }
  ]

  const handleCopyLink = async () => {
    try {
      // TODO: 실제 링크 URL로 교체
      const linkUrl = `https://example.com/result/${rowData?.id}`
      await navigator.clipboard.writeText(linkUrl)
      snackbarStore.success('링크가 복사되었습니다')
    } catch {
      snackbarStore.error('링크 복사에 실패했습니다')
    }
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showFooterBorder={false}
  showCloseButton={false}
  showHeaderBorder={false}
  size="fit"
  bodyClass="p-5 pb-7"
  headerClass="px-5 py-4"
  containerClass="min-w-[640px] overflow-hidden rounded-lg bg-gradient-to-br from-[#eef4ff] via-[#f8fbff] to-[#d7e5ff] shadow-xl"
>
  {#snippet header()}
    <div
      class="flex w-full items-center justify-between border-b border-gray-100"
    >
      <div class="flex items-center gap-[10px]">
        <BaroLinkTextWithIcon />
        <Typography
          variant="headline-02-normal-semibold"
          color="text-body-strong"
        >
          전송기록
        </Typography>
      </div>
      <Button
        onclick={closeModal}
        class="flex-center h-11 w-11 rounded-full bg-gray-50 p-0! duration-300 hover:bg-gray-100"
      >
        <CloseIcon color="#8A949E" />
      </Button>
    </div>
  {/snippet}

  {#snippet body()}
    <div class="space-y-5">
      <!-- 바로 링크 섹션 -->
      <div class="flex items-center justify-between">
        <div class="flex gap-1 items-center">
          <Typography variant="body-03-regular" color="text-gray-500">
            모바일 검사 마감일
          </Typography>
          <div
            class="px-2 h-6 flex justify-center items-center rounded-[100px] bg-[#49AAEF1A]"
          >
            <Typography variant="body-03-regular" color="text-primary-400"
              >D-3</Typography
            >
          </div>
          <Typography variant="body-03-regular" color="text-gray-500">
            2025-10-14
          </Typography>
        </div>
        <button
          onclick={handleCopyLink}
          class="w-[103px] h-[32px] bg-white flex justify-center items-center gap-2 rounded-[8px] transition-colors hover:bg-gray-50"
        >
          <LinkIcon width={16} height={16} />
          <Typography variant="body-03-medium" color="text-gray-600">
            링크 복사
          </Typography>
        </button>
      </div>

      <!-- 전송 기록 테이블 -->
      <div class="overflow-hidden rounded-lg border border-gray-200">
        <!-- 헤더 -->
        <div
          class="grid grid-cols-[180px_160px_1fr] border-b border-gray-100 bg-gray-100 px-5 py-3"
        >
          <Typography variant="body-02-medium" color="text-gray-500">
            전송 일자
          </Typography>
          <Typography
            variant="body-03-regular"
            color="text-gray-500"
            className="text-center"
          >
            수신자(보호자)
          </Typography>
          <Typography
            variant="body-03-regular"
            color="text-gray-500"
            className="text-center"
          ></Typography>
        </div>

        <!-- 데이터 행 -->
        {#each sendHistory as history}
          <div
            class="grid grid-cols-[180px_160px_1fr] bg-white items-center px-5 py-3"
          >
            <Typography variant="body-02-regular" color="text-gray-700">
              {history.sentAt}
            </Typography>
            <Typography
              variant="body-02-regular"
              color="text-gray-700"
              className="text-center"
            >
              {history.recipientName}
            </Typography>
            <div class="flex justify-end items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                class="w-[68px] h-[32px] bg-white flex justify-center border border-gray-200 items-center gap-1.5 rounded-[8px]  transition-colors hover:bg-gray-50"
                onclick={handleResend}
              >
                <Typography variant="body-03-medium" color="text-gray-600">
                  재전송
                </Typography>
              </Button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/snippet}

  <!-- {#snippet footer()}
    <div class="flex justify-end items-center">
      <Button
        onclick={closeModal}
        class="h-11 rounded-lg bg-primary-500 px-8 duration-200 hover:bg-primary-400"
      >
        <Typography variant="body-01-normal-medium" color="text-white">확인</Typography
        >
      </Button>
    </div>
  {/snippet} -->
</BaseModal>
