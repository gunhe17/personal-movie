<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import Button from '../Button.svelte'
  import TabBar from '../TabBar.svelte'
  import CloseIcon from '$lib/assets/CloseIcon.svelte'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { requireCenterId } from '$lib/stores/center.store'
  import {
    listSendResults,
    getSendResultDeliveryHistory,
    resendSendResult,
    type SendResultSummary,
    type MessageLogSummary
  } from '$lib/hooks/actions/quickLinks'

  interface Props {
    modalId?: string
    caseId: string
    closeModal?: () => void
    onResend?: () => void
  }

  let { modalId, closeModal = () => {}, caseId, onResend }: Props = $props()

  let activeTab = $state('result')

  const tabs = [{ value: 'result', label: '결과전송' }]

  // API 데이터
  let sendResults = $state<SendResultSummary[]>([])
  let deliveryLogs = $state<Map<string, MessageLogSummary[]>>(new Map())
  let isLoading = $state(false)
  let resendingId = $state<string | null>(null)

  // 발송 이력 조회
  async function loadSendResults() {
    isLoading = true
    try {
      const centerId = requireCenterId()
      const results = await listSendResults().request({ centerId, caseId })
      sendResults = Array.isArray(results) ? results : []
    } catch {
      sendResults = []
    } finally {
      isLoading = false
    }
  }

  // 특정 전송 건의 delivery history 조회
  async function loadDeliveryHistory(sendResultId: string) {
    try {
      const centerId = requireCenterId()
      const logs = await getSendResultDeliveryHistory().request({
        centerId,
        caseId,
        sendResultId
      })
      deliveryLogs.set(sendResultId, Array.isArray(logs) ? logs : [])
      deliveryLogs = new Map(deliveryLogs)
    } catch {
      // 실패 시 빈 배열
    }
  }

  // 재전송
  async function handleResend(sendResultId: string) {
    resendingId = sendResultId
    try {
      const centerId = requireCenterId()
      await resendSendResult().request({
        centerId,
        caseId,
        sendResultId,
        payload: { failed_only: false }
      })
      snackbarStore.success('결과를 재전송했습니다')
      onResend?.()
      await loadSendResults()
    } catch {
      snackbarStore.error('재전송에 실패했습니다')
    } finally {
      resendingId = null
    }
  }

  // 채널 라벨
  function channelLabel(channel: string | null): string {
    if (channel === 'alarmtalk') return '알림톡'
    if (channel === 'sms') return 'SMS'
    return channel ?? '-'
  }

  // 날짜 포맷
  function formatDate(iso: string): string {
    if (!iso) return '-'
    const d = new Date(iso)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${day} ${h}:${min}`
  }

  // 수신자 요약
  function recipientsSummary(sr: SendResultSummary): string {
    if (!sr.recipients || sr.recipients.length === 0) return '-'
    const first = sr.recipients[0]
    const name = first.name || first.phone || '-'
    if (sr.recipients.length === 1) return name
    return `${name} 외 ${sr.recipients.length - 1}명`
  }

  // 컴포넌트 마운트 시 데이터 로드
  $effect(() => {
    if (caseId) {
      loadSendResults()
    }
  })
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
  containerClass="min-w-[580px] overflow-hidden rounded-lg bg-white shadow-xl"
>
  {#snippet header()}
    <div class="flex w-full items-center justify-between">
      <Typography
        variant="headline-02-normal-semibold"
        color="text-body-strong"
      >
        전송 내역
      </Typography>
      <button
        onclick={closeModal}
        class="flex h-11 w-10 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition"
      >
        <CloseIcon color="#8A949E" />
      </button>
    </div>
  {/snippet}

  {#snippet body()}
    <div class="space-y-5">
      <!-- 탭 -->
      <TabBar {tabs} bind:activeTab class="border-b-0" />

      {#if isLoading}
        <div class="flex items-center justify-center py-10 text-gray-400">
          불러오는 중...
        </div>
      {:else if sendResults.length === 0}
        <div class="flex items-center justify-center py-10 text-gray-400">
          전송 내역이 없습니다
        </div>
      {:else}
        <!-- 전송 기록 테이블 -->
        <div>
          <!-- 헤더 -->
          <div
            class="grid grid-cols-[160px_100px_100px_1fr] border-b border-gray-200 py-3"
          >
            <Typography variant="body-02-medium" color="text-gray-500">
              전송 일시
            </Typography>
            <Typography
              variant="body-02-medium"
              color="text-gray-500"
              className="text-center"
            >
              전송 방식
            </Typography>
            <Typography
              variant="body-02-medium"
              color="text-gray-500"
              className="text-center"
            >
              수신자
            </Typography>
            <div></div>
          </div>

          <!-- 데이터 행 -->
          {#each sendResults as sr (sr.id)}
            <div
              class="grid grid-cols-[160px_100px_100px_1fr] items-center border-b border-gray-100 py-4"
            >
              <Typography variant="body-02-regular" color="text-gray-700">
                {formatDate(sr.created_at)}
              </Typography>
              <Typography
                variant="body-02-regular"
                color="text-gray-700"
                className="text-center"
              >
                {channelLabel(sr.channel)}
              </Typography>
              <Typography
                variant="body-02-regular"
                color="text-gray-700"
                className="text-center"
              >
                {recipientsSummary(sr)}
              </Typography>
              <div class="flex justify-end">
                <button
                  onclick={() => handleResend(sr.id)}
                  disabled={resendingId === sr.id}
                  class="h-9 rounded-lg border border-primary-300 bg-white px-4 text-body-02-normal-medium text-primary-500 hover:bg-primary-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendingId === sr.id ? '전송 중...' : '재전송'}
                </button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="flex justify-end px-5 pt-4 pb-5">
      <Button
        onclick={closeModal}
        class="h-11 rounded-lg bg-primary-500 px-8 hover:bg-primary-600 transition"
      >
        <Typography variant="body-01-normal-medium" color="text-white"
          >확인</Typography
        >
      </Button>
    </div>
  {/snippet}
</BaseModal>
