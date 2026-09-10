<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { fade } from 'svelte/transition'
  import { useQueryClient } from '@tanstack/svelte-query'

  import Typography from '$components/Typography.svelte'
  import Button from '$components/Button.svelte'
  import ConfirmModal from '$components/modal/ConfirmModal.svelte'
  import MarkdownArtifactViewer from '$lib/features/voucher/components/MarkdownArtifactViewer.svelte'
  import PdfArtifactViewer from '$lib/features/voucher/components/PdfArtifactViewer.svelte'
  import { formPagesOf } from '$lib/features/voucher/confirm-candidates'
  import { queryBuilder } from '$hooks/queries/builder'
  import {
    getVoucherExtractionDetail,
    retryVoucherExtraction,
    stopVoucherExtraction,
    resumeVoucherExtraction,
    deleteVoucherExtraction,
    type VoucherExtractionDetailResponse,
    type VoucherExtractionDocumentItem,
    type VoucherExtractionStatus
  } from '$hooks/actions/voucher-extraction.action'
  import { getVoucherList } from '$hooks/actions/voucher.action'
  import { modalStore } from '$stores/modal'
  import { showErrorSnackbar, showSuccessSnackbar } from '$utils/errorHandler'
  import { formatDate } from '$utils/format'

  const extractionId = $derived(page.params.extractionId!)
  const queryClient = useQueryClient()

  const STATUS_LABELS: Record<VoucherExtractionStatus, string> = {
    processing: '진행 중',
    review: '영역 확정 대기',
    paused: '중단됨',
    completed: '완료',
    failed: '실패'
  }
  const STATUS_BADGE: Record<
    VoucherExtractionStatus,
    { bg: string; text: string; dot: string }
  > = {
    processing: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    review: { bg: 'bg-violet-50', text: 'text-violet-700', dot: 'bg-violet-500' },
    paused: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    completed: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
    failed: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' }
  }
  const TYPE_LABELS: Record<string, string> = {
    business_guide: '사업안내',
    manual: '매뉴얼',
    form: '서식',
    supplementary: '참고자료',
    notice: '공고'
  }

  // 상세 — status='processing' 동안 3초 폴링
  const detailQuery = $derived(
    queryBuilder<any, any>(
      getVoucherExtractionDetail,
      () => ({ extractionId }),
      () => ({
        refetchInterval: (q: any) =>
          q.state.data?.status === 'processing' ? 3000 : false
      })
    )
  )
  const detail = $derived<VoucherExtractionDetailResponse | null>(
    detailQuery.data ?? null
  )
  const isLoading = $derived(detailQuery.isPending)

  // 산출물이 수십~수백 개(서식 png)라 한 덩어리로 두면 목록이 화면을 삼킨다.
  // 뷰어로 여는 가공물(md·pdf)과 서식 png 를 갈라, 서식은 접어 둔다.
  // 서식으로 판정된 쪽은 서버가 completed.forms 로 알려준다(이름 파싱 없음).
  const formPages = $derived(formPagesOf(detail?.forms ?? []))
  const otherArtifacts = $derived(
    (detail?.artifact_documents ?? []).filter((d) => d.file_type?.toLowerCase() !== 'png')
  )
  const artifactUrlById = $derived(
    new Map((detail?.artifact_documents ?? []).map((d) => [d.id, d.url]))
  )

  // 확정 여부 — extraction 은 확정을 모른다(확정은 vouchers 행이 생기는 것뿐).
  // 카탈로그를 한 번 받아 후보와 대조한다. 키 = 확정 시 중복 판정에 쓰는 (이름·연도·기관) 그대로.
  // ponytail: 문서 하나가 감당할 규모 전제 — total 이 받은 수보다 크면 화면이 부분 대조라고 고지한다.
  const CATALOG_SIZE = 100 // 서버 상한(le=100) — 넘기면 422 로 조용히 빈 목록이 온다
  const catalogQuery = queryBuilder<any, any>(getVoucherList, () => ({ size: CATALOG_SIZE }))
  const catalog = $derived(catalogQuery.data ?? null)
  const catalogPartial = $derived(
    catalog ? (catalog.total ?? 0) > (catalog.items?.length ?? 0) : false
  )

  function identityKey(name: string, year: number | string, org: string): string {
    return `${String(name).trim()}\u0000${year}\u0000${String(org).trim()}`
  }

  const confirmedByKey = $derived(
    new Map<string, string>(
      (catalog?.items ?? []).map((v: any) => [
        identityKey(v.name, v.program_year, v.program_organization),
        v.id
      ])
    )
  )

  /** 후보 → 확정된 바우처 id. 확정 전이면 null. */
  function confirmedIdOf(cand: any): string | null {
    const org = (detail?.meta as any)?.organization?.value
    const year = (detail?.meta as any)?.year?.value
    if (!cand?.name || !org || !year) return null
    return confirmedByKey.get(identityKey(cand.name, Number(year), String(org))) ?? null
  }

  const confirmedCount = $derived(
    (detail?.candidates ?? []).filter((c) => confirmedIdOf(c) !== null).length
  )

  // 대표 문서명 — 첫 입력 원본의 name
  const docName = $derived(detail?.source_documents?.[0]?.name ?? '(이름 없음)')

  // 인라인 문서 뷰어 — 칩 선택 → 해당 섹션 아래 펼침 (web VoucherDocumentSection 패턴)
  let viewerDoc = $state<VoucherExtractionDocumentItem | null>(null)
  function toggleViewer(doc: VoucherExtractionDocumentItem) {
    viewerDoc = viewerDoc?.id === doc.id ? null : doc
  }

  async function handleStop() {
    try {
      await stopVoucherExtraction().request({ extractionId })
      showSuccessSnackbar('중단을 요청했습니다 — 진행 중인 단계를 마치는 대로 멈춥니다.')
      queryClient.invalidateQueries({ queryKey: ['getVoucherExtractionDetail'], exact: false })
    } catch (e) {
      showErrorSnackbar(e)
    }
  }

  async function handleResume() {
    try {
      await resumeVoucherExtraction().request({ extractionId })
      showSuccessSnackbar('멈춘 지점부터 이어갑니다.')
      queryClient.invalidateQueries({ queryKey: ['getVoucherExtractionDetail'], exact: false })
    } catch (e) {
      showErrorSnackbar(e)
    }
  }

  async function handleRetry() {
    try {
      await retryVoucherExtraction().request({ extractionId })
      showSuccessSnackbar('재추출을 시작했습니다.')
      queryClient.invalidateQueries({
        queryKey: ['getVoucherExtractionDetail'],
        exact: false
      })
      queryClient.invalidateQueries({
        queryKey: ['getVoucherExtractionList'],
        exact: false
      })
    } catch (e) {
      showErrorSnackbar(e)
    }
  }

  function handleDelete() {
    modalStore.open({
      component: ConfirmModal,
      props: {
        title: '추출 삭제',
        message: '이 추출 작업을 삭제하시겠습니까?\n삭제 후 되돌릴 수 없습니다.',
        confirmText: '삭제',
        type: 'danger',
        onConfirm: async () => {
          try {
            await deleteVoucherExtraction().request({ extractionId })
            showSuccessSnackbar('삭제되었습니다.')
            queryClient.invalidateQueries({
              queryKey: ['getVoucherExtractionList'],
              exact: false
            })
            goto('/voucher-extraction')
          } catch (e) {
            showErrorSnackbar(e)
          }
        }
      },
      options: { size: 'sm' }
    })
  }

  /** 런타임 stage → 진행 스텝 (2단계 파이프라인).
   *  1단계: route·s1=전사, list·s2a·s3_detect=구조 → review 게이트
   *  2단계: tx·field·repair·dm=내용, finalize=마감 */
  function stepOf(stage: string | undefined): string {
    if (!stage) return 'transcribe'
    if (stage === 'route' || stage === 's1') return 'transcribe'
    if (stage === 'list' || stage === 's2a' || stage === 's3_detect') return 'structure'
    if (stage === 'finalize') return 'finalize'
    return 'extract'
  }

  /** span [7, 10] 또는 [p-007, p-010] → "p-007~p-010". */
  function spanTxt(cand: any): string | null {
    const s = cand?.span
    if (!Array.isArray(s) || s.length < 2 || !s[0]) return null
    const p = (x: any) => (typeof x === 'number' ? `p-${String(x).padStart(3, '0')}` : `${x}`)
    return s[0] === s[1] ? p(s[0]) : `${p(s[0])}~${p(s[1])}`
  }
