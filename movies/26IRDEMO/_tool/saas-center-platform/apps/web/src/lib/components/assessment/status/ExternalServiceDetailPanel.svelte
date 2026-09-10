<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import Button from '$root/src/lib/components/Button.svelte'
  import Stepper from './Stepper.svelte'
  import PDFViewer from '$lib/components/PDFViewer.svelte'
  import {
    EXTERNAL_SERVICE_STEPS,
    getExternalServiceActiveStep
  } from '$lib/features/assessment/status-detail/constants'
  import type { AssessmentItem } from '$lib/features/assessment/status-detail/types'
  import { centerId } from '$lib/stores/center.store'
  import { postRaw } from '$lib/services/api/instances'
  import { submitTask } from '$lib/hooks/actions/case.action'
  import UploadIconWithCircle54 from '$root/src/lib/assets/UploadIconWithCircle54.svelte'
  import SandGlass54 from '$root/src/lib/assets/SandGlass54.svelte'

  /** 스마트 바이체커 등 external_service: 보고서는 PDF만 업로드 가능 */
  const ACCEPT_TYPES = '.pdf'

  let {
    selectedAssessment,
    clientName,
    clientBirthDate,
    onReportSubmitted,
    onRefuseAssessment
  } = $props<{
    selectedAssessment: AssessmentItem
    /** 내담자명 (다운로드 파일명 조합용) */
    clientName?: string
    /** 내담자 생년월일 (다운로드 파일명 조합용, 예: 1990-01-01) */
    clientBirthDate?: string
    onReportSubmitted?: () => void | Promise<void>
    onRefuseAssessment?: (assessment: AssessmentItem) => void
  }>()

  let selectedStep = $state(1)
  let isReuploadMode = $state(false)
  let uploadFile = $state<File | null>(null)
  let uploadLoading = $state(false)
  let uploadError = $state<string | null>(null)
  let isDragging = $state(false)

  let pdfViewerUrl = $derived(
    selectedAssessment.reportDocumentId && $centerId
      ? `/api/proxy/centers/${$centerId}/documents/${selectedAssessment.reportDocumentId}/download`
      : null
  )
  let pdfFile = $state<File | null>(null)
  let pdfFileLoading = $state(false)
  let pdfFileError = $state<string | null>(null)

  $effect(() => {
    if (isReuploadMode) {
      selectedStep = 1
      return
    }
    if (selectedAssessment.status === 'completed') {
      selectedStep = 2
      return
    }
    selectedStep = getExternalServiceActiveStep(
      selectedAssessment.status,
      !!selectedAssessment.reportDocumentId
    )
  })

  /** 다운로드 파일명: 내담자명_생년월일_검사명.pdf (각 부분 없으면 생략) */
  function buildPdfDownloadFileName(
    assessmentName: string | undefined,
    clientNameVal: string | undefined,
    clientBirthDateVal: string | undefined
  ): string {
    const sanitize = (s: string, maxLen: number) =>
      s
        .replace(/[/\\?%*:|"<>]/g, '_')
        .trim()
        .slice(0, maxLen) || ''
    const name = sanitize(assessmentName ?? 'report', 80)
    const client = sanitize(clientNameVal ?? '', 40)
    const birth = (clientBirthDateVal ?? '')
      .replace(/-/g, '')
      .trim()
      .slice(0, 8)
    const parts = [client, birth, name].filter(Boolean)
    const base = parts.length > 0 ? parts.join('_') : 'report'
    return base.endsWith('.pdf') ? base : `${base}.pdf`
  }

  $effect(() => {
    const url = pdfViewerUrl
    const assessmentName = selectedAssessment.name
    const fileName = buildPdfDownloadFileName(
      assessmentName,
      clientName,
      clientBirthDate
    )
    if (!url) {
      pdfFile = null
      pdfFileError = null
      pdfFileLoading = false
      return
    }
    pdfFileLoading = true
    pdfFileError = null
    pdfFile = null
    fetch(url, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error(`PDF 요청 실패: ${res.status}`)
        const ct = res.headers.get('content-type') ?? ''
        if (!ct.includes('application/pdf') && !ct.includes('octet-stream')) {
          throw new Error('PDF가 아닌 응답입니다.')
        }
        return res.blob()
      })
      .then((blob) => {
        pdfFile = new File([blob], fileName, {
          type: blob.type || 'application/pdf'
        })
        pdfFileError = null
      })
      .catch((err) => {
        pdfFileError =
          err instanceof Error ? err.message : 'PDF를 불러오지 못했어요'
        pdfFile = null
      })
      .finally(() => {
        pdfFileLoading = false
      })
  })

  function handleStepChange(stepNumber: number) {
    if (stepNumber === 1 && selectedAssessment.status === 'completed') {
      isReuploadMode = true
    }
    if (stepNumber === 2) {
      isReuploadMode = false
    }
    selectedStep = stepNumber
  }

  function validateFile(file: File): boolean {
    const lower = file.name.toLowerCase()
    if (!lower.endsWith('.pdf')) return false
    return file.type === 'application/pdf'
  }

  async function doUploadAndSubmit(file: File) {
    const cId = $centerId
    const taskId = selectedAssessment.id
    if (!cId || !taskId) {
      uploadError = '센터/검사 정보를 찾을 수 없습니다.'
      return
    }
    uploadError = null
    uploadLoading = true
    try {
      const form = new FormData()
      form.append('file', file)
      const doc = await postRaw<{ id: string }>(
        `/centers/${cId}/documents`,
        form
      )
      const submitReq = submitTask()
      await submitReq.request({
        centerId: cId,
        taskId,
        payload: {
          workflow_type: 'external_service',
          report_document_id: doc.id
        }
      })
      isReuploadMode = false
      await onReportSubmitted?.()
    } catch (e) {
      uploadError = e instanceof Error ? e.message : '업로드에 실패했습니다.'
    } finally {
      uploadLoading = false
      uploadFile = null
    }
  }

  function onFileSelect(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (!validateFile(file)) {
      uploadError = 'PDF 형식만 업로드 가능해요.'
      return
    }
    uploadError = null
    uploadFile = file
    doUploadAndSubmit(file)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    isDragging = false
    const file = e.dataTransfer?.files?.[0]
    if (!file) return
    if (!validateFile(file)) {
      uploadError = 'PDF 형식만 업로드 가능해요.'
      return
    }
    uploadError = null
    uploadFile = file
    doUploadAndSubmit(file)
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault()
    isDragging = true
  }

  function onDragLeave() {
    isDragging = false
  }
</script>

<Stepper
  steps={EXTERNAL_SERVICE_STEPS}
  activeStep={selectedStep}
  completedSteps={selectedAssessment.reportDocumentId ? [1, 2] : []}
  onStepChange={handleStepChange}
/>

{#if selectedStep === 1}
  <!-- 스텝 1: 보고서 업로드 (완료 시 업로드 불가 안내) -->
  <div class="flex flex-1 flex-col items-center px-8 py-10">
    <div class="w-full max-w-xl flex flex-col items-center">
      <div class="class mb-3">
        <UploadIconWithCircle54 />
      </div>
      <Typography
        variant="headline-02-semibold"
        color="text-gray-900"
        className="mb-2 text-center"
      >
        {isReuploadMode ? '보고서 재업로드' : '보고서를 업로드해주세요'}
      </Typography>
      <Typography
        variant="body-02-regular"
        color="text-gray-600"
        className="mb-8 text-center"
      >
        {#if isReuploadMode}
          새로운 보고서를 업로드하면 기존 보고서가 교체돼요.
        {:else}
          보고서를 등록하면 기록을 보관하고 언제든지 결과를 확인할 수 있어요
        {/if}
      </Typography>

      {#if uploadError}
        <div class="mb-4 w-full rounded-lg bg-status-danger-bg px-4 py-2">
          <Typography variant="body-02-regular" color="text-red-600"
            >{uploadError}</Typography
          >
        </div>
      {/if}

      <div
        role="button"
        tabindex="0"
        class="w-full rounded-lg border-2 border-dashed transition-colors {isDragging
          ? 'border-primary-400 bg-primary-50'
          : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'}"
        class:pointer-events-none={uploadLoading}
        ondragover={onDragOver}
        ondragleave={onDragLeave}
        ondrop={onDrop}
      >
        <div
          class="flex min-h-50 flex-col items-center justify-center gap-3 px-6 py-8"
        >
          {#if uploadLoading}
            <div
              class="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-primary-500"
            ></div>
            <Typography variant="body-02-regular" color="text-gray-500"
              >업로드 중...</Typography
            >
          {:else}
            <Typography variant="body-02-regular" color="text-gray-600">
              파일을 여기로 드래그하여 업로드 해주세요
            </Typography>
            <Typography variant="body-03-regular" color="text-gray-500">
              PDF 형식만 업로드 가능해요
            </Typography>
            <Button
              type="button"
              class="mt-2 h-10 rounded-lg bg-primary-500 px-6 text-white hover:bg-primary-600"
              onclick={() =>
                document.getElementById('external-service-file-input')?.click()}
            >
              <Typography variant="body-02-medium" color="text-white"
                >{isReuploadMode ? '파일 재선택' : '파일 선택'}</Typography
              >
            </Button>
          {/if}
        </div>
      </div>
      <input
        type="file"
        accept={ACCEPT_TYPES}
        id="external-service-file-input"
        class="sr-only"
        onchange={onFileSelect}
      />
    </div>
  </div>
{:else}
  <!-- 스텝 2: 결과 보기 -->
  {#if selectedAssessment.status === 'pending' || selectedAssessment.status === 'in_progress'}
    <div
      class="flex flex-1 flex-col items-center justify-start px-8 pt-30 pb-16"
    >
      <div class="mb-4"><SandGlass54 /></div>
      <Typography
        variant="title-01-normal-semibold"
        color="text-title-default"
        className="mb-2"
      >
        보고서가 아직 없어요
      </Typography>
      <Typography
        variant="body-02-normal-regular"
        color="text-body-subtle"
        className="text-center"
      >
        보고서를 업로드하면 결과를 확인할 수 있어요.
      </Typography>
    </div>
  {:else}
    <div class="flex flex-1 flex-col min-h-0 px-0">
      {#if pdfFileLoading}
        <div class="flex flex-1 items-center justify-center px-8 py-16">
          <Typography variant="body-02-regular" color="text-gray-500"
            >PDF 로딩 중...</Typography
          >
        </div>
      {:else if pdfFileError}
        <div class="flex flex-1 items-center justify-center px-8 py-16">
          <Typography
            variant="body-02-regular"
            color="text-red-600"
            className="text-center">{pdfFileError}</Typography
          >
        </div>
      {:else if pdfFile}
        <div class="flex-1 min-h-0 flex flex-col">
          <div class="flex-1 min-h-0 flex flex-col px-6">
            <PDFViewer
              file={pdfFile}
              reportToolbar={{
                title: selectedAssessment.name,
                onSendResult: onReportSubmitted ?? undefined
              }}
              minInitialScale={1}
            />
          </div>
          <div
            class="shadow-sticky-top relative z-10 flex items-center justify-end gap-2 border-t border-gray-100 bg-white px-5 py-3 xl:rounded-b-2xl"
          >
            <button
              type="button"
              class="h-11 w-35 rounded-lg border border-gray-300 bg-white text-body-01-normal-medium text-gray-700 hover:bg-gray-50"
              onclick={() => handleStepChange(1)}
            >
              재업로드
            </button>
          </div>
        </div>
      {:else}
        <div
          class="flex flex-1 flex-col items-center justify-start px-8 pt-30 pb-16"
        >
          <div class="mb-4"><SandGlass54 /></div>
          <Typography
            variant="title-01-normal-semibold"
            color="text-title-default"
            className="mb-2"
          >
            보고서가 아직 없어요
          </Typography>
          <Typography
            variant="body-02-normal-regular"
            color="text-body-subtle"
            className="text-center"
          >
            보고서를 업로드하면 결과를 확인할 수 있어요.
          </Typography>
        </div>
        <div
          class="shadow-sticky-top relative z-10 flex items-center justify-end gap-2 border-t border-gray-100 bg-white px-5 py-3 xl:rounded-b-2xl"
        >
          <button
            type="button"
            class="h-11 w-35 rounded-lg border border-gray-300 bg-white text-body-01-normal-medium text-gray-700 hover:bg-gray-50"
            onclick={() => handleStepChange(1)}
          >
            이전
          </button>
        </div>
      {/if}
    </div>
  {/if}
{/if}
