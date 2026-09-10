<script lang="ts">
  import SplitPane from '$lib/features/voucher/components/SplitPane.svelte'
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { fade } from 'svelte/transition'
  import { useQueryClient } from '@tanstack/svelte-query'

  import Typography from '$components/Typography.svelte'
  import Button from '$components/Button.svelte'
  import PdfHighlightViewer from '$lib/features/voucher/components/PdfHighlightViewer.svelte'
  import { pageNum } from '$lib/features/voucher/confirm-candidates'
  import { queryBuilder } from '$hooks/queries/builder'
  import {
    getVoucherExtractionDetail,
    confirmVoucherLayout,
    type VoucherExtractionDetailResponse
  } from '$hooks/actions/voucher-extraction.action'
  import { showErrorMessage, showErrorSnackbar, showSuccessSnackbar } from '$utils/errorHandler'

  // 1단계 확정 화면 — 감지된 바우처 영역·서식 쪽을 검토/수정해 확정한다.
  // 확정본이 2단계(내용 추출)의 정본: 추출은 여기서 정한 영역만 돈다.
  // 서식은 구간 단위(여러 장 = 한 서식) — 감지는 쪽 단위라 연속 쪽을 묶어 제안한다.

  const extractionId = $derived(page.params.extractionId!)
  const queryClient = useQueryClient()

  const detailQuery = $derived(
    queryBuilder<any, any>(getVoucherExtractionDetail, () => ({ extractionId }))
  )
  const detail = $derived<VoucherExtractionDetailResponse | null>(
    detailQuery.data ?? null
  )
  const isLoading = $derived(detailQuery.isPending)

  interface SpanRow {
    name: string
    code: string
    start_page: number | null
    end_page: number | null
  }
  interface FormRow {
    title: string
    kind: string
    /** 소속 — 이 확정이 정본. 감지가 제안하고 사람이 고친다 */
    scope: 'voucher' | 'common' | 'unknown'
    voucher_names: string[]
    start_page: number | null
    end_page: number | null
  }

  let spans = $state<SpanRow[]>([])
  let forms = $state<FormRow[]>([])
  let built = false

  // 감지가 낸 사업명은 깨끗한 이름("아동정서발달지원서비스")인데 영역명은 앞뒤가
  // 붙어 있다("4 …(031109) / 시･군 공동서비스"). 정확일치로는 못 맞으니 정규화 후 포함으로 잇는다.
  const normName = (s: string) => (s ?? '').replace(/[\s()\/·･\-]|[0-9]/g, '')
  function resolveSpanName(detected: string, names: string[]): string | null {
    const d = normName(detected)
    if (!d) return null
    return names.find((n) => { const x = normName(n); return x && (x.includes(d) || d.includes(x)) }) ?? null
  }

  $effect(() => {
    if (built || !detail) return
    const data = (detail.progress?.data ?? {}) as any

    spans = ((data.spans ?? []) as any[]).map((s) => ({
      name: s.name ?? '',
      code: s.code ?? '',
      start_page: pageNum(s.start_page),
      end_page: pageNum(s.end_page)
    }))

    // 감지된 서식 쪽 → 연속 쪽 묶음 제안 (여러 장짜리 서식 1건으로).
    // 제목은 첫 유효 제목, 종류도 첫 값 — 틀리면 사용자가 행을 쪼개거나 고친다.
    const pages = ((data.form_pages ?? []) as any[])
      .map((f) => ({
        n: pageNum(f.page),
        title: f.title ?? '',
        kind: f.kind ?? '기타',
        scope: (f.scope ?? 'unknown') as FormRow['scope'],
        voucher_name: f.voucher_name ?? ''
      }))
      .filter((f) => f.n != null)
      .sort((a, b) => (a.n as number) - (b.n as number))
    const grouped: FormRow[] = []
    for (const f of pages) {
      const last = grouped[grouped.length - 1]
      // 제목이 바뀌면 다른 서식이다 — 이어진 쪽이라도 쪼갠다(추천서 p.9 / 소견서 p.10)
      const sameForm = last && (!f.title || !last.title || f.title === last.title)
      if (last && last.end_page === (f.n as number) - 1 && sameForm) {
        last.end_page = f.n
        if (!last.title && f.title) last.title = f.title
        // 묶인 쪽 중 하나라도 사업을 지목하면 그 소속을 단위에 올린다
        if (last.scope !== 'voucher' && f.scope === 'voucher') {
          last.scope = 'voucher'
          last.voucher_names = f.voucher_name ? [f.voucher_name] : []
        } else if (f.voucher_name && !last.voucher_names.includes(f.voucher_name)) {
          last.voucher_names.push(f.voucher_name)
        }
      } else {
        grouped.push({
          title: f.title,
          kind: f.kind,
          scope: f.scope,
          voucher_names: f.voucher_name ? [f.voucher_name] : [],
          start_page: f.n,
          end_page: f.n
        })
      }
    }
    // 감지 사업명을 실제 영역명으로 치환 — 못 맞으면 미정으로 남긴다
    const spanNames = spans.map((s) => s.name).filter(Boolean)
    for (const f of grouped) {
      const resolved = f.voucher_names
        .map((n) => resolveSpanName(n, spanNames))
        .filter((n): n is string => !!n)
      f.voucher_names = [...new Set(resolved)]
      if (f.scope === 'voucher' && f.voucher_names.length === 0) f.scope = 'unknown'
    }

    forms = grouped
    built = true
  })

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

  function goPage(n: number | null) {
    if (n != null) viewerPage = n
  }

  const invalid = $derived.by(() => {
    const out: string[] = []
    spans.forEach((s, i) => {
      if (!s.name.trim()) out.push(`영역 ${i + 1}: 이름 없음`)
      if (!s.start_page || !s.end_page || s.end_page < s.start_page)
        out.push(`영역 ${i + 1}: 쪽 범위 오류`)
    })
    forms.forEach((f, i) => {
      if (!f.start_page || !f.end_page || f.end_page < f.start_page)
        out.push(`서식 ${i + 1}: 쪽 범위 오류`)
    })
    if (spans.length === 0) out.push('영역이 최소 1개 필요합니다')
    return out
  })

  let isConfirming = $state(false)
  async function handleConfirm() {
    if (isConfirming) return
    if (invalid.length) {
      showErrorMessage(invalid[0])
      return
    }
    isConfirming = true
    try {
      await confirmVoucherLayout().request({
        extractionId,
        spans: spans.map((s) => ({
          name: s.name.trim(),
          code: s.code.trim() || null,
          start_page: s.start_page as number,
          end_page: s.end_page as number
        })),
        forms: forms.map((f) => ({
          title: f.title.trim(),
          kind: f.kind.trim() || '기타',
          scope: f.scope,
          voucher_names: f.scope === 'voucher' ? f.voucher_names.filter(Boolean) : [],
          start_page: f.start_page as number,
          end_page: f.end_page as number
        }))
      })
      showSuccessSnackbar('확정 완료 — 내용 추출을 시작합니다.')
      queryClient.invalidateQueries({ queryKey: ['getVoucherExtractionDetail'], exact: false })
      goto(`/voucher-extraction/${extractionId}`)
    } catch (e) {
      showErrorSnackbar(e)
    } finally {
      isConfirming = false
    }
  }

  const numCls =
    'w-16 rounded-md border border-gray-200 px-2 py-1.5 text-center font-mono text-xs outline-none focus:border-primary-400'
  const txtCls =
    'w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-primary-400'
  // 라벨은 폭을 맞춰 세로선을 만든다 — 행이 여러 줄이라 정렬이 없으면 흐트러진다
  const labelCls = 'w-7 shrink-0 text-[11px] text-gray-400'
  const addBtnCls =
    'shrink-0 whitespace-nowrap rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:border-primary-300 hover:text-primary-600'
  const chipCls = (on: boolean) =>
    `rounded-md border px-2 py-0.5 text-[11px] transition-colors ${
      on
        ? 'border-primary-400 bg-primary-50 text-primary-700'
        : 'border-gray-200 text-gray-500 hover:border-primary-200'
    }`
