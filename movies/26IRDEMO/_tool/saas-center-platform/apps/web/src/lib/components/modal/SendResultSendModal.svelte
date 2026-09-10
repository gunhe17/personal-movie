<script lang="ts">
  import { slide } from 'svelte/transition'
  import { onMount } from 'svelte'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { requireCenterId } from '$lib/stores/center.store'
  import {
    createSendResult,
    listSendResults,
    resendSendResult,
    type SendResultSummary
  } from '$lib/hooks/actions/quickLinks'
  import {
    getDefaultTemplate,
    getMessageTemplates,
    type MessageTemplateSummary
  } from '$lib/hooks/actions/messageTemplate.action'
  import { renderContentWithHighlight } from '$lib/features/center/message-template/view-model'
  import { getVariableLabelMap } from '$lib/features/center/message-template/constants'

  import Button from '../Button.svelte'
  import Select from '../Select.svelte'
  import BaseModal from './BaseModal.svelte'
  import TrashIcon from '$lib/assets/TrashIcon.svelte'
  import Typography from '@common/components/Typography.svelte'
  import CirclePlusBlueIcon from '$lib/assets/CirclePlusBlueIcon.svelte'
  import CloseIcon from '../../assets/CloseIcon.svelte'
  import RadioCircleCheckedIcon from '../../assets/RadioCircleCheckedIcon.svelte'
  import RadioCircleUncheckedIcon from '../../assets/RadioCircleUncheckedIcon.svelte'

  interface Props {
    modalId?: string
    caseId: string
    closeModal?: () => void
    onSendComplete?: () => void
  }

  let {
    modalId,
    caseId,
    closeModal = () => {},
    onSendComplete
  }: Props = $props()

  // ========== 탭 ==========
  let activeTab = $state<'send' | 'history'>('send')

  // ========== 전송 내역 ==========
  let sendResults = $state<SendResultSummary[]>([])
  let isLoadingHistory = $state(false)
  let resendingId = $state<string | null>(null)
  let hasHistory = $state(false)

  async function loadSendResults() {
    isLoadingHistory = true
    try {
      const centerId = requireCenterId()
      const results = await listSendResults().request({ centerId, caseId })
      sendResults = Array.isArray(results) ? results : []
      hasHistory = sendResults.length > 0
    } catch {
      sendResults = []
    } finally {
      isLoadingHistory = false
    }
  }

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
      onSendComplete?.()
      await loadSendResults()
    } catch {
      snackbarStore.error('재전송에 실패했습니다')
    } finally {
      resendingId = null
    }
  }

  function channelLabel(channel: string | null): string {
    if (channel === 'alarmtalk') return '알림톡'
    if (channel === 'sms') return 'SMS'
    return channel ?? '-'
  }

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

  function recipientsSummary(sr: SendResultSummary): string {
    if (!sr.recipients || sr.recipients.length === 0) return '-'
    const first = sr.recipients[0]
    const name = first.name || first.phone || '-'
    if (sr.recipients.length === 1) return name
    return `${name} 외 ${sr.recipients.length - 1}명`
  }

  function recipientsPhoneSummary(sr: SendResultSummary): string {
    if (!sr.recipients || sr.recipients.length === 0) return '-'
    const first = sr.recipients[0]
    const phone = first.phone || '-'
    if (sr.recipients.length === 1) return phone
    return `${phone} 외 ${sr.recipients.length - 1}건`
  }

  // ========== 전송 폼 ==========
  let channel = $state<'alarmtalk' | 'sms'>('sms')

  let templateContent = $state('')
  let selectedTemplateId = $state<string | null>(null)
  let availableTemplates = $state<MessageTemplateSummary[]>([])
  let showTemplateSelector = $state(false)
  let ready = $state(false)
  onMount(async () => {
    try {
      const centerId = requireCenterId()
      const [defaultRes, listRes] = await Promise.all([
        getDefaultTemplate().request({
          centerId,
          template_type: 'assessment_result_send'
        }),
        getMessageTemplates().request({
          centerId,
          template_type: 'assessment_result_send'
        }),
        loadSendResults()
      ])
      templateContent = defaultRes.fallback_content
      if (defaultRes.template) {
        selectedTemplateId = defaultRes.template.id
      }
      availableTemplates = listRes.items
    } catch {
      // 폴백
    } finally {
      ready = true
    }
  })

  function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 11)
    if (digits.length <= 3) return digits
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  }

  function handlePhoneInput(idx: number, e: Event) {
    const input = e.target as HTMLInputElement
    const formatted = formatPhone(input.value)
    recipients[idx].phone = formatted
    requestAnimationFrame(() => {
      input.value = formatted
      input.setSelectionRange(formatted.length, formatted.length)
    })
  }

  const relationOptions = ['엄마', '아빠', '할머니', '할아버지', '기타']

  let recipients = $state<{ relation: string; name: string; phone: string }[]>([
    { relation: '', name: '', phone: '' }
  ])

  let isSending = $state(false)

  const variableLabelMap = getVariableLabelMap('assessment_result_send')
  let previewHtml = $derived.by(() => {
    const html = renderContentWithHighlight(templateContent, variableLabelMap)
    return html.replace(/\n/g, '<br>')
  })

  let hasCustomTemplate = $derived(
    availableTemplates.some((t) => t.center_id !== null)
  )

  const onClickAddRecipients = () => {
    recipients = [...recipients, { relation: '', name: '', phone: '' }]
  }

  const onClickRemoveRecipient = (idx: number) => {
    recipients = recipients.filter((_, i) => i !== idx)
  }

  const onClickSend = async () => {
    const validRecipients = recipients.filter((r) => r.name && r.phone)
    if (validRecipients.length === 0) {
      snackbarStore.error('이름과 전화번호를 입력해주세요')
      return
    }

    isSending = true
    try {
      const centerId = requireCenterId()
      await createSendResult().request({
        centerId,
        caseId,
        payload: {
          recipients: validRecipients.map((r) => ({
            name: r.name,
            phone: r.phone,
            relation: r.relation
          })),
          channel,
          template_id: selectedTemplateId ?? undefined
        }
      })
      snackbarStore.success('결과 전송이 완료되었습니다')
      onSendComplete?.()
      // 전송 후 내역 갱신 & 내역 탭으로 이동
      await loadSendResults()
      activeTab = 'history'
    } catch {
      snackbarStore.error('결과 전송에 실패했습니다')
    } finally {
      isSending = false
    }
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showFooterBorder={true}
  showCloseButton={false}
  showHeaderBorder={true}
  size="fit"
  headerClass="px-5 py-4"
  bodyClass="overflow-y-auto"
  footerClass="px-5 pt-4 pb-5 border-t border-gray-200"
  containerClass="min-w-[900px] max-h-[90vh] overflow-hidden rounded-lg bg-white shadow-xl"
>
  {#snippet header()}
    <div class="flex min-w-0 flex-1 items-center justify-between">
      <Typography
        variant="headline-02-normal-semibold"
        color="text-body-strong"
      >
        결과 전송
      </Typography>
      <button
        onclick={closeModal}
        class="flex-center h-6 w-6 shrink-0 text-gray-400 hover:text-gray-600"
      >
        <CloseIcon color="#8A949E" />
      </button>
    </div>
  {/snippet}

  {#snippet body()}
    <!-- 탭 -->
    <div class="flex border-b border-gray-200 px-5 pt-5">
      <button
        class="px-4 py-2.5 text-sm font-medium transition-colors {activeTab ===
        'send'
          ? 'text-primary-600 border-b-2 border-primary-500'
          : 'text-gray-500 hover:text-gray-700'}"
        onclick={() => (activeTab = 'send')}
      >
        전송
      </button>
      <button
        class="px-4 py-2.5 text-sm font-medium transition-colors {activeTab ===
        'history'
          ? 'text-primary-600 border-b-2 border-primary-500'
          : 'text-gray-500 hover:text-gray-700'}"
        onclick={() => (activeTab = 'history')}
      >
        전송 내역
        {#if hasHistory}
          <span
            class="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-label-02-normal-medium text-gray-600"
            >{sendResults.length}</span
          >
        {/if}
      </button>
    </div>

    {#if activeTab === 'send'}
      <!-- 전송 폼 -->
      {#if !ready}
        <div
          class="flex items-center justify-center px-5 min-w-[900px] min-h-[420px]"
        >
          <p class="text-sm text-gray-400">양식을 불러오는 중...</p>
        </div>
      {:else}
        <div class="flex w-full gap-6 p-5">
          <!-- 왼쪽: 폼 영역 -->
          <div class="flex-1 space-y-5 min-w-0">
            <!-- 수신자 섹션 -->
            <div class="pt-4">
              <Typography
                variant="title-01-semibold"
                color="text-gray-800"
                className="mb-2"
              >
                수신자
              </Typography>

              <Typography
                variant="body-03-regular"
                color="text-gray-500"
                className="mb-3"
              >
                결과를 받을 수신자의 정보를 입력해주세요
              </Typography>
              <div class="space-y-3">
                {#each recipients as recipient, idx}
                  <div
                    transition:slide
                    class="flex items-center gap-2 w-full max-w-full"
                  >
                    <Select
                      class="w-[100px] rounded-lg bg-white"
                      options={relationOptions}
                      selected={recipient.relation}
                      placeholder="관계"
                      on:change={(e) => (recipient.relation = e.detail)}
                    />
                    <input
                      type="text"
                      placeholder="이름"
                      bind:value={recipient.name}
                      class="field-input w-[120px] shrink-0"
                    />
                    <input
                      type="tel"
                      placeholder="010-0000-0000"
                      value={recipient.phone}
                      oninput={(e) => handlePhoneInput(idx, e)}
                      class="h-11 flex-1 min-w-0 bg-white rounded-lg border border-gray-200 px-2.5 text-sm text-gray-700 outline-none focus:border-border-active"
                    />
                    {#if recipients.length > 1}
                      <button
                        onclick={() => onClickRemoveRecipient(idx)}
                        class="shrink-0 rounded-md p-1 hover:bg-gray-50"
                      >
                        <TrashIcon />
                      </button>
                    {/if}
                  </div>
                {/each}
              </div>
              <div class="mt-3 flex justify-center">
                <button
                  onclick={onClickAddRecipients}
                  class="flex items-center gap-2 py-1"
                >
                  <CirclePlusBlueIcon />
                  <Typography variant="body-02-regular" color="text-gray-600">
                    추가
                  </Typography>
                </button>
              </div>
            </div>

            <!-- 전송 방식 섹션 -->
            <div class="border-t border-gray-200 pt-5">
              <Typography
                variant="title-01-semibold"
                color="text-gray-800"
                className="mb-3"
              >
                전송 방식
              </Typography>
              <div class="flex gap-3">
                <button
                  disabled
                  class="flex h-11 flex-1 items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 cursor-not-allowed opacity-50"
                >
                  <div class="flex flex-col items-start">
                    <Typography
                      variant="body-01-normal-medium"
                      color="text-gray-400"
                    >
                      알림톡
                    </Typography>
                    <span class="text-body-03-normal-regular text-gray-400"
                      >준비 중</span
                    >
                  </div>
                  <div class="flex h-5 w-5 items-center justify-center">
                    <RadioCircleUncheckedIcon strokeColor="#D1D5DB" />
                  </div>
                </button>
                <button
                  onclick={() => (channel = 'sms')}
                  class="flex h-11 flex-1 items-center justify-between rounded-lg border px-4 transition-all duration-200 {channel ===
                  'sms'
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'}"
                >
                  <Typography
                    variant="body-01-normal-medium"
                    color={channel === 'sms'
                      ? 'text-primary-600'
                      : 'text-gray-700'}
                  >
                    문자
                  </Typography>
                  <div class="flex h-5 w-5 items-center justify-center">
                    {#if channel === 'sms'}
                      <RadioCircleCheckedIcon checkColor="#4f83ff" />
                    {:else}
                      <RadioCircleUncheckedIcon strokeColor="#D1D5DB" />
                    {/if}
                  </div>
                </button>
              </div>
            </div>
          </div>

          <!-- 오른쪽: 미리보기 영역 -->
          <div class="flex-1 min-w-0 pt-4">
            <div class="flex items-center justify-between mb-3">
              <Typography variant="title-01-semibold" color="text-gray-800">
                미리보기
              </Typography>
              {#if hasCustomTemplate}
                <button
                  class="text-xs text-blue-600 hover:text-blue-700"
                  onclick={() => (showTemplateSelector = !showTemplateSelector)}
                >
                  양식 변경
                </button>
              {:else}
                <a
                  href="/center/message-templates"
                  class="text-xs text-blue-600 hover:text-blue-700"
                >
                  양식 추가
                </a>
              {/if}
            </div>

            {#if showTemplateSelector}
              <div
                class="mb-3 rounded-lg border border-gray-200 bg-white p-2 space-y-1"
                transition:slide
              >
                {#each availableTemplates as tpl}
                  <button
                    class="w-full text-left rounded-lg px-3 py-2 text-xs hover:bg-gray-50 transition-colors {selectedTemplateId ===
                    tpl.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700'}"
                    onclick={async () => {
                      selectedTemplateId = tpl.id
                      try {
                        const { getMessageTemplate } = await import(
                          '$lib/hooks/actions/messageTemplate.action'
                        )
                        const detail = await getMessageTemplate().request({
                          centerId: requireCenterId(),
                          templateId: tpl.id
                        })
                        templateContent = detail.content
                      } catch {
                        /* fallback */
                      }
                      showTemplateSelector = false
                    }}
                  >
                    {tpl.name}
                    {#if tpl.is_default}
                      <span
                        class="ml-1 rounded bg-blue-100 px-1.5 py-0.5 text-label-02-normal-medium text-blue-600"
                        >기본</span
                      >
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}

            <div class="rounded-lg bg-gray-100 p-5">
              <div class="rounded-lg bg-white p-4 shadow-sm">
                <p class="text-xs leading-relaxed text-gray-700">
                  <span class="font-semibold text-gray-500">[Web발신]</span><br
                  />{@html previewHtml}
                </p>
              </div>
            </div>
          </div>
        </div>
      {/if}
    {:else}
      <!-- 전송 내역 탭 -->
      <div class="p-5 pb-7">
        {#if isLoadingHistory}
          <div class="flex items-center justify-center py-10 text-gray-400">
            불러오는 중...
          </div>
        {:else if sendResults.length === 0}
          <div class="flex items-center justify-center py-10 text-gray-400">
            전송 내역이 없습니다
          </div>
        {:else}
          <div>
            <div
              class="grid grid-cols-[160px_80px_100px_140px_1fr] border-b border-gray-200 py-3"
            >
              <Typography variant="body-02-medium" color="text-gray-500">
                전송 일시
              </Typography>
              <Typography
                variant="body-02-medium"
                color="text-gray-500"
                className="text-center"
              >
                방식
              </Typography>
              <Typography
                variant="body-02-medium"
                color="text-gray-500"
                className="text-center"
              >
                수신자
              </Typography>
              <Typography
                variant="body-02-medium"
                color="text-gray-500"
                className="text-center"
              >
                연락처
              </Typography>
              <div></div>
            </div>

            {#each sendResults as sr (sr.id)}
              <div
                class="grid grid-cols-[160px_80px_100px_140px_1fr] items-center border-b border-gray-100 py-4"
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
                <Typography
                  variant="body-02-regular"
                  color="text-gray-700"
                  className="text-center"
                >
                  {recipientsPhoneSummary(sr)}
                </Typography>
                <div class="flex justify-end">
                  <button
                    onclick={() => handleResend(sr.id)}
                    disabled={resendingId === sr.id}
                    class="h-8 rounded-lg border border-primary-300 bg-white px-3 text-xs text-primary-500 hover:bg-primary-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resendingId === sr.id ? '전송 중...' : '재전송'}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  {/snippet}

  {#snippet footer()}
    {#if activeTab === 'send'}
      <div class="flex w-full justify-end">
        <Button
          onclick={onClickSend}
          disabled={isSending || !ready}
          class="h-11 rounded-lg bg-primary-500 px-8 duration-200 hover:bg-primary-600 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Typography variant="body-01-normal-medium" color="text-white">
            {isSending ? '전송 중...' : '전송'}
          </Typography>
        </Button>
      </div>
    {:else}
      <div class="flex w-full justify-end">
        <Button
          onclick={closeModal}
          class="h-11 rounded-lg bg-primary-500 px-8 hover:bg-primary-600 transition"
        >
          <Typography variant="body-01-normal-medium" color="text-white"
            >확인</Typography
          >
        </Button>
      </div>
    {/if}
  {/snippet}
</BaseModal>
