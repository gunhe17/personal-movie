<script lang="ts">
  // AI 리뷰 플로팅 카드 — 본문에서 텍스트를 선택하면 옆에 뜬다.
  // ⚠️ 시연용: 리뷰 내용은 선택 텍스트 특성으로 규칙 매칭한 목업.
  //    실기능 전환 시 analyze()를 POST /api/report/review 호출로 교체.

  interface ReviewPoint {
    kind: 'warning' | 'suggest' | 'evidence' | 'good' | 'spelling' | 'style'
    title: string
    body: string
    /** 고쳐쓰기 제안 — 있으면 before → after 로 표시 */
    before?: string
    after?: string
  }

  let {
    text = '',
    x = 0,
    y = 0,
    open = false,
    onclose,
    onapply,
    onapplyall
  } = $props<{
    text?: string
    x?: number
    y?: number
    open?: boolean
    onclose?: () => void
    /** 수정안 1건 적용 — (찾을 표현, 바꿀 표현) */
    onapply?: (before: string, after: string) => void
    /** 수정안 일괄 적용 — [찾을 표현, 바꿀 표현][] */
    onapplyall?: (pairs: [string, string][]) => void
  }>()

  // ── 색 사용 규칙 (종합 AI 리뷰 패널과 동일) ──
  // 종류마다 색을 주면 카드가 알록달록해져 무엇이 중요한지 안 보인다.
  // 색은 '검토 필요'(경고)에만 쓰고, 나머지는 무채색 + 아이콘으로 구분한다.
  const KIND_STYLE: Record<
    string,
    { icon: string; ring: string; bg: string; fg: string; label: string }
  > = {
    warning: {
      icon: 'warning',
      ring: 'ring-orange-500/25',
      bg: 'bg-orange-500/10',
      fg: 'text-orange-600',
      label: '검토 필요'
    },
    suggest: {
      icon: 'auto_fix_high',
      ring: 'ring-gray-300',
      bg: 'bg-gray-100',
      fg: 'text-gray-600',
      label: '표현 제안'
    },
    evidence: {
      icon: 'fact_check',
      ring: 'ring-gray-300',
      bg: 'bg-gray-100',
      fg: 'text-gray-600',
      label: '근거 연결'
    },
    good: {
      icon: 'check_circle',
      ring: 'ring-gray-300',
      bg: 'bg-gray-100',
      fg: 'text-gray-500',
      label: '적절'
    },
    spelling: {
      icon: 'spellcheck',
      ring: 'ring-gray-300',
      bg: 'bg-gray-100',
      fg: 'text-gray-600',
      label: '맞춤법'
    },
    style: {
      icon: 'edit_note',
      ring: 'ring-gray-300',
      bg: 'bg-gray-100',
      fg: 'text-gray-600',
      label: '표현 개선'
    }
  }

  // 교정 규칙 — re에 매칭된 실제 텍스트를 to로 치환한다.
  // (고정 문자열이 아니라 매칭 결과를 쓰므로 본문 표현과 항상 일치)
  interface FixRule {
    re: RegExp
    to: string
    why: string
  }

  // 맞춤법·띄어쓰기 (임상 보고서에서 흔한 오류 위주)
  const SPELL_RULES: FixRule[] = [
    { re: /해석되어진/, to: '해석된', why: "'되어진'은 이중 피동입니다." },
    { re: /되어진/, to: '된', why: "'되어진'은 이중 피동입니다." },
    { re: /보여집니다|보여진다/, to: '보인다', why: '이중 피동 표현입니다.' },
    {
      re: /사료된다|사료됩니다/,
      to: '판단된다',
      why: '과도한 한자어 표현입니다.'
    },
    { re: /할\s수\s밖에/, to: '할 수밖에', why: "'수밖에'는 붙여 씁니다." },
    { re: /있는것/, to: '있는 것', why: "의존명사 '것'은 띄어 씁니다." },
    { re: /하는것/, to: '하는 것', why: "의존명사 '것'은 띄어 씁니다." },
    { re: /및\s및/, to: '및', why: '중복 표기입니다.' }
  ]

  // 표현 개선 (임상 문체)
  const STYLE_RULES: FixRule[] = [
    {
      re: /매우\s*높다는\s*점을/,
      to: '유의하게 상승되어 있음을',
      why: '주관적 강조어 대신 임상 용어를 권장합니다.'
    },
    {
      re: /매우\s*높다/,
      to: '유의하게 상승되어 있다',
      why: '주관적 강조어 대신 임상 용어를 권장합니다.'
    },
    {
      re: /환자의\s*경우/,
      to: '내담자의 경우',
      why: '심리평가 보고서에서는 "내담자" 표기가 일반적입니다.'
    },
    {
      re: /환자/,
      to: '내담자',
      why: '심리평가 보고서에서는 "내담자" 표기가 일반적입니다.'
    },
    {
      re: /문제가\s*있다/,
      to: '어려움이 관찰된다',
      why: '가치판단적 표현을 중립적으로 기술하는 것이 좋습니다.'
    },
    {
      re: /것\s*같다|듯하다/,
      to: '것으로 시사된다',
      why: '추측성 구어체보다 보고서 문체를 권장합니다.'
    }
  ]

  // 선택 텍스트 특성 기반 목업 리뷰 생성 (결정적 — 같은 문장이면 같은 결과)
  function analyze(t: string): ReviewPoint[] {
    const out: ReviewPoint[] = []
    const s = t.trim()

    // 규칙 적용 — 매칭된 실제 텍스트를 before로 쓴다(본문과 정확히 일치해야 치환된다).
    // 이미 잡은 구간과 겹치는 규칙은 건너뛴다(같은 자리 중복 제안 방지).
    const claimed: string[] = []
    function collect(
      rules: FixRule[],
      kind: 'spelling' | 'style',
      title: string
    ) {
      for (const r of rules) {
        const m = s.match(r.re)
        if (!m) continue
        const hit = m[0]
        if (claimed.some((c) => c.includes(hit) || hit.includes(c))) continue
        claimed.push(hit)
        out.push({
          kind,
          title: kind === 'spelling' ? `'${hit}' → '${r.to}'` : title,
          body: r.why,
          before: hit,
          after: r.to
        })
      }
    }
    collect(SPELL_RULES, 'spelling', '맞춤법 교정')
    collect(STYLE_RULES, 'style', '보고서 문체로 다듬기')

    // 단정적 표현 검출 — CDSS 원칙상 AI 초안은 단정하면 안 됨
    if (
      /(이다|하다|있다|없다|된다)[.。]?$/.test(s) ||
      /명백|확실|분명/.test(s)
    ) {
      out.push({
        kind: 'warning',
        title: '단정적 서술 — 완화 표현 권장',
        body: '투사적 검사 해석은 확정 진단이 아닌 가설로 기술해야 합니다. "~로 시사된다", "~가능성이 있다" 형태를 권장합니다.'
      })
    }
    // 진단명 직접 언급
    if (/우울증|조현병|불안장애|ADHD|경계선|인격장애/.test(s)) {
      out.push({
        kind: 'warning',
        title: '진단명 직접 기술 감지',
        body: '심리검사 보고서에서 진단명 단독 기술은 지양됩니다. 관찰된 지표와 함께 기술하거나 "~에 부합하는 양상"으로 완화하세요.'
      })
    }
    // 수치 인용 여부
    if (/\d/.test(s)) {
      out.push({
        kind: 'evidence',
        title: '검사 근거와 연결됨',
        body: '인용된 수치가 로르샤하 구조요약 · MMPI-2 프로파일과 대조 확인되었습니다. 출처 표기를 함께 두면 신뢰도가 높아집니다.'
      })
    } else {
      out.push({
        kind: 'evidence',
        title: '수치 근거 미포함',
        body: '이 서술을 뒷받침하는 정량 지표가 없습니다. HTP 필압 지표 또는 DEPI=5 등 구체적 근거 삽입을 권장합니다.'
      })
    }
    // 문장 길이
    if (s.length > 90) {
      out.push({
        kind: 'suggest',
        title: '문장이 깁니다',
        body: `${s.length}자 — 2개 문장으로 분리하면 가독성이 개선됩니다. 임상 보고서 권장 길이는 60~80자입니다.`
      })
    } else if (s.length > 0) {
      out.push({
        kind: 'good',
        title: '문장 길이 적절',
        body: `${s.length}자 — 임상 보고서 권장 범위에 부합합니다.`
      })
    }
    // 교차분석 연결
    out.push({
      kind: 'suggest',
      title: '검사 간 소견 불일치',
      body: '공격성 영역에서 HTP(강한 필압·예각)와 MMPI-2(T=72)는 상승을 시사하나 로르샤하(AG=1)는 정상 범위입니다. 이 문단이 공격성을 다룬다면 불일치를 함께 기술하는 것이 좋습니다.'
    })

    // 맞춤법 검사에 걸린 항목이 없으면 통과했음을 명시 (검사를 돌렸다는 신호)
    if (!out.some((o) => o.kind === 'spelling')) {
      out.unshift({
        kind: 'good',
        title: '맞춤법·띄어쓰기 이상 없음',
        body: `${s.length}자 구간에서 표기 오류가 발견되지 않았습니다.`
      })
    }

    // 임상적 지적을 앞으로 — 맞춤법은 워드에도 있는 기능이라
    // 근거 부족·검사 간 모순 같은 임상 판단이 먼저 보여야 한다.
    const order: Record<string, number> = {
      warning: 0,
      evidence: 1,
      suggest: 2,
      spelling: 3,
      style: 4,
      good: 5
    }
    const sorted = out.sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9))

    // 개수를 제한하되 **수정안이 있는 항목은 절대 버리지 않는다.**
    // 클릭해서 고칠 수 있는 실행 항목이라, 잘리면 "왜 안 뜨지" 하게 된다.
    // (실제로 '환자의 경우 → 내담자의 경우'가 slice에 잘려 나갔었다)
    const actionable = sorted.filter((p) => p.before && p.after)
    const informational = sorted.filter((p) => !(p.before && p.after))
    const MAX = 7
    const merged = [...actionable, ...informational.slice(0, Math.max(0, MAX - actionable.length))]

    // 정렬 순서를 유지한 채 반환
    return merged.sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9))
  }

  let points = $derived(analyze(text))
  let excerpt = $derived(text.length > 60 ? text.slice(0, 60) + '…' : text)

  // 교정 제안이 있으면 모두 반영한 문장을 미리 보여준다
  let fixes = $derived(points.filter((p) => p.before && p.after))
  let previewText = $derived(
    fixes.reduce(
      (acc, p) => acc.split(p.before as string).join(p.after as string),
      text
    )
  )
  /** 미리보기 문장을 조각내 변경 부분만 강조 */
  let previewParts = $derived.by(() => {
    const afters = fixes.map((p) => p.after as string).filter(Boolean)
    if (!afters.length) return [{ text: previewText, changed: false }]
    const re = new RegExp(
      `(${afters.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
      'g'
    )
    const segs: string[] = previewText.split(re)
    return segs
      .filter((seg: string) => seg !== '')
      .map((seg: string) => ({ text: seg, changed: afters.includes(seg) }))
  })

  // 화면 밖으로 나가지 않게 위치 보정.
  // 뷰포트 크기를 반응형으로 추적해야 리사이즈/스크롤 후에도 어긋나지 않는다.
  const CARD_W = 420
  const CARD_H = 840
  const MARGIN = 12

  let vw = $state(typeof window !== 'undefined' ? window.innerWidth : 1280)
  let vh = $state(typeof window !== 'undefined' ? window.innerHeight : 800)
  function syncViewport() {
    vw = window.innerWidth
    vh = window.innerHeight
  }

  // 카드가 뷰포트를 넘지 않도록 실제 사용할 크기부터 제한
  let cardW = $derived(Math.min(CARD_W, vw - MARGIN * 2))
  let cardH = $derived(Math.min(CARD_H, vh - MARGIN * 2))

  /**
   * 헤더를 끌어 사용자가 직접 옮긴 위치. null이면 선택 위치(x·y) 기반 자동 배치.
   * 다른 문장을 선택하면 그 옆에 다시 떠야 하므로 자동 배치로 되돌린다.
   * (로르샤하 RegionPopover가 region.id로 리셋하는 것과 같은 방식)
   */
  let dragOverride = $state<{ left: number; top: number } | null>(null)
  let placedFor = $state('')
  $effect(() => {
    if (text !== placedFor) {
      dragOverride = null
      placedFor = text
    }
  })

  // 자동 배치든 드래그든 마지막에 뷰포트 안으로 클램프한다
  let posX = $derived(
    Math.max(MARGIN, Math.min(dragOverride?.left ?? x, vw - cardW - MARGIN))
  )
  let posY = $derived(
    Math.max(MARGIN, Math.min(dragOverride?.top ?? y, vh - cardH - MARGIN))
  )

  // ── 헤더 드래그 ──
  let dragging = $state(false)
  function startDrag(e: MouseEvent) {
    // 헤더 안의 닫기 버튼 클릭까지 드래그로 먹지 않도록
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    dragging = true
    const startX = e.clientX
    const startY = e.clientY
    const baseLeft = posX
    const baseTop = posY

    function onMove(ev: MouseEvent) {
      dragOverride = {
        left: baseLeft + (ev.clientX - startX),
        top: baseTop + (ev.clientY - startY)
      }
    }
    function onUp() {
      dragging = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
</script>

<svelte:window onresize={syncViewport} />

{#if open && text.trim()}
  <div
    class="fixed z-80 flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
    style="left:{posX}px; top:{posY}px; width:{cardW}px; max-height:{cardH}px"
    role="dialog"
    aria-label="AI 리뷰"
  >
    <!-- 헤더 — 드래그 핸들. 카드가 본문을 가리면 끌어서 치울 수 있다.
         헤더 색은 AI 분석 버튼과 같은 계열 — 버튼에서 카드가 나온 것처럼 보이게 -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <header
      class="flex shrink-0 items-center gap-2 bg-linear-to-r from-primary-500 to-primary-700 px-3.5 py-2.5 select-none {dragging
        ? 'cursor-grabbing'
        : 'cursor-grab'}"
      onmousedown={startDrag}
    >
      <span class="material-icons-round text-base text-white">auto_awesome</span
      >
      <span class="text-body-01-normal-bold text-white">AI 리뷰</span>
      <span
        class="rounded-full bg-white/20 px-1.5 py-0.5 text-label-02-normal-semibold text-white"
      >
        {points.length}건
      </span>
      <button
        type="button"
        onclick={() => onclose?.()}
        class="ml-auto rounded-lg w-8 h-8 flex-center text-white/70 transition-colors hover:bg-white/15 hover:text-white"
        aria-label="닫기"
      >
        <span class="material-icons-round text-base">close</span>
      </button>
    </header>

    <!-- 선택 문장 -->
    <div class="shrink-0 border-b border-gray-100 bg-gray-50 px-3.5 py-2">
      <p
        class="text-label-02-normal-semibold uppercase tracking-wide text-gray-400"
      >
        선택 구간
      </p>
      <p class="mt-0.5 line-clamp-2 text-body-03-reading-regular text-gray-600">
        "{excerpt}"
      </p>
    </div>

    <!-- 수정 후 미리보기 (교정 제안이 있을 때만) -->
    {#if fixes.length}
      <!-- 미리보기가 리뷰 목록을 밀어내지 않도록 카드 높이의 45%로 상한 -->
      <div
        class="flex shrink-0 flex-col overflow-hidden border-b border-gray-100 bg-green-50/60 px-3.5 py-2.5"
        style="max-height:{Math.round(cardH * 0.45)}px"
      >
        <div class="flex shrink-0 items-center gap-1.5">
          <span class="material-icons-round text-[15px] text-green-600"
            >auto_fix_high</span
          >
          <p
            class="text-label-02-normal-bold uppercase tracking-wide text-green-700"
          >
            수정 후 미리보기
          </p>
          <span class="ml-auto text-label-02-normal-semibold text-green-600">
            {fixes.length}곳 변경
          </span>
        </div>
        <p
          class="scrollbar-custom scrollbar-light mt-1.5 min-h-0 flex-1 overflow-y-auto text-body-03-reading-regular text-gray-700"
        >
          {#each previewParts as part}
            {#if part.changed}
              <mark
                class="rounded bg-green-200/70 px-0.5 font-semibold text-green-900"
              >
                {part.text}
              </mark>
            {:else}{part.text}{/if}
          {/each}
        </p>
        <button
          type="button"
          onclick={() => onapplyall?.(fixes.map((f) => [f.before, f.after]))}
          class="mt-2 flex w-full shrink-0 items-center justify-center gap-1 rounded-lg bg-green-600 py-2 text-body-03-normal-bold text-white transition-colors hover:bg-green-700"
        >
          <span class="material-icons-round text-[16px]">done_all</span>
          {fixes.length}곳 모두 적용
        </button>
      </div>
    {/if}

    <!-- 리뷰 항목 -->
    <div
      class="scrollbar-custom scrollbar-light min-h-0 flex-1 space-y-2 overflow-y-auto p-3"
    >
      {#each points as p}
        {@const st = KIND_STYLE[p.kind]}
        <div class="rounded-xl p-2.5 ring-1 {st.bg} {st.ring}">
          <div class="flex items-center gap-1.5">
            <span class="material-icons-round text-[15px] {st.fg}"
              >{st.icon}</span
            >
            <span class="text-body-03-normal-bold {st.fg}">{st.label}</span>
          </div>
          <p class="mt-1 text-body-03-reading-semibold text-gray-800">{p.title}</p>
          <p class="mt-0.5 text-body-03-reading-regular text-gray-600">
            {p.body}
          </p>
          {#if p.before && p.after}
            <div class="mt-2 rounded-lg bg-white/70 p-2 ring-1 ring-black/5">
              <div class="flex flex-wrap items-center gap-1.5 text-body-03-normal-regular">
                <span
                  class="rounded bg-gray-100 px-1.5 py-0.5 text-gray-400 line-through"
                >
                  {p.before}
                </span>
                <span class="material-icons-round text-[15px] text-gray-400">
                  arrow_forward
                </span>
                <span
                  class="rounded bg-green-50 px-1.5 py-0.5 font-semibold text-green-700"
                >
                  {p.after}
                </span>
              </div>
              <button
                type="button"
                onclick={() => onapply?.(p.before as string, p.after as string)}
                class="mt-2 flex w-full items-center justify-center gap-1 rounded-md bg-primary-500 py-1.5 text-body-03-normal-semibold text-white transition-colors hover:bg-primary-600 focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span class="material-icons-round text-[14px]"
                  >auto_fix_high</span
                >
                이 수정안 적용
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <!-- 푸터 -->
    <div
      class="flex shrink-0 items-center gap-2 border-t border-gray-100 px-3.5 py-2"
    >
      <span class="material-icons-round text-[13px] text-gray-400">shield</span>
      <p class="text-label-02-reading-regular text-gray-400">
        AI 보조 의견 · 최종 판단은 임상가가 결정합니다
      </p>
    </div>
  </div>
{/if}
