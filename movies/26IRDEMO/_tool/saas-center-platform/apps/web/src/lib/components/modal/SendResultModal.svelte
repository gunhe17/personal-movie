<script lang="ts">
  import { slide } from 'svelte/transition'
  import type { AssessmentStatusRow } from '$lib/types/assessmentStatus'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { dateToString } from '$lib/utils/date'
  import { createAssessmentSendLink } from '$lib/hooks/actions/quickLinks'
  import { requireCenterId } from '$lib/stores/center.store'
  import { onMount } from 'svelte'
  import { getLinkAssessments } from '$lib/hooks/actions/link-assessments'
  import {
    getDefaultTemplate,
    getMessageTemplates,
    getMessageTemplate,
    type MessageTemplateSummary
  } from '$lib/hooks/actions/messageTemplate.action'

  import SendLinkHistory from './SendLinkHistory.svelte'
  import { renderContentWithHighlight } from '$lib/features/center/message-template/view-model'
  import { getVariableLabelMap } from '$lib/features/center/message-template/constants'
  let activeTab = $state<'send' | 'history'>('send')
  let historyBusy = $state(false)
  let channel = $state<'alarmtalk' | 'sms'>('sms')
  const variableLabels = getVariableLabelMap('assessment_send_link')
  let templates = $state<MessageTemplateSummary[]>([])
  let selectedTemplateId = $state('')
  let templateContent = $state('')
  const previewHtml = $derived(
    renderContentWithHighlight(templateContent, variableLabels)
  )
  let defaultContent = $state('')
  let builtinContent = $state('')
  let builtinNotice = $state(false)
  let loadingTemplate = $state(true)
  let templateError = $state('')
  let templateRequest = 0
  let disposed = false
  async function loadTemplates() {
    const request = ++templateRequest
    loadingTemplate = true
    templateError = ''
    try {
      const centerId = requireCenterId()
      const [defaults, list] = await Promise.all([
        getDefaultTemplate().request({
          centerId,
          template_type: 'assessment_send_link'
        }),
        getMessageTemplates().request({
          centerId,
          template_type: 'assessment_send_link'
        })
      ])
      if (disposed || request !== templateRequest) return
      templates = list.items
      defaultContent = defaults.template?.content ?? defaults.fallback_content
      builtinContent = defaults.builtin_content ?? ''
      builtinNotice =
        !!builtinContent &&
        (!defaultContent.includes('{assessment_url}') ||
          !defaultContent.includes('{verification_code}'))
      selectedTemplateId = defaults.template?.id ?? ''
      if (
        defaults.template &&
        !templates.some((template) => template.id === defaults.template!.id)
      )
        templates = [defaults.template, ...templates]
      templateContent = defaultContent
      if (builtinNotice) {
        selectedTemplateId = '__builtin__'
        templateContent = builtinContent
      }
    } catch {
      if (!disposed && request === templateRequest)
        templateError = '발송 양식을 불러오지 못했습니다. 다시 불러와주세요.'
    } finally {
      if (!disposed && request === templateRequest) loadingTemplate = false
    }
  }
  async function selectTemplate() {
    const request = ++templateRequest
    loadingTemplate = true
    templateError = ''
    try {
      const content =
        selectedTemplateId === '__builtin__'
          ? builtinContent
          : selectedTemplateId
            ? (
                await getMessageTemplate().request({
                  centerId: requireCenterId(),
                  templateId: selectedTemplateId
                })
              ).content
            : defaultContent
      if (!disposed && request === templateRequest) templateContent = content
    } catch {
      if (!disposed && request === templateRequest)
        templateError = '선택한 양식을 불러오지 못했습니다. 다시 선택해주세요.'
    } finally {
      if (!disposed && request === templateRequest) loadingTemplate = false
    }
  }
  const templateInvalid = $derived(
    !templateContent.includes('{assessment_url}') ||
      !templateContent.includes('{verification_code}')
  )
  onMount(() => {
    void loadTemplates()
    return () => {
      disposed = true
      templateRequest += 1
    }
  })

  import Button from '../Button.svelte'
  import Switch from '../Switch.svelte'
  import Select from '../Select.svelte'
  import SegmentTab from '../SegmentTab.svelte'
  import BaseModal from './BaseModal.svelte'
  import TrashIcon from '$lib/assets/TrashIcon.svelte'
  import Typography from '@common/components/Typography.svelte'
  import CirclePlusBlueIcon from '$lib/assets/CirclePlusBlueIcon.svelte'
  import CloseIcon from '../../assets/CloseIcon.svelte'
  import CalendarIcon from '$lib/assets/CalendarIcon.svelte'
  import RadioCircleCheckedIcon from '../../assets/RadioCircleCheckedIcon.svelte'
  import RadioCircleUncheckedIcon from '../../assets/RadioCircleUncheckedIcon.svelte'
  import BaroLinkTextWithIcon from '../../assets/BaroLinkTextWithIcon.svelte'
  import Hourglass from '../../assets/Hourglass.svelte'

  interface Props {
    modalId?: string
    rowData?: AssessmentStatusRow
    closeModal?: () => void
    onSendComplete?: () => void
    initialTab?: 'send' | 'history'
  }

  let {
    modalId,
    closeModal = () => {},
    rowData,
    onSendComplete,
    initialTab = 'send'
  }: Props = $props()
  onMount(() => {
    activeTab = initialTab
  })

  let supportedIds = $state<string[]>([])
  let loadingAssessments = $state(true)
  let assessmentError = $state('')
  onMount(() => {
    let disposed = false
    void getLinkAssessments()
      .request()
      .then((assessments) => {
        if (!disposed)
          supportedIds = assessments
            .filter((assessment) => assessment.supports_online)
            .map((assessment) => assessment.id)
      })
      .catch(() => {
        if (!disposed)
          assessmentError =
            '온라인 지원 정보를 불러오지 못했습니다. 창을 닫고 다시 시도해주세요.'
      })
      .finally(() => {
        if (!disposed) loadingAssessments = false
      })
    return () => {
      disposed = true
    }
  })

  const onlineAssessments = $derived(
    rowData?.assessments
      ?.map((name, index) => ({
        id: `assessment-${index}`,
        name,
        isOnline: supportedIds.includes(rowData.assessmentUids[index])
      }))
      .filter((assessment) => assessment.isOnline) || []
  )

  // 선택된 검사
  let selectedAssessments = $state<string[]>([])

  // 검사 선택 토글
  function toggleAssessment(id: string) {
    if (selectedAssessments.includes(id)) {
      selectedAssessments = selectedAssessments.filter((i) => i !== id)
    } else {
      selectedAssessments = [...selectedAssessments, id]
    }
  }

  // 만료일 설정 상태
  let hasEndDate = $state<boolean>(false)

  // 일수 옵션 (3일 뒤, 7일 뒤, 15일 뒤, 30일 뒤)
  const dayOptions = [
    { label: '3일 뒤', value: '3' },
    { label: '7일 뒤', value: '7' },
    { label: '15일 뒤', value: '15' },
    { label: '30일 뒤', value: '30' }
  ]

  let selectedDayValue = $state<string>('3')
  let sending = $state<boolean>(false)

  // 모바일 검사 선택 여부
  const hasSelectedAssessment = $derived(selectedAssessments.length > 0)

  // 시작일과 종료일 계산
  const today = new Date()
  const startDateStr = $derived(dateToString(today, 'YYYY-MM-DD'))
  const endDateStr = $derived(() => {
    const result = new Date()
    result.setDate(result.getDate() + parseInt(selectedDayValue))
    return dateToString(result, 'YYYY-MM-DD')
  })

  // 관계 옵션
  const relationOptions = ['엄마', '아빠', '할머니', '할아버지', '기타']

  // 수신자 목록
  let recipients = $state<{ relation: string; name: string; phone: string }[]>([
    { relation: '엄마', name: '', phone: '' }
  ])

  const onClickAddRecipients = () => {
    recipients = [...recipients, { relation: '', name: '', phone: '' }]
  }

  const onClickRemoveRecipient = (idx: number) => {
    recipients = recipients.filter((_, i) => i !== idx)
  }

  const onClickSendLink = async () => {
    if (loadingTemplate || templateError || templateInvalid) return
    const validRecipient = recipients.map((recipient) => ({
      ...recipient,
      name: recipient.name.trim(),
      phone: recipient.phone.replace(/\D/g, '')
    }))
    if (
      !validRecipient.length ||
      validRecipient.some(
        (recipient) => !recipient.name || !/^01\d{8,9}$/.test(recipient.phone)
      )
    ) {
      snackbarStore.error('수신자 정보를 입력해주세요')
      return
    }
    if (!rowData?.id) {
      snackbarStore.error('검사 정보를 찾을 수 없어요')
      return
    }
    // 선택된 synthetic id(assessment-{index}) → 실제 검사 uid 매핑
    const assessmentIds = selectedAssessments
      .map((id) => rowData.assessmentUids?.[Number(id.split('-')[1])])
      .filter((uid): uid is string => !!uid && supportedIds.includes(uid))
    if (assessmentIds.length === 0) {
      snackbarStore.error('전송할 검사를 선택해주세요')
      return
    }
    if (sending) return
    sending = true
    try {
      const response = await createAssessmentSendLink().request({
        centerId: requireCenterId(),
        caseId: rowData.id,
        payload: {
          recipients: validRecipient,
          assessment_ids: assessmentIds,
          expires_at: hasEndDate
            ? new Date(`${endDateStr()}T23:59:59+09:00`).toISOString()
            : null,
          channel,
          template_id: selectedTemplateId || undefined
        }
      })
      const result =
        (
          response as unknown as {
            data?: {
              delivery_results?: { status: string; error?: string | null }[]
            }
          }
        )?.data ??
        (response as unknown as {
          delivery_results?: { status: string; error?: string | null }[]
        })
      const failed =
        result?.delivery_results?.filter((r) => r.status === 'failed') ?? []
      if (failed.length > 0) {
        const templateMissing = failed.some((delivery) =>
          /21044|승인된 카카오톡 템플릿 없음/.test(delivery.error ?? '')
        )
        const contentMissing = failed.some((delivery) =>
          delivery.error?.includes('검사 링크와 인증번호')
        )
        snackbarStore.warning(
          templateMissing
            ? '링크는 생성됐지만 승인된 알림톡 템플릿을 찾지 못했습니다. 발송 템플릿 코드와 발신 프로필을 확인해주세요.'
            : contentMissing
              ? '링크는 생성됐지만 발송 양식에 바로링크 또는 인증번호가 없습니다. 메시지 양식 설정을 확인해주세요.'
              : `링크는 생성됐지만 ${failed.length}명에게 메시지 전송이 실패했어요`
        )
        activeTab = 'history'
        return
      } else {
        snackbarStore.success('링크 전송을 완료했습니다')
      }
      onSendComplete?.()
      activeTab = 'history'
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
      snackbarStore.error(detail || '바로링크 전송에 실패했습니다')
    } finally {
      sending = false
    }
  }
