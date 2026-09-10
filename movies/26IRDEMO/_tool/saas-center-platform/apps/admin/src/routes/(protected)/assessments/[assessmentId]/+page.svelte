<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import Typography from '$components/Typography.svelte'
  import Button from '$components/Button.svelte'
  import Checkbox from '$components/Checkbox.svelte'
  import Select from '$components/Select.svelte'
  import Input from '$components/Input.svelte'
  import Textarea from '$components/Textarea.svelte'
  import EditIcon from '$lib/assets/EditIcon.svelte'
  import { queryBuilder, mutationBuilder } from '$hooks/queries/builder'
  import {
    getAssessmentDetail,
    patchAssessment,
    type AssessmentDetailResponse,
    type AssessmentDefinition,
    type AssessmentStatus
  } from '$hooks/actions/assessment.action'
  import { fade } from 'svelte/transition'
  import { auth } from '$lib/stores/auth'
  import { canOperate } from '$lib/utils/permissions'
  import { modalStore } from '$lib/stores/modal'
  import DefinitionModal from './components/DefinitionModal.svelte'
  import {
    TYPE_OPTIONS, STATUS_OPTIONS, WORKFLOW_OPTIONS, DEFINITION_TYPE_OPTIONS,
    TYPE_LABELS, STATUS_CONFIG, WORKFLOW_LABELS, DEFINITION_TYPE_LABELS
  } from '$lib/features/assessment/constants'
  import type { DefinitionType } from '$hooks/actions/assessment.action'

  // ─── 파라미터 ───
  const assessmentId = $derived(page.params.assessmentId)

  // ─── 모드 ───
  let isEditing = $state(false)

  // ─── 쿼리 ───
  const detailQuery = $derived(
    queryBuilder<any, any>(getAssessmentDetail, () => ({ assessmentId }))
  )

  const assessment = $derived<AssessmentDetailResponse | null>(
    detailQuery.data ?? null
  )
  const isLoading = $derived(detailQuery.isPending)

  // ─── 수정 폼 상태 ───
  let formCode = $state('')
  let formKorName = $state('')
  let formEngName = $state('')
  let formType = $state('')
  let formStatus = $state<AssessmentStatus>('private')
  let formVersion = $state('')
  let formDuration = $state<string>('')
  let formAge = $state('')
  let formDescription = $state('')
  let formWorkflowType = $state('')
  let formExternalUrl = $state('')
  let formSupportsOnline = $state(false)
  let formDefinitionType = $state<DefinitionType>('choice')

  function startEditing() {
    if (!assessment) return
    formCode = assessment.code
    formKorName = assessment.kor_name
    formEngName = assessment.eng_name
    formType = assessment.type
    formStatus = assessment.status
    formVersion = assessment.version
    formDuration =
      assessment.duration != null ? String(assessment.duration) : ''
    formAge = assessment.age ?? ''
    formDescription = assessment.description ?? ''
    formWorkflowType = assessment.workflow_type
    formExternalUrl = assessment.external_url ?? ''
    formSupportsOnline = assessment.supports_online
    formDefinitionType = (assessment.definition?.type as DefinitionType) ?? 'choice'
    isEditing = true
  }

  // ─── 뮤테이션 ───
  const updateMutation = mutationBuilder(
    patchAssessment,
    undefined,
    undefined,
    {
      successMessage: '검사가 수정되었습니다.',
      onSettled: (data: any, error: any) => {
        if (!error) isEditing = false
      }
    }
  )

  // ─── 핸들러 ───
  function handleSave() {
    if (!formCode.trim() || !formKorName.trim() || !formEngName.trim()) return

    updateMutation.mutate({
      assessmentId,
      code: formCode.trim(),
      version: formVersion.trim() || '1.0',
      kor_name: formKorName.trim(),
      eng_name: formEngName.trim(),
      type: formType,
      status: formStatus,
      duration: formDuration ? Number(formDuration) : null,
      age: formAge.trim() || null,
      description: formDescription.trim() || null,
      workflow_type: formWorkflowType,
      external_url:
        formWorkflowType === 'external_service' && formExternalUrl.trim()
          ? formExternalUrl.trim()
          : null,
      supports_online: formSupportsOnline,
      ...(formWorkflowType === 'external_service' && assessment?.workflow_type === 'self_report'
        ? { definition: {} }
        : {})
    })
  }

  function formatDateTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // ─── 문항 정의 ───
  const definition = $derived<AssessmentDefinition>(assessment?.definition ?? {})
  const questionCount = $derived(definition.questions?.length ?? 0)
  const commonOptions = $derived(definition.common_options ?? [])
  const currentDefinitionType = $derived(
    isEditing ? formDefinitionType : (assessment?.definition?.type as DefinitionType | undefined) ?? 'choice'
  )
  const isSelfReport = $derived(
    isEditing ? formWorkflowType === 'self_report' : assessment?.workflow_type === 'self_report'
  )

  function openDefinitionModal() {
    if (!assessment) return
    const originalType = (assessment.definition?.type as DefinitionType) ?? 'choice'
    const typeChanged = isEditing && formDefinitionType !== originalType

    modalStore.open({
      component: DefinitionModal,
      props: {
        assessment,
        ...(typeChanged
          ? { initialEditing: true, initialDefinitionType: formDefinitionType }
          : {}),
        onSaved: () => {
          detailQuery.refetch()
        }
      },
      options: { size: 'wide' }
    })
  }

  // ─── 스타일 ───
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'
</script>

