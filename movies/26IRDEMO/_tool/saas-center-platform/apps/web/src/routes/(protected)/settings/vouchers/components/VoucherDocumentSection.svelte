<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import PDFViewer from '$lib/components/PDFViewer.svelte'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { centerId } from '$lib/stores/center.store'
  import {
    getCenterVoucherDocuments,
    type CenterVoucherDocumentItem
  } from '$lib/hooks/actions/centerVoucher.action'

  let {
    centerVoucherId
  }: {
    centerVoucherId: string
  } = $props()

  const docsQuery = $derived(
    queryBuilder(
      getCenterVoucherDocuments,
      () => ({ centerId: $centerId, centerVoucherId }),
      { enabled: !!$centerId && !!centerVoucherId }
    )
  )

  const items = $derived(docsQuery.data?.items ?? [])
  const isLoading = $derived(docsQuery.isLoading)

  // 선택된 자료 ID (탭) — 첫 번째 자동 선택
  let selectedDocId = $state<string | null>(null)
  $effect(() => {
    if (items.length === 0) {
      selectedDocId = null
      return
    }
    if (
      !selectedDocId ||
      !items.find((d) => d.global_document_id === selectedDocId)
    ) {
      selectedDocId = items[0].global_document_id
    }
  })

  function selectDoc(fileId: string) {
    selectedDocId = fileId
  }

  const selected = $derived(
    items.find((d) => d.global_document_id === selectedDocId) ?? null
  )

  // 서버 프록시 경유 stream URL (CORS 회피)
  function buildFileUrl(globalDocumentId: string): string {
    return `/api/proxy/centers/${$centerId}/center-vouchers/${centerVoucherId}/documents/${globalDocumentId}/file`
  }

  // 자료는 pdf 외에 png/jpg(서식 이미지) 등 다양한 포맷이 올 수 있다.
  // 포맷별로 뷰어를 분기한다 (이미지를 PDFViewer에 넘기면 "Invalid PDF" 오류).
  const IMAGE_TYPES = new Set([
    'png',
    'jpg',
    'jpeg',
    'gif',
    'webp',
    'bmp',
    'svg'
  ])
  function isImage(fileType: string): boolean {
    return IMAGE_TYPES.has((fileType ?? '').toLowerCase())
  }
  function isPdf(fileType: string): boolean {
    return (fileType ?? '').toLowerCase() === 'pdf'
  }

  /** 파일 포맷 배지 라벨 — 확장자 대문자 (pdf → PDF) */
  function fileTypeLabel(item: CenterVoucherDocumentItem): string {
    return (item.file_type ?? '').toUpperCase() || '파일'
  }

  // PDF 파일 캐시 — global_document_id → File (PDFViewer는 File 입력 필요)
  let fileCache = $state<Record<string, File>>({})
  let isFetchingFile = $state(false)
  let fetchError = $state<string | null>(null)

  // 선택된 PDF 자료를 프록시 경유로 fetch (캐시 활용).
  // 이미지/기타 포맷은 <img>·링크로 직접 처리하므로 fetch 불필요.
  $effect(() => {
    const doc = selected
    if (!doc || !doc.has_file || !isPdf(doc.file_type)) return
    if (fileCache[doc.global_document_id]) return

    let cancelled = false
    isFetchingFile = true
    fetchError = null
    ;(async () => {
      try {
        const res = await fetch(buildFileUrl(doc.global_document_id), {
          credentials: 'include'
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        const fileName = doc.name.toLowerCase().endsWith('.pdf')
          ? doc.name
          : `${doc.name}.pdf`
        const file = new File([blob], fileName, {
          type: blob.type || 'application/pdf'
        })
        if (cancelled) return
        fileCache = { ...fileCache, [doc.global_document_id]: file }
      } catch (err) {
        if (cancelled) return
        fetchError = '자료를 불러오지 못했어요'
        console.error('[VoucherDocumentSection] fetch failed', err)
      } finally {
        if (!cancelled) isFetchingFile = false
      }
    })()

    return () => {
      cancelled = true
    }
  })
</script>

<section class="flex h-full min-h-0 flex-col">
  {#if isLoading}
    <Typography
      variant="body-02-normal-regular"
      color="text-gray-400"
      className="block py-10 text-center"
    >
      불러오는 중...
    </Typography>
  {:else if items.length === 0}
    <!-- 섹션 안 빈 상태 — gray-50 박스 · body-02 -->
    <div class="flex flex-col items-center gap-2 rounded-xl bg-gray-50 py-8">
      <Typography variant="body-02-normal-regular" color="text-gray-600">
        연결된 자료가 없어요
      </Typography>
    </div>
  {:else}
    <!-- 목록 레일(280 고정) + 뷰어 — 레일↔본문 gap 16 -->
    <div
      class="grid min-h-0 flex-1 gap-4 {items.length > 1
        ? 'grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]'
        : 'grid-cols-1'}"
    >
      <!-- 좌측: 자료 레일 (자료 1개면 숨김) -->
      {#if items.length > 1}
        <aside class="min-h-0 overflow-y-auto">
          <!-- 레일 항목 — full-bleed 금지: radius 8 + 패딩 12, 항목 사이 8 -->
          <ul class="flex flex-col gap-2">
            {#each items as doc (doc.global_document_id)}
              {@const isActive = doc.global_document_id === selectedDocId}
              <li>
                <button
                  type="button"
                  onclick={() => selectDoc(doc.global_document_id)}
                  class="w-full rounded-lg p-3 text-left transition-colors {isActive
                    ? 'bg-primary-50'
                    : 'hover:bg-gray-50'}"
                >
                  <Typography
                    variant="body-01-normal-semibold"
                    color={isActive ? 'text-primary-600' : 'text-gray-800'}
                    className="block truncate-safe"
                  >
                    {doc.name}
                  </Typography>
                  <div class="mt-2 flex items-center gap-2">
                    <BadgeRectangle label={fileTypeLabel(doc)} size="sm" />
                    {#if doc.page_range}
                      <Typography
                        variant="body-03-normal-regular"
                        color="text-gray-500"
                      >
                        p.{doc.page_range}
                      </Typography>
                    {/if}
                  </div>
                </button>
              </li>
            {/each}
          </ul>
        </aside>
      {/if}

      <!-- 우측: 뷰어 영역 -->
      <div class="flex min-h-0 min-w-0 flex-col">
        <!-- 선택 자료 메타 (한 줄) -->
        {#if selected}
          <div class="mb-3 flex shrink-0 flex-wrap items-center gap-2">
            <Typography
              variant="body-02-normal-medium"
              color="text-gray-800"
              className="truncate-safe"
            >
              {selected.name}
            </Typography>
            {#if selected.page_range}
              <Typography
                variant="body-03-normal-regular"
                color="text-gray-500"
              >
                p.{selected.page_range}
              </Typography>
            {/if}
            {#if selected.has_file}
              <a
                href={buildFileUrl(selected.global_document_id)}
                target="_blank"
                rel="noopener noreferrer"
                class="ml-auto text-body-02-normal-medium text-gray-600 underline underline-offset-2 transition-colors hover:text-gray-800"
              >
                새 창에서 열기
              </a>
            {/if}
          </div>
        {/if}

        <!-- 자료 뷰어 (포맷별 분기: 이미지 / PDF / 기타) -->
        <div class="min-h-0 flex-1">
          {#if !selected}
            <!-- 선택된 자료 없음 -->
          {:else if !selected.has_file}
            <div
              class="flex flex-col items-center gap-2 rounded-xl bg-gray-50 py-8"
            >
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-600"
              >
                첨부 파일이 없는 자료예요
              </Typography>
            </div>
          {:else if isImage(selected.file_type)}
            <div
              class="flex h-full items-center justify-center overflow-auto rounded-xl border border-gray-200 bg-gray-100 p-4"
            >
              <img
                src={buildFileUrl(selected.global_document_id)}
                alt={selected.name}
                class="max-h-full max-w-full object-contain"
              />
            </div>
          {:else if isPdf(selected.file_type)}
            {#if fileCache[selected.global_document_id]}
              <PDFViewer
                file={fileCache[selected.global_document_id]}
                reportToolbar={{ title: selected.name }}
                minInitialScale={1}
              />
            {:else if fetchError}
              <div class="rounded-xl bg-status-danger-bg py-8 text-center">
                <Typography
                  variant="body-02-normal-regular"
                  color="text-status-danger"
                >
                  {fetchError}
                </Typography>
              </div>
            {:else}
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-400"
                className="block py-10 text-center"
              >
                불러오는 중...
              </Typography>
            {/if}
          {:else}
            <!-- hwpx·docx 등 미리보기 미지원 포맷 -->
            <div
              class="flex h-full flex-col items-center justify-center gap-3 rounded-xl bg-gray-50 p-6 text-center"
            >
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-600"
              >
                미리보기를 지원하지 않는 형식이에요 ({fileTypeLabel(selected)})
              </Typography>
              <a
                href={buildFileUrl(selected.global_document_id)}
                target="_blank"
                rel="noopener noreferrer"
                class="text-body-02-normal-medium text-primary-500 underline underline-offset-2 transition-colors hover:text-primary-600"
              >
                새 창에서 열기
              </a>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</section>