</script>

<div class="h-[min(820px,90dvh)] w-full" data-testid="barolink-modal-frame">
  <BaseModal
    {modalId}
    {closeModal}
    showFooterBorder={true}
    showCloseButton={false}
    showHeaderBorder={true}
    bodyScrollable={false}
    size="fit"
    headerClass="px-5 py-4 border-b border-gray-200"
    bodyClass="flex flex-col p-5 pb-0 overflow-hidden"
    footerClass="px-5 pt-4 pb-5 border-t border-gray-200"
    containerClass="w-full max-w-[960px] max-h-[90vh] overflow-hidden rounded-lg bg-white"
  >
    {#snippet header()}
      <div class="flex w-full items-start justify-between">
        <div class="flex flex-col gap-[10px]">
          <div class="flex items-center gap-1">
            <BaroLinkTextWithIcon />
            <Typography
              variant="headline-02-normal-semibold"
              color="text-gray-800"
            >
              로 전송할게요
            </Typography>
          </div>
          <Typography variant="body-01-medium" color="text-gray-600">
            모바일에서 가능한 검사를 전송할 수 있어요!
          </Typography>
        </div>
        <button
          onclick={closeModal}
          disabled={sending || historyBusy}
          aria-label="바로링크 전송 닫기"
          class="flex-center h-6 w-6 text-gray-400 hover:text-gray-600"
        >
          <CloseIcon color="#8A949E" />
        </button>
      </div>
    {/snippet}

    {#snippet body()}
      <div
        class="mb-5 flex shrink-0 gap-6 border-b border-gray-200"
        role="tablist"
        aria-label="바로링크 전송"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'send'}
          disabled={sending || historyBusy}
          onclick={() => (activeTab = 'send')}
          class="border-b-2 px-2 py-3 text-sm font-medium {activeTab === 'send'
            ? 'border-primary-500 text-primary-500'
            : 'border-transparent text-gray-500'}">전송</button
        >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'history'}
          disabled={sending || historyBusy}
          onclick={() => (activeTab = 'history')}
          class="border-b-2 px-2 py-3 text-sm font-medium {activeTab ===
          'history'
            ? 'border-primary-500 text-primary-500'
            : 'border-transparent text-gray-500'}">전송 내역</button
        >
      </div>
      <div
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-7 [scrollbar-gutter:stable]"
        data-testid="barolink-modal-content"
      >
        {#if activeTab === 'history'}
          <SendLinkHistory
            caseId={rowData?.id ?? ''}
            templateId={selectedTemplateId || undefined}
            templateName={selectedTemplateId === '__builtin__'
              ? '바로링크 기본 양식 · 서비스 제공'
              : (templates.find(
                  (template) => template.id === selectedTemplateId
                )?.name ?? '기본 양식')}
            canResend={!loadingTemplate && !templateError && !templateInvalid}
            onSent={onSendComplete}
            onBusy={(value) => (historyBusy = value)}
          />
        {:else if loadingAssessments || (loadingTemplate && !defaultContent)}
          <div
            role="status"
            aria-label="전송 정보 불러오는 중"
            class="space-y-5"
          >
            <p class="text-sm text-gray-500">전송 정보를 불러오는 중입니다.</p>
            <div
              aria-hidden="true"
              class="grid grid-cols-1 gap-6 lg:grid-cols-2"
            >
              <div class="space-y-4">
                <div class="h-6 w-36 rounded bg-gray-100"></div>
                <div class="h-28 rounded-lg bg-gray-100"></div>
                <div class="h-28 rounded-lg bg-gray-100"></div>
              </div>
              <div class="h-80 rounded-lg bg-gray-100"></div>
            </div>
          </div>
        {:else}
          <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section
              class="order-2 min-w-0 space-y-3 rounded-lg border border-gray-200 bg-white p-4 self-start"
              aria-label="발송 양식"
            >
              <div class="flex items-center justify-between gap-3">
                <h3 class="text-title-01-semibold text-gray-800">
                  보낼 메시지
                </h3>
                <span class="text-xs text-gray-500">문자 (SMS/LMS)</span>
              </div>
              <details class="group">
                <summary class="cursor-pointer text-sm text-primary-500"
                  >양식 변경 · 관리</summary
                >
                <div
                  class="mt-3 space-y-3 rounded-lg border border-gray-200 p-3"
                >
                  <a
                    href="/center/message-templates"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-sm text-primary-500 underline"
                    >양식 관리 (새 창)</a
                  >
                  <label for="link-template" class="block text-sm text-gray-700"
                    >사용할 메시지 양식</label
                  >
                  <select
                    id="link-template"
                    class="field-input w-full"
                    bind:value={selectedTemplateId}
                    onchange={selectTemplate}
                    disabled={sending || loadingTemplate}
                  >
                    <option value="">기본 양식 자동 적용</option>
                    {#if builtinContent}<option value="__builtin__"
                        >바로링크 기본 양식 · 서비스 제공</option
                      >{/if}
                    {#each templates as template (template.id)}<option
                        value={template.id}
                        >{template.name}{template.center_id === null
                          ? ' · 시스템'
                          : ''}</option
                      >{/each}
                  </select>
                  {#if builtinNotice && selectedTemplateId === '__builtin__'}
                    <p class="text-sm text-gray-600">
                      기존 양식의 필수 항목이 누락되어 서비스 기본 양식을
                      적용했습니다.
                    </p>
                  {/if}
                  <button
                    type="button"
                    disabled={sending}
                    onclick={loadTemplates}
                    class="text-sm text-primary-500 underline"
                    >양식 다시 불러오기</button
                  >
                </div>
              </details>
              {#if loadingTemplate}<p
                  role="status"
                  class="text-sm text-gray-500"
                >
                  발송 양식을 불러오는 중입니다.
                </p>
              {:else if templateError}<p
                  role="alert"
                  class="text-sm text-red-600"
                >
                  {templateError}
                </p>
              {:else}
                <p class="text-sm font-medium text-gray-700">메시지 미리보기</p>
                <div
                  class="whitespace-pre-wrap break-words rounded-lg bg-gray-50 p-4 text-sm leading-relaxed text-gray-800"
                >
                  {@html previewHtml}
                </div>
                <p class="text-xs text-gray-500">
                  수신자 정보·바로링크·인증번호는 전송 시 자동으로 입력됩니다.
                </p>
                {#if templateInvalid}<p
                    role="alert"
                    class="text-sm text-red-600"
                  >
                    이 양식에 {'{assessment_url}'}와 {'{verification_code}'}가
                    모두 필요합니다. ‘양식 변경 · 관리’를 열어 다른 양식을
                    선택하거나 수정해주세요.
                  </p>{/if}
              {/if}
              <p class="text-xs text-gray-500">
                본문 길이에 따라 LMS로 전송되며, 발송 비용이 발생할 수 있습니다.
              </p>
            </section>
            <div class="order-1 min-w-0">
              <p class="mb-4 text-body-03-normal-regular text-gray-600">
                새 링크를 전송하면 이 검사의 기존 링크는 사용할 수 없습니다.
              </p>
              {#if loadingAssessments || assessmentError || !onlineAssessments.length}
                <p
                  role="status"
                  class="mb-4 text-body-03-normal-regular text-gray-600"
                >
                  {loadingAssessments
                    ? '온라인 지원 검사를 확인하고 있습니다.'
                    : assessmentError ||
                      '온라인으로 전송할 수 있는 검사가 없습니다.'}
                </p>
              {/if}
              <div class="space-y-5 w-full max-w-full">
                <!-- 온라인 가능 검사 섹션 -->
                <div class=" py-6">
                  <div class="mb-2 flex items-baseline gap-1">
                    <Typography
                      variant="title-01-semibold"
                      color="text-gray-800"
                    >
                      모바일 가능 검사
                    </Typography>
                  </div>
                  <Typography
                    variant="body-03-regular"
                    color="text-gray-500"
                    className="mb-3"
                  >
                    이 검사는 센터 방문없이 내담자가 스스로 모바일로 진행할 수
                    있어요
                  </Typography>
                  <div class="flex flex-wrap gap-3 w-full max-w-full">
                    {#each onlineAssessments as assessment}
                      {@const isSelected = selectedAssessments.includes(
                        assessment.id
                      )}
                      <button
                        onclick={() => toggleAssessment(assessment.id)}
                        class="flex w-[184px] min-w-[184px] h-[84px] items-start justify-between rounded-lg border p-4 transition-colors duration-200 {isSelected
                          ? 'border-[#4f83ff] bg-white shadow-[0_10px_32px_rgba(66,114,196,0.18)]'
                          : 'border-[#e6edff] bg-white hover:border-[#d3e0ff]'}"
                      >
                        <div class="flex flex-col items-start gap-2">
                          <span
                            class="rounded border px-2 py-0.5 text-xs font-medium {isSelected
                              ? 'border-[#4f83ff] text-[#3565ff]'
                              : 'border-[#d3e0ff] text-[#4f83ff]'}"
                          >
                            온라인
                          </span>
                          <Typography
                            variant="body-02-medium"
                            color="text-gray-700"
                          >
                            {assessment.name}
                          </Typography>
                        </div>
                        <!-- 체크 원형 아이콘 -->
                        <div
                          class="flex h-6 w-6 items-center justify-center rounded-full {isSelected
                            ? 'bg-[#4f83ff]'
                            : 'bg-gray-100'}"
                        >
                          {#if isSelected}
                            <RadioCircleCheckedIcon checkColor="#fff" />
                          {:else}
                            <RadioCircleUncheckedIcon strokeColor="#8A949E" />
                          {/if}
                        </div>
                      </button>
                    {/each}
                  </div>
                </div>

                {#if hasSelectedAssessment}
                  <!-- 수신자 섹션 -->
                  <div class="pt-6 border-t border-gray-200">
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
                      className="mb-2"
                    >
                      링크를 받을 내담자의 정보를 입력해주세요
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
                            inputmode="numeric"
                            aria-label="수신자 휴대폰 번호"
                            placeholder="01012345678"
                            bind:value={recipient.phone}
                            class="field-input flex-1 min-w-0"
                          />
                          {#if recipients.length > 1}
                            <button
                              onclick={() => onClickRemoveRecipient(idx)}
                              class="shrink-0 rounded-md p-1 hover:bg-gray-50 bg-white"
                            >
                              <TrashIcon />
                            </button>
                          {/if}
                        </div>

                        <!-- 검사 마감일 섹션 -->
                      {/each}
                      <p class="text-xs text-gray-500">
                        휴대폰 번호는 숫자만 입력해주세요. 붙여넣은 번호의
                        하이픈(-)은 전송 시 자동으로 제외됩니다.
                      </p>
                    </div>
                    <div class="mt-3 flex justify-center">
                      <button
                        onclick={onClickAddRecipients}
                        class="flex items-center gap-2 py-1"
                      >
                        <CirclePlusBlueIcon />
                        <Typography
                          variant="body-02-regular"
                          color="text-gray-600"
                        >
                          추가
                        </Typography>
                      </button>
                    </div>
                  </div>

                  <div transition:slide class="border-t border-gray-200 pt-6">
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-1">
                        <Typography
                          variant="title-01-semibold"
                          color="text-gray-800"
                        >
                          링크 접근 만료일을 지정할까요?
                        </Typography>
                        <span class="field-required">*</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <Typography
                          variant="body-03-regular"
                          color="text-gray-500"
                        >
                          {hasEndDate ? '할게요' : '안할게요'}
                        </Typography>
                        <Switch
                          bind:checked={hasEndDate}
                          ariaLabel="링크 접근 만료일 설정"
                        />
                      </div>
                    </div>

                    {#if hasEndDate}
                      <div transition:slide>
                        <Typography
                          variant="body-03-regular"
                          color="text-gray-500"
                          className="mb-3"
                        >
                          만료되면 링크 인증과 검사 진행이 모두 차단됩니다. 검사
                          일정과는 별개입니다.
                        </Typography>

                        <!-- 일수 옵션 버튼들 -->
                        <SegmentTab
                          items={dayOptions}
                          selected={selectedDayValue}
                          onChange={(value) => (selectedDayValue = value)}
                        />

                        <!-- 날짜 범위 표시 -->
                        <div class="flex items-center gap-2 my-4">
                          <div
                            class="flex h-11 flex-1 items-center justify-between rounded-lg border border-gray-200 bg-white px-4"
                          >
                            <span class="text-sm text-gray-700"
                              >{startDateStr}</span
                            >
                            <CalendarIcon />
                          </div>
                          <span class="text-gray-400">~</span>
                          <div
                            class="flex h-11 flex-1 items-center justify-between rounded-lg border border-gray-200 bg-white px-4"
                          >
                            <span class="text-sm text-gray-700"
                              >{endDateStr()}</span
                            >
                            <CalendarIcon />
                          </div>
                        </div>

                        <!-- 안내 메시지 -->
                        <div
                          class="flex items-center gap-2 rounded-lg border border-primary-200 bg-white px-4 py-3"
                        >
                          <Hourglass />
                          <Typography
                            variant="body-01-medium"
                            color="text-primary-500"
                          >
                            {endDateStr()}까지 바로링크에 접근할 수 있어요
                          </Typography>
                        </div>
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/snippet}

    {#snippet footer()}
      {#if activeTab === 'history'}
        <Button
          onclick={closeModal}
          disabled={historyBusy}
          class="h-11 rounded-lg border border-gray-200 bg-white px-6"
          >닫기</Button
        >
      {:else}
        <div class="flex w-full justify-end">
          <Button
            onclick={onClickSendLink}
            disabled={loadingTemplate ||
              !!templateError ||
              templateInvalid ||
              sending ||
              loadingAssessments ||
              !!assessmentError ||
              selectedAssessments.length === 0}
            class="h-11 rounded-lg bg-gradient-to-r from-[#5b8cff] to-[#3f6cf5] px-8 duration-200 hover:brightness-105 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Typography variant="body-01-normal-medium" color="text-white">
              바로링크 전송
            </Typography>
          </Button>
        </div>
      {/if}
    {/snippet}
  </BaseModal>
</div>
