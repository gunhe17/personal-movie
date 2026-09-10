<style>
  /* 심각도 점 — 노랑은 흰 배경 대비가 2:1대라 면만으로는 형태가 흐릿하다.
     같은 계열의 진한 색으로 테두리를 둘러 윤곽을 잡는다.
     다크에서는 어두운 면 위라 밝은 색이 그대로 보여 테두리가 transparent다. */
  .sev-dot {
    width: 8px;
    height: 8px;
    flex-shrink: 0;
    border-radius: 9999px;
    border: 1px solid;
  }
  .sev-dot-high {
    background: var(--sev-high);
    border-color: var(--sev-high-line);
  }
  .sev-dot-medium {
    background: var(--sev-medium);
    border-color: var(--sev-medium-line);
  }
  .sev-dot-low {
    background: var(--chrome-fg-3);
    border-color: transparent;
  }

  /* 포커스 링의 offset 색은 Tailwind 기본이 흰색이라
     다크 카드 위에서 흰 테두리가 생긴다 — 카드 배경을 따라가게 한다. */
  .fix-btn {
    --tw-ring-offset-color: var(--chrome-raised);
  }

  /* 체크 표시가 왼쪽에서 오른쪽으로 그려지는 애니메이션.
     path 총 길이는 23.35(계산값) — 24로 잡아 여유를 둔다. */
  .check-draw path {
    stroke-dasharray: 24;
    stroke-dashoffset: 24;
    /* both = 지연 중에도 시작 상태(안 보임)를 유지하고, 끝나면 그대로 남는다 */
    animation: check-draw 0.34s cubic-bezier(0.65, 0, 0.35, 1) both;
    /* 지연은 svg에 인라인으로 --draw-delay를 심어 전달한다
       (animation-delay:inherit은 svg 자체에 애니메이션이 없어 신뢰할 수 없다) */
    animation-delay: var(--draw-delay, 0ms);
  }
  @keyframes check-draw {
    to {
      stroke-dashoffset: 0;
    }
  }

  /* 점수 게이지 — 수정안을 적용해 점수가 오를 때 차오르며 색이 변한다 */
  .score-ring {
    transition:
      stroke-dasharray 0.6s cubic-bezier(0.4, 0, 0.2, 1),
      stroke 0.6s ease;
  }

  /* 모션 최소화 설정을 존중 — 애니메이션 없이 바로 표시 */
  @media (prefers-reduced-motion: reduce) {
    .check-draw path {
      animation: none;
      stroke-dashoffset: 0;
    }
    .score-ring {
      transition: none;
    }
  }
</style>

