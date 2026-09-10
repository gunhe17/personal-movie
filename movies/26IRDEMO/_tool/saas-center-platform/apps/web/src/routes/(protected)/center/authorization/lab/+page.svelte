<script lang="ts">
  // ────────────────────────────────────────────────────────────────────
  // 권한 설정 — 뷰 구조 LAB (시안)
  // 목적: "이 역할이 각 메뉴에 뭘 할 수 있나"를 현재 테이블보다 직관적으로
  //       확인할 수 있는 대안 구조 비교. 전부 mock — 실제 적용 아님.
  // ────────────────────────────────────────────────────────────────────

  type Cell = 'allow' | 'deny' | 'na' // na = 편집 개념 없음(-)
  interface PermItem {
    label: string
    view: 'allow' | 'deny' // 조회
    edit: Cell // 편집
  }
  interface Section {
    label: string
    items: PermItem[]
  }

  // 실제 카테고리(constants.ts CATEGORY_GROUPS) 기준 mock — 상태만 다양화
  const sections: Section[] = [
    {
      label: '상담 · 검사 관리',
      items: [
        { label: '내담자', view: 'allow', edit: 'allow' },
        { label: '상담', view: 'allow', edit: 'allow' },
        { label: '상담노트', view: 'allow', edit: 'deny' },
        { label: '검사', view: 'allow', edit: 'allow' },
        { label: '검사 설정', view: 'allow', edit: 'deny' },
        { label: '바로링크', view: 'allow', edit: 'na' }
      ]
    },
    {
      label: '운영 관리',
      items: [
        { label: '일정', view: 'allow', edit: 'allow' },
        { label: '문서', view: 'allow', edit: 'deny' },
        { label: '양식', view: 'deny', edit: 'deny' },
        { label: '양식 관리', view: 'deny', edit: 'deny' },
        { label: '청구', view: 'allow', edit: 'allow' }
      ]
    },
    {
      label: '센터 관리',
      items: [
        { label: '구성원', view: 'allow', edit: 'deny' },
        { label: '센터', view: 'allow', edit: 'allow' },
        { label: '프로그램', view: 'allow', edit: 'allow' },
        { label: '장소', view: 'allow', edit: 'deny' },
        { label: '역할', view: 'allow', edit: 'deny' },
        { label: '공지사항', view: 'allow', edit: 'allow' }
      ]
    }
  ]

  // ── 접근 레벨 파생 (직관 뷰의 핵심: 조회+편집 → 한 단어) ──
  type Level = 'edit' | 'read' | 'none'
  function levelOf(it: PermItem): Level {
    if (it.view === 'deny') return 'none'
    if (it.edit === 'allow') return 'edit'
    return 'read'
  }

  const LEVEL_META: Record<
    Level,
    { label: string; text: string; bg: string; border: string; dot: string }
  > = {
    edit: {
      label: '편집 가능',
      text: 'text-green-700',
      bg: 'bg-green-50',
      border: 'border-green-100',
      dot: 'bg-green-500'
    },
    read: {
      label: '읽기 전용',
      text: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      dot: 'bg-amber-500'
    },
    none: {
      label: '접근 불가',
      text: 'text-gray-500',
      bg: 'bg-gray-100',
      border: 'border-gray-200',
      dot: 'bg-gray-400'
    }
  }

  const allItems = sections.flatMap((s) => s.items)
  const counts = {
    edit: allItems.filter((i) => levelOf(i) === 'edit').length,
    read: allItems.filter((i) => levelOf(i) === 'read').length,
    none: allItems.filter((i) => levelOf(i) === 'none').length
  }

  let activeLayout = $state<'A' | 'B' | 'C' | 'D'>('B')

  const LAYOUT_META: Record<'A' | 'B' | 'C' | 'D', string> = {
    A: 'A · 테이블 — 현재 방식(메뉴 · 조회 · 편집, 허용/제한 텍스트)',
    B: 'B · 접근 레벨 요약 — 메뉴별 한 줄 상태(편집 가능 · 읽기 전용 · 접근 불가)',
    C: 'C · 체크 매트릭스 — 아이콘 · 색으로 전체를 한눈에 스캔',
    D: 'D · 카드 그리드 — 메뉴별 카드 + 권한 칩'
  }
