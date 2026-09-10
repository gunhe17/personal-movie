<style>
  .modal-root {
    position: relative;
    height: 90vh;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .assessment-tabs {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 100%;
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 0;
    pointer-events: auto;
  }
  .assessment-tabs-container {
    flex: 1;
    min-width: 0;
    display: flex;
    gap: 4px;
    /* 탭 합이 모달 폭을 넘어도 바깥으로 새지 않게 (라벨은 truncate로 흡수) */
    overflow: hidden;
  }
  .assessment-tab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    /* 0 0 auto면 이름이 길 때 줄지 않아 모달 밖으로 삐져나온다 */
    flex: 0 1 auto;
    min-width: 0;
    max-width: 180px;
    height: 36px;
    padding: 0 14px;
    background: #f3f4f6;
    border: 1px solid #f3f4f6;
    border-bottom: 0;
    border-radius: 10px 10px 0 0;
    color: #6b7280;
    overflow: hidden;
    transition:
      background-color 160ms ease,
      border-color 160ms ease,
      color 160ms ease;
    cursor: pointer;
  }
  .assessment-tab:hover {
    background: #e5e7eb;
    border-color: #e5e7eb;
  }
  .assessment-tab.is-active {
    background: #ffffff;
    color: #111827;
    border-color: #ffffff;
  }

  .floating-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 48px;
    height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: opacity 160ms ease;
  }
  .floating-nav:hover {
    opacity: 0.85;
  }
  .floating-nav :global(svg) {
    width: 100%;
    height: 100%;
  }
  .floating-nav-prev {
    left: -64px;
    transform: translateY(-50%) rotate(180deg);
  }
  .floating-nav-next {
    right: -64px;
  }

  @media (max-width: 767px) {
    .floating-nav {
      display: none !important;
    }
    .assessment-tabs-container {
      overflow-x: auto;
      scrollbar-width: none;
    }
    .assessment-tabs-container::-webkit-scrollbar {
      display: none;
    }
    .assessment-tab {
      flex: 0 0 auto;
      padding: 0 12px;
    }
    .assessment-pagination {
      display: none !important;
    }
  }

  .assessment-pagination {
    flex: 0 0 122px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    height: 36px;
    padding: 0 4px;
  }
  .pagination-arrow {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    color: #ffffff;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    transition: opacity 160ms ease;
  }
  .pagination-arrow:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .pagination-arrow:not(:disabled):hover {
    opacity: 0.8;
  }

  .tab-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 9999px;
    background: #9ca3af;
  }
  .assessment-tab.is-active .tab-dot {
    background: #f47500;
  }
  .assessment-tab.has-opinion .tab-dot {
    display: none;
  }
</style>