<script lang="ts">
  // 종합 AI 리뷰 사이드바 — 본문 위에 오버레이로 열린다.
  // 구간별 리뷰(AiReviewCard)가 문장 단위라면 이쪽은 문서 단위다.
  // ⚠️ 시연용: 분석 결과는 overall-review.ts의 규칙 매칭 목업.

  import {
    REVIEW_STEPS,
    type OverallReview,
    type OverallIssue,
    type IssueFix
  } from './overall-review'

  let {
    open = false,
    phase = 'idle',
    review = null,
    stepIndex = 0,
    onclose,
    onjump,
    onrerun,
    onpreview
  } = $props<{
    open?: boolean
    /** idle: 분석 전 · analyzing: 분석 중 · result: 결과 */
    phase?: 'idle' | 'analyzing' | 'result'
    review?: OverallReview | null
    /** 분석 중 현재까지 완료된 단계 수 */
    stepIndex?: number
    onclose?: () => void
    /** 지적사항 클릭 — 해당 블록으로 이동 */
    onjump?: (blockId: string) => void
    onrerun?: () => void
    /** 수정안 미리보기 요청 — CDSS상 즉시 적용하지 않는다 */
    onpreview?: (issue: OverallIssue, fix: IssueFix) => void
  }>()

  // ── 색 사용 규칙 ──
  // 색이 많으면 무엇이 중요한지 안 보인다. 그래서 색은 '심각도 배지'에만 쓴다.
  //   red/amber = 심각도 (유일하게 색을 쓰는 정보)
  //   그 외     = 무채색. 버튼도 어두운 톤으로 두고,
  //               지적 종류는 색이 아니라 아이콘으로 구분한다.
  const KIND_STYLE: Record<string, { icon: string; label: string }> = {
    'missing-section': { icon: 'edit_note', label: '섹션 누락' },
    structure: { icon: 'account_tree', label: '구성 오류' },
    contradiction: { icon: 'compare_arrows', label: '서술 모순' },
    unreferenced: { icon: 'link_off', label: '결과 미반영' },
    'span-summary': { icon: 'spellcheck', label: '표현 교정' }
  }

  /** 심각도 — 유일하게 색을 쓰는 축.
   *  배지(색 배경 + 라벨)는 카드마다 반복되면 시선을 뺏어 점으로 줄였다.
   *  색만으로 정보를 주지 않도록 label을 aria-label/title로 남긴다. */
  const SEVERITY: Record<string, { label: string; dot: string }> = {
    high: { label: '심각도 높음', dot: 'sev-dot-high' },
    medium: { label: '심각도 보통', dot: 'sev-dot-medium' },
    low: { label: '심각도 낮음', dot: 'sev-dot-low' }
  }

  /**
   * 점수 색 — 3단계. 지적을 고칠 때마다 점수가 올라 색이 바뀐다.
   *   90 이상 = 초록 (거의 완성)
   *   60~89   = 노랑 (개선 중)
   *   60 미만 = 빨강 (고칠 것이 많음)
   */
  function scoreColor(s: number): string {
    if (s >= 90) return 'text-sev-ok-fg'
    if (s >= 60) return 'text-sev-medium-fg'
    return 'text-sev-high-fg'
  }
  /** SVG stroke는 클래스가 아니라 값이 필요하다 → 토큰을 직접 참조.
   *  게이지는 굵은 선(면)이라 점과 같은 선명한 색을 쓴다. */
  function scoreRing(s: number): string {
    if (s >= 90) return 'var(--sev-ok)'
    if (s >= 60) return 'var(--sev-medium)'
    return 'var(--sev-high)'
  }

  let issues = $derived<OverallIssue[]>(review?.issues ?? [])
  let highCount = $derived(issues.filter((i) => i.severity === 'high').length)

  // 원형 게이지
  const RING_R = 26
  const RING_C = 2 * Math.PI * RING_R
</script>

