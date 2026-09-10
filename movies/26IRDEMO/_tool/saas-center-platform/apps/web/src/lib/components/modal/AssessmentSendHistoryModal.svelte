<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import {
    clientListStroe,
    sessionListMockApis,
    type AssessmentSendHistoryType
  } from '$lib/stores/sessionStatus_local'
  import Button from '../Button.svelte'
  import { twMerge } from 'tailwind-merge'
  import { dateToString } from '$lib/utils/date'
  import LinkIcon from '$lib/assets/LinkIcon.svelte'
  import { snackbarStore } from '$lib/stores/snackbar'

  interface Props {
    modalId?: string
    sessionId?: string
    closeModal?: () => void
  }

  let { modalId, closeModal = () => {}, sessionId }: Props = $props()

  const cellClass = 'flex items-center px-[10px] border-b border-gray-100 '
  const headers: string[] = ['전송 일자', '수신자', '링크 복사']

  let assessmentSendHistoryList = $state<AssessmentSendHistoryType[]>([])

  const onClickCopyLink = (link: string) => {
    navigator.clipboard
      .writeText(link)
      .then(() => {
        snackbarStore.success('링크를 복사했습니다')
      })
      .catch(() => {
        snackbarStore.error('개발환경에서는 복사 불가')
      })
  }

  $effect(() => {
    if ($clientListStroe) {
      if (!sessionId) return
      assessmentSendHistoryList =
        sessionListMockApis.getAssessmentSendHistoryList(sessionId)
          .data as AssessmentSendHistoryType[]
    }
  })
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={false}
  showFooterBorder={false}
  showCloseButton={false}
  size="lg"
  bodyClass="p-5 pb-7 max-h-[600px]"
  title="전송 내역을 확인할게요"
>
  {#snippet body()}
    <div class="flex-center max-w-149.5 flex-col">
      <div class="grid w-full grid-cols-[1.3fr_1.5fr_1fr]">
        {#each headers as head}
          <div
            class={twMerge(
              'flex h-12 items-center bg-gray-50 px-5',
              head === '링크 복사' && 'justify-center'
            )}
          >
            <Typography variant="body-02-regular">
              {head}
            </Typography>
          </div>
        {/each}
      </div>
      <div class="grid w-full grid-cols-[1.3fr_1.5fr_1fr]">
        {#each assessmentSendHistoryList as history}
          <div class={twMerge(cellClass, 'h-12 px-5')}>
            <Typography variant="body-02-regular" color={'text-gray-800'}>
              {history.send_date &&
                dateToString(history.send_date, 'YYYY.MM.DD (d) HH:mm')}
            </Typography>
          </div>
          <div class={twMerge(cellClass, 'h-12 px-5')}>
            <Typography variant="body-02-regular" color={'text-gray-800'}>
              {history.receiver.receiver_relation}에게 전송됨
            </Typography>
          </div>
          <div class={twMerge(cellClass, 'h-12 justify-center')}>
            <!-- svelte-ignore event_directive_deprecated -->
            <button on:click={() => onClickCopyLink(history.link)}>
              <LinkIcon />
            </button>
          </div>
        {/each}
      </div>
    </div>
  {/snippet}
  {#snippet footer()}
    <div class="flex w-full items-center justify-end">
      <Button
        onclick={closeModal}
        class="h-11 w-40 rounded-[10px] bg-primary-500 duration-200 hover:bg-primary-400"
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          확인
        </Typography>
      </Button>
    </div>
  {/snippet}
</BaseModal>