</script>

<!-- ────────────────────────────────────────────────────────────────── -->
<!-- LAB 헤더 -->
<!-- ────────────────────────────────────────────────────────────────── -->
<div class="flex flex-col">
  <div
    class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
  >
    <div>
      <h1 class="text-headline-01-normal-semibold text-gray-900">
        권한 뷰 구조 — LAB
      </h1>
      <p class="mt-0.5 text-body-03-normal-regular text-gray-400">
        {LAYOUT_META[activeLayout]}
      </p>
    </div>

    <!-- 레이아웃 스위처 -->
    <div class="flex gap-1 self-start rounded-lg bg-gray-900 p-1">
      {#each ['A', 'B', 'C', 'D'] as layout}
        <button
          class="rounded-lg px-5 py-2 text-body-02-normal-medium transition-colors
            {activeLayout === layout
            ? 'bg-white text-gray-900'
            : 'text-gray-400 hover:text-white'}"
          onclick={() => (activeLayout = layout as 'A' | 'B' | 'C' | 'D')}
        >
          {layout}
        </button>
      {/each}
    </div>
  </div>

  <!-- 요약 카운트(모든 시안 공통 상단) -->
  <div class="mb-4 flex flex-wrap gap-2">
    {#each ['edit', 'read', 'none'] as Level[] as lv}
      <div
        class="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 {LEVEL_META[
          lv
        ].border} {LEVEL_META[lv].bg}"
      >
        <span class="h-2 w-2 rounded-full {LEVEL_META[lv].dot}"></span>
        <span class="text-body-03-normal-medium {LEVEL_META[lv].text}"
          >{LEVEL_META[lv].label}</span
        >
        <span class="text-body-03-normal-bold {LEVEL_META[lv].text}"
          >{counts[lv]}</span
        >
      </div>
    {/each}
  </div>

  <!-- ══════════════════════════════════════════════════════════════ -->
  <!-- A · 테이블 (현재 방식)                                          -->
  <!-- ══════════════════════════════════════════════════════════════ -->
  {#if activeLayout === 'A'}
    <div class="space-y-8">
      {#each sections as section}
        <div>
          <p class="mb-3 text-body-01-normal-semibold text-gray-900">
            {section.label}
          </p>
          <!-- 헤더 -->
          <div
            class="mb-1 grid h-10 grid-cols-[3fr_2fr_2fr] items-center bg-gray-50 px-4"
          >
            <span class="text-body-03-normal-medium text-gray-500">메뉴</span>
            <span class="text-body-03-normal-medium text-gray-500">조회</span>
            <span class="text-body-03-normal-medium text-gray-500">편집</span>
          </div>
          {#each section.items as it}
            <div
              class="grid min-h-12 grid-cols-[3fr_2fr_2fr] items-center border-b border-gray-100 px-4 py-2.5"
            >
              <span class="text-body-01-reading-regular text-gray-800"
                >{it.label}</span
              >
              <!-- 조회 -->
              <span
                class="text-body-02-normal-medium {it.view === 'allow'
                  ? 'text-primary-500'
                  : 'text-status-danger'}"
                >{it.view === 'allow' ? '허용' : '제한'}</span
              >
              <!-- 편집 -->
              {#if it.edit === 'na'}
                <span class="text-body-02-normal-medium text-gray-400">-</span>
              {:else}
                <div class="flex items-center justify-between gap-2">
                  <span
                    class="text-body-02-normal-medium {it.view === 'deny'
                      ? 'text-gray-400'
                      : it.edit === 'allow'
                        ? 'text-primary-500'
                        : 'text-status-danger'}"
                    >{it.view === 'deny'
                      ? '제한'
                      : it.edit === 'allow'
                        ? '허용'
                        : '제한'}</span
                  >
                  {#if it.view === 'deny'}
                    <span
                      class="text-label-01-normal-regular text-right text-gray-500"
                      >조회 제한 시 자동 제한</span
                    >
                  {:else if it.edit === 'deny'}
                    <span
                      class="text-label-01-normal-regular text-right text-gray-500"
                      >읽기만 가능합니다</span
                    >
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {/if}

  <!-- ══════════════════════════════════════════════════════════════ -->
  <!-- B · 접근 레벨 요약 (한 줄 상태)                                 -->
  <!-- ══════════════════════════════════════════════════════════════ -->
  {#if activeLayout === 'B'}
    <div class="space-y-6">
      {#each sections as section}
        <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <p
            class="border-b border-gray-100 bg-gray-50 px-5 py-2.5 text-body-02-normal-semibold text-gray-700"
          >
            {section.label}
          </p>
          {#each section.items as it}
            {@const lv = levelOf(it)}
            <div
              class="flex items-center justify-between border-b border-gray-100 px-5 py-3.5 last:border-b-0"
            >
              <span class="text-body-01-normal-medium text-gray-800"
                >{it.label}</span
              >
              <span
                class="inline-flex items-center gap-2 rounded-full border px-3 py-1 {LEVEL_META[
                  lv
                ].border} {LEVEL_META[lv].bg}"
              >
                <span class="h-2 w-2 rounded-full {LEVEL_META[lv].dot}"></span>
                <span class="text-body-03-normal-medium {LEVEL_META[lv].text}"
                  >{LEVEL_META[lv].label}</span
                >
              </span>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {/if}

  <!-- ══════════════════════════════════════════════════════════════ -->
  <!-- C · 체크 매트릭스 (아이콘 · 색)                                 -->
  <!-- ══════════════════════════════════════════════════════════════ -->
  {#if activeLayout === 'C'}
    <div class="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <!-- 헤더 -->
      <div
        class="grid grid-cols-[3fr_2fr_2fr] items-center border-b border-gray-200 bg-gray-50 px-5 py-2.5"
      >
        <span class="text-body-03-normal-medium text-gray-500">메뉴</span>
        <span class="text-center text-body-03-normal-medium text-gray-500"
          >조회</span
        >
        <span class="text-center text-body-03-normal-medium text-gray-500"
          >편집</span
        >
      </div>
      {#each sections as section}
        <p
          class="border-b border-gray-100 bg-gray-50/60 px-5 py-1.5 text-label-01-normal-medium text-gray-400"
        >
          {section.label}
        </p>
        {#each section.items as it}
          {@const lv = levelOf(it)}
          <div
            class="grid grid-cols-[3fr_2fr_2fr] items-center border-b border-gray-100 px-5 py-3 last:border-b-0"
          >
            <span class="text-body-02-normal-medium text-gray-800"
              >{it.label}</span
            >
            <!-- 조회 셀 -->
            <div class="flex justify-center">
              {#if it.view === 'allow'}
                <span
                  class="flex h-7 w-7 items-center justify-center rounded-full bg-green-50 text-green-600"
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M4.5 10.5l3.5 3.5 7.5-8"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
              {:else}
                <span
                  class="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-400"
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M5 10h10"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                  </svg>
                </span>
              {/if}
            </div>
            <!-- 편집 셀 -->
            <div class="flex justify-center">
              {#if it.edit === 'na'}
                <span class="text-body-02-normal-medium text-gray-300">–</span>
              {:else if lv === 'edit'}
                <span
                  class="flex h-7 w-7 items-center justify-center rounded-full bg-green-50 text-green-600"
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <path
                      d="M4.5 10.5l3.5 3.5 7.5-8"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
              {:else}
                <!-- 읽기전용 or 접근불가 → 잠금 -->
                <span
                  class="flex h-7 w-7 items-center justify-center rounded-full {it.view ===
                  'deny'
                    ? 'bg-gray-100 text-gray-400'
                    : 'bg-amber-50 text-amber-600'}"
                >
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                    <rect
                      x="4.5"
                      y="8.5"
                      width="11"
                      height="7.5"
                      rx="1.5"
                      stroke="currentColor"
                      stroke-width="1.6"
                    />
                    <path
                      d="M7 8.5V6.5a3 3 0 016 0v2"
                      stroke="currentColor"
                      stroke-width="1.6"
                      stroke-linecap="round"
                    />
                  </svg>
                </span>
              {/if}
            </div>
          </div>
        {/each}
      {/each}
    </div>
    <!-- 범례 -->
    <div class="mt-3 flex flex-wrap items-center gap-4 px-1">
      <span class="inline-flex items-center gap-1.5">
        <span
          class="flex h-5 w-5 items-center justify-center rounded-full bg-green-50 text-green-600"
        >
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none"
            ><path
              d="M4.5 10.5l3.5 3.5 7.5-8"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            /></svg
          >
        </span>
        <span class="text-body-03-normal-regular text-gray-500">허용</span>
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span
          class="flex h-5 w-5 items-center justify-center rounded-full bg-amber-50 text-amber-600"
        >
          <svg width="11" height="11" viewBox="0 0 20 20" fill="none"
            ><rect
              x="4.5"
              y="8.5"
              width="11"
              height="7.5"
              rx="1.5"
              stroke="currentColor"
              stroke-width="1.6"
            /><path
              d="M7 8.5V6.5a3 3 0 016 0v2"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            /></svg
          >
        </span>
        <span class="text-body-03-normal-regular text-gray-500">읽기 전용</span>
      </span>
      <span class="inline-flex items-center gap-1.5">
        <span
          class="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-gray-400"
        >
          <svg width="10" height="10" viewBox="0 0 20 20" fill="none"
            ><path
              d="M5 10h10"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
            /></svg
          >
        </span>
        <span class="text-body-03-normal-regular text-gray-500">제한</span>
      </span>
    </div>
  {/if}

  <!-- ══════════════════════════════════════════════════════════════ -->
  <!-- D · 카드 그리드                                                 -->
  <!-- ══════════════════════════════════════════════════════════════ -->
  {#if activeLayout === 'D'}
    <div class="space-y-6">
      {#each sections as section}
        <div>
          <p class="mb-3 text-body-01-normal-semibold text-gray-900">
            {section.label}
          </p>
          <div class="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {#each section.items as it}
              {@const lv = levelOf(it)}
              <div
                class="rounded-lg border border-gray-200 bg-white p-4 ring-1 ring-inset ring-transparent transition-shadow hover:shadow-md"
              >
                <div class="mb-3 flex items-center justify-between">
                  <span class="text-body-01-normal-semibold text-gray-900"
                    >{it.label}</span
                  >
                  <span class="h-2.5 w-2.5 rounded-full {LEVEL_META[lv].dot}"
                  ></span>
                </div>
                <div class="flex flex-col gap-1.5">
                  <div class="flex items-center justify-between">
                    <span class="text-body-03-normal-regular text-gray-500"
                      >조회</span
                    >
                    <span
                      class="text-body-03-normal-medium {it.view === 'allow'
                        ? 'text-green-700'
                        : 'text-gray-400'}"
                      >{it.view === 'allow' ? '허용' : '제한'}</span
                    >
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-body-03-normal-regular text-gray-500"
                      >편집</span
                    >
                    <span
                      class="text-body-03-normal-medium {it.edit === 'na'
                        ? 'text-gray-300'
                        : lv === 'edit'
                          ? 'text-green-700'
                          : lv === 'read'
                            ? 'text-amber-700'
                            : 'text-gray-400'}"
                      >{it.edit === 'na'
                        ? '해당 없음'
                        : lv === 'edit'
                          ? '허용'
                          : '제한'}</span
                    >
                  </div>
                </div>
                <div
                  class="mt-3 rounded-md px-2.5 py-1.5 text-center text-label-01-normal-medium {LEVEL_META[
                    lv
                  ].bg} {LEVEL_META[lv].text}"
                >
                  {LEVEL_META[lv].label}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
