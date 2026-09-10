<script lang="ts">
  import { tick } from 'svelte'
  import type { Plan, Selection } from '$lib/types'
  import {
    reviewItems,
    reviewStatus,
    reviewStatusLabels,
    reviewKindLabels,
    reviewDiff,
    setContentReview,
    nextUnreviewed
  } from '$lib/content-review'
  import type { ContentReview } from '$lib/content-review'
  import StructureOutline from './StructureOutline.svelte'
  import '$lib/review-workspace.css'
  let {
    plan,
    selection,
    reviews = $bindable(),
    presentation = $bindable('document'),
    disabled = false,
    onFeature,
    onPrepare,
    onQuestion
  }: {
    plan: Plan
    selection: Selection
    reviews?: ContentReview[]
    presentation?: 'document' | 'map'
    disabled?: boolean
    onFeature: (id: string) => void
    onPrepare: () => void
    onQuestion: (question: string, title: string) => void
  } = $props()
  const instanceId = $props.id()
  let inspectorOpen = $state(false)
  let navigation = $state<{ key: string } | null>(null)
  let selectionTrigger: HTMLElement | null = null
  let activeKey = $state(''),
    query = $state(''),
    filter = $state('all')
  let notes = $state<Record<string, string>>({}),
    notice = $state('')
  let undo = $state<{ key: string; previous?: ContentReview } | null>(null)
  let inspector = $state<HTMLElement>()
  let inspectorHeading = $state<HTMLElement>()
  let scroller = $state<HTMLDivElement>()
  const records = $derived(reviews ?? [])
  const items = $derived(reviewItems(plan, selection))
  const active = $derived(
    items.find((item) => item.key === activeKey) ?? items[0]
  )
  $effect(() => {
    if (
      presentation === 'document' &&
      !['overview', 'requirement'].includes(active.kind)
    )
      activeKey = items[0].key
  })
  const previous = $derived(
    records.find((review) => review.key === active?.key)
  )
  const status = $derived(active ? reviewStatus(active, records) : 'new')
  const diff = $derived(
    active && status === 'stale' ? reviewDiff(active, previous) : []
  )
  const accepted = $derived(
    items.filter((item) => reviewStatus(item, records) === 'accepted').length
  )
  const pending = $derived(
    items.filter((item) =>
      ['new', 'stale'].includes(reviewStatus(item, records))
    ).length
  )
  const filtered = $derived(
    items.filter(
      (item) =>
        (filter === 'all' || reviewStatus(item, records) === filter) &&
        (item.title + item.sections.map((s) => s.value).join(' '))
          .toLowerCase()
          .includes(query.toLowerCase())
    )
  )
  const queueIndex = $derived(
    filtered.findIndex((item) => item.key === active?.key)
  )
  const related = $derived(
    items.filter(
      (item) =>
        active &&
        (active.links.includes(item.key) || item.links.includes(active.key))
    )
  )
  const note = $derived(
    active ? (notes[active.key] ?? previous?.note ?? '') : ''
  )
  const smooth = (): ScrollBehavior =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'instant'
      : 'smooth'
  async function select(key: string, navigate = false) {
    const scrollTop = scroller?.scrollTop ?? 0
    if (!navigate && document.activeElement instanceof HTMLElement)
      selectionTrigger = document.activeElement
    if (navigate) {
      navigation = { key }
      selectionTrigger = null
    }
    activeKey = key
    const item = items.find((i) => i.key === key)
    if (
      presentation === 'document' &&
      item &&
      !['overview', 'requirement'].includes(item.kind)
    ) {
      presentation = 'map'
      navigation = { key }
    }
    inspectorOpen = true
    await tick()
    if (presentation === 'document') {
      const sheet = document.getElementById(instanceId + '-' + key)
      sheet?.scrollIntoView({ block: 'start', behavior: smooth() })
      if (navigate) sheet?.focus({ preventScroll: true })
      return
    }
    // Inspecting a card keeps its context and position; queue navigation is explicit.
    if (navigate && scroller) {
      const selected = scroller.querySelector<HTMLElement>(
        'button[aria-pressed="true"]'
      )
      const top = selected
        ? scroller.scrollTop +
          selected.getBoundingClientRect().top -
          scroller.getBoundingClientRect().top -
          24
        : 0
      scroller.scrollTo({ top: Math.max(0, top), behavior: 'instant' })
    } else scroller?.scrollTo({ top: scrollTop, behavior: 'instant' })
    inspector?.scrollTo({ top: 0, behavior: 'instant' })
    if (navigate || window.matchMedia('(max-width: 1280px)').matches)
      inspectorHeading?.focus({ preventScroll: true })
  }
  async function closeInspector() {
    inspectorOpen = false
    await tick()
    if (selectionTrigger?.isConnected)
      selectionTrigger.focus({ preventScroll: true })
  }
  async function browse() {
    inspectorOpen = false
    activeKey = ''
    notice = ''
    await tick()
    scroller?.scrollTo({ top: 0, behavior: 'instant' })
  }
  function move(direction: number) {
    if (!filtered.length) return
    const index =
      queueIndex < 0
        ? 0
        : (queueIndex + direction + filtered.length) % filtered.length
    void select(filtered[index].key, true)
  }
  function decide(nextStatus: ContentReview['status']) {
    if (!active || disabled) return
    try {
      const key = active.key,
        title = active.title
      const nextReviews = setContentReview(records, active, nextStatus, note)
      undo = { key, previous: records.find((r) => r.key === key) }
      reviews = nextReviews
      const next = nextUnreviewed(items, nextReviews, key)
      notice = `${title} · ${reviewStatusLabels[nextStatus]}. ${next ? '다음 미검토 항목으로 이동했어요.' : '미검토 항목을 모두 살펴봤어요. 수정 요청과 보류 항목도 확인해 주세요.'}`
      if (next) {
        filter = 'all'
        query = ''
        void select(next, true)
      }
    } catch (error) {
      notice = error instanceof Error ? error.message : '검토 기록 실패'
    }
  }
  function revert() {
    if (!undo || disabled) return
    const last = undo
    reviews = records.filter((r) => r.key !== last.key)
    if (last.previous) reviews = [...reviews, last.previous]
    undo = null
    notice = '마지막 검토를 되돌렸어요.'
    void select(last.key, true)
  }