{#if open}
  <!-- 오버레이 패널 — 본문 위에 겹친다(레이아웃을 밀지 않음) -->
  <aside
    class="absolute top-0 right-0 z-30 flex h-full w-100 flex-col border-l border-chrome-line bg-chrome shadow-2xl"
    aria-label="AI 종합 리뷰"
  >
    <!-- 헤더 -->
    <div
      class="flex shrink-0 items-center justify-between border-b border-chrome-line px-4 py-3"
    >
      <div class="flex items-center gap-2">
        <span class="material-icons-round text-[20px] text-chrome-fg-2"
          >auto_awesome</span
        >
        <div>
          <h3 class="text-body-02-normal-bold text-chrome-fg">AI 종합 리뷰</h3>
          <p class="text-label-02-reading-regular text-chrome-fg-2">
            보고서 전체를 문서 단위로 검토합니다
          </p>
        </div>
      </div>
      <button
        class="rounded-lg flex-center w-8 h-8 text-chrome-fg-2 transition hover:bg-chrome-hover hover:text-chrome-fg"
        onclick={() => onclose?.()}
        aria-label="닫기"
      >
        <span class="material-icons-round text-[18px]">close</span>
      </button>
    </div>

    {#if phase === 'analyzing'}
      <!-- 분석 중 — 단계별 진행을 보여준다 (실기능에서는 SSE 이벤트로 점등) -->
      <div class="flex flex-1 flex-col gap-1 px-5 py-6">
        <p class="mb-3 text-body-03-reading-semibold text-chrome-fg">
          보고서를 분석하고 있습니다
        </p>
        {#each REVIEW_STEPS as step, i}
          {@const done = i < stepIndex}
          {@const active = i === stepIndex}
          <div
            class="flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors {active
              ? 'bg-chrome-sunken'
              : ''}"
          >
            <span
              class="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center"
            >
              {#if done}
                <!-- 체크가 스윽 그려진다 (stroke-dashoffset 애니메이션) -->
                <svg
                  class="check-draw h-4 w-4 text-sev-ok"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 12.5 L9.5 18 L20 6.5" />
                </svg>
              {:else if active}
                <span
                  class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-500/30 border-t-primary-500"
                ></span>
              {:else}
                <span class="h-1.5 w-1.5 rounded-full bg-chrome-line"></span>
              {/if}
            </span>
            <div class="min-w-0 flex-1">
              <p
                class="text-label-01-reading-semibold {done ? 'text-chrome-fg-2' : active ? 'text-chrome-fg' : 'text-chrome-fg-3'}"
              >
                {step.label}{active ? '…' : ''}
              </p>
            </div>
          </div>
        {/each}
      </div>
    {:else if phase === 'result' && review}
      <div
        class="scrollbar-custom scrollbar-sidebar min-h-0 flex-1 overflow-y-auto p-4"
      >
        <!-- ── 완성도 요약 ── -->
        <div class="mb-4 rounded-xl bg-chrome-raised p-3.5 ring-1 ring-chrome-line">
          <div class="flex items-center gap-3.5">
            <div class="relative h-14 w-14 shrink-0">
              <svg viewBox="0 0 64 64" class="h-full w-full -rotate-90">
                <circle
                  cx="32"
                  cy="32"
                  r={RING_R}
                  fill="none"
                  stroke="var(--chrome-line)"
                  stroke-width="6"
                />
                <!-- 점수가 바뀌면 게이지가 차오르며 색도 함께 바뀐다 -->
                <circle
                  class="score-ring"
                  cx="32"
                  cy="32"
                  r={RING_R}
                  fill="none"
                  stroke={scoreRing(review.score)}
                  stroke-width="6"
                  stroke-linecap="round"
                  stroke-dasharray="{(review.score / 100) * RING_C} {RING_C}"
                />
              </svg>
              <div class="absolute inset-0 flex items-center justify-center">
                <span class="text-title-01-normal-bold {scoreColor(review.score)}"
                  >{review.score}</span
                >
              </div>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-body-03-normal-bold text-chrome-fg">보고서 완성도</p>
              <p class="mt-0.5 text-label-02-reading-regular text-chrome-fg-3">
                {review.stats.charCount.toLocaleString()}자 · 섹션 {review.stats
                  .sectionCount}개 · 검사 {review.stats.referencedExams}/{review
                  .stats.totalExams} 반영
              </p>
            </div>
          </div>
        </div>

        <!-- ── 검토사항 (메인) ──
             분석 경로는 로딩 중에 이미 보여줬으므로 결과 화면에서는 생략한다. -->
        {#if issues.length}
          <div class="mb-2.5 flex items-baseline gap-2 px-0.5">
            <h4 class="text-body-02-normal-bold text-chrome-fg">검토사항</h4>
            <span class="text-label-01-normal-regular text-chrome-fg-3">{issues.length}건</span>
            {#if highCount > 0}
              <span class="ml-auto text-label-02-normal-semibold text-red-300">
                주요 {highCount}건
              </span>
            {/if}
          </div>

          <div class="space-y-2.5">
            {#each issues as issue}
              {@const st = KIND_STYLE[issue.kind] ?? KIND_STYLE['span-summary']}
              {@const sev = SEVERITY[issue.severity] ?? SEVERITY.low}
              <div
                class="overflow-hidden rounded-xl bg-chrome-raised ring-1 ring-chrome-line"
              >
                <div class="flex">
                  <div class="min-w-0 flex-1 p-3.5">
                    <!-- 헤더: 종류(무채색) + 심각도 점 + 이동 -->
                    <div class="flex items-center gap-1.5">
                      <span
                        class="material-icons-round text-[15px] text-chrome-fg-3"
                        aria-hidden="true">{st.icon}</span
                      >
                      <span class="text-label-02-normal-medium text-chrome-fg-2"
                        >{st.label}</span
                      >
                      <span
                        class="sev-dot {sev.dot}"
                        role="img"
                        aria-label={sev.label}
                        title={sev.label}
                      ></span>
                      {#if issue.blockId}
                        <button
                          class="ml-auto flex shrink-0 items-center gap-1 rounded-lg px-1.5 py-1 text-label-02-normal-medium text-chrome-fg-2 transition hover:bg-chrome-hover hover:text-chrome-fg"
                          onclick={() => onjump?.(issue.blockId!)}
                          title="본문에서 해당 위치 보기"
                        >
                          <!-- Material 아이콘 폰트는 font-size가 외부 CSS와 충돌해
                               작은 크기에서 잘 안 먹는다. 인라인 SVG로 크기를 확실히 잡는다. -->
                          <svg
                            class="h-3.5 w-3.5 shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                          >
                            <circle cx="12" cy="12" r="7" />
                            <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
                          </svg>
                          이동
                        </button>
                      {/if}
                    </div>

                    <p
                      class="mt-2 text-label-01-reading-semibold text-chrome-fg"
                    >
                      {issue.title}
                    </p>
                    <p class="mt-1 text-label-01-reading-regular text-chrome-fg-2">
                      {issue.detail}
                    </p>

                    {#if issue.evidence}
                      <p
                        class="mt-2 rounded-lg bg-chrome-sunken px-2.5 py-1.5 text-label-02-reading-regular text-chrome-fg-2"
                      >
                        <span class="font-semibold text-chrome-fg-2">근거</span> · {issue.evidence}
                      </p>
                    {/if}

                    <!-- 수정안 — 클릭해도 바로 적용되지 않고 미리보기를 먼저 띄운다 -->
                    {#if issue.fixes?.length}
                      <div class="mt-3 flex flex-wrap items-center gap-1.5">
                        {#each issue.fixes as fix}
                          <!-- 주 액션 — 가이드 §4-1에 따라 파란 배경.
                               무채색이면 클릭 가능한지 읽히지 않는다.
                               (누르면 바로 적용되지 않고 미리보기 모달을 연다) -->
                          <button
                            class="fix-btn flex items-center gap-1.5 rounded-lg bg-primary-500 px-2.5 py-1.5 text-label-02-normal-semibold text-white transition hover:bg-primary-600 focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:outline-none"
                            onclick={() => onpreview?.(issue, fix)}
                          >
                            <!-- Google Fonts CSS의 font-size:24px를 이기려면 !important 필요 -->
                            <span
                              class="material-icons-round text-[16px]! leading-none text-white/80"
                              >auto_fix_high</span
                            >
                            {fix.label}
                          </button>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div
            class="rounded-xl bg-chrome-raised p-5 text-center ring-1 ring-chrome-line"
          >
            <svg
              class="check-draw mx-auto h-7 w-7 text-sev-ok"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M4 12.5 L9.5 18 L20 6.5" />
            </svg>
            <p class="mt-2 text-label-01-reading-semibold text-chrome-fg">
              검토사항이 없습니다
            </p>
            <p class="mt-0.5 text-label-01-reading-regular text-chrome-fg-2">
              문서 구성과 서술이 모두 적절합니다.
            </p>
          </div>
        {/if}

        <!-- ── 작성 체크리스트 (보조 정보) ── -->
        <div class="mt-4 rounded-xl bg-chrome-raised p-3.5 ring-1 ring-chrome-line">
          <p class="mb-2.5 text-label-01-normal-bold text-chrome-fg-2">
            작성 체크리스트
          </p>
          <div class="space-y-1.5">
            {#each review.checklist as c}
              <div class="flex items-center gap-2">
                {#if c.ok}
                  <!-- 통과 항목은 초록 — "여기는 됐다"가 보이는 게 진행 상태를 읽기 쉽다 -->
                  <svg
                    class="h-3.5 w-3.5 shrink-0 text-sev-ok"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 12.5 L9.5 18 L20 6.5" />
                  </svg>
                {:else}
                  <span
                    class="h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-chrome-line"
                  ></span>
                {/if}
                <span
                  class="text-label-01-normal-regular {c.ok ? 'text-chrome-fg-3' : 'text-chrome-fg-2'}"
                >
                  {c.label}
                </span>
              </div>
            {/each}
          </div>
        </div>

        <!-- CDSS 고지 — AI는 보조, 최종 판단은 임상가 -->
        <p class="mt-4 px-1 text-label-02-reading-regular text-chrome-fg-3">
          본 검토 결과는 작성 보조를 위한 참고 정보입니다. 최종 판단과 수정
          여부는 임상가가 결정합니다.
        </p>
      </div>

      <!-- 하단 액션 -->
      <div class="shrink-0 border-t border-chrome-line p-3">
        <button
          class="flex w-full items-center justify-center gap-1.5 rounded-lg bg-chrome-sunken py-2 text-label-01-normal-semibold text-chrome-fg-2 transition hover:bg-chrome-hover"
          onclick={() => onrerun?.()}
        >
          <span class="material-icons-round text-[15px]">refresh</span>
          다시 분석
        </button>
      </div>
    {/if}
  </aside>
{/if}
