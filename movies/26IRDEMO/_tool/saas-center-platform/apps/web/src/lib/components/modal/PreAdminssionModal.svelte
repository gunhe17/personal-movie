<script lang="ts">
  import BaseModal from './BaseModal.svelte'
  import FormFillBody from '$lib/components/form/FormFillBody.svelte'
  import Typography from '@common/components/Typography.svelte'
  import type {
    FormSchema,
    AnswerResponse
  } from '$lib/hooks/actions/form.action'
  import { orderedFieldKeys } from '$lib/features/form/template/schema-utils'
  import { centerId } from '$lib/stores/center.store'

  interface Props {
    modalId?: string
    closeModal?: () => void
    title?: string
    template?: { id: string; schema: FormSchema }
    existingAnswers?: AnswerResponse[]
    isEditMode?: boolean
    onSave?: (
      answers: { question_id: string; answer: { value: string | string[] } }[]
    ) => Promise<void>
  }

  let {
    modalId = '',
    closeModal = () => {},
    title = '사전기록지',
    template,
    existingAnswers = [],
    isEditMode = false,
    onSave
  }: Props = $props()

  // 답변 상태: { [question_id]: string | string[] }
  let answers = $state<Record<string, string | string[]>>({})
  let isSaving = $state(false)

  // 기존 답변으로 초기화
  $effect(() => {
    if (existingAnswers.length > 0) {
      const initial: Record<string, string | string[]> = {}
      for (const ans of existingAnswers) {
        initial[ans.question_id] = ans.answer.value
      }
      answers = initial
    }
  })

  // 원본 위에 얹어 보기용 배경 이미지 — 센터 서식 프록시(인증 세션)
  const pageImageUrl = (no: number) =>
    `/api/proxy/centers/${$centerId}/forms/templates/${template!.id}/pages/${no}/image`

  const fieldOrder = $derived(
    template?.schema ? orderedFieldKeys(template.schema) : []
  )

  const handleConfirm = async () => {
    if (!onSave || isSaving) return
    isSaving = true
    try {
      const answerItems = fieldOrder
        .filter(
          (fid) =>
            answers[fid] !== undefined &&
            answers[fid] !== '' &&
            (!Array.isArray(answers[fid]) ||
              (answers[fid] as string[]).length > 0)
        )
        .map((fid) => ({
          question_id: fid,
          answer: { value: answers[fid] }
        }))
      await onSave(answerItems)
    } finally {
      isSaving = false
    }
  }
</script>

<BaseModal
  {modalId}
  {closeModal}
  showHeaderBorder={false}
  showFooterBorder={true}
  showCloseButton={true}
  size="lg"
  bodyClass="p-5 pb-7"
  footerClass="px-5 pt-4 pb-5"
  {title}
>
  {#snippet body()}
    {#if template}
      <FormFillBody schema={template.schema as any} bind:answers pageImageUrl={pageImageUrl} />
    {/if}
  {/snippet}

  {#snippet footer()}
    <div class="flex w-full justify-end items-center">
      <button
        onclick={handleConfirm}
        disabled={isSaving}
        class="flex h-11 px-8 items-center justify-center rounded-lg bg-primary-500 text-white transition-colors hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Typography variant="body-01-normal-medium" color="text-white">
          {isSaving ? '저장 중...' : isEditMode ? '수정' : '등록'}
        </Typography>
      </button>
    </div>
  {/snippet}
</BaseModal>