</script>

<div in:fade class="flex h-full flex-col p-6">
  <div class="mb-4 flex shrink-0 items-center justify-between gap-4">
    <button
      class="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      onclick={() => goto(`/voucher-extraction/${extractionId}`)}
    >
      ← 추출 상세
    </button>
    <Button
      size="md"
      color="primary"
      content={isConfirming ? '확정 중…' : `확정하고 추출 시작 (영역 ${spans.length} · 서식 ${forms.length})`}
      disabled={isConfirming || !detail || detail.status !== 'review'}
      onclick={handleConfirm}
    />
  </div>

  <div class="mb-4 shrink-0">
    <Typography variant="body-01-normal-bold" color="text-gray-900">영역·서식 확정</Typography>
    <Typography variant="caption-01-normal-regular" color="text-gray-500">
      감지 결과를 수정해 확정하면 이 정의대로 내용 추출(2단계)이 시작됩니다 · 쪽 번호를 누르면 그 쪽으로 이동합니다
    </Typography>
  </div>

  {#if isLoading}
    <div class="section-border flex items-center justify-center py-16">
      <Typography variant="body-03-normal-regular" color="text-gray-400">불러오는 중...</Typography>
    </div>
  {:else if !detail}
    <div class="section-border py-16 text-center">
      <Typography variant="body-03-normal-regular" color="text-gray-400">
        추출 작업을 찾을 수 없습니다
      </Typography>
    </div>
  {:else if detail.status !== 'review'}
    <div class="section-border py-16 text-center">
      <Typography variant="body-03-normal-regular" color="text-gray-400">
        영역 확정 대기 상태가 아닙니다 (현재: {detail.status})
      </Typography>
    </div>
  {:else}
    <SplitPane>
      {#snippet left()}
        <!-- 좌: 원본 PDF -->
        <div class="flex min-h-0 flex-1 flex-col">
        {#if proxiedPdfUrl}
          <div class="min-h-0 flex-1">
            <PdfHighlightViewer url={proxiedPdfUrl} page={viewerPage} query={null} maxHeight="100%" />
          </div>
        {:else}
          <div
            class="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50/40 px-6 text-center text-sm text-gray-400"
          >
            원본 PDF가 없습니다
          </div>
        {/if}
        </div>
      {/snippet}

      {#snippet right()}
        <!-- 우: 영역·서식 편집 -->
        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto pl-1">
        <div class="section-border p-4">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <Typography variant="body-02-normal-semibold" color="text-gray-900">
                바우처 영역
              </Typography>
              <span class="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-600">
                {spans.length}
              </span>
            </div>
            <button
              type="button"
              class={addBtnCls}
              onclick={() => spans.push({ name: '', code: '', start_page: null, end_page: null })}
            >
              ＋ 영역 추가
            </button>
          </div>

          {#each spans as s, i (i)}
            <!-- 행을 만지면(포커스 포함) 뷰어가 그 영역 첫 쪽으로 — 이름은 전폭으로 다 보이게 -->
            <div
              class="space-y-1.5 border-b border-gray-50 px-1 py-2"
              onfocusin={() => goPage(s.start_page)}
              onclick={() => goPage(s.start_page)}
              role="group"
            >
              <div class="flex items-center gap-2">
                <span class="w-5 shrink-0 font-mono text-[11px] text-gray-300">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <input type="text" bind:value={s.name} placeholder="사업/서비스명" class={txtCls} />
                <button
                  type="button"
                  class="w-5 shrink-0 text-gray-300 hover:text-red-500"
                  aria-label="이 영역 삭제"
                  onclick={(e) => { e.stopPropagation(); spans.splice(i, 1) }}
                >
                  ×
                </button>
              </div>
              <div class="flex items-center gap-2 pl-7 text-[11px] text-gray-400">
                <span class={labelCls}>코드</span>
                <input type="text" bind:value={s.code} placeholder="—" class="{numCls} w-24" />
                <span class="ml-1 {labelCls}">쪽</span>
                <input type="number" min="1" bind:value={s.start_page} class={numCls} />
                <span>~</span>
                <input type="number" min="1" bind:value={s.end_page}
                       onfocus={() => goPage(s.end_page)} class={numCls} />
              </div>
            </div>
          {/each}
        </div>

        <div class="section-border p-4">
          <div class="mb-1 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <Typography variant="body-02-normal-semibold" color="text-gray-900">
                서식
              </Typography>
              <span class="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-600">
                {forms.length}
              </span>
            </div>
            <button
              type="button"
              class="rounded-md border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:border-primary-300 hover:text-primary-600"
              onclick={() =>
                forms.push({
                  title: '',
                  kind: '기타',
                  scope: 'unknown',
                  voucher_names: [],
                  start_page: null,
                  end_page: null
                })}
            >
              ＋ 서식 추가
            </button>
          </div>
          <p class="mb-3 text-[11px] text-gray-400">
            여러 장짜리 서식은 시작~끝 쪽을 한 행으로 · 소속은 감지 제안이며 여기서 고칩니다
          </p>

          {#each forms as f, i (i)}
            <div
              class="space-y-1.5 border-b border-gray-50 px-1 py-2"
              onfocusin={() => goPage(f.start_page)}
              onclick={() => goPage(f.start_page)}
              role="group"
            >
              <div class="flex items-center gap-2">
                <span class="w-5 shrink-0 font-mono text-[11px] text-gray-300">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <input type="text" bind:value={f.title} placeholder="서식 제목" class={txtCls} />
                <button
                  type="button"
                  class="w-5 shrink-0 text-gray-300 hover:text-red-500"
                  aria-label="이 서식 삭제"
                  onclick={(e) => { e.stopPropagation(); forms.splice(i, 1) }}
                >
                  ×
                </button>
              </div>
              <div class="flex items-center gap-2 pl-7 text-[11px] text-gray-400">
                <span class={labelCls}>쪽</span>
                <input type="number" min="1" bind:value={f.start_page} class={numCls} />
                <span>~</span>
                <input type="number" min="1" bind:value={f.end_page}
                       onfocus={() => goPage(f.end_page)} class={numCls} />
              </div>
              <!-- 소속 = 공용 + 바우처들을 한 줄 선택지로. 공용은 배타, 바우처는 복수 선택 -->
              <div class="flex items-start gap-2 pl-7">
                <span class="{labelCls} pt-1">소속</span>
                <div class="flex flex-wrap gap-1">
                  <button
                    type="button"
                    class={chipCls(f.scope === 'common')}
                    onclick={(e) => {
                      e.stopPropagation()
                      f.scope = f.scope === 'common' ? 'unknown' : 'common'
                      f.voucher_names = []
                    }}
                  >
                    {f.scope === 'common' ? '✓ ' : ''}공용
                  </button>
                  {#each spans.filter((s) => s.name.trim()) as s (s.name)}
                    {@const on = f.scope === 'voucher' && f.voucher_names.includes(s.name)}
                    <button
                      type="button"
                      class={chipCls(on)}
                      onclick={(e) => {
                        e.stopPropagation()
                        const names = on
                          ? f.voucher_names.filter((n) => n !== s.name)
                          : [...f.voucher_names.filter((n) => n !== s.name), s.name]
                        f.voucher_names = names
                        f.scope = names.length ? 'voucher' : 'unknown'
                      }}
                    >
                      {on ? '✓ ' : ''}{s.name}
                    </button>
                  {/each}
                  {#if f.scope === 'unknown'}
                    <span class="self-center pl-1 text-[11px] text-gray-300">
                      고르지 않으면 어느 바우처에도 붙지 않습니다
                    </span>
                  {/if}
                </div>
              </div>
            </div>
          {/each}
          {#if forms.length === 0}
            <p class="px-1 py-3 text-xs text-gray-400">감지된 서식이 없습니다 — 필요하면 추가하세요.</p>
          {/if}
        </div>

        {#if invalid.length}
            <div class="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
              {#each invalid as msg, i (i)}
                <div class="text-xs text-red-600">{msg}</div>
              {/each}
            </div>
          {/if}
        </div>
      {/snippet}
    </SplitPane>
  {/if}
</div>
