<script lang="ts">
  /**
   * 검사 보고서(PDF) 뷰어 — 상태 분기 + 스트리밍 로드 + PDFViewer
   *
   * 검사 상세 패널(스텝 3)과 소견 작성 모드가 공유한다.
   * 보고서 자체만 담당하고, 단계 이동 등 화면 고유 액션은 footer 스니펫으로 받는다.
   */
  import type { Snippet } from 'svelte'
  import Typography from '@common/components/Typography.svelte'
  import SandGlass54 from '$lib/assets/SandGlass54.svelte'
  import PDFViewer from '$lib/components/PDFViewer.svelte'
  import { centerId } from '$lib/stores/center.store'
  import type { AssessmentItem } from '$lib/features/assessment/status-detail/types'

  let {
    assessment,
    clientName,
    clientBirthDate,
    onSendResult,
    footer,
    minInitialScale = 1
  } = $props<{
    assessment: AssessmentItem
    /** 다운로드 파일명 조합용 */
    clientName?: string
    /** 다운로드 파일명 조합용 (예: 1990-01-01) */
    clientBirthDate?: string
    /** 보고서 툴바 "결과전송" (소견 작성 모드에서는 전달하지 않는다 — 맥락 밖 액션) */
    onSendResult?: () => void
    /** PDF가 뜬 상태에서 뷰어 아래에 붙일 하단바 (스텝 이동 등) */
    footer?: Snippet
    minInitialScale?: number
  }>()

  /** 뷰어용: 같은 오리진 스트리밍 URL (CORS 없음) */
  const pdfViewerUrl = $derived(
    assessment.reportDocumentId && $centerId
      ? `/api/proxy/centers/${$centerId}/documents/${assessment.reportDocumentId}/download`
      : null
  )

  let pdfFile = $state<File | null>(null)
  let pdfFileLoading = $state(false)
  let pdfFileError = $state<string | null>(null)

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
    const fileName = buildPdfDownloadFileName(
      assessment.name,
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
          throw new Error('PDF가 아닌 응답입니다. (API/프록시 확인)')
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
</script>

{#if assessment.status === 'pending' || assessment.status === 'in_progress'}
  <div class="flex-1 flex items-start justify-center px-8 pt-30 pb-16">
    <div class="flex flex-col items-center">
      <div class="mb-4"><SandGlass54 /></div>
      <Typography
        variant="title-01-normal-semibold"
        color="text-title-default"
        className="mb-2"
      >
        보고서가 아직 생성되지 않았어요
      </Typography>
      <Typography
        variant="body-02-normal-regular"
        color="text-body-subtle"
        className="text-center"
      >
        검사가 제출되면 자동으로 보고서가 생성됩니다.
      </Typography>
    </div>
  </div>
{:else if assessment.status === 'refused'}
  <div class="flex flex-1 flex-col items-center justify-start px-8 pt-30 pb-16">
    <Typography
      variant="body-02-regular"
      color="text-gray-500"
      className="text-center"
    >
      거부된 검사입니다.
    </Typography>
  </div>
{:else if assessment.status === 'cancelled'}
  <div class="flex flex-1 flex-col items-center justify-start px-8 pt-30 pb-16">
    <Typography
      variant="body-02-regular"
      color="text-gray-500"
      className="text-center"
    >
      이 검사는 중단되었어요.
      {#if assessment.cancelledReason}
        <span class="block mt-3 text-gray-400 text-xs">
          사유: {assessment.cancelledReason}
        </span>
      {/if}
    </Typography>
  </div>
{:else if assessment.reportDocumentId}
  <!-- 보고서 생성: 스트리밍 URL로 fetch 후 PDFViewer에 File 전달 -->
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
              title: assessment.name,
              onSendResult: onSendResult ?? undefined
            }}
            {minInitialScale}
          />
        </div>
        {@render footer?.()}
      </div>
    {/if}
  </div>
{:else}
  <!-- reportDocumentId 없음: 보고서 미생성 안내 -->
  <div class="flex-1 flex items-start justify-center px-8 pt-30 pb-16">
    <div class="flex flex-col items-center">
      <div class="mb-4"><SandGlass54 /></div>
      <Typography
        variant="title-01-normal-semibold"
        color="text-title-default"
        className="mb-2"
      >
        보고서가 아직 생성되지 않았어요
      </Typography>
      <Typography
        variant="body-02-normal-regular"
        color="text-body-subtle"
        className="text-center"
      >
        내담자가 검사를 제출하면 자동으로 채점 및 보고서가 생성됩니다.
      </Typography>
    </div>
  </div>
{/if}