</script>

<div in:fade class="p-6">
  <button
    class="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
    onclick={() => goto('/voucher-extraction')}
  >
    ← 목록
  </button>

  {#if isLoading}
    <div class="section-border flex items-center justify-center py-16">
      <Typography variant="body-03-normal-regular" color="text-gray-400">
        불러오는 중...
      </Typography>
    </div>
  {:else if !detail}
    <div class="section-border py-16 text-center">
      <Typography variant="body-03-normal-regular" color="text-gray-400">
        추출 작업을 찾을 수 없습니다
      </Typography>
    </div>
  {:else}
    {@const badge = STATUS_BADGE[detail.status]}
    <!-- 헤더 -->
    <div class="mb-6 flex items-start justify-between gap-4">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <Typography variant="headline-02-normal-bold" color="text-gray-900">
            {docName}
          </Typography>
          <span
            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium {badge.bg} {badge.text}"
          >
            <span class="h-1.5 w-1.5 rounded-full {badge.dot}"></span>
            {STATUS_LABELS[detail.status]}
          </span>
          {#if detail.type}
            <span class="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {TYPE_LABELS[detail.type] ?? detail.type}
            </span>
          {/if}
        </div>
        <div class="mt-1 font-mono text-[11px] text-gray-400">{detail.id}</div>
        {#if detail.source_url}
          <a
            href={detail.source_url}
            target="_blank"
            rel="noopener noreferrer"
            class="mt-1 inline-block text-xs text-primary-600 hover:underline"
          >
            원본 출처 ↗
          </a>
        {/if}
      </div>
      <div class="flex shrink-0 gap-2">
        {#if detail.status === 'review'}
          <Button
            size="md"
            color="primary"
            content="영역·서식 확정"
            onclick={() => goto(`/voucher-extraction/${extractionId}/layout`)}
          />
        {/if}
        {#if detail.status === 'processing'}
          <Button size="md" color="light" content="중단" onclick={handleStop} />
        {/if}
        {#if detail.status === 'paused'}
          <Button size="md" color="primary" content="이어서 가공" onclick={handleResume} />
          <Button size="md" color="light" content="처음부터 재추출" onclick={handleRetry} />
        {/if}
        {#if detail.status === 'failed'}
          <Button size="md" color="light" content="재추출" onclick={handleRetry} />
        {/if}
        <Button size="md" color="stroke-delete" content="삭제" onclick={handleDelete} />
      </div>
    </div>

    <!-- 실패 사유 -->
    {#if detail.status === 'failed' && detail.failed}
      <div class="section-border mb-4 bg-red-50/50 p-4">
        <Typography variant="body-03-normal-medium" color="text-red-700">
          실패 사유
        </Typography>
        <Typography
          variant="body-03-normal-regular"
          color="text-red-600"
          className="mt-1 whitespace-pre-line"
        >
          {detail.failed}
        </Typography>
      </div>
    {/if}

    <!-- 메타 -->
    <div class="section-border mb-4 grid grid-cols-2 gap-4 p-4 md:grid-cols-4">
      <div>
        <div class="text-xs text-gray-500">문서</div>
        <div class="mt-0.5 text-sm font-medium text-gray-900">
          입력 {detail.source_documents.length} · 산출 {detail.artifact_documents.length}
        </div>
      </div>
      <div>
        <div class="text-xs text-gray-500">후보</div>
        <div class="mt-0.5 text-sm font-medium text-gray-900">
          {detail.candidates.length}개
        </div>
      </div>
      <div>
        <div class="text-xs text-gray-500">소요 시간</div>
        <div class="mt-0.5 text-sm font-medium text-gray-900">
          {detail.latency_ms ? `${Math.round(detail.latency_ms / 1000)}초` : '-'}
        </div>
      </div>
      <div>
        <div class="text-xs text-gray-500">등록일</div>
        <div class="mt-0.5 text-sm font-medium text-gray-900">
          {formatDate(detail.created_at, 'YYYY-MM-DD')}
        </div>
      </div>
    </div>

    <!-- 진행률 — 단계 3스텝 (전사 → 분석 → 마감). stage 미상이면 첫 스텝. -->
    {#snippet progressBar(stage: string | undefined)}
      {@const steps = [
        { key: 'transcribe', label: '문서 전사' },
        { key: 'structure', label: '영역·서식 파악' },
        { key: 'extract', label: '내용 추출' },
        { key: 'finalize', label: '마감' }
      ]}
      {@const cur = Math.max(
        0,
        steps.findIndex((s) => s.key === stage)
      )}
      <div>
        <div class="mb-2 flex items-center gap-2">
          <span class="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500"></span>
          <span class="text-sm text-blue-600">
            {steps[cur].label} 중… ({cur + 1}/{steps.length} · 자동 새로고침)
          </span>
        </div>
        <div class="flex gap-1.5">
          {#each steps as s, i (s.key)}
            <div
              class="h-1.5 flex-1 rounded-full {i < cur
                ? 'bg-blue-500'
                : i === cur
                  ? 'bg-blue-400 animate-pulse'
                  : 'bg-gray-200'}"
            ></div>
          {/each}
        </div>
      </div>
    {/snippet}

    <div class="section-border mb-4 p-4">
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <Typography variant="body-02-normal-semibold" color="text-gray-900">
          추출 결과 · 후보 {detail.candidates.length}건
        </Typography>
        {#if detail.status === 'completed' && detail.candidates.length > 0}
          <span class="text-xs text-gray-400">
            확정 {confirmedCount} / {detail.candidates.length}
          </span>
          {#if catalogPartial}
            <span
              class="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700"
              title="카탈로그가 커서 앞 {CATALOG_SIZE}건만 대조했습니다 — 확정된 바우처가 미확정으로 보일 수 있습니다"
            >
              부분 대조
            </span>
          {/if}
        {/if}
      </div>

      {#if detail.status === 'review'}
        {@const spans = (detail.progress?.data as any)?.spans ?? []}
        {@const fps = (detail.progress?.data as any)?.form_pages ?? []}
        <div class="rounded-lg border border-violet-100 bg-violet-50/60 px-4 py-3">
          <div class="text-sm font-medium text-violet-800">
            구조 파악 완료 — 영역 {spans.length}개 · 서식 후보 {fps.length}쪽 감지
          </div>
          <p class="mt-1 text-xs text-violet-600">
            영역과 서식 구간을 확정하면 내용 추출(2단계)이 시작됩니다. 추출은 확정된 영역만 돕니다.
          </p>
        </div>
      {:else if detail.status === 'processing'}
        {@render progressBar(stepOf(detail.progress?.stage))}
        {#if detail.progress?.stage === 'field'}
          {@const done = ((detail.progress?.data as any)?.vouchers ?? []).length}
          {@const total = ((detail.progress?.data as any)?.spans ?? []).length}
          <p class="mt-2 text-xs text-gray-500">바우처 {done} / {total} 추출됨 — 중단해도 여기까지는 보존됩니다</p>
        {/if}
      {:else if detail.candidates.length === 0}
        <Typography variant="body-03-normal-regular" color="text-gray-400">
          추출된 후보가 없습니다
        </Typography>
      {:else}
        <!-- 후보가 수십 건이라 카드 대신 한 줄 행 — 열이 맞아야 눈으로 훑을 수 있다 -->
        <div
          class="flex items-center gap-3 border-b border-gray-200 px-1 pb-1.5 text-[11px] text-gray-400"
        >
          <span class="w-6 shrink-0"></span>
          <span class="min-w-0 flex-1">사업 · 서비스</span>
          <span class="w-16 shrink-0 text-center">확정</span>
          <span class="w-28 shrink-0 text-right">문서 내 위치</span>
          <span class="w-28 shrink-0"></span>
        </div>

        <div class="divide-y divide-gray-100">
          {#each detail.candidates as cand, i (i)}
            {@const confirmedId = confirmedIdOf(cand)}
            <div class="flex items-center gap-3 px-1 py-2.5">
              <span class="w-6 shrink-0 font-mono text-[11px] text-gray-300">
                {String(i + 1).padStart(2, '0')}
              </span>

              <span class="min-w-0 flex-1 truncate text-sm text-gray-900">
                {cand.name || '(이름 없음)'}
              </span>

              <span class="w-16 shrink-0 text-center">
                {#if confirmedId}
                  <span class="rounded bg-green-50 px-1.5 py-0.5 text-[11px] text-green-700">
                    확정됨
                  </span>
                {:else}
                  <span class="text-[11px] text-gray-300">미확정</span>
                {/if}
              </span>

              <span class="w-28 shrink-0 text-right font-mono text-[11px] text-gray-400">
                {spanTxt(cand) ?? ''}
              </span>

              {#if confirmedId}
                <button
                  type="button"
                  class="w-28 shrink-0 rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-600 transition-colors hover:border-primary-300 hover:text-primary-600"
                  onclick={() => goto(`/vouchers/${confirmedId}`)}
                >
                  바우처 보기
                </button>
              {:else}
                <button
                  type="button"
                  class="w-28 shrink-0 rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-600 transition-colors hover:border-primary-300 hover:text-primary-600"
                  onclick={() => goto(`/voucher-extraction/${extractionId}/confirm/${i}`)}
                >
                  확정하러 가기
                </button>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- 문서 (입력 원본 / 산출물) — url 있으면 열기/다운로드 -->
    {#snippet docChips(docs: VoucherExtractionDocumentItem[], emptyText: string)}
      {#if docs.length === 0}
        <Typography variant="body-03-normal-regular" color="text-gray-400">
          {emptyText}
        </Typography>
      {:else}
        <div class="flex flex-wrap gap-2">
          {#each docs as doc (doc.id)}
            {#if doc.url && (doc.file_type === 'md' || doc.file_type === 'pdf')}
              <button
                type="button"
                onclick={() => toggleViewer(doc)}
                class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors {viewerDoc?.id ===
                doc.id
                  ? 'border-primary-300 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-700 hover:border-primary-300 hover:bg-gray-50'}"
                title="미리보기"
              >
                {doc.name}
                <span
                  class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500"
                  >.{doc.file_type}</span
                >
              </button>
            {:else if doc.url}
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition-colors hover:border-primary-300 hover:bg-gray-50"
                title="열기 / 다운로드"
              >
                {doc.name}
                <span
                  class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500"
                  >.{doc.file_type}</span
                >
              </a>
            {:else}
              <span
                class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700"
              >
                {doc.name}
                <span
                  class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500"
                  >.{doc.file_type}</span
                >
              </span>
            {/if}
          {/each}
        </div>

        <!-- 선택된 문서의 인라인 뷰어 — 자기 섹션 아래에만 펼침 -->
        {#if viewerDoc && viewerDoc.url && docs.some((d) => d.id === viewerDoc?.id)}
          {@const vurl = viewerDoc.url}
          <div class="mt-3 max-w-3xl">
            <div class="mb-2 flex items-center gap-2">
              <a
                href={vurl}
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs text-primary-600 hover:underline"
              >
                원본 열기 ↗
              </a>
              <button
                type="button"
                onclick={() => (viewerDoc = null)}
                class="ml-auto rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                ✕ 닫기
              </button>
            </div>
            {#key viewerDoc.id}
              {#if viewerDoc.file_type === 'pdf'}
                <PdfArtifactViewer url={vurl} />
              {:else}
                <MarkdownArtifactViewer url={vurl} />
              {/if}
            {/key}
          </div>
        {/if}
      {/if}
    {/snippet}

    <div class="section-border mb-4 p-4">
      <Typography variant="body-02-normal-semibold" color="text-gray-900" className="mb-2">
        입력 원본
      </Typography>
      {@render docChips(detail.source_documents, '입력 원본이 없습니다')}
    </div>

    <div class="section-border p-4">
      <div class="mb-2 flex items-center gap-2">
        <Typography variant="body-02-normal-semibold" color="text-gray-900">
          산출물
        </Typography>
        <span class="text-xs text-gray-400">{detail.artifact_documents.length}건</span>
      </div>

      <div class="space-y-2">
        <details open class="rounded-lg border border-gray-100">
          <summary
            class="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm select-none hover:bg-gray-50"
          >
            <span class="text-gray-400 transition-transform">▸</span>
            <span class="font-medium text-gray-800">가공 문서</span>
            <span class="font-mono text-xs text-gray-400">{otherArtifacts.length}</span>
            <span class="text-xs text-gray-400">— 전사·병합 결과</span>
          </summary>
          <div class="border-t border-gray-100 p-3">
            {@render docChips(otherArtifacts, '아직 가공 문서가 없습니다')}
          </div>
        </details>

        <details class="rounded-lg border border-gray-100">
          <summary
            class="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm select-none hover:bg-gray-50"
          >
            <span class="text-gray-400 transition-transform">▸</span>
            <span class="font-medium text-gray-800">서식 페이지</span>
            <span class="font-mono text-xs text-gray-400">{formPages.length}</span>
            <span class="text-xs text-gray-400">— 제출용 서식으로 감지된 페이지 png</span>
          </summary>
          <div class="border-t border-gray-100 p-3">
            {#if formPages.length === 0}
              <Typography variant="body-03-normal-regular" color="text-gray-400">
                감지된 서식 페이지가 없습니다
              </Typography>
            {:else}
              <div class="grid grid-cols-1 gap-1 sm:grid-cols-2 xl:grid-cols-3">
                {#each formPages as fp (fp.page)}
                  {@const href = fp.id ? artifactUrlById.get(fp.id) : null}
                  <a
                    href={href ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 hover:text-primary-600"
                    title={fp.kind}
                  >
                    <span class="w-12 shrink-0 font-mono text-[11px] text-gray-400">
                      p-{String(fp.page).padStart(3, '0')}
                    </span>
                    <span class="truncate">{fp.title || fp.kind || '(제목 없음)'}</span>
                  </a>
                {/each}
              </div>
            {/if}
          </div>
        </details>
      </div>
    </div>
  {/if}
</div>
