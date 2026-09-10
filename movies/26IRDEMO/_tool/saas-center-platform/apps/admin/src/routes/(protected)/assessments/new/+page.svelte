<script lang="ts">
  import { goto } from '$app/navigation'
  import Typography from '$components/Typography.svelte'
  import Button from '$components/Button.svelte'
  import Checkbox from '$components/Checkbox.svelte'
  import Select from '$components/Select.svelte'
  import Input from '$components/Input.svelte'
  import Textarea from '$components/Textarea.svelte'
  import { mutationBuilder } from '$hooks/queries/builder'
  import {
    postCreateAssessment,
    type AssessmentStatus
  } from '$hooks/actions/assessment.action'
  import { fade } from 'svelte/transition'
  import { TYPE_OPTIONS, STATUS_OPTIONS, WORKFLOW_OPTIONS, DEFINITION_TYPE_OPTIONS } from '$lib/features/assessment/constants'
  import type { DefinitionType } from '$hooks/actions/assessment.action'
  import { createDefinitionEditor } from '$lib/features/assessment/definition-editor.svelte'
  import DefinitionEditor from '$lib/features/assessment/DefinitionEditor.svelte'

  // ─── 폼 상태 ───
  let code = $state('')
  let kor_name = $state('')
  let eng_name = $state('')
  let type = $state('objective')
  let status = $state<AssessmentStatus>('private')
  let version = $state('1.0')
  let duration = $state<string>('')
  let age = $state('')
  let description = $state('')
  let workflow_type = $state('self_report')
  let external_url = $state('')
  let supports_online = $state(true)
  let definition_type = $state<DefinitionType>('choice')

  // ─── 문항 정의 (self_report 전용) ───
  const defEditor = createDefinitionEditor()

  // definition.type 변경 시 에디터 동기화
  $effect(() => {
    defEditor.definitionType = definition_type
  })

  // ─── 뮤테이션 ───
  const createMutation = mutationBuilder(
    postCreateAssessment,
    undefined,
    undefined,
    {
      successMessage: '검사가 등록되었습니다.',
      onSettled: (data: any, error: any) => {
        if (!error) goto('/assessments')
      }
    }
  )

  const isSubmitting = $derived(createMutation.isPending)

  // ─── 핸들러 ───
  function handleSubmit() {
    if (!code.trim() || !kor_name.trim() || !eng_name.trim()) return

    // 문항 정의 조립 (self_report만)
    const definition =
      workflow_type === 'self_report' && defEditor.questions.length > 0
        ? defEditor.getDefinition()
        : {}

    createMutation.mutate({
      code: code.trim(),
      kor_name: kor_name.trim(),
      eng_name: eng_name.trim(),
      type,
      status,
      version: version.trim() || '1.0',
      duration: duration ? Number(duration) : undefined,
      age: age.trim() || undefined,
      description: description.trim() || undefined,
      workflow_type,
      external_url:
        workflow_type === 'external_service' && external_url.trim()
          ? external_url.trim()
          : undefined,
      supports_online,
      definition
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
    <Typography variant="headline-01-normal-bold" tag="h1">검사 등록</Typography
    >
  </div>

  <!-- svelte-ignore a11y_label_has_associated_control -->
  <div class="space-y-4">
    <!-- 기본 정보 -->
    <div class="section-border p-6">
      <div class="mb-4 flex items-center justify-between">
        <Typography variant="title-01-normal-semibold" tag="h2">기본 정보</Typography>
        <Button
          color="primary"
          size="md"
          content="등록"
          disabled={isSubmitting ||
            !code.trim() ||
            !kor_name.trim() ||
            !eng_name.trim()}
          onclick={handleSubmit}
        />
      </div>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="검사 코드"
          required
          bind:value={code}
          placeholder="예: K-CBCL"
          maxlength={50}
        />

        <Input
          label="버전"
          bind:value={version}
          placeholder="1.0"
          maxlength={20}
        />

        <Input
          label="한국어 검사명"
          required
          bind:value={kor_name}
          placeholder="예: 한국판 아동행동체크리스트"
          maxlength={255}
        />

        <Input
          label="영어 검사명"
          required
          bind:value={eng_name}
          placeholder="예: Korean Child Behavior Checklist"
          maxlength={255}
        />

        <div>
          <label class={labelClass}>
            검사 유형 <span class="text-red-500">*</span>
          </label>
          <Select
            class="h-11 w-full bg-white rounded-lg"
            selected={type}
            on:change={(e) => (type = e.detail.value)}
            options={TYPE_OPTIONS}
          />
        </div>

        <div>
          <label class={labelClass}>
            공개 상태 <span class="text-red-500">*</span>
          </label>
          <Select
            class="h-11 w-full bg-white rounded-lg"
            selected={status}
            on:change={(e) => (status = e.detail.value)}
            options={STATUS_OPTIONS}
          />
        </div>
      </div>
    </div>

    <!-- 검사 특성 -->
    <div class="section-border p-6">
      <Typography variant="title-01-normal-semibold" tag="h2" className="mb-4"
        >검사 특성</Typography
      >

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Input
          label="소요 시간 (분)"
          type="number"
          bind:value={duration}
          placeholder="예: 30"
          min={1}
        />

        <Input
          label="대상 연령"
          bind:value={age}
          placeholder="예: 6세~18세"
          maxlength={100}
        />

        <div class="md:col-span-2">
          <Textarea
            label="검사 설명"
            bind:value={description}
            placeholder="검사에 대한 설명을 입력하세요"
            rows={3}
          />
        </div>
      </div>
    </div>

    <!-- 워크플로우 설정 -->
    <div class="section-border p-6">
      <Typography variant="title-01-normal-semibold" tag="h2" className="mb-4"
        >워크플로우 설정</Typography
      >

      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label class={labelClass}>워크플로우 타입</label>
          <Select
            class="h-11 w-full bg-white rounded-lg"
            selected={workflow_type}
            on:change={(e) => (workflow_type = e.detail.value)}
            options={WORKFLOW_OPTIONS}
          />
        </div>

        {#if workflow_type === 'external_service'}
          <Input
            label="외부 검사 URL"
            type="url"
            bind:value={external_url}
            placeholder="https://..."
            maxlength={500}
          />
        {/if}

        {#if workflow_type === 'self_report'}
          <div>
            <label class={labelClass}>문항 유형</label>
            <Select
              class="h-11 w-full bg-white rounded-lg"
              selected={definition_type}
              on:change={(e) => (definition_type = e.detail.value)}
              options={DEFINITION_TYPE_OPTIONS}
            />
          </div>
        {/if}

        <div class="flex items-center gap-3 md:col-span-2">
          <Checkbox id="supports_online" bind:checked={supports_online} />
          <label
            for="supports_online"
            class="text-sm text-gray-700 cursor-pointer"
          >
            온라인 검사 지원
          </label>
        </div>
      </div>
    </div>

    <!-- 문항 정의 (self_report 전용) -->
    {#if workflow_type === 'self_report'}
      <div class="section-border p-6">
        <Typography variant="title-01-normal-semibold" tag="h2" className="mb-4"
          >문항 정의</Typography
        >
        <DefinitionEditor editor={defEditor} />
      </div>
    {/if}

  </div>
</div>
