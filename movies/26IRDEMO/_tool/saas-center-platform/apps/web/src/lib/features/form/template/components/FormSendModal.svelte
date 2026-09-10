<script lang="ts">
  import { slide } from 'svelte/transition'
  import { onMount } from 'svelte'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { requireCenterId } from '$lib/stores/center.store'
  import { createFormSend } from '$lib/hooks/actions/form.action'
  import {
    getDefaultTemplate,
    getMessageTemplates,
    type MessageTemplateSummary
  } from '$lib/hooks/actions/messageTemplate.action'
  import {
    getClientList,
    type ClientListItem
  } from '$lib/hooks/actions/client.action'
  import type { ExtendedClient } from '$lib/stores/receiveForm'
  import { renderContentWithHighlight } from '$lib/features/center/message-template/view-model'
  import { getVariableLabelMap } from '$lib/features/center/message-template/constants'

  import Button from '$lib/components/Button.svelte'
  import BaseModal from '$lib/components/modal/BaseModal.svelte'
  import Typography from '@common/components/Typography.svelte'
  import CloseIcon from '$lib/assets/CloseIcon.svelte'
  import RadioCircleCheckedIcon from '$lib/assets/RadioCircleCheckedIcon.svelte'
  import RadioCircleUncheckedIcon from '$lib/assets/RadioCircleUncheckedIcon.svelte'
  import ClientMultiSelect from '$lib/components/assessment/receive/ClientMultiSelect.svelte'

  const TEMPLATE_TYPE = 'form_fill_request'

  interface Props {
    modalId?: string
    templateId: string
    formName?: string
    closeModal?: () => void
    onSendComplete?: () => void
  }

  let {
    modalId,
    templateId,
    formName = '',
    closeModal = () => {},
    onSendComplete
  }: Props = $props()

  // ========== 전송 양식 ==========
  let channel = $state<'alarmtalk' | 'sms'>('sms')

  let templateContent = $state('')
  let selectedTemplateId = $state<string | null>(null)
  let availableTemplates = $state<MessageTemplateSummary[]>([])
  let showTemplateSelector = $state(false)
  let ready = $state(false)

  // ── 수신자: assessment/receive 의 내담자 검색 드롭다운 재사용 ──
  let clientOptions = $state<ClientListItem[]>([])
  let selectedClients = $state<ExtendedClient[]>([])

  async function loadClients() {
    try {
      const centerId = requireCenterId()
      const res = await getClientList().request({
        centerId,
        status: 'active',
        limit: 100
      })
      clientOptions = res.items ?? []
    } catch {
      clientOptions = []
    }
  }

  onMount(async () => {
    try {
      const centerId = requireCenterId()
      const [defaultRes, listRes] = await Promise.all([
        getDefaultTemplate().request({
          centerId,
          template_type: TEMPLATE_TYPE
        }),
        getMessageTemplates().request({
          centerId,
          template_type: TEMPLATE_TYPE
        }),
        loadClients()
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

  let isSending = $state(false)

  const variableLabelMap = getVariableLabelMap(TEMPLATE_TYPE)
  let previewHtml = $derived.by(() => {
    const html = renderContentWithHighlight(templateContent, variableLabelMap)
    return html.replace(/\n/g, '<br>')
  })

  let hasCustomTemplate = $derived(
    availableTemplates.some((t) => t.center_id !== null)
  )

  const onClickSend = async () => {
    const recipients = selectedClients
      .map((c) => ({
        name: c.name,
        phone: (c.guardian_phone ?? '').trim(),
        relation: c.guardian_relationship ?? ''
      }))
      .filter((r) => r.phone)

    if (recipients.length === 0) {
      snackbarStore.error('연락처가 등록된 내담자를 선택해주세요')
      return
    }

    isSending = true
    try {
      const centerId = requireCenterId()
      await createFormSend().request({
        centerId,
        templateId,
        payload: {
          recipients,
          channel,
          template_id: selectedTemplateId ?? undefined
        }
      })
      snackbarStore.success('작성 요청을 전송했습니다')
      onSendComplete?.()
      closeModal()
    } catch {
      snackbarStore.error('전송에 실패했습니다')
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
        문서 작성 요청
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
    {#if !ready}
      <div
        class="flex items-center justify-center px-5 min-w-[900px] min-h-[420px]"
      >
        <p class="text-sm text-gray-400">양식을 불러오는 중...</p>
      </div>
    {:else}
      <div class="flex w-full gap-6 p-5 pb-7">
        <!-- 왼쪽: 폼 영역 (드롭다운 최소폭 480px 에 맞춰 고정) -->
        <div class="w-[480px] shrink-0 space-y-5">
          <!-- 대상 양식 -->
          {#if formName}
            <div
              class="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
            >
              <Typography variant="body-03-regular" color="text-gray-400"
                >양식</Typography
              >
              <Typography variant="body-02-medium" color="text-gray-800"
                >{formName}</Typography
              >
            </div>
          {/if}

          <!-- 수신자 (assessment/receive 내담자 검색 드롭다운 재사용) -->
          <div>
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
              className="mb-1"
            >
              내담자를 검색해 선택해주세요
            </Typography>
            <ClientMultiSelect
              label=""
              options={clientOptions}
              bind:selected={selectedClients}
              placeholder="내담자 이름을 검색해주세요"
              disableBottomMargin
              onOpen={loadClients}
            />
          </div>

          <!-- 전송 방식 -->
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
                    color="text-gray-400">알림톡</Typography
                  >
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

        <!-- 오른쪽: 미리보기 -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between mb-3">
            <Typography variant="title-01-semibold" color="text-gray-800"
              >미리보기</Typography
            >
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
  {/snippet}

  {#snippet footer()}
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
  {/snippet}
</BaseModal>
