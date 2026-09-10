<script lang="ts">
  import { fade } from 'svelte/transition'
  import PDFViewer from '$lib/components/PDFViewer.svelte'
  import NoDataSection from '$lib/components/NoDataSection.svelte'
  import { dateToString } from '$lib/utils/date'
  import { formatAnswerValue } from '$lib/features/clients/detail'
  import { orderedFieldKeys } from '$lib/features/form/template/schema-utils'
  import type { ClientDocumentItem } from '$lib/types/client'

  interface Props {
    preAdmissionState: string
    preAdmissionDocument: ClientDocumentItem | null
    preAdmissionPdfDocument: ClientDocumentItem | null
    preAdmissionImageDocument: ClientDocumentItem | null
    fileCache: Record<string, File>
    submittedInstance: any | null
    templateSchema: any | null
    preAdmissionFileLoading: boolean
    onUploadClick: () => void
    onResendClick: () => void
  }

  let {
    preAdmissionState,
    preAdmissionDocument,
    preAdmissionPdfDocument,
    preAdmissionImageDocument,
    fileCache,
    submittedInstance,
    templateSchema,
    preAdmissionFileLoading,
    onUploadClick,
    onResendClick
  }: Props = $props()

  let isPdf = $derived(
    preAdmissionDocument && preAdmissionDocument.fileType === 'application/pdf'
  )

  let imageObjectUrl = $state('')

  $effect(() => {
    if (preAdmissionImageDocument && fileCache[preAdmissionImageDocument.id]) {
      imageObjectUrl = URL.createObjectURL(
        fileCache[preAdmissionImageDocument.id]
      )
    }
    return () => {
      if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl)
    }
  })
</script>

{#if preAdmissionFileLoading}
  <div class="flex h-full items-center justify-center">
    <p class="text-gray-400 text-sm">문서를 불러오는 중...</p>
  </div>
{:else if preAdmissionPdfDocument && isPdf && fileCache[preAdmissionPdfDocument.id]}
  <div class="h-full min-h-0">
    <PDFViewer
      file={fileCache[preAdmissionPdfDocument.id]}
      reportToolbar={{ title: preAdmissionPdfDocument.title }}
      minInitialScale={1}
    />
  </div>
{:else if preAdmissionImageDocument && imageObjectUrl}
  <div
    transition:fade
    class="h-full flex items-center justify-center overflow-auto bg-gray-50 rounded-lg"
  >
    <img
      src={imageObjectUrl}
      alt={preAdmissionDocument?.title}
      class="shadow rounded"
    />
  </div>
{:else if preAdmissionState === 'empty'}
  <NoDataSection
    description={'아직 사전기록지가 등록되지 않았어요\n템플릿으로 작성하거나, 종이 기록지를 촬영해 올릴 수 있어요'}
  >
    {#snippet actions()}
      <div class="flex items-center gap-3">
        <button
          onclick={onResendClick}
          class="h-12 min-w-[150px] rounded-lg bg-primary-500 px-6 text-body-01-normal-medium text-white transition-colors hover:bg-primary-400"
        >
          템플릿으로 작성
        </button>
        <button
          onclick={onUploadClick}
          class="h-12 min-w-[150px] rounded-lg bg-[#E8EAF0] px-6 text-body-01-normal-medium text-[#636B74] transition-colors hover:bg-[#DFE3EA]"
        >
          종이 기록지 업로드
        </button>
      </div>
    {/snippet}
  </NoDataSection>
{:else if preAdmissionState === 'draft'}
  <div class="flex flex-col items-center justify-center h-full text-center">
    <div class="w-12 h-12 rounded-full bg-gray-100 flex-center mb-4">
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="12" cy="12" r="10" stroke="#9CA3AF" stroke-width="2" />
        <path
          d="M15 9L9 15M9 9L15 15"
          stroke="#9CA3AF"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    </div>
    <p class="text-gray-600 mb-6">아직 작성이 완료되지 않았어요</p>
    <button
      onclick={onResendClick}
      class="px-5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
    >
      재요청
    </button>
  </div>
{:else if preAdmissionState === 'submitted' && submittedInstance && templateSchema}
  {@const answerMap = Object.fromEntries(
    submittedInstance.answers.map((a: any) => [a.question_id, a.answer.value])
  )}
  {@const fieldOrder = orderedFieldKeys(templateSchema)}
  <div class="space-y-5">
    <dl class="text-sm space-y-1.5">
      <div class="flex gap-5">
        <dt class="w-16 min-w-16 text-gray-500">작성자</dt>
        <dd class="text-gray-900">
          {#each submittedInstance.answers as ans}
            {#if ans.question_id === 'q1'}
              {formatAnswerValue(ans.answer.value)}
            {/if}
          {/each}
        </dd>
      </div>
      <div class="flex gap-5">
        <dt class="w-16 min-w-16 text-gray-500">작성 일시</dt>
        <dd class="text-gray-900">
          {submittedInstance.submitted_at
            ? dateToString(
                new Date(submittedInstance.submitted_at),
                'YYYY-MM-DD'
              )
            : '-'}
        </dd>
      </div>
      <div class="flex gap-5">
        <dt class="w-16 min-w-16 text-gray-500">작성 방식</dt>
        <dd class="text-gray-900">온라인</dd>
      </div>
    </dl>

    <hr class="border-gray-100" />

    <div class="space-y-4 text-sm">
      {#each fieldOrder as fieldId (fieldId)}
        {@const field = templateSchema.fields[fieldId]}
        {@const answer = answerMap[fieldId]}
        {#if field && field.label && answer}
          <div>
            <p class="text-gray-500 mb-0.5">{field.label}</p>
            <p class="text-gray-900">{formatAnswerValue(answer)}</p>
          </div>
        {/if}
      {/each}
    </div>
  </div>
{:else if preAdmissionState === 'submitted'}
  <div class="flex items-center justify-center h-full">
    <p class="text-gray-400 text-sm">불러오는 중...</p>
  </div>
{/if}
