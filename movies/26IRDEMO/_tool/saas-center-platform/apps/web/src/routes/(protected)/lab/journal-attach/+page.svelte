<script lang="ts">
  // 상담일지 작성 화면 — 입력 · 본문 · 출력 시안 (mock only)
  //
  //   헤더 58        날짜·시간 · 프로그램 · 상담실 · 상태 · 케밥   (회기 속성만)
  //   참여자 바 76   칩 + 출결 세그먼트 (옛 '일지 상단바' 흡수 — 이름 중복 제거)
  //   ┌ 스크롤 ─────────────────────────────────────────────┐
  //   │ 🎙 이 회기 녹음  (빈 일지=hero / 작성 중=한 줄)      │  ← 고정 아님
  //   │ 상담 목표 / 진행 내용 / 다음 상담 내용 / 개인 메모     │
  //   └─────────────────────────────────────────────────────┘
  //   하단 바 64     저장 시각 · [전달문 만들기] [저장]
  //
  // 필드노트는 작성 영역 한 곳에만 둔다 — 배치는 소속이 아니라 사용 순간을 따르고,
  // 소속(회기 단위)은 "이 회기 녹음"이라는 라벨이 책임진다. 그룹 상담에서 두 문서에
  // 모두 뜨는 것은 중복이 아니라 사실(양쪽 다 그 녹음으로 쓴다).
  //
  // AI 버튼 라벨은 `[재료]로 [산출물] 만들기` 문형으로 통일.
  import { fade, fly, slide } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import Typography from '@common/components/Typography.svelte'
  import Switch from '$lib/components/Switch.svelte'
  import FieldnoteIcon20 from '$lib/assets/FieldnoteIcon20.svelte'
  import HighlightStarWhite24 from '$lib/assets/HighlightStarWhite24.svelte'
  import LockIcon20 from '$lib/assets/LockIcon20.svelte'
  import ArrowBackIcon24 from '$lib/assets/ArrowBackIcon24.svelte'
  import KebabIcon20 from '$lib/assets/KebabIcon20.svelte'
  import CloseIcon32 from '$lib/assets/CloseIcon32.svelte'

  // ── 랩 시나리오 ───────────────────────────────────────────────
  type NoteState = 'none' | 'processing' | 'completed'
  let noteState = $state<NoteState>('completed')
  const NOTE_STATES: { key: NoteState; label: string }[] = [
    { key: 'none', label: '녹음 없음' },
    { key: 'processing', label: '분석 중' },
    { key: 'completed', label: '분석 완료' }
  ]
  // 1:1이면 참여자 칩 레일이 숨는다(실제 코드 showClientTabs와 동일)
  let clientCount = $state(2)
  const showClientTabs = $derived(clientCount > 1)

  const SAMPLE = {
    goal: '감정에 이름을 붙여 표현하는 연습을 이어간다.',
    progress: `감정카드 12장으로 지난 한 주를 돌아보는 활동을 진행했다. 초반에는 "몰라요"로 회피하는 반응이 3회 관찰되었으나, 치료사가 상황을 먼저 서술해주자 "속상했어"라고 스스로 명명하는 데 성공했다.\n놀이 중 또래 갈등 장면을 재현할 때 목소리가 작아지는 패턴이 반복된다.`,
    nextPlan:
      '가정에서 감정카드를 사용한 결과를 확인하고, 또래 갈등 상황 역할극을 시도한다.',
    privateMemo:
      '보호자 기대 수준이 높아 속도 조절이 필요. 지난 통화에서 "또래보다 늦다"는 표현 반복됨.'
  }

  let goal = $state(SAMPLE.goal)
  let progress = $state(SAMPLE.progress)
  let nextPlan = $state(SAMPLE.nextPlan)
  let privateMemo = $state(SAMPLE.privateMemo)

  function clearJournal() {
    goal = ''
    progress = ''
    nextPlan = ''
    privateMemo = ''
    shareText = ''
    isShared = false
    savedAt = ''
  }
  function fillJournal() {
    goal = SAMPLE.goal
    progress = SAMPLE.progress
    nextPlan = SAMPLE.nextPlan
    privateMemo = SAMPLE.privateMemo
    savedAt = '15:04'
  }

  const hasJournalContent = $derived(
    !!(goal.trim() || progress.trim() || nextPlan.trim() || privateMemo.trim())
  )
  // 전달문 재료 — 개인 메모는 제외
  const hasMaterial = $derived(
    !!(goal.trim() || progress.trim() || nextPlan.trim())
  )

  // ── 저장 (하단 좌측이 소유) ───────────────────────────────────
  let savedAt = $state('15:04')
  let justSaved = $state(false)
  let savedTimer: ReturnType<typeof setTimeout> | null = null
  function handleSave() {
    savedAt = '15:22'
    justSaved = true
    if (savedTimer) clearTimeout(savedTimer)
    savedTimer = setTimeout(() => (justSaved = false), 1800)
  }

  // ── 초안 이력 (녹음 산출물 — 녹음 없으면 0) ────────────────────
  const MOCK_DRAFTS = [
    {
      id: 'd1',
      at: '2026-08-27 15:04',
      template: '기본 서식',
      entries: [
        {
          label: '주요 주제',
          field: 'goal',
          text: '감정 명명 연습 · 또래 갈등'
        },
        {
          label: '진전 사항',
          field: 'progress',
          text: '회피 반응 3회 → 후반 자발적 감정 명명 1회 성공'
        }
      ]
    },
    {
      id: 'd2',
      at: '2026-08-27 15:11',
      template: 'SOAP',
      entries: [
        {
          label: '다음 회기 목표',
          field: 'nextPlan',
          text: '감정카드 가정 활용 결과 확인 · 역할극 도입'
        }
      ]
    }
  ]
  let generatedDrafts = $state(2)
  const draftCount = $derived(noteState === 'completed' ? generatedDrafts : 0)

  let isDraftOpen = $state(false)
  let expandedDraft = $state('')
  function insertDraft(field: string, text: string) {
    const append = (prev: string) => (prev.trim() ? `${prev}\n\n${text}` : text)
    if (field === 'goal') goal = append(goal)
    else if (field === 'progress') progress = append(progress)
    else nextPlan = append(nextPlan)
    isDraftOpen = false
  }

  // ── 필드노트 시트 (비차단 — 열어둔 채 쓴다) ────────────────────
  let isSheetOpen = $state(false)
  let isGenerating = $state(false)
  function generateDraft() {
    if (isGenerating) return
    isGenerating = true
    setTimeout(() => {
      isGenerating = false
      generatedDrafts += 1
      isSheetOpen = false
      isDraftOpen = true
    }, 1400)
  }

  // ── 전달문 모달 (차단 — 다 쓴 뒤의 별도 작업) ──────────────────
  let isTransferOpen = $state(false)
  let shareText = $state('')
  let shareDraft = $state('')
  let isShared = $state(false)
  let shareDraftShared = $state(false)
  let isConverting = $state(false)

  const MOCK_CONVERTED = `오늘은 서연이가 자기 마음에 이름을 붙이는 연습을 했어요.

처음에는 "몰라요"라고 답하는 순간이 있었지만, 상황을 하나씩 짚어주자 "속상했어"라고 스스로 말해주었어요. 자기 감정을 말로 꺼내본 게 오늘의 가장 큰 걸음이에요.

집에서는 잠들기 전에 오늘 기분을 감정카드에서 하나 골라보는 걸 해보시면 좋겠어요. 잘 고르지 못해도 괜찮으니, 고르려고 한 시간 자체를 칭찬해 주세요.

다음 시간에는 감정카드를 어떻게 써봤는지 함께 이야기 나눠볼 예정이에요.`

  function openTransfer() {
    if (!hasMaterial) return
    shareDraft = shareText
    shareDraftShared = isShared
    isTransferOpen = true
  }
  function convertInModal() {
    if (isConverting) return
    isConverting = true
    setTimeout(() => {
      shareDraft = MOCK_CONVERTED
      isConverting = false
    }, 1200)
  }
  function saveTransfer() {
    shareText = shareDraft
    isShared = shareDraft.trim() ? shareDraftShared : false
    isTransferOpen = false
  }

  // 하단 버튼이 상태를 말한다 — 문서에 카드가 없어도 상태를 안다
  const transferLabel = $derived(
    isShared
      ? '전달문 · 공유 중'
      : shareText.trim()
        ? '전달문 · 작성됨'
        : '전달문 만들기'
  )

  // ── 괘선 그리드 auto-grow (실제 에디터와 동일: 36px 라인) ──────
  const LINE = 36
  const MIN_LINES = 3
  function autoGrow(node: HTMLTextAreaElement) {
    const resize = () => {
      node.style.height = `${LINE * MIN_LINES}px`
      const needed = Math.max(node.scrollHeight, LINE * MIN_LINES)
      node.style.height = `${Math.ceil(needed / LINE) * LINE}px`
    }
    resize()
    node.addEventListener('input', resize)
    return { destroy: () => node.removeEventListener('input', resize) }
  }

  // 실제 화면 사례에 맞춘 목록 — 보호자도 참여자 칩으로 들어온다
  const ALL_CLIENTS = [
    { n: '김서연', i: '서' },
    { n: '김도윤', i: '도' },
    { n: '김도윤의 보호자', i: '보' },
    { n: '박하준', i: '하' }
  ]
  const CLIENTS = $derived(ALL_CLIENTS.slice(0, clientCount))
  const ATTENDANCE = [
    { l: '참석', on: true },
    { l: '취소', on: false },
    { l: '노쇼', on: false }
  ]