<div in:fade class="p-6">
  <!-- 뒤로가기 + 헤더 -->
  <div class="mb-6">
    <button
      onclick={() => goto('/assessments')}
      class="mb-3 text-sm text-gray-500 transition-colors hover:text-gray-700"
    >
      ← 검사 목록
    </button>

    {#if isLoading}
      <Typography variant="headline-01-normal-bold" tag="h1"
        >불러오는 중...</Typography
      >
    {:else if assessment}
      <div class="flex items-center gap-3">
        <Typography variant="headline-01-normal-bold" tag="h1"
          >{assessment.kor_name}</Typography
        >
        {#if STATUS_CONFIG[assessment.status]}
          {@const statusInfo = STATUS_CONFIG[assessment.status]}
          <span
            class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium {statusInfo.bg} {statusInfo.text}"
          >
            {statusInfo.label}
          </span>
        {/if}
      </div>
    {/if}
  </div>

  {#if assessment}
    <!-- svelte-ignore a11y_label_has_associated_control -->
    <div class="space-y-4">
      <!-- 기본 정보 -->
      <div class="section-border p-6">
        <div class="mb-4 flex items-center justify-between">
          <Typography variant="title-01-normal-semibold" tag="h2"
            >기본 정보</Typography
          >
          {#if isEditing}
            <Button
              color="primary"
              size="md"
              content="수정하기"
              disabled={updateMutation.isPending ||
                !formCode.trim() ||
                !formKorName.trim() ||
                !formEngName.trim()}
              onclick={handleSave}
            />
          {:else if canOperate($auth.user?.role)}
            <button
              onclick={startEditing}
              class="flex h-7 w-7 items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
              title="수정"
            >
              <EditIcon size={20} />
            </button>
          {/if}
        </div>

        {#if isEditing}
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="검사 코드"
              required
              bind:value={formCode}
              maxlength={50}
            />
            <Input label="버전" bind:value={formVersion} maxlength={20} />
            <Input
              label="한국어 검사명"
              required
              bind:value={formKorName}
              maxlength={255}
            />
            <Input
              label="영어 검사명"
              required
              bind:value={formEngName}
              maxlength={255}
            />
            <div>
              <label class={labelClass}
                >검사 유형 <span class="text-red-500">*</span></label
              >
              <Select
                class="h-11 w-full bg-white rounded-lg"
                selected={formType}
                on:change={(e) => (formType = e.detail.value)}
                options={TYPE_OPTIONS}
              />
            </div>
            <div>
              <label class={labelClass}
                >공개 상태 <span class="text-red-500">*</span></label
              >
              <Select
                class="h-11 w-full bg-white rounded-lg"
                selected={formStatus}
                on:change={(e) => (formStatus = e.detail.value)}
                options={STATUS_OPTIONS}
              />
            </div>
          </div>
        {:else}
          <dl class="space-y-3">
            <div class="flex">
              <dt class="w-36 shrink-0 text-sm text-gray-500">검사 코드</dt>
              <dd class="text-sm text-gray-900">
                <span
                  class="rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs font-medium text-gray-600"
                  >{assessment.code}</span
                >
              </dd>
            </div>
            <div class="flex">
              <dt class="w-36 shrink-0 text-sm text-gray-500">버전</dt>
              <dd class="text-sm text-gray-900">{assessment.version}</dd>
            </div>
            <div class="flex">
              <dt class="w-36 shrink-0 text-sm text-gray-500">한국어 검사명</dt>
              <dd class="text-sm text-gray-900">{assessment.kor_name}</dd>
            </div>
            <div class="flex">
              <dt class="w-36 shrink-0 text-sm text-gray-500">영어 검사명</dt>
              <dd class="text-sm text-gray-900">{assessment.eng_name}</dd>
            </div>
            <div class="flex">
              <dt class="w-36 shrink-0 text-sm text-gray-500">검사 유형</dt>
              <dd class="text-sm text-gray-900">
                {TYPE_LABELS[assessment.type] ?? assessment.type}
              </dd>
            </div>
            <div class="flex">
              <dt class="w-36 shrink-0 text-sm text-gray-500">공개 상태</dt>
              <dd class="text-sm text-gray-900">
                {STATUS_CONFIG[assessment.status]?.label ?? assessment.status}
              </dd>
            </div>
          </dl>
        {/if}
      </div>

      <!-- 검사 특성 -->
      <div class="section-border p-6">
        <Typography variant="title-01-normal-semibold" tag="h2" className="mb-4"
          >검사 특성</Typography
        >

        {#if isEditing}
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="소요 시간 (분)"
              type="number"
              bind:value={formDuration}
              min={1}
            />
            <Input label="대상 연령" bind:value={formAge} maxlength={100} />
            <div class="md:col-span-2">
              <Textarea
                label="검사 설명"
                bind:value={formDescription}
                rows={3}
              />
            </div>
          </div>
        {:else}
          <dl class="space-y-3">
            <div class="flex">
              <dt class="w-36 shrink-0 text-sm text-gray-500">소요 시간</dt>
              <dd class="text-sm text-gray-900">
                {assessment.duration ? `${assessment.duration}분` : '-'}
              </dd>
            </div>
            <div class="flex">
              <dt class="w-36 shrink-0 text-sm text-gray-500">대상 연령</dt>
              <dd class="text-sm text-gray-900">{assessment.age ?? '-'}</dd>
            </div>
            <div class="flex">
              <dt class="w-36 shrink-0 text-sm text-gray-500">검사 설명</dt>
              <dd class="text-sm text-gray-900 whitespace-pre-wrap">
                {assessment.description ?? '-'}
              </dd>
            </div>
          </dl>
        {/if}
      </div>

      <!-- 워크플로우 설정 -->
      <div class="section-border p-6">
        <Typography variant="title-01-normal-semibold" tag="h2" className="mb-4"
          >워크플로우 설정</Typography
        >

        {#if isEditing}
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label class={labelClass}>워크플로우 타입</label>
              <Select
                class="h-11 w-full bg-white rounded-lg"
                selected={formWorkflowType}
                on:change={(e) => (formWorkflowType = e.detail.value)}
                options={WORKFLOW_OPTIONS}
              />
            </div>

            {#if formWorkflowType === 'external_service'}
              <Input
                label="외부 검사 URL"
                type="url"
                bind:value={formExternalUrl}
                maxlength={500}
              />
            {/if}

            {#if formWorkflowType === 'self_report'}
              <div>
                <label class={labelClass}>문항 유형</label>
                <Select
                  class="h-11 w-full bg-white rounded-lg"
                  selected={formDefinitionType}
                  on:change={(e) => (formDefinitionType = e.detail.value)}
                  options={DEFINITION_TYPE_OPTIONS}
                />
              </div>
            {/if}

            <div class="flex items-center gap-3 md:col-span-2">
              <Checkbox
                id="edit_supports_online"
                bind:checked={formSupportsOnline}
              />
              <label
                for="edit_supports_online"
                class="text-sm text-gray-700 cursor-pointer"
              >
                온라인 검사 지원
              </label>
            </div>
          </div>
        {:else}
          <dl class="space-y-3">
            <div class="flex">
              <dt class="w-36 shrink-0 text-sm text-gray-500">워크플로우</dt>
              <dd class="text-sm text-gray-900">
                {WORKFLOW_LABELS[assessment.workflow_type] ??
                  assessment.workflow_type}
              </dd>
            </div>
            {#if assessment.definition?.type}
              <div class="flex">
                <dt class="w-36 shrink-0 text-sm text-gray-500">문항 유형</dt>
                <dd class="text-sm text-gray-900">
                  {DEFINITION_TYPE_LABELS[assessment.definition.type] ??
                    assessment.definition.type}
                </dd>
              </div>
            {/if}
            {#if assessment.external_url}
              <div class="flex">
                <dt class="w-36 shrink-0 text-sm text-gray-500">외부 URL</dt>
                <dd class="text-sm text-primary-600 break-all">
                  {assessment.external_url}
                </dd>
              </div>
            {/if}
            <div class="flex">
              <dt class="w-36 shrink-0 text-sm text-gray-500">온라인 검사</dt>
              <dd class="text-sm text-gray-900">
                {assessment.supports_online ? '지원' : '미지원'}
              </dd>
            </div>
          </dl>
        {/if}
      </div>

      <!-- 문항 정의 (self_report 전용) -->
      {#if isSelfReport}
        <div class="section-border p-6">
          <div class="flex items-center justify-between mb-4">
            <Typography variant="title-01-normal-semibold" tag="h2"
              >문항 정의</Typography
            >
            {#if canOperate($auth.user?.role)}
              <Button
                color="light"
                content="문항 관리"
                size="sm"
                onclick={openDefinitionModal}
              />
            {/if}
          </div>

          {#if questionCount > 0}
            <dl class="space-y-3">
              <div class="flex">
                <dt class="w-36 shrink-0 text-sm text-gray-500">총 문항 수</dt>
                <dd class="text-sm text-gray-900">{questionCount}문항</dd>
              </div>
              {#if currentDefinitionType === 'choice' && commonOptions.length > 0}
                <div class="flex">
                  <dt class="w-36 shrink-0 text-sm text-gray-500">공통 선택지</dt>
                  <dd class="text-sm text-gray-900">
                    {commonOptions.length}지선다 ({commonOptions.map((o) => o.label).join(' ~ ')})
                  </dd>
                </div>
              {/if}
            </dl>
          {:else}
            <p class="text-sm text-gray-400">등록된 문항이 없습니다</p>
          {/if}
        </div>
      {/if}

      <!-- 메타 정보 -->
      <div class="section-border p-6">
        <Typography variant="title-01-normal-semibold" tag="h2" className="mb-4"
          >메타 정보</Typography
        >
        <dl class="space-y-3">
          <div class="flex">
            <dt class="w-36 shrink-0 text-sm text-gray-500">등록일</dt>
            <dd class="text-sm text-gray-900">
              {formatDateTime(assessment.created_at)}
            </dd>
          </div>
          <div class="flex">
            <dt class="w-36 shrink-0 text-sm text-gray-500">수정일</dt>
            <dd class="text-sm text-gray-900">
              {formatDateTime(assessment.updated_at)}
            </dd>
          </div>
        </dl>
      </div>

    </div>
  {/if}
</div>