</script>

<section
  class="review-workspace"
  class:document-mode={presentation === 'document'}
  class:inspector-closed={!inspectorOpen}
  aria-label="기획 구조와 내용 검토"
>
  <div class="editor-review-status">
    <span class="review-status-label">검토 현황</span>
    <span>채택 {accepted} / {items.length} · 검토할 항목 {pending}개</span>
    <div
      role="progressbar"
      aria-label="내용 채택 진행률"
      aria-valuenow={accepted}
      aria-valuemin="0"
      aria-valuemax={items.length}
    >
      <i style:width={`${(accepted / Math.max(items.length, 1)) * 100}%`}></i>
    </div>
  </div>
  <div class="editor-document" hidden={presentation !== 'document'}>
    {#each items.filter( (i) => ['overview', 'requirement'].includes(i.kind) ) as item, index (item.key)}
      <article
        class="editor-sheet"
        class:selected={active.key === item.key}
        id={instanceId + '-' + item.key}
        tabindex="-1"
      >
        <div class="editor-sheet-header">
          <span class="editor-sheet-number"
            >{String(index + 1).padStart(2, '0')}</span
          >
          <h2>{item.kind === 'overview' ? '개요' : '요구사항'}</h2>
          <span class="review-badge" data-status={reviewStatus(item, records)}
            >{reviewStatusLabels[reviewStatus(item, records)]}</span
          ><button {disabled} onclick={() => select(item.key)}
            >{active.key === item.key ? '검토 중' : '이 항목 검토'}</button
          >
        </div>
        {#if item.kind === 'overview'}<section>
            <h3>기획 이름</h3>
            <p>{item.title}</p>
          </section>{/if}
        {#each item.sections as field}<section>
            <h3>{field.label}</h3>
            <p class:empty={!field.value}>
              {field.value ||
                '아직 작성되지 않았어요. 왼쪽에서 보완할 내용을 남겨주세요.'}
            </p>
          </section>{/each}
        {#if active.key === item.key}
          {#if diff.length}<section class="review-diff">
              <h3>이전 검토 후 달라진 내용</h3>
              {#each diff as row}<details>
                  <summary>{row.label}</summary><small>이전</small>
                  <p>{row.before || '작성 전'}</p>
                  <small>현재</small>
                  <p>{row.after || '내용 삭제'}</p>
                </details>{/each}
            </section>{/if}
          <label class="review-note"
            >검토 의견 <small>수정 요청 시 필수</small><textarea
              rows="2"
              maxlength="4000"
              value={note}
              {disabled}
              oninput={(event) =>
                (notes[active.key] = event.currentTarget.value)}
              placeholder="채택할 내용이나 수정이 필요한 부분을 남겨주세요."
            ></textarea></label
          >
        {/if}
        <div class="editor-sheet-footer">
          <button {disabled} onclick={onPrepare}>+ 기획 내용 보완</button
          >{#if item.links.length}<button
              {disabled}
              onclick={() => {
                presentation = 'map'
                void select(item.key, true)
              }}>연결된 항목 {item.links.length}개 ↗</button
            >{/if}
        </div>
      </article>
    {/each}
    {#if !plan.audit?.requirements.length}<div class="editor-document-empty">
        <h3>요구사항을 구체화할 차례예요.</h3>
        <p>왼쪽에 원하는 동작을 적고 보완을 요청해 주세요.</p>
        <button {disabled} onclick={onPrepare}>기획 보완</button>
      </div>{/if}
  </div>
  <div class="review-layout" hidden={presentation !== 'map'}>
    <div class="review-structure">
      <div class="structure-tools outline-tools">
        <label class="review-search"
          ><span class="sr-only">전체 기획 항목 검색</span><input
            type="search"
            placeholder="필요한 항목 찾기"
            bind:value={query}
          /></label
        ><label
          ><span class="sr-only">검토 상태</span><select bind:value={filter}
            ><option value="all">전체 상태</option
            >{#each Object.entries(reviewStatusLabels) as [value, label]}<option
                {value}>{label}</option
              >{/each}</select
          ></label
        >{#if query || filter !== 'all'}<button
            onclick={() => {
              query = ''
              filter = 'all'
            }}>검색 초기화</button
          >{/if}
      </div>
      <div class="outline-viewport" bind:this={scroller}>
        <div hidden={!!query || filter !== 'all'}>
          <StructureOutline
            {plan}
            {selection}
            reviews={records}
            selectedKey={inspectorOpen ? activeKey : ''}
            {navigation}
            inspectorId={instanceId + '-inspector'}
            {disabled}
            onSelect={(key) => select(key)}
            onBrowse={browse}
            {onPrepare}
          />
        </div>
        {#if query || filter !== 'all'}<section
            class="outline-search"
            aria-label="기획 항목 검색 결과"
          >
            <h2>검색 결과 {filtered.length}개</h2>
            <p>
              전체 기획에서 찾은 항목이에요. 항목을 선택하면 내용을 검토할 수
              있어요.
            </p>
            {#each filtered as item}<button
                class="outline-search-item"
                {disabled}
                onclick={() => {
                  query = ''
                  filter = 'all'
                  void select(item.key, true)
                }}
                ><span>{reviewKindLabels[item.kind]}</span><strong
                  >{item.title}</strong
                ><span
                  class="review-badge"
                  data-status={reviewStatus(item, records)}
                  >{reviewStatusLabels[reviewStatus(item, records)]}</span
                ></button
              >{:else}<p>조건에 맞는 항목이 없어요.</p>{/each}
          </section>{/if}
      </div>
    </div>
    <aside
      class="review-inspector"
      hidden={!inspectorOpen}
      id={instanceId + '-inspector'}
      aria-label="선택 항목 검토"
    >
      {#if active}
        <header
          class="review-inspector-heading"
          bind:this={inspectorHeading}
          tabindex="-1"
        >
          <div class="review-inspector-topline">
            <div class="review-detail-meta">
              <span>{reviewKindLabels[active.kind]}</span>
              <span class="review-badge" data-status={status}
                >{reviewStatusLabels[status]}</span
              >
            </div>
            <button
              class="editor-inspector-close"
              aria-label="항목 상세 닫기"
              onclick={closeInspector}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg
              >
            </button>
          </div>
          <h3>{active.title}</h3>
        </header>
        <div class="review-inspector-body" bind:this={inspector}>
          {#key active.key}<div class="review-detail">
              {#if diff.length}<section class="review-diff">
                  <h4>이전 검토 후 달라진 내용 {diff.length}</h4>
                  {#each diff as row}<details open={diff.length === 1}>
                      <summary>{row.label}</summary><small>이전</small>
                      <p class="before">{row.before || '작성 전'}</p>
                      <small>현재</small>
                      <p class="after">{row.after || '내용 삭제'}</p>
                    </details>{/each}{#if previous?.note}<p>
                      이전 의견: {previous.note}
                    </p>{/if}
                </section>{/if}
              {#each active.sections.filter((section) => !['근거', '점검 관점', '우선순위 근거'].includes(section.label)) as section}<section
                  class="review-section"
                >
                  <h4>{section.label}</h4>
                  <p class:empty={!section.value}>
                    {section.value || '아직 작성되지 않았어요.'}
                  </p>
                  {#if section.value && ['남은 질문', '결정 질문'].includes(section.label)}<button
                      class="text-action"
                      {disabled}
                      onclick={() => onQuestion(section.value, active.title)}
                      >남은 결정에 등록 ↗</button
                    >{/if}
                </section>{/each}
              <label class="review-note"
                >검토 의견 <small>수정 요청 시 필수</small><textarea
                  rows="3"
                  maxlength="4000"
                  value={note}
                  oninput={(event) =>
                    (notes[active.key] = event.currentTarget.value)}
                  {disabled}
                  placeholder="수정할 부분과 이유, 보류한 질문을 남겨주세요."
                ></textarea></label
              >
              <details class="review-supporting">
                <summary>점검 근거와 연결된 항목</summary>
                {#each active.sections.filter( (section) => ['근거', '점검 관점', '우선순위 근거'].includes(section.label) ) as section}
                  <section class="review-section">
                    <h4>{section.label}</h4>
                    <p>
                      {section.value.replace(
                        /^(high|medium|low) \/ /,
                        (_, level) =>
                          ((
                            ({
                              high: '높음',
                              medium: '보통',
                              low: '낮음'
                            }) as Record<string, string>
                          )[level] ?? level) + ' / '
                      ) || '아직 작성되지 않았어요.'}
                    </p>
                  </section>
                {/each}
                {#if related.length}<section class="review-section">
                    <h4>연결된 항목 {related.length}</h4>
                    <div class="related-links">
                      {#each related as item}<button
                          {disabled}
                          onclick={() => select(item.key, true)}
                          ><small>{reviewKindLabels[item.kind]}</small
                          >{item.title} ↗</button
                        >{/each}
                    </div>
                  </section>{/if}
              </details>
              <div class="review-edit-actions">
                {#if active.kind === 'feature'}<button
                    {disabled}
                    onclick={() => onFeature(active.id)}
                    >범위·동작 편집 ↗</button
                  >{:else}<button {disabled} onclick={onPrepare}
                    >기획 보완 요청 ↗</button
                  >{/if}
              </div>
              {#if previous}<p class="review-record">
                  마지막 검토: {new Date(previous.at).toLocaleString('ko-KR')} ·
                  {reviewStatusLabels[previous.status]}
                </p>{/if}
            </div>{/key}
        </div>
        <div class="review-inspector-footer">
          <div class="review-queue-label">
            전체 항목 순서로 검토 {@render queueControls()}
          </div>
          {@render decisionControls()}
          <p>검토 후 다음 미검토 항목으로 이동해요.</p>
        </div>
      {/if}
    </aside>
  </div>
  <div class="review-dock" hidden={presentation !== 'document'}>
    {@render queueControls()}
    <p>{active?.title}</p>
    {@render decisionControls()}
  </div>
  <div class="review-feedback" role="status">
    {#key notice}<span class="review-announcement"
        >{notice ||
          (presentation === 'map'
            ? '항목을 누르면 상세가 열려요. 펼친 목록과 읽던 위치는 유지돼요.'
            : '검토하면 다음 미검토 항목으로 이동해요. 검토 기록은 브라우저에 자동 보관돼요.')}</span
      >{/key}{#if undo}<button {disabled} onclick={revert}
        >마지막 검토 되돌리기</button
      >{/if}
  </div>
</section>

{#snippet queueControls()}
  <div class="review-position">
    <button
      aria-label="이전 검토 항목"
      disabled={disabled || !filtered.length}
      onclick={() => move(-1)}>←</button
    ><span
      >{queueIndex < 0
        ? '선택 항목'
        : `${queueIndex + 1} / ${filtered.length}`}</span
    ><button
      aria-label="다음 검토 항목"
      disabled={disabled || !filtered.length}
      onclick={() => move(1)}>→</button
    >
  </div>
{/snippet}

{#snippet decisionControls()}
  <div class="review-decisions">
    <button {disabled} onclick={() => decide('deferred')}>판단 보류</button
    ><button
      disabled={disabled || !note.trim()}
      onclick={() => decide('changes')}
      title={!note.trim()
        ? '검토 의견에 수정할 내용과 이유를 입력하세요.'
        : undefined}>수정 요청</button
    ><button class="review-accept" {disabled} onclick={() => decide('accepted')}
      >✓ 내용 채택</button
    >
  </div>
{/snippet}