<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import CompleteCheckIcon20 from '$root/src/lib/assets/CompleteCheckIcon20.svelte'
  import CircleArrowGrayIcon64 from '$root/src/lib/assets/CircleArrowGrayIcon64.svelte'
  import { responsive } from '$lib/stores/responsive.svelte'

  interface AssessmentTab {
    id: string
    taskId: string
    name: string
    opinion: string | null
  }

  interface Props {
    modalId?: string
    closeModal?: () => void
    assessments: AssessmentTab[]
    initialAssessmentId: string
    clientName?: string
    clientCode?: string
    scheduledLabel?: string
    createdLabel?: string
    onConfirm?: (taskId: string, opinion: string | null) => Promise<void> | void
  }

  let {
    closeModal = () => {},
    assessments,
    initialAssessmentId,
    clientName,
    clientCode,
    createdLabel,
    onConfirm
  }: Props = $props()

  // svelte-ignore state_referenced_locally
  let selectedId = $state(initialAssessmentId || assessments[0]?.id || '')
  let isSaving = $state(false)

  // ── 괘선(36px) 정렬 ────────────────────────────────────────────────
  // 본문 배경은 36px 괘선이고, 타이틀 행(h-36)·textarea(line-height 36)가 그 칸에
  // 얹혀야 한다. 메타 카드는 반 칸(18) 아래 = 첫 줄 가운데에서 시작하고 높이가
  // 데이터로 변하므로, 카드 뒤에 "다음 36 배수까지의 나머지"만큼 스페이서를 깔아
  // 격자로 복귀시킨다 (상담일지 모달과 동일 규격).
  const GRID = 36
  const META_TOP_OFFSET = 18
  let metaCardEl = $state<HTMLDivElement | null>(null)
  let metaSnapPx = $state(0)

  $effect(() => {
    const el = metaCardEl
    if (!el) return
    const sync = () => {
      const used = META_TOP_OFFSET + el.offsetHeight
      metaSnapPx = (GRID - (used % GRID)) % GRID
    }
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => observer.disconnect()
  })

  const opinions = $state<Record<string, string>>({})

  $effect(() => {
    for (const a of assessments) {
      if (!(a.id in opinions)) {
        opinions[a.id] = a.opinion ?? ''
      }
    }
  })

  const currentAssessment = $derived(
    assessments.find((a) => a.id === selectedId) ?? null
  )
  const currentIndex = $derived(
    assessments.findIndex((a) => a.id === selectedId)
  )

  const headerTitle = $derived(currentAssessment?.name ?? '검사 소견')
  const subtitleText = '검사 결과에 대한 소견을 작성해주세요'
  const clientMetaLabel = $derived(
    clientName
      ? clientCode
        ? `${clientName} (${clientCode})`
        : clientName
      : ''
  )
  const createdAt = $derived(
    createdLabel ?? new Date().toISOString().slice(0, 10)
  )

  const writtenIds = $derived(
    new Set(
      assessments
        .filter((a) => !!(opinions[a.id] ?? a.opinion))
        .map((a) => a.id)
    )
  )

  const PAGE_SIZE = 6
  let tabPage = $state(0)
  const totalPages = $derived(
    Math.max(1, Math.ceil(assessments.length / PAGE_SIZE))
  )
  const visibleAssessments = $derived(
    responsive.isMobile
      ? assessments
      : assessments.slice(tabPage * PAGE_SIZE, (tabPage + 1) * PAGE_SIZE)
  )
  const hasPrevPage = $derived(tabPage > 0)
  const hasNextPage = $derived(tabPage < totalPages - 1)

  function prevTabPage() {
    if (hasPrevPage) tabPage -= 1
  }
  function nextTabPage() {
    if (hasNextPage) tabPage += 1
  }

  function syncTabPageTo(idx: number) {
    tabPage = Math.floor(idx / PAGE_SIZE)
  }

  function handleSelect(id: string) {
    if (id === selectedId) return
    selectedId = id
    const idx = assessments.findIndex((a) => a.id === id)
    if (idx >= 0) syncTabPageTo(idx)
  }

  function gotoPrev() {
    if (assessments.length === 0) return
    const prevIdx = (currentIndex - 1 + assessments.length) % assessments.length
    selectedId = assessments[prevIdx].id
    syncTabPageTo(prevIdx)
  }
  function gotoNext() {
    if (assessments.length === 0) return
    const nextIdx = (currentIndex + 1) % assessments.length
    selectedId = assessments[nextIdx].id
    syncTabPageTo(nextIdx)
  }

  function autoScroll(node: HTMLTextAreaElement) {
    const scroll = () => {
      requestAnimationFrame(() => {
        if (node.selectionStart === node.value.length) {
          node.scrollTop = node.scrollHeight
        }
      })
    }
    node.addEventListener('input', scroll)
    return {
      destroy() {
        node.removeEventListener('input', scroll)
      }
    }
  }

  async function handleSave() {
    if (isSaving || !onConfirm) return
    isSaving = true
    try {
      // 활성 탭만이 아니라 변경된 모든 검사 소견을 저장 (다중 검사 소견 유실 방지)
      for (const a of assessments) {
        const next = (opinions[a.id] ?? '').trim() || null
        const prev = (a.opinion ?? '').trim() || null
        if (next !== prev) {
          await onConfirm(a.taskId, next)
        }
      }
      closeModal()
    } catch {
      // 상위 서비스에서 처리
    } finally {
      isSaving = false
    }
  }
</script>

