<script lang="ts">
  import SplitPane from '$lib/features/voucher/components/SplitPane.svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { fade } from 'svelte/transition'

  import Typography from '$components/Typography.svelte'
  import PdfHighlightViewer from '$lib/features/voucher/components/PdfHighlightViewer.svelte'
  import VoucherRecordEditor from '$lib/features/voucher/components/VoucherRecordEditor.svelte'
  import FieldRow from '$lib/features/voucher/components/FieldRow.svelte'
  import {
    FIELDS_MAIN,
    buildForm,
    formPagesInSpan,
    formPagesOf,
    pageNum,
    resolveVoucherIds,
    type VoucherForm
  } from '$lib/features/voucher/confirm-candidates'
  import { deriveOldFields, pruneEmptyRows } from '$lib/features/voucher/record-derive'
  import { queryBuilder } from '$hooks/queries/builder'
  import {
    getVoucherExtractionDetail,
    confirmVoucherExtraction,
    type VoucherExtractionDetailResponse
  } from '$hooks/actions/voucher-extraction.action'
  import { getVoucherList } from '$hooks/actions/voucher.action'
  import {
    createFormExtractionFromDocument,
    getFormExtractionDetail,
    confirmFormExtraction,
    listFormExtractions
  } from '$hooks/actions/form-extraction.action'
  import { showErrorMessage, showErrorSnackbar, showSuccessSnackbar } from '$utils/errorHandler'
  import Button from '$components/Button.svelte'
  import { useQueryClient } from '@tanstack/svelte-query'

  // 바우처 1건 확정 화면 — 항목 편집 + 서식 검토. 편집과 확정이 한 화면에 있어
  // 페이지를 옮겨도 잃을 상태가 없다(확정은 이 바우처 1건만 보낸다).
  // 바우처 이동은 라우트 전환이 아니라 상단 레일 — N건 × 탭을 선형 통과시키지 않기 위함.

  const extractionId = $derived(page.params.extractionId!)
  const index = $derived(Number(page.params.index ?? 0))

  type Tab = 'fields' | 'forms'
  const TABS: { id: Tab; label: string }[] = [
    { id: 'fields', label: '추출 항목 검증' },
    { id: 'forms', label: '서식 페이지 · 변환' }
  ]
  let tab = $state<Tab>('fields')

  const detailQuery = $derived(
    queryBuilder<any, any>(getVoucherExtractionDetail, () => ({ extractionId }))
  )
  const detail = $derived<VoucherExtractionDetailResponse | null>(
    detailQuery.data ?? null
  )
  const isLoading = $derived(detailQuery.isPending)

  // 편집 대상이라 파생이 아니라 상태 — 재조회가 사용자의 편집을 덮지 않게 1회만 만든다.
  let forms = $state<VoucherForm[]>([])
  let built = false
  $effect(() => {
    if (built || !detail || detail.status !== 'completed') return
    forms = detail.candidates.map((c) => buildForm(c, detail.meta))
    built = true
  })
  const form = $derived<VoucherForm | null>(forms[index] ?? null)

  const formPages = $derived(
    formPagesInSpan(formPagesOf(detail?.forms ?? []), form?.page_range ?? null)
  )
  // 서식 png 미리보기 URL — artifact 목록에서 id 로 찾는다(판정은 forms 가 소유)
  const artifactUrlById = $derived(
    new Map((detail?.artifact_documents ?? []).map((d) => [d.id, d.url]))
  )

  const pdfDoc = $derived(
    detail?.source_documents?.find((d) => d.file_type?.toLowerCase() === 'pdf') ?? null
  )
  let pdfUrlStable = $state<string | null>(null)
  $effect(() => {
    if (!pdfUrlStable && pdfDoc?.url) pdfUrlStable = pdfDoc.url
  })
  const proxiedPdfUrl = $derived(
    pdfUrlStable ? `/api/file-proxy?url=${encodeURIComponent(pdfUrlStable)}` : null
  )

  let viewerPage = $state<number | null>(null)
  let viewerQuery = $state<string | null>(null)
  let activeKey = $state<string | null>(null)

  // 바우처를 옮기면 뷰어도 그 구간 첫 페이지로 (직전 바우처 페이지에 머무는 혼동 방지)
  let shownIndex = -1
  $effect(() => {
    if (!form || shownIndex === index) return
    shownIndex = index
    viewerPage = form.page_range?.[0] ?? null
    viewerQuery = null
    activeKey = null
  })

  function focusField(key: string) {
    if (!form) return
    const pg = pageNum(form.paths[key] ?? null)
    if (pg !== null) viewerPage = pg
    viewerQuery = form.queries[key] || null
    activeKey = key
  }

  function move(delta: number) {
    const next = index + delta
    if (next < 0 || next >= forms.length) return
    goto(`/voucher-extraction/${extractionId}/confirm/${next}`, { noScroll: true })
  }

  const queryClient = useQueryClient()
  let isConfirming = $state(false)

  const inputCls =
    'w-full rounded-lg border border-gray-200 bg-primary-50/30 px-3 py-3 text-base outline-none focus:border-primary-500'

  /** 확정에 모자란 필수 칸 — 배너·검증이 같은 판정을 쓴다 */
  const missing = $derived.by(() => {
    const f = form
    if (!f) return [] as string[]
    const out: string[] = []
    if (!f.name.trim()) out.push('사업/서비스명')
    if (!f.program_name.trim()) out.push('사업 이름')
    if (!f.program_organization.trim()) out.push('사업 기관')
    const y = Number(f.program_year)
    if (!Number.isFinite(y) || y < 1900 || y > 2999) out.push('사업 연도')
    return out
  })

  async function handleConfirm() {
    const f = form
    if (!f || isConfirming) return
    if (missing.length) {
      // showErrorSnackbar 는 axios 에러에서 메시지를 뽑는다 — 문자열은 showErrorMessage
      showErrorMessage(`${missing.join('·')} 을(를) 채워야 확정할 수 있습니다.`)
      return
    }
    const year = Number(f.program_year)
    // 빈 행·항목 정리 후 저장, 정리된 record 에서 구 필드(web·mobile 소비용) 재파생
    const rec = pruneEmptyRows($state.snapshot(f.record))
    const derived = deriveOldFields(rec)

    // 이 바우처에 붙일 문서만 — 원본은 바우처 구간, 서식 png 는 그 한 쪽.
    // 안 보내면 서버가 추출 문서 전량을 붙인다(구 동작).
    const documents = [
      ...(pdfDoc ? [{ global_document_id: pdfDoc.id, page_range: f.page_range }] : []),
      ...formPages.flatMap((fp) =>
        fp.pages
          .filter((pg) => pg.id)
          .map((pg) => ({
            global_document_id: pg.id as string,
            page_range: [pg.no, pg.no] as [number, number]
          }))
      )
    ]

    isConfirming = true
    try {
      const res: any = await confirmVoucherExtraction().request({
        extractionId,
        vouchers: [
          {
            name: f.name.trim(),
            program_name: f.program_name.trim(),
            program_organization: f.program_organization.trim(),
            program_year: year,
            usage_start_date: f.usage_start_date || null,
            usage_end_date: f.usage_end_date || null,
            application_method: f.application_method.trim() || null,
            application_start_date: f.application_start_date || null,
            application_end_date: f.application_end_date || null,
            support_amount: derived.support_amount,
            support_scope: derived.support_scope,
            support_target: derived.support_target,
            contact: f.contact.trim() || null,
            record: rec,
            page_range: f.page_range,
            documents
          }
        ]
      })
      const created = res?.voucher_created_count ?? 0
      showSuccessSnackbar(created > 0 ? '확정 완료 — 카탈로그에 등록했습니다' : '확정 완료 — 기존 바우처를 갱신했습니다')
      queryClient.invalidateQueries({ queryKey: ['getVoucherList'], exact: false })
      // 다음 미확정 후보로 (마지막이면 목록으로)
      if (index < forms.length - 1) {
        goto(`/voucher-extraction/${extractionId}/confirm/${index + 1}`, { noScroll: true })
      } else {
        goto(`/voucher-extraction/${extractionId}`)
      }
    } catch (e) {
      showErrorSnackbar(e)
    } finally {
      isConfirming = false
    }
  }

  // ── 서식 스키마 추출·확정 (form_extractions) ──
  // 쪽 단위로 FormSchema 를 추출해 FormTemplate 으로 확정한다(백엔드 API 는 단일 쪽 제약).
  // 매핑은 화면 세션 상태 — 추출~확정을 이 자리에서 끝내는 흐름.
  interface SchemaJob {
    id: string
    status: 'processing' | 'completed' | 'failed'
    schema: Record<string, unknown> | null
    failed: string | null
    templateName: string | null
  }
  let schemaJobs = $state<Record<number, SchemaJob>>({})

  // 추출본은 form_extractions 에 남는다 — 화면을 다시 열면 (원본 문서, 쪽)으로 되찾는다.
  // 없으면 매번 다시 돌리게 되고, 그건 그대로 LLM 비용이다.
  let restored = false
  $effect(() => {
    if (restored || !pdfDoc || formPages.length === 0) return
    restored = true
    void restoreSchemaJobs(pdfDoc.id)
  })

  async function restoreSchemaJobs(sourceDocumentId: string) {
    try {
      const res: any = await listFormExtractions().request({ size: 100 })
      const pages = new Set(formPages.map((f) => f.page))
      // 최신순 응답 — 쪽마다 첫 행만 취한다
      for (const row of res?.items ?? []) {
        if (row.source_document_id !== sourceDocumentId) continue
        if (row.page == null || !pages.has(row.page) || schemaJobs[row.page]) continue
        schemaJobs[row.page] = {
          id: row.id, status: row.status, schema: null, failed: null, templateName: null
        }
        if (row.status === 'processing') pollSchemaJob(row.page)
        else void loadSchemaJob(row.page)
      }
    } catch {
      /* 되찾기 실패는 흐름을 막지 않는다 — 다시 추출로 갈 수 있다 */
    }
  }

  async function loadSchemaJob(fpage: number) {
    const job = schemaJobs[fpage]
    if (!job) return
    try {
      const d: any = await getFormExtractionDetail().request({ extractionId: job.id })
      schemaJobs[fpage] = {
        ...job, status: d.status, schema: d.schema ?? null, failed: d.failed ?? null
      }
    } catch {
      /* 상세 조회 실패 — 목록의 상태만 유지 */
    }
  }

  async function startSchemaExtract(fpage: number, title: string) {
    const unit = formPages.find((f) => f.page === fpage)
    if (!pdfDoc) {
      showErrorMessage('원본 PDF가 없어 서식을 추출할 수 없습니다.')
      return
    }
    try {
      const res: any = await createFormExtractionFromDocument().request({
        source_document_id: pdfDoc.id,
        name: (title || '서식').slice(0, 90),
        pages: unit?.pages.map((pg) => pg.no) ?? [fpage]
      })
      schemaJobs[fpage] = {
        id: res.id, status: 'processing', schema: null, failed: null, templateName: null
      }
      pollSchemaJob(fpage)
    } catch (e) {
      showErrorSnackbar(e)
    }
  }

  async function pollSchemaJob(fpage: number) {
    const job = schemaJobs[fpage]
    if (!job) return
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000))
      try {
        const d: any = await getFormExtractionDetail().request({ extractionId: job.id })
        if (d.status !== 'processing') {
          schemaJobs[fpage] = {
            ...job, status: d.status, schema: d.schema ?? null, failed: d.failed ?? null
          }
          return
        }
      } catch {
        /* 일시 오류 — 다음 폴링 */
      }
    }
    schemaJobs[fpage] = { ...job, status: 'failed', schema: null, failed: '추출 응답 대기 시간 초과' }
  }

  async function confirmSchema(fpage: number, title: string) {
    const job = schemaJobs[fpage]
    if (!job?.schema) return
    try {
      const res: any = await confirmFormExtraction().request({
        extractionId: job.id,
        name: (title || '서식').slice(0, 90),
        schema: job.schema,
        voucher_ids: linkTargetsOf(fpage),
        kind: formPages.find((f) => f.page === fpage)?.kind || '기타'
      })
      schemaJobs[fpage] = { ...job, templateName: `${res.name} v${res.version}` }
      showSuccessSnackbar(`서식 템플릿 등록 — ${res.name} (v${res.version})`)
    } catch (e) {
      showErrorSnackbar(e)
    }
  }

  // 이 서식을 붙일 바우처들 — 귀속은 추론하지 않는다(영역 확정 화면의 소속 선택이 정본).
  //   voucher : 고른 사업들   common : 이 추출의 확정된 바우처 전부   unknown : 없음
  // size 상한은 서버가 100 — 넘기면 422 라 카탈로그가 통째로 비고 링크가 0건이 된다(실측)
  const catalogQuery = queryBuilder<any, any>(getVoucherList, () => ({ size: 100 }))
  const catalogItems = $derived(catalogQuery.data?.items ?? [])
  const identityMeta = $derived(
    (detail?.meta as any)?.year?.value && (detail?.meta as any)?.organization?.value
      ? {
          year: (detail!.meta as any).year.value,
          organization: (detail!.meta as any).organization.value
        }
      : null
  )

  function linkTargetsOf(fpage: number): string[] {
    const fp = formPages.find((f) => f.page === fpage)
    if (!fp || fp.scope === 'unknown') return []
    const names =
      fp.scope === 'common'
        ? (detail?.candidates ?? []).map((c: any) => c.name).filter(Boolean)
        : fp.voucherNames
    return resolveVoucherIds(names, catalogItems, identityMeta)
  }

  // 추출된 스키마를 화면에서 직접 고친다 — 확정은 편집본으로 나간다.
  const FIELD_TYPES = [
    'text', 'textarea', 'email', 'phone', 'number', 'date', 'time', 'datetime',
    'select', 'radio', 'checkbox_group', 'signature', 'file', 'image'
  ]
  let activeFieldKey = $state<string | null>(null)

  /** 편집 대상 스키마의 필드 목록 — [key, def] 쌍 */
  function fieldRows(job: SchemaJob | undefined): [string, any][] {
    const f = (job?.schema as any)?.fields
    return f && typeof f === 'object' ? Object.entries(f) : []
  }

  /** PNG 위에 그릴 위젯 — rect 는 0~1 정규화 좌표 */
  function elementBoxes(job: SchemaJob | undefined): any[] {
    const els = (job?.schema as any)?.elements
    return Array.isArray(els) ? els.filter((e) => Array.isArray(e?.rect) && e.rect.length === 4) : []
  }

  function setFieldProp(fpage: number, key: string, prop: string, value: unknown) {
    const job = schemaJobs[fpage]
    const f = (job?.schema as any)?.fields?.[key]
    if (!f) return
    f[prop] = value
    schemaJobs[fpage] = { ...job! }   // 편집 반영
  }

  function removeField(fpage: number, key: string) {
    const job = schemaJobs[fpage]
    const s = job?.schema as any
    if (!s?.fields) return
    delete s.fields[key]
    // 그 필드만 가리키던 위젯도 함께 제거 — 남으면 유령 박스가 된다
    if (Array.isArray(s.elements)) {
      s.elements = s.elements.filter(
        (e: any) => !(Array.isArray(e.field_refs) && e.field_refs.length === 1 && e.field_refs[0] === key)
      )
    }
    schemaJobs[fpage] = { ...job! }
    if (activeFieldKey === key) activeFieldKey = null
  }

  // ── 캔버스 편집 — PNG 위 박스를 끌어 옮기고 크기를 바꾼다 ──
  // rect 는 0~1 정규화라 이미지가 어떤 크기로 그려져도 그대로 쓰인다.
  // 서식이 여러 장이면 쪽마다 오버레이가 하나씩 — 좌표(rect)는 그 쪽 안에서 0~1이다
  let overlayEls = $state<Record<number, HTMLDivElement | null>>({})
  const pageOf = (el: any) => Number(el?.page ?? 1)
  const overlayOf = (pg: number) => overlayEls[pg] ?? null
  let selectedIds = $state<string[]>([])
  let zoom = $state(1) // 1 = 폭 맞춤
  let scrollerEl: HTMLDivElement | null = $state(null)
  let band = $state<number[] | null>(null) // 러버밴드 [x, y, w, h] (0~1) — banding.pg 쪽
  let banding: { x: number; y: number; pg: number } | null = null
  const isPicked = (id: string) => selectedIds.includes(id)
  let editing: {
    items: { el: any; rect: number[] }[]
    edges: { l: boolean; r: boolean; t: boolean; b: boolean }
    x0: number
    y0: number
    w: number
    h: number
  } | null = null

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

  // ── 칸 맞춤 — 서식의 괘선을 읽어 놓인 자리의 칸에 맞춘다 ──
  // 표 안의 입력칸을 눈으로 맞추긴 어렵다. 박스가 테두리에 닿으면 그 선들이 둘러싼
  // 칸을 역산해 딱 맞게 고친다.
  //
  // 괘선 판정은 "이 열이 박스 높이만큼 이어져 어두운가"(비율) — 연속 런으로 보면
  // 안티에일리어싱에 끊겨 표 안쪽 선을 통째로 놓친다(실측). 또 원본 해상도로 읽는다 —
  // 축소하면 얇은 괘선이 회색으로 뭉개져 13개 중 7개만 남았다.
  const SNAP_MAX_W = 2400 // 이보다 큰 원본만 줄인다(메모리 상한)
  const LINE_GAP = 25 // 이웃 픽셀보다 이만큼 어두우면 선 위의 점
  const LINE_PROBE = 5 // 이웃을 보는 거리(px)
  const LINE_COVER = 0.8 // 구간의 이 비율 이상이 선 위의 점이면 괘선
  // 칸 맞춤은 수식키(⌘/Ctrl)를 누른 동안만 — 평소 드래그는 자유 이동이다
  const wantsSnap = (e: PointerEvent) => e.metaKey || e.ctrlKey
  let lumMaps: Record<number, { w: number; h: number; lum: Uint8Array }> = {}

  function buildInkMap(img: HTMLImageElement, pg: number) {
    delete lumMaps[pg]
    if (!img.naturalWidth) return
    const W = Math.min(SNAP_MAX_W, img.naturalWidth)
    const H = Math.round(img.naturalHeight * (W / img.naturalWidth))
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    let data: Uint8ClampedArray
    try {
      ctx.drawImage(img, 0, 0, W, H)
      data = ctx.getImageData(0, 0, W, H).data
    } catch {
      return // 픽셀을 못 읽으면 맞춤 없이 수동 편집
    }
    const lum = new Uint8Array(W * H)
    for (let i = 0, p = 0; p < lum.length; i += 4, p++) {
      lum[p] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
    }
    lumMaps[pg] = { w: W, h: H, lum }
  }

  type Cell = { left: number; top: number; right: number; bottom: number }
  let snapPreview = $state<{ primary: number[] | null; others: number[][] }>({
    primary: null,
    others: []
  })
  let snapPage = $state<number | null>(null)
  let bandPage = $state<number | null>(null)
  const NO_SNAP = { primary: null, others: [] }

  /**
   * 놓으면 적용될 칸(primary)과, 닿은 테두리 건너편의 대안 칸들(others).
   * 어느 칸이 되는지는 박스 중심이 정한다 — 살짝 밀어 다른 칸을 고를 수 있게
   * 대안도 함께 그린다.
   */
  /**
   * 이 박스 구간에서 괘선을 찾는 탐침.
   * 판정 = 픽셀마다 **이웃보다 어두운가** + 그 비율(커버리지).
   * 절대 밝기 임계는 못 쓴다 — 서식 PNG는 원본보다 낮은 해상도라 얇은 괘선이
   * 옅은 회색으로 뭉개져, 원본 PDF에 있는 선을 놓친다(추천사유↔판단근거 실측).
   * 임계를 낮추면 이번엔 회색 채움 헤더가 선이 된다.
   * 줄 평균만으로 대비를 보면 글자 획이 선으로 잡힌다 — 커버리지가 그걸 가른다
   * (진짜 선은 구간 전체가 이웃보다 어둡고, 글자는 일부만).
   */
  function lineProbes(rect: number[], pg: number) {
    const lumMap = lumMaps[pg]
    if (!lumMap) return null
    const { w: W, h: H, lum } = lumMap
    const [rx, ry, rw, rh] = rect
    const x0 = clamp(Math.round(rx * W), 0, W - 1)
    const y0 = clamp(Math.round(ry * H), 0, H - 1)
    const x1 = clamp(Math.round((rx + rw) * W), x0 + 1, W - 1)
    const y1 = clamp(Math.round((ry + rh) * H), y0 + 1, H - 1)

    const isVLine = (x: number) => {
      if (x - LINE_PROBE < 0 || x + LINE_PROBE >= W) return false
      let dark = 0
      for (let y = y0; y <= y1; y++) {
        const i = y * W + x
        if (lum[i] < Math.min(lum[i - LINE_PROBE], lum[i + LINE_PROBE]) - LINE_GAP) dark++
      }
      return dark / (y1 - y0 + 1) >= LINE_COVER
    }
    const isHLine = (y: number) => {
      if (y - LINE_PROBE < 0 || y + LINE_PROBE >= H) return false
      let dark = 0
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x
        if (lum[i] < Math.min(lum[i - LINE_PROBE * W], lum[i + LINE_PROBE * W]) - LINE_GAP) dark++
      }
      return dark / (x1 - x0 + 1) >= LINE_COVER
    }
    return { W, H, x0, y0, x1, y1, isVLine, isHLine }
  }

  /** 잡은 변을 인접 괘선에 붙인 rect — 붙일 선이 없으면 null */
  function snapEdges(rect: number[], g: Edges, pg: number): number[] | null {
    const pr = lineProbes(rect, pg)
    if (!pr) return null
    const { W, H, x0, y0, x1, y1, isVLine, isHLine } = pr
    const reach = Math.round(W * EDGE_SNAP_REACH) // 이보다 먼 선은 "인접"이 아니다
    const near = (at: number, lim: number, hit: (v: number) => boolean) => {
      for (let d = 0; d <= reach; d++) {
        if (at - d >= 0 && hit(at - d)) return at - d
        if (at + d < lim && hit(at + d)) return at + d
      }
      return null
    }

    let [x, y, w, h] = rect
    let moved = false
    if (g.l) {
      const v = near(x0, W, isVLine)
      if (v != null) { const nx = v / W; w += x - nx; x = nx; moved = true }
    } else if (g.r) {
      const v = near(x1, W, isVLine)
      if (v != null) { w = v / W - x; moved = true }
    }
    if (g.t) {
      const hz = near(y0, H, isHLine)
      if (hz != null) { const ny = hz / H; h += y - ny; y = ny; moved = true }
    } else if (g.b) {
      const hz = near(y1, H, isHLine)
      if (hz != null) { h = hz / H - y; moved = true }
    }
    return moved && w >= MIN_SIZE && h >= MIN_SIZE ? [x, y, w, h] : null
  }

  function snapCandidates(rect: number[], pg: number) {
    const pr = lineProbes(rect, pg)
    if (!pr) return NO_SNAP
    const { W, H, x0, y0, x1, y1, isVLine, isHLine } = pr
    const range = Math.round(W * 0.4) // 이보다 먼 선은 이 칸의 테두리가 아니다
    const cellAt = (px: number, py: number): Cell | null => {
      if (px < 0 || px >= W || py < 0 || py >= H) return null
      let left = null as number | null
      let right = null as number | null
      let top = null as number | null
      let bottom = null as number | null
      for (let x = px; x >= Math.max(0, px - range); x--) if (isVLine(x)) { left = x; break }
      for (let x = px; x < Math.min(W, px + range); x++) if (isVLine(x)) { right = x; break }
      for (let y = py; y >= Math.max(0, py - range); y--) if (isHLine(y)) { top = y; break }
      for (let y = py; y < Math.min(H, py + range); y++) if (isHLine(y)) { bottom = y; break }
      if (left == null || right == null || top == null || bottom == null) return null
      if (right - left < 8 || bottom - top < 8) return null
      return { left, top, right, bottom }
    }

    // 테두리에 닿지 않았으면 후보 없음 = 놓아도 그대로(취소)
    const vHits: number[] = []
    const hHits: number[] = []
    for (let x = x0; x <= x1; x++) if (isVLine(x)) vHits.push(x)
    for (let y = y0; y <= y1; y++) if (isHLine(y)) hHits.push(y)
    if (!vHits.length && !hHits.length) return NO_SNAP

    const cx = (x0 + x1) >> 1
    const cy = (y0 + y1) >> 1
    const primary = cellAt(cx, cy)

    // 닿은 선 건너편 — 중심에서 먼 쪽으로 3px 넘어간 지점
    const alt: Cell[] = []
    const OVER = 3
    for (const x of [vHits[0], vHits[vHits.length - 1]]) {
      const c = cellAt(x < cx ? x - OVER : x + OVER, cy)
      if (c) alt.push(c)
    }
    for (const y of [hHits[0], hHits[hHits.length - 1]]) {
      const c = cellAt(cx, y < cy ? y - OVER : y + OVER)
      if (c) alt.push(c)
    }

    const pad = 1
    const toRect = (c: Cell) => [
      (c.left + pad) / W,
      (c.top + pad) / H,
      (c.right - c.left - pad * 2) / W,
      (c.bottom - c.top - pad * 2) / H
    ]
    const key = (c: Cell) => `${c.left},${c.top},${c.right},${c.bottom}`
    const seen = new Set(primary ? [key(primary)] : [])
    const others: number[][] = []
    for (const c of alt) {
      if (seen.has(key(c))) continue
      seen.add(key(c))
      others.push(toRect(c))
    }
    return { primary: primary ? toRect(primary) : null, others }
  }

  const ZOOM_MIN = 0.5
  const ZOOM_MAX = 4
  const setZoom = (z: number) => (zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)))

  /** ⌘/Ctrl + 휠 = 확대·축소 (일반 휠은 그대로 스크롤) */
  function onWheel(e: WheelEvent) {
    if (!(e.metaKey || e.ctrlKey)) return
    e.preventDefault()
    setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))
  }

  /** 확대해 놓으면 목표가 화면 밖에 있다 — 가장자리에 닿으면 따라 스크롤한다 */
  function autoScroll(e: PointerEvent) {
    if (!scrollerEl) return
    const b = scrollerEl.getBoundingClientRect()
    const EDGE = 24
    const STEP = 12
    if (e.clientY < b.top + EDGE) scrollerEl.scrollTop -= STEP
    else if (e.clientY > b.bottom - EDGE) scrollerEl.scrollTop += STEP
    if (e.clientX < b.left + EDGE) scrollerEl.scrollLeft -= STEP
    else if (e.clientX > b.right - EDGE) scrollerEl.scrollLeft += STEP
  }

  const overlayPoint = (e: PointerEvent, pg: number) => {
    const b = overlayOf(pg)!.getBoundingClientRect()
    return { x: clamp((e.clientX - b.left) / b.width, 0, 1), y: clamp((e.clientY - b.top) / b.height, 0, 1) }
  }

  function startBand(e: PointerEvent, pg: number) {
    if (e.target !== overlayOf(pg)) return // 상자 위에서 시작한 건 드래그다
    const p = overlayPoint(e, pg)
    banding = { ...p, pg }
    bandPage = pg
    band = [p.x, p.y, 0, 0]
    if (!e.shiftKey) selectedIds = []
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
  }

  function moveBand(e: PointerEvent, pg: number) {
    if (!banding || banding.pg !== pg) return
    autoScroll(e)
    const p = overlayPoint(e, pg)
    band = [
      Math.min(banding.x, p.x),
      Math.min(banding.y, p.y),
      Math.abs(p.x - banding.x),
      Math.abs(p.y - banding.y)
    ]
  }

  function endBand(boxes: any[], pg: number) {
    if (!banding || banding.pg !== pg || !band) return
    const [bx, by, bw, bh] = band
    const hit = boxes
      .filter((el) => {
        const [x, y, w, h] = el.rect
        return x < bx + bw && x + w > bx && y < by + bh && y + h > by
      })
      .map((el) => el.id)
    if (hit.length) selectedIds = [...new Set([...selectedIds, ...hit])]
    banding = null
    band = null
    bandPage = null
  }

  function selectElement(el: any, additive = false) {
    selectedIds = additive
      ? isPicked(el.id)
        ? selectedIds.filter((id) => id !== el.id)
        : [...selectedIds, el.id]
      : [el.id]
    const key = (el.field_refs ?? [])[0] ?? null
    activeFieldKey = key
    if (key)
      document
        .querySelector(`[data-fk="${CSS.escape(key)}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  // 테두리를 잡으면 그 변만 늘린다 — 별도 핸들 없이 상자 자체가 조작면이다.
  // ⌘ 를 누른 동안은 언제나 이동(칸 맞춤 모드)이라 테두리를 잡아도 끌려가지 않는다.
  const MIN_SIZE = 0.005
  const EDGE_SNAP_REACH = 0.02 // 변에서 이 거리(가로 폭 비율) 안의 괘선만 인접
  type Edges = { l: boolean; r: boolean; t: boolean; b: boolean }
  const NO_EDGE: Edges = { l: false, r: false, t: false, b: false }
  const isResize = (g: Edges) => g.l || g.r || g.t || g.b

  function edgeZone(e: PointerEvent, target: HTMLElement): Edges {
    const b = target.getBoundingClientRect()
    const gx = Math.min(6, b.width / 3)
    const gy = Math.min(6, b.height / 3)
    return {
      l: e.clientX - b.left <= gx,
      r: b.right - e.clientX <= gx,
      t: e.clientY - b.top <= gy,
      b: b.bottom - e.clientY <= gy
    }
  }

  function edgeCursor(g: Edges): string {
    if ((g.l && g.t) || (g.r && g.b)) return 'nwse-resize'
    if ((g.r && g.t) || (g.l && g.b)) return 'nesw-resize'
    if (g.l || g.r) return 'ew-resize'
    if (g.t || g.b) return 'ns-resize'
    return 'move'
  }

  function startDrag(e: PointerEvent, el: any, boxes: any[]) {
    const overlay = overlayOf(pageOf(el))
    if (!overlay) return
    // 이미 선택된 것을 잡으면 선택을 유지한다 — 그래야 여럿을 함께 옮긴다
    if (e.shiftKey) selectElement(el, true)
    else if (!isPicked(el.id)) selectElement(el)

    const chosen = boxes.filter((b) => isPicked(b.id))
    // 여럿을 잡았으면 크기 조절은 하지 않는다 — 함께 옮기기만
    const edges = chosen.length === 1 ? edgeZone(e, e.currentTarget as HTMLElement) : NO_EDGE
    const box = overlay.getBoundingClientRect()
    editing = {
      items: chosen.map((b) => ({ el: b, rect: [...b.rect] })),
      edges,
      x0: e.clientX,
      y0: e.clientY,
      w: box.width,
      h: box.height
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    e.preventDefault()
    e.stopPropagation()
    lastProbe = [e.clientX, e.clientY]
    snapPage = pageOf(el)
    snapPreview =
      wantsSnap(e) && chosen.length === 1 ? snapCandidates(el.rect, pageOf(el)) : NO_SNAP
  }

  let lastProbe: [number, number] = [0, 0]
  function onDrag(e: PointerEvent) {
    if (!editing) {
      // 잡기 전에 무엇이 될지 커서로 알린다
      const target = e.currentTarget as HTMLElement
      target.style.cursor = edgeCursor(edgeZone(e, target))
      return
    }
    autoScroll(e)
    const dx = (e.clientX - editing.x0) / editing.w
    const dy = (e.clientY - editing.y0) / editing.h
    const g = editing.edges
    const single = editing.items.length === 1

    if (single && isResize(g)) {
      const { el, rect } = editing.items[0]
      const [x, y, w, h] = rect
      let nx = x
      let ny = y
      let nw = w
      let nh = h
      if (g.l) {
        nx = clamp(x + dx, 0, x + w - MIN_SIZE)
        nw = w + (x - nx)
      } else if (g.r) {
        nw = clamp(w + dx, MIN_SIZE, 1 - x)
      }
      if (g.t) {
        ny = clamp(y + dy, 0, y + h - MIN_SIZE)
        nh = h + (y - ny)
      } else if (g.b) {
        nh = clamp(h + dy, MIN_SIZE, 1 - y)
      }
      el.rect = [nx, ny, nw, nh]
      // ⌘ 를 누르고 있으면 잡은 변을 인접 괘선에 붙인다
      const fit = wantsSnap(e) ? snapEdges(el.rect, g, pageOf(el)) : null
      snapPage = pageOf(el)
      snapPreview = fit ? { primary: fit, others: [] } : NO_SNAP
      return
    }

    for (const { el, rect } of editing.items) {
      const [x, y, w, h] = rect
      el.rect = [clamp(x + dx, 0, 1 - w), clamp(y + dy, 0, 1 - h), w, h]
    }

    // 칸 맞춤은 하나만 잡았을 때 — 여럿을 한 칸에 욱여넣는 건 뜻이 없다
    if (!wantsSnap(e) || !single) {
      snapPreview = NO_SNAP
      return
    }
    // 매 픽셀마다 훑을 필요는 없다 — 2px 이동마다.
    // 두 축을 다 본다: 한 축만 보면 수직 드래그에서 미리보기가 갱신되지 않아
    // 놓을 때 낡은 칸이 적용된다(실측).
    if (Math.abs(e.clientX - lastProbe[0]) + Math.abs(e.clientY - lastProbe[1]) < 2) return
    lastProbe = [e.clientX, e.clientY]
    snapPage = pageOf(editing.items[0].el)
    snapPreview = snapCandidates(editing.items[0].el.rect, pageOf(editing.items[0].el))
  }

  function endDrag(e: PointerEvent) {
    // ⌘ 를 누른 채 테두리에 붙였으면 그 칸으로 확정, 아니면 놓은 자리 그대로
    if (editing && wantsSnap(e) && snapPreview.primary && editing.items.length === 1)
      editing.items[0].el.rect = snapPreview.primary
    snapPreview = NO_SNAP
    editing = null
  }

  const NUDGE: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1]
  }

  function nudge(e: KeyboardEvent, el: any) {
    const d = NUDGE[e.key]
    if (!d) return
    e.preventDefault()
    const step = (e.shiftKey ? 0.01 : 0.002) // Shift = 5배 — 거친 이동
    const [x, y, w, h] = el.rect
    el.rect = [clamp(x + d[0] * step, 0, 1 - w), clamp(y + d[1] * step, 0, 1 - h), w, h]
  }

  /** 캔버스에서 고른 박스가 가리키는 필드들 — 목록에서 그 행을 진하게 표시한다 */
  const pickedFieldKeys = $derived.by(() => {
    const job = selected ? schemaJobs[selected.page] : undefined
    return new Set(
      elementBoxes(job)
        .filter((e) => selectedIds.includes(e.id))
        .flatMap((e) => (e.field_refs ?? []) as string[])
    )
  })

  /** 이 필드를 가리키는 첫 위젯 — 목록에서 캔버스로 건너뛴다 */
  function focusFieldBox(fpage: number, key: string) {
    const el = elementBoxes(schemaJobs[fpage]).find((e) => (e.field_refs ?? []).includes(key))
    if (el) selectedIds = [el.id]
    activeFieldKey = key
  }

  let selectedForm = $state<string | null>(null)
  const selected = $derived(formPages.find((f) => f.id === selectedForm) ?? formPages[0] ?? null)
  const proxied = (id: string | null) => {
    const u = id ? artifactUrlById.get(id) : null
    return u ? `/api/file-proxy?url=${encodeURIComponent(u)}` : null
  }

  /** 캔버스에 깔 쪽들 — 스키마 pages[].no(1..N)가 서식 구간의 쪽 순서와 같다.
   *  스키마가 아직 없으면 원본 png 만으로 쪽을 세운다(추출 전에도 문서는 보인다). */
  const canvasPages = $derived.by(() => {
    const src = selected?.pages ?? []
    const schemaPages = (schemaJobs[selected?.page ?? -1]?.schema as any)?.pages
    // 상자가 붙는 쪽은 스키마가 정본 — 원본 png 는 같은 순서로 짝짓는다.
    // 스키마 쪽이 더 많으면(구간을 좁게 잡은 경우) 그 쪽은 배경 없이 흰 종이로 그린다.
    const list = Array.isArray(schemaPages) && schemaPages.length ? schemaPages : null
    if (!list) return src.map((pg, i) => ({ no: i + 1, url: proxied(pg.id), ratio: 0 }))
    return list.map((pg: any, i: number) => ({
      no: Number(pg?.no ?? i + 1),
      url: proxied(src[i]?.id ?? null),
      ratio: pg?.w && pg?.h ? pg.h / pg.w : 0
    }))
  })
  const proxiedFormUrl = $derived(canvasPages[0]?.url ?? null)
</script>

<div in:fade class="flex h-full flex-col p-6">
  <div class="mb-4 flex shrink-0 items-center justify-between gap-4">
    <button
      class="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      onclick={() => goto(`/voucher-extraction/${extractionId}`)}
    >
      ← 추출 상세
    </button>

    <!-- 바우처 전환 레일 -->
    {#if forms.length > 0}
      <div class="flex items-center gap-1">
        <button
          class="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-500 disabled:opacity-40 hover:border-gray-300"
          disabled={index <= 0}
          onclick={() => move(-1)}
          aria-label="이전 바우처"
        >
          ◀
        </button>
        <span class="min-w-[92px] text-center font-mono text-xs text-gray-500">
          {index + 1} / {forms.length}
        </span>
        <button
          class="rounded-md border border-gray-200 px-2 py-1 text-sm text-gray-500 disabled:opacity-40 hover:border-gray-300"
          disabled={index >= forms.length - 1}
          onclick={() => move(1)}
          aria-label="다음 바우처"
        >
          ▶
        </button>

        <Button
          size="md"
          color="primary"
          content={isConfirming ? '확정 중…' : '이 바우처 확정'}
          disabled={isConfirming || !form}
          onclick={handleConfirm}
        />
      </div>
    {/if}
  </div>

  {#if isLoading}
    <div class="section-border flex items-center justify-center py-16">
      <Typography variant="body-03-normal-regular" color="text-gray-400">
        불러오는 중...
      </Typography>
    </div>
  {:else if !form}
    <div class="section-border py-16 text-center">
      <Typography variant="body-03-normal-regular" color="text-gray-400">
        해당 순번의 바우처가 없습니다
      </Typography>
    </div>
  {:else}
    <!-- 바우처 헤더 -->
    <div class="mb-4">
      <div class="flex flex-wrap items-center gap-2">
        <Typography variant="body-01-normal-bold" color="text-gray-900">
          {form.name || '(이름 없음)'}
        </Typography>
        {#if form.page_range}
          <span class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-500">
            p.{form.page_range[0]}{form.page_range[1] !== form.page_range[0]
              ? `–${form.page_range[1]}`
              : ''}
          </span>
        {/if}
      </div>
    </div>

    <!-- 탭 -->
    <div class="mb-4 flex shrink-0 gap-1 border-b border-gray-200">
      {#each TABS as t (t.id)}
        <button
          class="-mb-px border-b-2 px-3 py-2 text-sm transition-colors {tab === t.id
            ? 'border-primary-500 font-medium text-primary-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'}"
          onclick={() => (tab = t.id)}
        >
          {t.label}
          {#if t.id === 'forms' && formPages.length > 0}
            <span class="ml-1 font-mono text-[11px] text-gray-400">{formPages.length}</span>
          {/if}
        </button>
      {/each}
    </div>

    <!-- 좌(문서)·우(항목) 각자 스크롤 — 가운데 바로 비율을 바꾼다 -->
    <SplitPane>
      {#snippet left()}
      <div class="flex min-h-0 flex-1 flex-col">
        {#if tab === 'forms' && proxiedFormUrl}
          {@const boxes = elementBoxes(selected ? schemaJobs[selected.page] : undefined)}
          <div class="mb-1.5 flex shrink-0 items-center gap-1 text-xs text-gray-500">
            <button
              class="h-6 w-6 rounded border border-gray-200 hover:border-primary-300 hover:text-primary-600"
              aria-label="축소"
              onclick={() => setZoom(zoom / 1.25)}>−</button
            >
            <span class="w-11 text-center font-mono text-[11px] tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              class="h-6 w-6 rounded border border-gray-200 hover:border-primary-300 hover:text-primary-600"
              aria-label="확대"
              onclick={() => setZoom(zoom * 1.25)}>+</button
            >
            <button
              class="ml-1 rounded border border-gray-200 px-1.5 py-0.5 hover:border-primary-300 hover:text-primary-600"
              onclick={() => setZoom(1)}>폭 맞춤</button
            >
            {#if selectedIds.length > 1}
              <span class="ml-2 text-primary-600">{selectedIds.length}개 선택됨</span>
            {/if}
          </div>
          <div
            class="min-h-0 flex-1 space-y-3 overflow-auto rounded-lg border border-gray-200 bg-white"
            bind:this={scrollerEl}
            onwheel={onWheel}
          >
            {#each canvasPages as cp (cp.no)}
              <div
                class="relative select-none"
                style="width:{zoom * 100}%"
                bind:this={overlayEls[cp.no]}
                role="application"
                aria-label="서식 {cp.no}쪽 입력칸 편집 캔버스"
                onpointerdown={(e) => startBand(e, cp.no)}
                onpointermove={(e) => moveBand(e, cp.no)}
                onpointerup={() => endBand(boxes, cp.no)}
                onpointercancel={() => endBand(boxes, cp.no)}
              >
                {#if cp.url}
                  <img
                    src={cp.url}
                    alt="서식 {cp.no}쪽"
                    class="pointer-events-none block w-full"
                    draggable="false"
                    onload={(e) => buildInkMap(e.currentTarget as HTMLImageElement, cp.no)}
                  />
                {:else}
                  <div
                    class="w-full bg-white"
                    style="aspect-ratio:1/{cp.ratio || 1.414}"
                  ></div>
                {/if}
                {#if band && bandPage === cp.no}
                  <div
                    class="pointer-events-none absolute z-30 border border-primary-500 bg-primary-500/10"
                    style="left:{band[0] * 100}%; top:{band[1] * 100}%; width:{band[2] *
                      100}%; height:{band[3] * 100}%"
                  ></div>
                {/if}
                {#if snapPage === cp.no}
                  {#each snapPreview.others as r, i (i)}
                    <div
                      class="pointer-events-none absolute rounded-[2px] border border-dashed border-gray-400 bg-gray-400/10"
                      style="left:{r[0] * 100}%; top:{r[1] * 100}%; width:{r[2] *
                        100}%; height:{r[3] * 100}%"
                    ></div>
                  {/each}
                  {#if snapPreview.primary}
                    {@const r = snapPreview.primary}
                    <div
                      class="pointer-events-none absolute z-20 rounded-[2px] border-2 border-dashed border-emerald-500 bg-emerald-400/20"
                      style="left:{r[0] * 100}%; top:{r[1] * 100}%; width:{r[2] *
                        100}%; height:{r[3] * 100}%"
                    ></div>
                  {/if}
                {/if}
                {#each boxes.filter((el) => pageOf(el) === cp.no) as el (el.id)}
                  {@const on =
                    activeFieldKey != null && (el.field_refs ?? []).includes(activeFieldKey)}
                  {@const picked = isPicked(el.id)}
                  <div
                    class="absolute touch-none rounded-[2px] border transition-colors hover:bg-primary-500/20 {picked
                      ? 'z-10 border-primary-600 bg-primary-500/25 ring-2 ring-primary-300'
                      : on
                        ? 'border-primary-500 bg-primary-500/25'
                        : (el.field_refs ?? []).length
                          ? 'border-primary-400/70 bg-primary-400/10'
                          : 'border-gray-300/70 bg-gray-300/10'}"
                    style="left:{el.rect[0] * 100}%; top:{el.rect[1] * 100}%; width:{el.rect[2] *
                      100}%; height:{el.rect[3] * 100}%"
                    role="button"
                    tabindex="0"
                    aria-label="{(el.field_refs ?? [])[0] ?? el.id} 위치 조정"
                    onpointerdown={(e) => startDrag(e, el, boxes)}
                    onpointermove={onDrag}
                    onpointerup={endDrag}
                    onpointercancel={endDrag}
                    onkeydown={(e) => nudge(e, el)}
                  ></div>
                {/each}
              </div>
            {/each}
          </div>
        {:else if proxiedPdfUrl}
          <div class="min-h-0 flex-1">
            <PdfHighlightViewer
              url={proxiedPdfUrl}
              page={viewerPage}
              query={viewerQuery}
              maxHeight="100%"
            />
          </div>
          <p class="mt-1.5 shrink-0 text-xs text-gray-400">
            항목의 출처 칩을 누르면 해당 페이지로 이동해 근거를 하이라이트합니다.
          </p>
        {:else}
          <div
            class="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/40 px-6 text-center text-sm text-gray-400"
          >
            원본 PDF가 없습니다 (HWPX 등은 미리보기를 지원하지 않습니다).
          </div>
        {/if}
      </div>
      {/snippet}

      {#snippet right()}
      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto pl-1">
        {#if tab === 'fields'}
          {#if missing.length}
            <div class="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
              <div class="text-xs font-semibold text-red-700">
                {missing.join(' · ')} 이(가) 비어 확정할 수 없습니다
              </div>
              <p class="mt-1 text-xs text-red-600">
                기관·연도는 문서 공통 정보에서 자동으로 채웁니다. 이 문서는 추출하지 못해
                비어 있으니 직접 입력하세요.
              </p>
            </div>
          {/if}

          <div class="section-border space-y-10 p-5">
            <FieldRow
              label="사업/서비스명"
              required
              source={form.paths.name}
              active={activeKey === 'name'}
              onSource={() => focusField('name')}
            >
              <input
                type="text"
                bind:value={forms[index].name}
                onfocus={() => focusField('name')}
                maxlength={255}
                class="{inputCls} font-medium"
              />
            </FieldRow>

            {#each FIELDS_MAIN as field (field.key)}
              <FieldRow
                label={field.label}
                required={field.required}
                source={form.paths[field.key]}
                active={activeKey === field.key}
                onSource={() => focusField(field.key)}
              >
                {#if field.kind === 'textarea'}
                  <textarea
                    rows={2}
                    value={forms[index][field.key]}
                    oninput={(e) => (forms[index][field.key] = e.currentTarget.value)}
                    onfocus={() => focusField(field.key)}
                    class="{inputCls} field-sizing-content resize-none"
                  ></textarea>
                {:else}
                  <input
                    type={field.type ?? 'text'}
                    value={forms[index][field.key]}
                    oninput={(e) => (forms[index][field.key] = e.currentTarget.value)}
                    onfocus={() => focusField(field.key)}
                    class="{inputCls} {field.required && !String(forms[index][field.key]).trim()
                      ? 'border-red-300 bg-red-50/40'
                      : ''}"
                  />
                {/if}
              </FieldRow>
            {/each}
          </div>

          <VoucherRecordEditor
            record={forms[index].record}
            onSource={(p, q) => {
              viewerPage = pageNum(p)
              viewerQuery = q
              activeKey = null
            }}
          />
        {:else}
          <!-- 서식 페이지 목록 -->
          {#if formPages.length === 0}
            <div
              class="section-border px-6 py-12 text-center text-sm text-gray-400"
            >
              이 바우처 구간에서 감지된 서식 페이지가 없습니다.
              <br />
              <span class="text-xs">
                서식이 문서 뒤 부록에 모여 있으면 목록 화면의 “문서 공용 서식”에 잡힙니다.
              </span>
            </div>
          {:else}
            <div class="section-border p-4">
              <Typography variant="caption-01-normal-bold" color="text-gray-600">
                감지된 서식 {formPages.length}건
              </Typography>
              <div class="mt-3 space-y-1.5">
                {#each formPages as fp (fp.page)}
                  {@const job = schemaJobs[fp.page]}
                  <div
                    class="rounded-lg border transition-colors {selected?.id === fp.id
                      ? 'border-primary-300 bg-primary-50/40'
                      : 'border-gray-200 hover:border-gray-300'}"
                  >
                    <button
                      type="button"
                      class="flex w-full items-center gap-2 px-3 py-2 text-left"
                      onclick={() => {
                        selectedForm = fp.id
                        viewerPage = fp.page
                      }}
                    >
                      <span class="font-mono text-[11px] text-gray-400">p.{fp.page}</span>
                      <span class="min-w-0 flex-1 truncate text-sm text-gray-800">
                        {fp.title || '서식'}
                      </span>

                      {#if job?.templateName}
                        <span class="shrink-0 rounded bg-green-50 px-1.5 py-0.5 text-[11px] text-green-700">
                          템플릿 {job.templateName}
                        </span>
                      {:else if job?.status === 'processing'}
                        <span class="shrink-0 text-[11px] text-blue-500">스키마 추출 중…</span>
                      {:else if job?.status === 'failed'}
                        <span class="shrink-0 text-[11px] text-red-500" title={job.failed}>추출 실패</span>
                      {/if}
                    </button>

                    <div class="flex items-center gap-1.5 border-t border-gray-100 px-3 py-1.5">
                      <!-- 추출 버튼은 늘 자리를 지킨다 — 돌아가는 중엔 비활성으로 남아
                           "무엇이 진행 중인지"와 "다시 누를 수 없음"을 한 자리에서 보인다.
                           끝난 뒤에도 재추출은 열어 둔다(결과가 마음에 안 들 수 있으므로). -->
                      <button
                        type="button"
                        class="rounded border border-gray-200 px-2 py-0.5 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-50 {job?.status ===
                        'processing'
                          ? 'text-gray-400'
                          : 'text-gray-600 hover:border-primary-300 hover:text-primary-600'}"
                        disabled={job?.status === 'processing'}
                        onclick={() => startSchemaExtract(fp.page, fp.title)}
                      >
                        {job?.status === 'processing'
                          ? '추출 중…'
                          : job
                            ? '다시 추출'
                            : '스키마 추출'}
                      </button>

                      {#if job?.status === 'completed' && !job.templateName}
                        <button
                          type="button"
                          class="rounded bg-primary-500 px-2 py-0.5 text-[11px] text-white hover:bg-primary-600"
                          onclick={() => confirmSchema(fp.page, fp.title)}
                        >
                          템플릿으로 확정
                        </button>
                      {/if}

                      <span class="text-[10px] text-gray-400">
                        {#if job?.status === 'completed'}
                          필드 {Object.keys((job.schema as any)?.fields ?? {}).length}개 추출됨
                        {:else if job?.status === 'failed'}
                          <span class="text-red-500">{job.failed ?? '추출 실패'}</span>
                        {:else if job?.status !== 'processing'}
                          입력칸 좌표·유형을 추출해 서식 템플릿으로 만듭니다
                        {/if}
                      </span>
                    </div>
                  </div>
                {/each}
              </div>
            </div>

            <!-- 추출된 스키마 — 확정 전에 여기서 직접 고친다(우측 PNG 위 박스와 연동) -->
            {@const activeJob = selected ? schemaJobs[selected.page] : undefined}
            <div class="section-border p-4">
              <div class="mb-2 flex items-center justify-between">
                <Typography variant="caption-01-normal-bold" color="text-gray-600">
                  인식된 입력칸
                  {#if activeJob?.status === 'completed'}
                    <span class="ml-1 font-mono text-[11px] text-gray-400">
                      {fieldRows(activeJob).length}
                    </span>
                  {/if}
                </Typography>
                {#if activeJob?.status === 'completed'}
                  <span class="text-[10px] text-gray-400">라벨·유형을 고치면 확정에 반영됩니다</span>
                {/if}
              </div>

              {#if !activeJob}
                <div class="rounded-lg border border-dashed border-gray-200 bg-gray-50/40 px-4 py-10 text-center text-sm text-gray-400">
                  위 목록에서 서식을 고르고 <b>스키마 추출</b>을 누르면 인식된 입력칸이 여기 나옵니다.
                </div>
              {:else if activeJob.status === 'processing'}
                <div class="rounded-lg border border-dashed border-gray-200 bg-gray-50/40 px-4 py-10 text-center text-sm text-gray-400">
                  입력칸을 읽는 중…
                </div>
              {:else if activeJob.status === 'failed'}
                <div class="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-600">
                  {activeJob.failed ?? '추출 실패'}
                </div>
              {:else}
                <div class="divide-y divide-gray-100">
                  {#each fieldRows(activeJob) as [key, f] (key)}
                    {@const picked = pickedFieldKeys.has(key)}
                    <div
                      class="space-y-1.5 border-l-2 py-2 pl-2 transition-colors {picked
                        ? 'border-primary-500 bg-primary-50'
                        : activeFieldKey === key
                          ? 'border-primary-200 bg-primary-50/40'
                          : 'border-transparent'}"
                      data-fk={key}
                      onfocusin={() => focusFieldBox(selected!.page, key)}
                      onmouseenter={() => (activeFieldKey = key)}
                      role="group"
                    >
                      <div class="flex items-center gap-2">
                        {#if picked}
                          <span
                            class="-ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500"
                            aria-label="캔버스에서 선택됨"
                          ></span>
                        {/if}
                        <input
                          type="text"
                          value={f.label ?? ''}
                          oninput={(e) =>
                            setFieldProp(selected!.page, key, 'label', e.currentTarget.value)}
                          placeholder="칸 이름"
                          class="{inputCls} py-1.5 text-sm {picked
                            ? 'border-primary-400 bg-white'
                            : ''}"
                        />
                        <button
                          type="button"
                          class="w-5 shrink-0 text-gray-300 hover:text-red-500"
                          aria-label="이 입력칸 삭제"
                          onclick={() => removeField(selected!.page, key)}
                        >
                          ×
                        </button>
                      </div>
                      <div class="flex items-center gap-2 text-[11px] text-gray-400">
                        <select
                          value={f.type ?? 'text'}
                          onchange={(e) =>
                            setFieldProp(selected!.page, key, 'type', e.currentTarget.value)}
                          class="rounded-md border border-gray-200 px-1.5 py-1 text-[11px] outline-none focus:border-primary-400"
                        >
                          {#each FIELD_TYPES as ty (ty)}
                            <option value={ty}>{ty}</option>
                          {/each}
                        </select>
                        <label class="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={!!f.required}
                            onchange={(e) =>
                              setFieldProp(selected!.page, key, 'required', e.currentTarget.checked)}
                            class="h-3 w-3"
                          />
                          필수
                        </label>
                        {#if Array.isArray(f.options) && f.options.length}
                          <span class="truncate">선택지 {f.options.length}</span>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
      {/snippet}
    </SplitPane>
  {/if}
</div>
