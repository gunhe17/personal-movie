<script lang="ts">
  import BaseModal from '$components/modal/BaseModal.svelte'
  import Typography from '$components/Typography.svelte'
  import Button from '$components/Button.svelte'
  import { mutationBuilder } from '$hooks/queries/builder'
  import {
    patchAssessment,
    type AssessmentDetailResponse,
    type AssessmentDefinition,
    type DefinitionType
  } from '$hooks/actions/assessment.action'
  import { auth } from '$lib/stores/auth'
  import { canOperate } from '$lib/utils/permissions'
  import { createDefinitionEditor } from '$lib/features/assessment/definition-editor.svelte'
  import DefinitionEditor from '$lib/features/assessment/DefinitionEditor.svelte'

  interface Props {
    modalId?: string
    closeModal?: () => void
    assessment: AssessmentDetailResponse
    /** 유형 변경 시 전달 — 바로 수정 모드로 열림 */
    initialEditing?: boolean
    initialDefinitionType?: DefinitionType
    onSaved?: () => void
  }

  let {
    modalId = '',
    closeModal = () => {},
    assessment,
    initialEditing = false,
    initialDefinitionType,
    onSaved = () => {}
  }: Props = $props()

  // ─── 원본 데이터 ───
  const definition = $derived<AssessmentDefinition>(assessment.definition ?? {})
  const defType = $derived<DefinitionType>(
    (definition.type as DefinitionType) ?? 'choice'
  )
  const questions = $derived(definition.questions ?? [])
  const commonOptions = $derived(definition.common_options ?? [])

  // ─── 모드 ───
  // svelte-ignore state_referenced_locally
  let isEditing = $state(initialEditing)

  // ─── 수정용 에디터 ───
  // svelte-ignore state_referenced_locally
  const defEditor = createDefinitionEditor(
    initialEditing
      ? {
          definitionType: initialDefinitionType!,
          questions: [],
          commonOptions: []
        }
      : undefined
  )

  const isSCT = $derived(
    isEditing
      ? defEditor.definitionType === 'sentence_completion'
      : defType === 'sentence_completion'
  )

  // ─── 뮤테이션 ───
  const updateMutation = mutationBuilder(
    patchAssessment,
    undefined,
    undefined,
    {
      successMessage: '문항 정의가 저장되었습니다.',
      onSettled: (_data: any, error: any) => {
        if (!error) {
          onSaved()
          closeModal()
        }
      }
    }
  )

  // ─── 모드 전환 ───
  function startEditing() {
    defEditor.reset({
      definitionType: defType,
      questions: $state.snapshot(questions),
      commonOptions: $state.snapshot(commonOptions)
    })
    isEditing = true
  }

  function cancelEditing() {
    if (initialEditing) {
      closeModal()
    } else {
      isEditing = false
    }
  }

  // ─── 저장 ───
  function handleSave() {
    const newDefinition: AssessmentDefinition = {
      ...definition,
      ...defEditor.getDefinition()
    }

    updateMutation.mutate({
      assessmentId: assessment.id,
      definition: newDefinition
    })
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={true}
  bodyClass="p-6"
  footerClass="py-4 px-6"
  headerClass="px-6 py-4"
>
  {#snippet header()}
    <div class="flex items-center gap-3">
      <Typography variant="headline-02-semibold" color="text-gray-800">
        문항 관리
      </Typography>
      <span class="text-sm text-gray-500">— {assessment.code}</span>
      {#if isEditing}
        <span
          class="inline-flex rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-medium text-yellow-700"
        >
          수정 중
        </span>
      {/if}
    </div>
  {/snippet}

  {#snippet body()}
    {#if isEditing}
      <!-- ─── 수정 모드 ─── -->
      <DefinitionEditor editor={defEditor} />
    {:else}
      <!-- ─── 보기 모드 ─── -->
      <div class="space-y-6">
        <!-- 공통 선택지 (choice만) -->
        {#if !isSCT && commonOptions.length > 0}
          <div>
            <span class="text-sm font-medium text-gray-700 mb-2 block"
              >공통 선택지</span
            >
            <div class="flex flex-wrap gap-2">
              {#each commonOptions as option}
                <span
                  class="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600"
                >
                  {option.value}. {option.label}
                </span>
              {/each}
            </div>
          </div>
        {/if}

        <!-- 문항 테이블 -->
        {#if questions.length > 0}
          <div>
            <span class="text-sm font-medium text-gray-700 mb-2 block">
              문항 목록 (총 {questions.length}문항)
            </span>
            <div class="overflow-hidden rounded-lg border border-gray-200">
              <table class="w-full">
                <thead>
                  <tr class="bg-gray-50">
                    <th
                      class="w-14 px-4 py-2.5 text-left text-xs font-medium text-gray-500"
                      >#</th
                    >
                    <th
                      class="px-4 py-2.5 text-left text-xs font-medium text-gray-500"
                    >
                      {isSCT ? '문장 줄기' : '문항'}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  {#each questions as question}
                    <tr>
                      <td
                        class="w-14 px-4 py-3 text-sm font-medium text-gray-500"
                      >
                        {question.number}
                      </td>
                      <td class="px-4 py-3 text-sm text-gray-900">
                        {#if isSCT}
                          {question.stem_before ?? ''}
                          <span class="text-primary-500">___</span>
                          {#if question.stem_after}
                            {question.stem_after}
                          {/if}
                        {:else}
                          {question.text}
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {:else}
          <div class="py-12 text-center">
            <p class="text-sm text-gray-400">등록된 문항이 없습니다</p>
          </div>
        {/if}
      </div>
    {/if}
  {/snippet}

  {#snippet footer()}
    {#if isEditing}
      <Button color="light" content="취소" onclick={cancelEditing} />
      <Button
        color="primary"
        content="저장"
        disabled={updateMutation.isPending}
        onclick={handleSave}
      />
    {:else if canOperate($auth.user?.role)}
      <Button color="primary" content="수정" onclick={startEditing} />
    {:else}
      <Button color="light" content="닫기" onclick={closeModal} />
    {/if}
  {/snippet}
</BaseModal>