<div class="modal-root">
  <!-- 검사 탭 bar -->
  <div class="assessment-tabs">
    <div class="assessment-tabs-container">
      {#each visibleAssessments as assessment (assessment.id)}
        {@const isActive = assessment.id === selectedId}
        {@const hasOpinion = writtenIds.has(assessment.id)}
        <button
          type="button"
          class="assessment-tab"
          class:is-active={isActive}
          class:has-opinion={hasOpinion && !isActive}
          onclick={() => handleSelect(assessment.id)}
        >
          {#if hasOpinion && !isActive}
            <CompleteCheckIcon20 />
          {:else}
            <span class="tab-dot" aria-hidden="true"></span>
          {/if}
          <Typography
            variant="body-02-normal-regular"
            tag="span"
            color={isActive ? 'text-gray-900' : 'text-gray-600'}
            className="block truncate-safe min-w-0 flex-1"
          >
            {assessment.name}
          </Typography>
        </button>
      {/each}
    </div>
    {#if totalPages > 1}
      <div class="assessment-pagination">
        <button
          type="button"
          aria-label="이전 페이지"
          onclick={prevTabPage}
          disabled={!hasPrevPage}
          class="pagination-arrow"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <path
              d="M12.5 15L7.5 10L12.5 5"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <Typography
          variant="body-02-normal-regular"
          tag="span"
          color="text-white"
        >
          {writtenIds.size}/{assessments.length} 완료
        </Typography>
        <button
          type="button"
          aria-label="다음 페이지"
          onclick={nextTabPage}
          disabled={!hasNextPage}
          class="pagination-arrow"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <path
              d="M7.5 5L12.5 10L7.5 15"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
    {/if}
  </div>

  <!-- 플로팅 이전/다음 버튼 -->
  <button
    type="button"
    aria-label="이전 검사"
    onclick={gotoPrev}
    class="floating-nav floating-nav-prev"
  >
    <CircleArrowGrayIcon64 />
  </button>
  <button
    type="button"
    aria-label="다음 검사"
    onclick={gotoNext}
    class="floating-nav floating-nav-next"
  >
    <CircleArrowGrayIcon64 />
  </button>

  <!-- Header -->
  <div
    class="flex h-24.5 shrink-0 items-center justify-between gap-4 border-b border-gray-300 bg-white px-6 py-5"
  >
    <div class="min-w-0 flex-1 space-y-2">
      <Typography
        variant="headline-02-normal-semibold"
        className="truncate-safe"
        color="text-gray-800"
      >
        {headerTitle}
      </Typography>
      <Typography variant="body-01-normal-medium" color="text-gray-600">
        {subtitleText}
      </Typography>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <button
        type="button"
        class="w-19 h-11 bg-white rounded-lg border border-gray-200 px-5 text-body-01-normal-medium text-gray-600 transition hover:border-gray-300 hover:text-gray-800"
        onclick={() => closeModal()}
      >
        닫기
      </button>
      <button
        type="button"
        onclick={handleSave}
        disabled={isSaving}
        class="w-19 h-11 rounded-lg bg-blue-500 px-5 text-body-01-normal-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? '저장 중...' : '저장'}
      </button>
    </div>
  </div>

  <!-- Body -->
  <div class="journal-paper flex-1 min-h-0 overflow-y-auto pb-6">
    <!-- 메타 카드 위 여백 — 괘선 한 칸(36)이 아니라 반 칸(18).
         카드가 줄 경계가 아니라 줄 가운데에서 시작한다 -->
    <div class="h-[18px]"></div>

    <!-- 메타 카드 — 레이블+데이터(가로형, 텍스트 레이블) 카드 규격:
         15 · 레이블↔값 24 · 행 높이 20 · 행 간 8 (Web_Design.md §Layout) -->
    <div bind:this={metaCardEl} class="mx-6 rounded-xl bg-gray-50 p-4">
      {#if clientMetaLabel}
        <Typography
          variant="body-01-normal-medium"
          color="text-body-strong"
          className="mb-3 block"
        >
          {clientMetaLabel}
        </Typography>
      {/if}
      <div
        class="grid grid-cols-[auto_1fr] auto-rows-[20px] items-center gap-x-6 gap-y-2"
      >
        <Typography variant="body-02-normal-regular" color="text-gray-600">
          검사명
        </Typography>
        <Typography
          variant="body-02-normal-regular"
          color="text-body-strong"
          className="min-w-0 truncate-safe"
        >
          {currentAssessment?.name ?? ''}
        </Typography>
        <Typography variant="body-02-normal-regular" color="text-gray-600">
          작성일
        </Typography>
        <Typography variant="body-02-normal-regular" color="text-body-strong">
          {createdAt}
        </Typography>
      </div>
    </div>

    <!-- 괘선 복귀 스페이서 — 반 칸(18) + 카드 높이를 36 배수로 올림해 다음 줄부터
         타이틀·본문이 괘선 칸에 정확히 얹히게 한다(카드 높이는 데이터로 변한다) -->
    <div style="height: {metaSnapPx}px" aria-hidden="true"></div>

    <!-- 검사 소견 — 위 스페이서가 이미 격자선까지 채우므로 여기서 한 칸(36)을 더
         띄우지 않는다. 카드와의 간격 = 복귀 스페이서 반 칸(0.5칸) -->
    <div class="mx-6">
      <div class="h-[36px] flex items-center">
        <Typography variant="body-02-normal-medium" color="text-title-subtitle">
          검사 소견
        </Typography>
      </div>
      <!-- svelte-ignore element_invalid_self_closing_tag -->
      <textarea
        bind:value={opinions[selectedId]}
        maxlength={5000}
        placeholder="검사 결과를 바탕으로 소견을 작성해주세요"
        class="journal-line-input h-[180px] overflow-y-auto px-3 py-3.5"
        use:autoScroll
      />
    </div>
  </div>
</div>