</script>

<div in:fade class="flex h-full w-full flex-col gap-6 bg-gray-50 pb-10">
  <!-- 랩 헤더 -->
  <div class="shrink-0">
    <Typography variant="headline-01-normal-semibold" color="text-gray-900">
      상담일지 — 입력 · 본문 · 출력 Lab
    </Typography>
    <Typography
      variant="body-02-normal-regular"
      color="text-gray-500"
      className="mt-3 block"
    >
      고정 층을 3개 → 2개로 줄였어요. 참여자 칩 레일이 옛 '일지 상단바'를 흡수해
      이름 중복이 사라지고, 회기 속성(프로그램·상담실)은 헤더로, 저장 시각은
      하단으로 옮겼어요. 필드노트는 고정 자리를 쓰지 않고 문서 맨 위에만 있어요.
    </Typography>
  </div>

  <!-- 시나리오 컨트롤 -->
  <div
    class="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-3 rounded-xl bg-white px-5 py-4 ring-1 ring-inset ring-gray-200"
  >
    <div class="flex items-center gap-3">
      <span class="text-body-03-normal-medium text-gray-500">필드노트</span>
      <div
        class="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5"
      >
        {#each NOTE_STATES as s (s.key)}
          <button
            type="button"
            onclick={() => (noteState = s.key)}
            class="h-7 rounded-md px-2.5 text-body-03-normal-medium transition-colors {noteState ===
            s.key
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'}"
          >
            {s.label}
          </button>
        {/each}
      </div>
    </div>
    <div class="flex items-center gap-3">
      <span class="text-body-03-normal-medium text-gray-500">참여자</span>
      <div
        class="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5"
      >
        {#each [1, 2, 4] as n (n)}
          <button
            type="button"
            onclick={() => (clientCount = n)}
            class="h-7 rounded-md px-2.5 text-body-03-normal-medium transition-colors {clientCount ===
            n
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'}"
          >
            {n === 1 ? '1:1 (레일 숨김)' : `그룹 ${n}명`}
          </button>
        {/each}
      </div>
    </div>
    <div class="ml-auto flex items-center gap-2">
      <button
        type="button"
        onclick={clearJournal}
        class="h-9 rounded-lg border border-gray-200 bg-white px-3 text-body-03-normal-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-800"
      >
        일지 비우기 (hero 보기)
      </button>
      <button
        type="button"
        onclick={fillJournal}
        class="h-9 rounded-lg border border-gray-200 bg-white px-3 text-body-03-normal-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-800"
      >
        예시 채우기
      </button>
    </div>
  </div>

  <!-- ══════════ 회기 상세 패널 목업 ══════════ -->
  <div
    class="flex h-[760px] w-full min-w-0 shrink-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white"
  >
    <!-- ══ 헤더 58 — 회기 속성만 (프로그램·상담실 흡수) ══ -->
    <div
      class="flex h-[58px] shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-6"
    >
      <div class="flex min-w-0 items-center gap-2">
        <span class="-ml-1 shrink-0 rounded-lg p-1 text-gray-400">
          <ArrowBackIcon24 />
        </span>
        <span class="shrink-0 text-title-01-normal-semibold text-gray-900">
          2026-08-27 (수) 14:00 ~ 15:00
        </span>
        <span class="h-3 w-px shrink-0 bg-gray-300"></span>
        <!-- 좁아지면 상담실이 먼저 사라지고(hidden lg:inline), 그다음 프로그램명이 잘린다 -->
        <span
          class="min-w-0 truncate-safe text-body-02-normal-regular text-body-subtle"
        >
          놀이치료 - 그룹 - 그룹
        </span>
        <span
          class="hidden shrink-0 text-body-02-normal-regular text-body-subtle lg:inline"
        >
          · 상담실3
        </span>
        <span class="h-3 w-px shrink-0 bg-gray-300"></span>
        <span class="shrink-0 text-body-02-normal-medium text-gray-500">
          완료
        </span>
      </div>
      <span class="shrink-0 p-2 text-gray-400">
        <KebabIcon20 color="currentColor" />
      </span>
    </div>

    <!-- ══ 참여자 바 — 칩 + 출결. 옛 '일지 상단바'를 흡수했다 ══
         출결이 선택된 칩과 같은 줄에 있어 "이 사람의 출결"로 읽힌다.
         1:1이면 칩 레일 대신 이름 한 줄(60) — 실제 코드 showClientTabs와 동일 -->
    <div
      class="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 px-6 {showClientTabs
        ? 'h-[76px] py-4'
        : 'h-[60px]'}"
    >
      {#if showClientTabs}
        <div class="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {#each CLIENTS as c, i (c.n)}
            {@const active = i === 0}
            <span
              class="flex h-11 shrink-0 items-center gap-2 rounded-full border pl-[10px] pr-2 {active
                ? 'border-border-active bg-blue-50/60'
                : 'border-gray-200 bg-white'}"
            >
              <span
                class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-caption-01-normal-medium text-gray-600"
                >{c.i}</span
              >
              <span
                class="text-body-02-normal-medium {active
                  ? 'text-border-active'
                  : 'text-gray-700'}">{c.n}</span
              >
              <span class="h-1.5 w-1.5 rounded-full bg-green-500"></span>
              <!-- 선택된 칩에만 내담자 상세 이동(↗) — 옛 상단바 이름 링크를 흡수 -->
              {#if active}
                <button
                  type="button"
                  aria-label="{c.n} 상세"
                  class="ml-0.5 rounded p-0.5 text-primary-500 transition-colors hover:bg-white/70"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M5 3h6v6M11 3 3.5 10.5"
                      stroke="currentColor"
                      stroke-width="1.4"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
              {/if}
            </span>
          {/each}
        </div>
      {:else}
        <div class="flex min-w-0 items-center gap-2">
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-caption-01-normal-medium text-gray-600"
            >서</span
          >
          <span class="text-body-01-normal-semibold text-gray-900">김서연</span>
          <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500"></span>
          <button
            type="button"
            aria-label="김서연 상세"
            class="rounded p-0.5 text-primary-500 transition-colors hover:bg-gray-100"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M5 3h6v6M11 3 3.5 10.5"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>
      {/if}

      <div
        class="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5"
      >
        {#each ATTENDANCE as s (s.l)}
          <span
            class="flex h-7 items-center rounded-md px-2.5 text-body-03-normal-medium {s.on
              ? 'bg-white text-etc-green-yellow shadow-sm'
              : 'text-gray-500'}">{s.l}</span
          >
        {/each}
      </div>
    </div>

    <!-- ══ 괘선지 본문 (내부 스크롤) ══ -->
    <div class="min-h-0 flex-1 overflow-y-auto">
      <div class="journal-paper min-h-full pb-9">
        <!-- ══ 문서 맨 위 = 들어오는 것. 고정이 아니라 문서의 일부 ══
             빈 일지 → hero(분기점) / 작성 중 → 한 줄(재진입점) / 녹음 없음 → 숨김 -->
        {#if noteState !== 'none'}
          {#if !hasJournalContent}
            <div class="mx-6 mt-6" in:fade={{ duration: 160 }}>
              <div
                class="rounded-xl border border-gray-200 p-5"
                style="background: linear-gradient(to bottom, rgba(34, 234, 191, 0.05), rgba(68, 134, 255, 0.05)), #ffffff;"
              >
                <div class="flex items-center gap-2">
                  <FieldnoteIcon20 />
                  <span class="text-body-01-normal-semibold text-gray-900">
                    {noteState === 'processing'
                      ? '이 회기 녹음을 정리하고 있어요'
                      : '이 회기 녹음이 있어요'}
                  </span>
                  <span class="text-body-03-normal-regular text-gray-500">
                    {noteState === 'processing'
                      ? '보통 5분 안에 끝나요'
                      : '42분'}
                  </span>
                </div>
                <div class="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onclick={() => (isSheetOpen = true)}
                    class="h-10 rounded-lg border border-gray-200 bg-white px-4 text-body-02-normal-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-800"
                  >
                    대화 보기
                  </button>
                  <button
                    type="button"
                    onclick={generateDraft}
                    disabled={noteState !== 'completed' || isGenerating}
                    class="inline-flex h-10 items-center gap-2 rounded-lg px-4 text-white transition-[filter] {noteState !==
                      'completed' || isGenerating
                      ? 'cursor-not-allowed bg-gray-300'
                      : 'hover:brightness-105'}"
                    style={noteState !== 'completed' || isGenerating
                      ? ''
                      : 'background: linear-gradient(to right, #9B5DFF, #FF00B7); box-shadow: 0 2px 15.1px 0 rgba(246, 0, 255, 0.31);'}
                  >
                    {#if isGenerating}
                      <span
                        class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                      ></span>
                    {:else}
                      <HighlightStarWhite24 />
                    {/if}
                    <span class="text-body-02-normal-medium">
                      {isGenerating
                        ? '초안 만드는 중'
                        : '이 대화로 초안 만들기'}
                    </span>
                    <span class="text-[13px] text-white/70">(크레딧 5)</span>
                  </button>
                  {#if draftCount > 0}
                    <button
                      type="button"
                      onclick={() => (isDraftOpen = true)}
                      class="h-10 rounded-lg px-3 text-body-02-normal-medium text-gray-500 transition-colors hover:text-gray-700"
                    >
                      초안 {draftCount}건 보기
                    </button>
                  {/if}
                </div>
              </div>
            </div>
          {:else}
            <!-- 작성 중 = 한 줄(36). sticky 아님 — 스크롤과 함께 올라간다 -->
            <div
              class="mx-6 mt-4 flex h-9 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3"
            >
              <FieldnoteIcon20 />
              <span class="text-body-03-normal-medium text-gray-700">
                이 회기 녹음
              </span>
              <span class="text-body-03-normal-regular text-gray-500">
                {noteState === 'processing' ? '분석 중' : '42분'}
              </span>
              {#if draftCount > 0}
                <span class="h-2.5 w-px bg-gray-200"></span>
                <button
                  type="button"
                  onclick={() => (isDraftOpen = true)}
                  class="flex items-center gap-1 text-body-03-normal-regular text-gray-500 transition-colors hover:text-gray-700"
                >
                  초안
                  <span
                    class="flex h-4 min-w-4 items-center justify-center rounded-full bg-gray-100 px-1 text-caption-01-normal-medium text-gray-600"
                    >{draftCount}</span
                  >
                </button>
              {/if}
              <button
                type="button"
                onclick={() => (isSheetOpen = true)}
                class="ml-auto text-body-03-normal-medium text-primary-500 transition-colors hover:text-primary-600"
              >
                대화 보기
              </button>
            </div>
          {/if}
        {/if}

        <div class="mx-6 {noteState === 'none' ? 'mt-0' : 'mt-6'}">
          <div
            class="flex h-9 items-center text-[16px] font-medium text-gray-600"
          >
            상담 목표
          </div>
          <textarea
            bind:value={goal}
            use:autoGrow
            placeholder="상담 목표를 작성해주세요"
            class="journal-line-input block resize-none overflow-hidden px-3 py-3.5"
          ></textarea>
        </div>

        <div class="mx-6 mt-9">
          <div
            class="flex h-9 items-center text-[16px] font-medium text-gray-600"
          >
            진행 내용
          </div>
          <textarea
            bind:value={progress}
            use:autoGrow
            placeholder="진행 내용을 작성해주세요"
            class="journal-line-input block resize-none overflow-hidden px-3 py-3.5"
          ></textarea>
        </div>

        <div class="mx-6 mt-9">
          <div
            class="flex h-9 items-center text-[16px] font-medium text-gray-600"
          >
            다음 상담 내용
          </div>
          <textarea
            bind:value={nextPlan}
            use:autoGrow
            placeholder="다음 상담 내용을 작성해주세요"
            class="journal-line-input block resize-none overflow-hidden px-3 py-3.5"
          ></textarea>
        </div>

        <div class="mx-6 mt-9">
          <div class="flex h-9 items-center gap-1.5">
            <LockIcon20 />
            <span class="text-[16px] font-medium text-gray-600">개인 메모</span>
            <span class="text-[14px] text-gray-500">
              개인 기록용 메모로 본인만 확인가능해요
            </span>
          </div>
          <textarea
            bind:value={privateMemo}
            use:autoGrow
            placeholder="개인 메모를 작성해주세요"
            class="journal-line-input block resize-none overflow-hidden px-3 py-3.5"
          ></textarea>
        </div>
      </div>
    </div>

    <!-- ══ 하단 바 64 = 나가는 것 + 저장 시각 ══ -->
    <div
      class="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 px-5 py-3"
    >
      <div class="flex min-w-0 items-center">
        {#if !hasMaterial}
          <span class="text-body-03-normal-regular text-gray-400">
            상담 목표 · 진행 내용 · 다음 상담 내용 중 하나를 작성하면 전달문을
            만들 수 있어요
          </span>
        {:else if justSaved}
          <span
            in:fade={{ duration: 200 }}
            class="flex items-center gap-1 text-body-03-normal-medium text-mint-500"
          >
            <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path
                d="M3.5 8.5L6.5 11.5L12.5 4.5"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            저장됨
          </span>
        {:else if savedAt}
          <span class="text-body-03-normal-regular text-gray-400">
            {savedAt}에 저장됨
          </span>
        {:else}
          <span class="text-body-03-normal-regular text-gray-400">
            아직 저장하지 않았어요
          </span>
        {/if}
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onclick={openTransfer}
          disabled={!hasMaterial}
          title={!hasMaterial
            ? '상담 목표 · 진행 내용 · 다음 상담 내용 중 하나를 먼저 작성해주세요'
            : undefined}
          class="flex h-10 items-center gap-2 rounded-lg border px-4 text-body-02-normal-medium transition-colors {!hasMaterial
            ? 'cursor-not-allowed border-gray-200 bg-white text-gray-300'
            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800'}"
        >
          {#if isShared}
            <span class="h-1.5 w-1.5 rounded-full bg-status-success"></span>
          {/if}
          {transferLabel}
        </button>
        <button
          type="button"
          onclick={handleSave}
          class="flex h-10 w-20 shrink-0 items-center justify-center rounded-lg bg-primary-500 text-body-02-normal-medium text-white transition-colors hover:bg-primary-600"
        >
          저장
        </button>
      </div>
    </div>
  </div>

  <!-- 시안 요점 -->
  <div class="grid shrink-0 grid-cols-1 gap-4 xl:grid-cols-3">
    <div class="rounded-2xl bg-white p-5 ring-1 ring-inset ring-gray-200">
      <Typography variant="title-02-semibold" color="text-gray-900">
        고정 3층 → 2층
      </Typography>
      <ul
        class="mt-3 space-y-2 text-body-02-normal-regular text-gray-600 [&>li]:-indent-4 [&>li]:pl-4"
      >
        <li>
          · 칩 레일과 옛 상단바가 "누구의 일지인가"를 두 번 말하고 있었다 → 병합
        </li>
        <li>· 출결이 선택된 칩과 같은 줄 = "이 사람의 출결"로 읽힘</li>
        <li>· 회기 속성(프로그램·상담실)은 헤더로, 저장 시각은 하단으로</li>
        <li>
          · 고정 <span class="text-gray-800">312 → 198</span>(그룹) ·
          <span class="text-gray-800">236 → 122</span>(1:1)
        </li>
      </ul>
    </div>
    <div class="rounded-2xl bg-white p-5 ring-1 ring-inset ring-gray-200">
      <Typography variant="title-02-semibold" color="text-gray-900">
        필드노트는 작성 영역 한 곳
      </Typography>
      <ul
        class="mt-3 space-y-2 text-body-02-normal-regular text-gray-600 [&>li]:-indent-4 [&>li]:pl-4"
      >
        <li>· 배치는 소속이 아니라 사용 순간을 따른다 — 소속은 라벨이 책임</li>
        <li>
          · 그룹 상담에서 두 문서에 다 뜨는 건 중복이 아니라 사실 — 양쪽 다 그
          녹음으로 쓴다
        </li>
        <li>· 고정 자리를 쓰지 않는다(스크롤과 함께 올라감)</li>
        <li>
          · 재진입은 시트가 비차단이라 <span class="text-gray-800"
            >열어둔 채</span
          >
          쓰면 돼서 드물다
        </li>
      </ul>
    </div>
    <div class="rounded-2xl bg-white p-5 ring-1 ring-inset ring-gray-200">
      <Typography variant="title-02-semibold" color="text-gray-900">
        입력 · 본문 · 출력
      </Typography>
      <ul
        class="mt-3 space-y-2 text-body-02-normal-regular text-gray-600 [&>li]:-indent-4 [&>li]:pl-4"
      >
        <li>· 문서 맨 위 = 들어오는 것(녹음·초안)</li>
        <li>· 하단 = 나가는 것(전달문) + 저장 시각</li>
        <li>
          · 전달 버튼이 상태를 말한다(만들기 / 작성됨 / 공유 중) → 문서에 카드가
          없어도 상태를 안다
        </li>
        <li>· 라벨은 `[재료]로 [산출물] 만들기` 문형으로 통일</li>
      </ul>
    </div>
  </div>
</div>

<!-- ══════ 초안 이력 ══════ -->
{#if isDraftOpen}
  <div class="fixed inset-0 z-[70]" transition:fade={{ duration: 120 }}>
    <button
      type="button"
      class="absolute inset-0 cursor-default bg-black/10"
      aria-label="닫기"
      onclick={() => (isDraftOpen = false)}
    ></button>
    <div
      class="absolute left-1/2 top-1/2 w-[520px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-5 shadow-xl"
      transition:fly={{ y: 8, duration: 180, easing: cubicOut }}
    >
      <div class="mb-3 flex items-center justify-between">
        <span class="text-headline-02-normal-semibold text-gray-800">
          AI 초안 이력
        </span>
        <button
          type="button"
          onclick={() => (isDraftOpen = false)}
          aria-label="닫기"
          class="text-gray-400"><CloseIcon32 /></button
        >
      </div>
      <p class="mb-3 text-body-03-normal-regular text-gray-500">
        이 회기 녹음에서 만든 초안이에요. 본문은 덮어쓰지 않고 이어붙여요.
      </p>
      <div class="max-h-[420px] space-y-2 overflow-y-auto">
        {#each MOCK_DRAFTS.slice(0, draftCount) as d (d.id)}
          {@const open = expandedDraft === d.id}
          <div class="rounded-lg border border-gray-200 bg-gray-50/60">
            <button
              type="button"
              onclick={() => (expandedDraft = open ? '' : d.id)}
              class="flex w-full items-center gap-2 px-4 py-3 text-left"
            >
              <span class="text-[14px] text-gray-700">{d.at}</span>
              <span
                class="rounded-full bg-white px-2 py-0.5 text-[12px] text-gray-500 ring-1 ring-inset ring-gray-200"
                >{d.template}</span
              >
              <span
                class="ml-auto text-gray-400 transition-transform {open
                  ? 'rotate-180'
                  : ''}">⌄</span
              >
            </button>
            {#if open}
              <div
                class="space-y-3 border-t border-gray-200 px-4 py-3"
                transition:slide={{ duration: 160 }}
              >
                {#each d.entries as e (e.label)}
                  <div>
                    <div class="flex items-center gap-2">
                      <span class="text-[13px] font-medium text-gray-500"
                        >{e.label}</span
                      >
                      <button
                        type="button"
                        onclick={() => insertDraft(e.field, e.text)}
                        class="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[12px] text-primary-500 transition-colors hover:bg-primary-50"
                      >
                        본문에 넣기
                      </button>
                    </div>
                    <p class="mt-1 text-[14px] text-gray-700">{e.text}</p>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<!-- ══════ 필드노트 시트 — 비차단(열어둔 채 쓴다) ══════ -->
{#if isSheetOpen}
  <div
    class="pointer-events-none fixed inset-0 z-[60] flex items-end justify-start p-6 pb-0"
    transition:fade={{ duration: 150 }}
    role="presentation"
  >
    <div
      class="pointer-events-auto flex h-[70vh] max-h-[720px] w-[600px] max-w-full flex-col overflow-hidden rounded-t-[20px] shadow-[0_2px_20px_0_rgba(0,0,0,0.16)]"
      style="background: linear-gradient(to bottom, rgba(34, 234, 191, 0.04), rgba(68, 134, 255, 0.04)), #ffffff;"
      transition:fly={{ y: 24, duration: 240, easing: cubicOut }}
    >
      <div
        class="flex h-[58px] shrink-0 items-center justify-between border-b border-gray-100 px-5"
      >
        <div class="flex items-center gap-2">
          <FieldnoteIcon20 />
          <span class="text-body-01-normal-semibold text-gray-900">
            이 회기 녹음
          </span>
          <span class="text-body-03-normal-regular text-gray-500">
            {noteState === 'processing' ? '· 분석 중' : '· 42분'}
          </span>
        </div>
        <button
          type="button"
          onclick={() => (isSheetOpen = false)}
          aria-label="닫기"
          class="text-gray-400"><CloseIcon32 /></button
        >
      </div>

      {#if noteState === 'processing'}
        <div
          class="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"
        >
          <span
            class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-400"
          ></span>
          <p class="text-title-01-normal-semibold text-body-strong">
            대화를 정리하고 있어요
          </p>
          <p class="text-body-02-normal-regular text-body-subtle">
            보통 5분 안에 끝나요. 먼저 일지를 작성하셔도 돼요.
          </p>
        </div>
      {:else}
        <div
          class="flex shrink-0 items-center gap-5 border-b border-gray-100 px-5"
        >
          {#each ['전체 대화', '메모', 'AI 분석'] as t, i (t)}
            <span
              class="flex h-11 items-center text-body-02-normal-medium {i === 0
                ? 'border-b-2 border-gray-900 text-gray-900'
                : 'text-gray-500'}">{t}</span
            >
          {/each}
        </div>
        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {#each [{ s: '상담사', t: '오늘은 이 카드들 중에서 지난주에 제일 많이 들었던 마음을 골라볼까?' }, { s: '김서연', t: '음... 몰라요.' }, { s: '상담사', t: '괜찮아. 그럼 선생님이 먼저 말해볼게. 금요일에 친구가 먼저 가버렸을 때는 어땠어?' }, { s: '김서연', t: '속상했어.' }, { s: '상담사', t: '지금 그 말 해준 거, 되게 큰 거야.' }] as m, i (i)}
            <div class="flex gap-3">
              <span
                class="w-14 shrink-0 text-body-03-normal-medium {m.s ===
                '상담사'
                  ? 'text-primary-500'
                  : 'text-gray-500'}">{m.s}</span
              >
              <p class="text-body-02-normal-regular text-gray-700">{m.t}</p>
            </div>
          {/each}
        </div>
        <div class="shrink-0 border-t border-gray-100 p-4">
          <button
            type="button"
            onclick={generateDraft}
            disabled={isGenerating}
            class="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg text-white transition-[filter] {isGenerating
              ? 'cursor-not-allowed bg-gray-300'
              : 'hover:brightness-105'}"
            style={isGenerating
              ? ''
              : 'background: linear-gradient(to right, #9B5DFF, #FF00B7); box-shadow: 0 2px 15.1px 0 rgba(246, 0, 255, 0.31);'}
          >
            {#if isGenerating}
              <span
                class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              ></span>
              <span class="text-body-01-normal-medium">초안 만드는 중</span>
            {:else}
              <HighlightStarWhite24 />
              <span class="text-body-01-normal-medium">
                이 대화로 초안 만들기
              </span>
              <span class="text-[13px] text-white/60">(크레딧 5)</span>
            {/if}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- ══════ 전달문 모달 — 차단형(다 쓴 뒤의 별도 작업) ══════ -->
{#if isTransferOpen}
  <div
    class="fixed inset-0 z-[80] flex items-center justify-center p-6"
    transition:fade={{ duration: 150 }}
  >
    <button
      type="button"
      class="absolute inset-0 cursor-default bg-black/40"
      aria-label="닫기"
      onclick={() => (isTransferOpen = false)}
    ></button>
    <div
      class="relative flex h-[640px] max-h-[88vh] w-[960px] max-w-[94vw] flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      transition:fly={{ y: 12, duration: 200, easing: cubicOut }}
      role="dialog"
      tabindex="-1"
    >
      <div
        class="flex shrink-0 items-center justify-between gap-4 border-b border-gray-100 px-5 py-4"
      >
        <span class="text-headline-02-normal-semibold text-gray-800">
          전달문 만들기
        </span>
        <button
          type="button"
          onclick={() => (isTransferOpen = false)}
          aria-label="닫기"
          class="text-gray-400"><CloseIcon32 /></button
        >
      </div>

      <!-- 좌 재료 / 우 결과 — 변환이라는 행위를 그림으로 -->
      <div
        class="grid min-h-0 flex-1 grid-cols-1 gap-5 overflow-hidden p-5 lg:grid-cols-2"
      >
        <section class="flex min-h-0 flex-col">
          <div class="mb-3 flex items-baseline gap-2">
            <span class="text-body-02-normal-medium text-gray-700">
              이 내용으로 만들어요
            </span>
            <span class="text-body-03-normal-regular text-gray-400">
              2026-08-27 회기 · 김서연
            </span>
          </div>
          <div
            class="min-h-0 flex-1 space-y-6 overflow-y-auto rounded-xl bg-bg-base p-4"
          >
            {#each [{ l: '상담 목표', v: goal }, { l: '진행 내용', v: progress }, { l: '다음 상담 내용', v: nextPlan }] as f (f.l)}
              <div>
                <div class="text-body-03-normal-medium text-gray-500">
                  {f.l}
                </div>
                <p
                  class="mt-3 whitespace-pre-line text-body-02-normal-regular"
                  style={f.v.trim() ? 'color:#374151' : 'color:#9ca3af'}
                >
                  {f.v.trim() || '작성 안 함'}
                </p>
              </div>
            {/each}
          </div>
          <!-- 개인 메모가 위 목록에 '자리조차 없다'는 게 제외의 증명 -->
          <div class="mt-3 flex items-center gap-1.5">
            <LockIcon20 />
            <span class="text-body-03-normal-regular text-gray-500">
              개인 메모는 여기 없어요 — 재료로 쓰이지 않아요
            </span>
          </div>
        </section>

        <section class="flex min-h-0 flex-col">
          <div class="mb-3 flex items-baseline gap-2">
            <span class="text-body-02-normal-medium text-gray-700">
              이렇게 전달돼요
            </span>
            <span class="text-body-03-normal-regular text-gray-400">
              김서연님 가족이 앱에서 봐요
            </span>
          </div>
          {#if isConverting}
            <div
              class="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-input-border bg-white"
            >
              <div class="flex items-center gap-2">
                <span
                  class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-gray-400"
                ></span>
                <span class="text-body-02-normal-regular text-gray-500">
                  전할 내용을 고르는 중이에요
                </span>
              </div>
            </div>
          {:else}
            <textarea
              bind:value={shareDraft}
              maxlength={2000}
              placeholder="내담자·보호자에게 전할 내용을 적어주세요. 아래 버튼으로 왼쪽 일지에서 만들 수도 있어요."
              class="min-h-0 flex-1 resize-none rounded-xl border border-input-border bg-white px-4 py-3 text-[15px] leading-[26px] text-gray-900 placeholder:text-gray-400 focus:border-border-active focus:outline-none"
            ></textarea>
          {/if}
          <button
            type="button"
            onclick={convertInModal}
            disabled={isConverting}
            class="mt-3 inline-flex h-11 items-center justify-center gap-2 self-start rounded-lg px-4 text-white transition-[filter] {isConverting
              ? 'cursor-not-allowed bg-gray-300'
              : 'hover:brightness-105'}"
            style={isConverting
              ? ''
              : 'background: linear-gradient(to right, #9B5DFF, #FF00B7); box-shadow: 0 2px 15.1px 0 rgba(246, 0, 255, 0.31);'}
          >
            <HighlightStarWhite24 />
            <span class="text-body-02-normal-medium">
              {shareDraft.trim() ? '다시 만들기' : '이 일지로 전달문 만들기'}
            </span>
            <span class="text-[13px] text-white/70">(크레딧 2)</span>
          </button>
        </section>
      </div>

      <div
        class="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 px-5 pb-5 pt-4"
      >
        <div class="flex min-w-0 items-center gap-3">
          <div class="flex items-center gap-2">
            <Switch
              bind:checked={shareDraftShared}
              disabled={!shareDraft.trim()}
              ariaLabel="앱에서 공유"
            />
            <span
              class="text-body-02-normal-medium {shareDraftShared
                ? 'text-gray-700'
                : 'text-gray-400'}"
            >
              {shareDraftShared ? '공유 중' : '공유 안 함'}
            </span>
          </div>
          <span class="text-body-03-normal-regular text-gray-400">
            {shareDraftShared
              ? '사본이 전달되는 게 아니라 앱에서 열람만 되고, 끄면 즉시 중단돼요'
              : '공유를 켜야 앱에서 볼 수 있어요. 저장만 해두고 나중에 켜도 돼요'}
          </span>
        </div>
        <div class="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onclick={() => (isTransferOpen = false)}
            class="h-11 rounded-lg border border-gray-200 bg-white px-4 text-body-02-normal-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-800"
          >
            취소
          </button>
          <button
            type="button"
            onclick={saveTransfer}
            class="h-11 rounded-lg bg-primary-500 px-5 text-body-02-normal-medium text-white transition-colors hover:bg-primary-600"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
