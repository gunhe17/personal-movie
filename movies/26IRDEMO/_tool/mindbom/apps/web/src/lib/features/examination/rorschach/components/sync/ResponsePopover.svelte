<script lang="ts">
  /**
   * 반응 하나의 팝오버 — **실시와 채점이 같은 것을 쓴다.**
   *
   * 반응은 채점지의 한 줄이고(§14-2), 이 팝오버가 그 줄이다. 예전에는
   * 실시용(ResponseSheet)과 채점용(RegionPopover)이 따로 있었는데 위치 계산·
   * 드래그·헤더가 전부 복제였다. 검증된 채점 팝오버를 정본으로 합쳤다.
   *
   * **무엇이 보이느냐는 단계가, 무엇을 고칠 수 있느냐는 확정 여부가 정한다:**
   *
   * | | 실시 | 채점 | 확정 후 |
   * |---|---|---|---|
   * | 자유반응·질문 답변 | 편집 | **편집** | 읽기 |
   * | 위치 부호·영역 | 편집 | **편집** | 읽기 |
   * | 채점 코드 | 안 보임 | 편집 | 읽기 |
   *
   * 채점 UI를 실시 중에 보이지 않게 하는 것은 §3-2의 원칙이다 —
   * **임상가의 눈이 화면에 있으면 실패다.** 이건 그대로다(`isAdmin`).
   *
   * 반면 "기록은 실시에서만 고친다"(§14-14)는 **폐기했다**(피드백 v2-3).
   * 채점하다 오타나 빠진 질문을 발견했을 때 되돌아갈 길이 없으면 임상가는
   * 틀린 채로 확정한다 — "무엇을 근거로 채점했는지가 흐려진다"보다 나쁘다.
   * 이제 편집 잠금은 **확정 여부** 하나다(`canEditRecord`), §3-1의 "벽 없음"과
   * 같은 축이다.
   */
  import type { RorschachCoding } from '../../types'
  import type { ServerRegion, ServerResponseDetail } from '../../actions'
  import type { CardOrientation } from '../../constants'
  import {
    ORIENTATION_ICON,
    ORIENTATION_LABEL,
    ORIENTATION_ORDER,
    circled,
    missingScoreInputs,
    responseColor
  } from '../../constants'
  import type { DictationPhase } from '../../hooks/dictation.svelte'
  import CodingPanel from '../coding/CodingPanel.svelte'
  import LocationPicker from '../coding/LocationPicker.svelte'
  import ResponseInput from './ResponseInput.svelte'
  import Tooltip from '$lib/components/ui/Tooltip.svelte'
  import Icon from '$lib/components/ui/Icon.svelte'
  import Close from '$lib/assets/icons/Close.svelte'

  interface Props {
    /**
     * 무엇을 다루는 단계인가.
     * - 'administer' 실시 — 기록(텍스트·질문·위치·영역)을 편집. 채점은 숨김
     * - 'coding' 채점 — 기록은 읽기 전용, 채점만 편집
     */
    mode?: 'administer' | 'coding'
    /** 이 팝오버가 담당하는 **반응** — 화면의 축이다(§14-4) */
    response: ServerResponseDetail
    /** 그 반응의 조각. 아직 영역을 안 그렸으면 null이다(정상 상태) */
    region: ServerRegion | null
    /** AI 채점 결과 */
    aiCoding: RorschachCoding | null
    /** 임상가 확정 코딩 */
    finalCoding: RorschachCoding | null
    aiConfidence: number | null
    aiReasoning: string | null
    isScoring: boolean
    readonly: boolean
    /** 캔버스 박스 요소 (영역 좌표 → viewport 좌표 변환용) */
    canvasBox: HTMLDivElement
    /** 받아쓰기 상태 (실시 전용) — **질문 칸의 테두리만** 이걸 따른다 */
    phase?: DictationPhase
    onClose: () => void
    /** AI 채점 호출. transcriptText는 임상가가 popover에서 교정한 응답. */
    onAiScore: (transcriptText: string) => void
    /** 코딩 저장. 현재 popover의 응답 텍스트도 함께 전달 (free_association_text 저장용). */
    onSaveCoding: (coding: RorschachCoding, transcriptText: string) => void
    /** 위치 부호 변경 — 반응에 저장된다(§14-7) */
    onChangeLocation?: (code: string | null) => void

    /**
     * 기록 저장 — **실시·채점 양쪽이 넘긴다**(피드백 v2-3).
     * 미제공이면 그 칸은 읽기 전용으로 그려진다.
     */
    onSaveText?: (v: string) => void
    onSaveInquiry?: (v: string) => void

    // --- 실시 전용 (넘기지 않으면 해당 UI가 아예 안 그려진다) ---
    onChangeOrientation?: (o: CardOrientation) => void
    onStartDrawing?: () => void
    onDelete?: () => void
    /**
     * 받아쓰기 토글 — **질문 칸 전용이다.** 어느 칸인지를 인자로 받지 않는다.
     *
     * 예전엔 `(target: 'free' | 'inquiry')`였다. 마이크가 두 개인데 dictation은
     * 하나여서 두 가지가 깨졌다: 녹음 중에 다른 칸 마이크를 누르면 `toggle()`이
     * 그냥 껐고, `phase`가 두 칸에 똑같이 흘러 어느 칸에 받아쓰는지 화면이
     * 구분하지 못했다. 마이크를 하나로 줄이니 두 문제가 함께 사라졌다.
     */
    onToggleMic?: () => void
    /** 그리기 중에는 카드를 가리지 않도록 흐려진다 */
    dimmed?: boolean
  }

  let {
    mode = 'coding',
    response,
    region,
    aiCoding,
    finalCoding,
    aiConfidence,
    aiReasoning,
    isScoring,
    readonly,
    canvasBox,
    phase = 'idle',
    onClose,
    onAiScore,
    onSaveCoding,
    onChangeLocation,
    onSaveText,
    onSaveInquiry,
    onChangeOrientation,
    onStartDrawing,
    onDelete,
    onToggleMic,
    dimmed = false
  }: Props = $props()

  let isAdmin = $derived(mode === 'administer')

  /**
   * 기록(자유반응·질문·위치)을 고칠 수 있는가 — **단계가 아니라 확정 여부다.**
   *
   * §14-14는 "기록은 실시에서만 고친다"였다(`isAdmin`). 근거는 "채점하며
   * 원자료를 고치면 무엇을 근거로 채점했는지가 흐려진다"였는데, 실사용에서
   * 뒤집혔다(피드백 v2-3): 채점하다 오타나 빠진 질문을 발견했을 때 되돌아갈
   * 길이 없으면 **임상가는 틀린 채로 확정한다.** 흐려지는 것보다 틀린 게 나쁘다.
   * §3-1의 "벽 없음"과도 이쪽이 일관된다 — 게이트는 결과 하나뿐이다.
   *
   * 안전장치는 확정 여부로 옮겼다: 확정 후에는 못 고친다(서버 `_ensure_editable`).
   * STT 원문은 따로 남아 무엇을 고쳤는지 대조되고(§4-2), 변경은 감사추적에 남는다.
   */
  let canEditRecord = $derived(!readonly)

  /**
   * 편집 버퍼 — 반응이 바뀌면 갈아끼운다. 저장은 blur가 한다.
   *
   * 타이핑마다 저장하면 요청이 폭주하고, 검사 중에 "저장하셨나요"를 신경
   * 쓰게 만들지 않으려면 자동이어야 한다.
   *
   * 예전에는 `userEdited`·`lastToggledText` 플래그로 "녹취록 토글이 바꾼 값"과
   * "임상가가 타이핑한 값"을 조정했다. **녹취록 경로가 사라져 통째로
   * 없어졌다**(§14-14) — 출처가 하나다.
   */
  let freeDraft = $state('')
  let inquiryDraft = $state('')
  let syncedRegionId = $state<string | null>(null)
  $effect(() => {
    if (response.id === syncedRegionId) return
    syncedRegionId = response.id
    freeDraft = response.free_association_text ?? ''
    inquiryDraft = response.inquiry_text ?? ''
  })

  // 받아쓰기가 서버에 반영되면 버퍼도 따라간다 — 입력 중이 아닐 때만.
  $effect(() => {
    if (response.id !== syncedRegionId) return
    const incoming = response.free_association_text ?? ''
    if (
      incoming !== freeDraft &&
      document.activeElement?.tagName !== 'TEXTAREA'
    ) {
      freeDraft = incoming
    }
  })

  /** AI 제안 줄에 표시할 항목 — 임상가 표의 순서를 따른다 */
  const AI_FIELDS = [
    { key: 'location', label: 'Loc' },
    { key: 'dq', label: 'DQ' },
    { key: 'determinants', label: 'Det' },
    { key: 'fq', label: 'FQ' },
    { key: 'contents', label: '내용' },
    { key: 'zScore', label: 'Z' },
    { key: 'specialScores', label: '특수' }
  ] as const

  function aiValue(key: (typeof AI_FIELDS)[number]['key']): string {
    if (!aiCoding) return ''
    const v = aiCoding[key]
    if (Array.isArray(v)) return v.join(', ')
    return v ? String(v) : ''
  }

  function fmtConfidence(c: number | null): string {
    if (c === null) return '-'
    return `${(c * 100).toFixed(0)}%`
  }

  /**
   * 코딩 패널 참조 — '전체 반영'이 이걸 통해 채택을 부른다.
   *
   * AI 제안 상자는 **팝오버 상단**에 있고 채택 대상(`local`)은 코딩 패널 안에
   * 있다. 로직을 위로 끌어올리면 편집 중인 값이 두 곳이 되므로, 자리만 위로
   * 올리고 동작은 아래에 남겼다.
   */
  let codingRef = $state<{ adopt: () => void; save: () => void } | null>(null)
  /** 반영할 제안이 남았는가 — 코딩 패널이 판정해 올려준다 */
  let adoptable = $state(false)
  /** 저장할 변경이 남았는가 — 코딩 패널이 판정해 올려준다 */
  let dirty = $state(false)

  let hasInquiry = $derived((response.inquiry_text ?? '').trim() !== '')
  let orientation = $derived(
    (response.card_orientation ?? 'up') as CardOrientation
  )

  const POPOVER_WIDTH = 360
  /**
   * 첫 렌더에서 아직 못 잰 높이의 대용값.
   *
   * 팝오버는 **내용 전체를 그대로 보여준다** — 안쪽에 스크롤을 두지 않는다.
   * 반응 하나의 정보는 한눈에 읽혀야 하는데, 스크롤이 생기면 코딩표 아래쪽
   * (특수점수·저장)이 접혀 있는 줄 모르고 지나친다.
   *
   * 대신 **높이를 재서 위치를 잡는다**: 아래로 넘칠 것 같으면 위로 올라간다.
   * 자를 수 없으니 자리를 옮기는 것이다.
   */
  const POPOVER_FALLBACK_HEIGHT = 540
  /** 실제로 그려진 높이 — 위치 계산이 이걸 본다 */
  let popoverH = $state(0)
  let effectiveH = $derived(popoverH || POPOVER_FALLBACK_HEIGHT)
  /** viewport 가장자리에서 떼어둘 거리 */
  const VIEWPORT_MARGIN = 8
  /** 카드 박스 모서리에서 떼어둘 거리 — 박스 테두리에 딱 붙으면 카드의 일부로 읽힌다 */
  const EDGE_INSET = 12

  /**
   * 팝오버가 화면 밖으로 나가지 않게 자른다.
   *
   * 세 갈래(드래그·조각 없음·조각 기준)가 각자 같은 클램프를 하고 있었다.
   * 한 곳이라도 빠뜨리면 그 경로에서만 팝오버가 화면 밖으로 나가는데, 어느
   * 경로로 열었는지에 따라 갈려서 재현이 어렵다 — 한 곳으로 모은다.
   */
  function clampToViewport(left: number, top: number) {
    return {
      left: Math.max(
        VIEWPORT_MARGIN,
        Math.min(window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN, left)
      ),
      top: Math.max(
        VIEWPORT_MARGIN,
        Math.min(window.innerHeight - effectiveH - VIEWPORT_MARGIN, top)
      )
    }
  }

  /** 캔버스 박스의 viewport 좌표 (스크롤·리사이즈 추적) */
  let boxRect = $state<DOMRect | null>(null)

  /**
   * **무대**(카드 박스를 담은 회색 영역)의 viewport 좌표.
   *
   * 팝오버를 카드 박스 기준으로 띄우면 자리가 화면마다 달라진다. `.card-box`는
   * 16:9로 무대 안에 **가운데 fit**되므로, 무대가 세로로 길어질수록(채점 화면은
   * 컬럼이 절반이라 특히) 박스가 아래로 내려앉는다 — 팝오버는 박스 상단에
   * 정확히 붙는데도 화면에서는 어중간하게 떠 보인다.
   *
   * 무대는 줌·팬(카드 박스의 `transform`)에도 흔들리지 않는다. 팝오버가
   * 늘 같은 자리에 있어야 한다는 배치 원칙(아래 `pos`)에 맞는 기준은 이쪽이다.
   */
  let stageRect = $state<DOMRect | null>(null)

  $effect(() => {
    if (!canvasBox) return
    const stage = canvasBox.parentElement
    const update = () => {
      boxRect = canvasBox.getBoundingClientRect()
      stageRect = stage?.getBoundingClientRect() ?? null
    }
    update()

    // 박스 크기/스크롤/리사이즈 추적
    const ro = new ResizeObserver(update)
    ro.observe(canvasBox)
    if (stage) ro.observe(stage)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)

    return () => {
      ro.disconnect()
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  })

  /**
   * 드래그로 사용자가 직접 옮긴 위치. null 이면 region 기반 자동 배치.
   * region 변경 시 자동 배치로 리셋.
   */
  let dragOverride = $state<{ left: number; top: number } | null>(null)
  let placementSyncedRegionId = $state<string | null>(null)
  $effect(() => {
    if (response.id !== placementSyncedRegionId) {
      dragOverride = null
      placementSyncedRegionId = response.id
    }
  })

  /**
   * 헤더 뱃지의 공통 골격 — **네 개가 한 줄에 서므로 규격이 같아야 한다.**
   *
   * 반응 번호·확정됨·영역·질문 넷이 각자 패딩과 글자 크기를 적고 있었다.
   * 값이 조금씩 달라 바닥선이 어긋났고, 하나를 키우면 나머지가 남는다.
   *
   * `h-6`으로 높이를 고정한 이유: 아이콘이 있는 뱃지(영역·질문)와 글자만 있는
   * 뱃지(반응·확정됨)는 내용 높이가 달라, 패딩만 맞추면 여전히 어긋난다.
   */
  const BADGE_BASE =
    'inline-flex h-6 shrink-0 items-center gap-1 rounded px-2 text-label-02-normal-medium'


  /**
   * 테두리·배지 색 = **이 반응의 색.** 카드 위 조각과 같은 값이다.
   *
   * 팝오버는 조각에서 튀어나오므로, 테두리가 조각 색과 같아야 "이 팝오버가
   * 저 폴리곤의 것"이 읽힌다. 반응이 여럿인 카드에서 팝오버를 드래그해 옮기면
   * 그 연결이 위치로는 끊기는데, 색은 안 끊긴다.
   *
   * ⚠️ 예전엔 `region.color`(DB 저장값)를 썼다. 그 값은 그릴 당시 규칙이
   * 박제된 것이라 기존 조각이 전부 `#3B82F6`이었고, 그래서 **어느 반응을 열든
   * 테두리가 파랑**이었다. 색은 번호에서 파생시킨다 — 칩·조각과 한 규칙.
   * (그 컬럼은 2026-08-26에 없어졌다. 이제 파생 말고는 방법이 없다.)
   *
   * 조각이 없어도(아직 안 그림) 중립색으로 떨어뜨리지 않는다. 이 색이 곧
   * 그렸을 때 나올 색이라(`nextRegionColor`와 같은 값) 미리 보여주는 게 맞다.
   */
  let accent = $derived(responseColor(response.response_no))

  /**
   * AI 채점을 걸 수 있는가 — 판정은 `canAiScore` 한 곳이다.
   *
   * 팝오버가 자체 규칙을 두면 표의 일괄채점 버튼과 갈린다. 같은 반응인데
   * 한쪽은 눌리고 한쪽은 안 눌리는 상태가 생긴다.
   */
  let missingInputs = $derived(missingScoreInputs(response))
  let scoreReady = $derived(missingInputs.length === 0)

  // 영역 path는 0..1 normalized. 캔버스 박스의 실제 픽셀 크기에 곱해 viewport 좌표 산출.
  let pos = $derived.by(() => {
    if (!boxRect) return null

    // 드래그 override는 조각 유무와 무관하므로 먼저 본다 (viewport 경계만 클램프)
    if (dragOverride) {
      return clampToViewport(dragOverride.left, dragOverride.top)
    }

    /**
     * **항상 카드 박스의 왼쪽 위다 — 조각이 있든 없든 같은 자리.**
     *
     * 예전에는 조각을 앵커로 삼아 "조각의 반대쪽"에 붙였다(오른쪽 조각이면
     * 왼쪽, 왼쪽 조각이면 오른쪽). 그 규칙은 카드가 화면 전체를 쓸 때만
     * 성립한다 — 채점 화면이 좌 카드 / 우 코딩표 2단이 되면 오른쪽에 붙은
     * 팝오버가 **코딩표를 덮는다.** 고정으로 띄운 표가 정작 채점하는 동안
     * 안 보이면 고정한 의미가 없다.
     *
     * 조각 옆에 바싹 붙이는 것도 버렸다. 앵커를 따라다니면 반응을 바꿀 때마다
     * 팝오버가 화면을 뛰어다니고, 조각이 카드 가운데 있으면 결국 반점을 덮는다.
     * 자리를 한 곳으로 고정하면 임상가의 눈이 그 자리를 학습하고, 카드는
     * 늘 같은 만큼만 가려진다.
     *
     * 왼쪽 위인 이유는 조각 없을 때의 근거 그대로다: `.card-box`는 16:9인데
     * 잉크 bbox는 가운데 ~64%라 **좌우 여백이 반점 바깥**이다.
     *
     * 어느 조각의 팝오버인지는 자리가 아니라 **색**이 잇는다(위 `accent`).
     *
     * 기준은 **무대**다(`stageRect`). 카드 박스는 16:9로 무대 안에 가운데
     * fit되어 화면 비율에 따라 위아래로 떠다니므로, 박스 기준으로 잡으면
     * "늘 같은 자리"라는 이 규칙 자체가 성립하지 않는다.
     */
    const anchor = stageRect ?? boxRect
    return clampToViewport(anchor.left + EDGE_INSET, anchor.top + EDGE_INSET)
  })

  // 헤더 드래그 핸들 — mousedown 시 현재 popover 좌표 + 마우스 시작점 기록
  let dragging = $state(false)
  function startDrag(e: MouseEvent) {
    if (!pos) return
    e.preventDefault()
    e.stopPropagation()
    dragging = true
    const startX = e.clientX
    const startY = e.clientY
    const baseLeft = pos.left
    const baseTop = pos.top

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

  // popover ref — 드래그 영역 식별용
  let popoverEl: HTMLDivElement | null = $state(null)

  // 신뢰도 포맷 함수는 CodingPanel로 넘겼다 — 뱃지가 거기 하나만 남았다.

  let hasAiCoding = $derived(aiCoding !== null)
  let hasFinalCoding = $derived(finalCoding !== null)
</script>

{#if pos}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!--
    `overflow-hidden`: 자식이 둥근 테두리 밖으로 나가는 것을 막는다.
    예전엔 본문에 `overflow-y-auto`가 있어서 그게 **부수적으로** 잘라줬는데,
    스크롤을 없애면서 클리핑도 함께 사라졌다.

    내용이 잘릴 걱정은 없다 — 팝오버에 높이 제한이 없어 내용만큼 늘어난다.
    드롭다운·툴팁은 portal로 body에 붙으므로 여기 갇히지 않는다.
  -->
  <div
    bind:this={popoverEl}
    bind:clientHeight={popoverH}
    class="fixed z-50 flex flex-col overflow-hidden rounded-lg border-2 bg-white shadow-2xl"
    style="left: {pos.left}px; top: {pos.top}px; width: {POPOVER_WIDTH}px; border-color: {accent};"
    onclick={(e) => e.stopPropagation()}
  >
    <!-- Header (드래그 핸들 — 헤더 빈 영역을 잡아 옮길 수 있음) -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <header
      class="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 shrink-0 select-none {dragging
        ? 'cursor-grabbing'
        : 'cursor-grab'}"
      onmousedown={startDrag}
    >
      <div class="flex items-center gap-2 min-w-0">
        <span
          class="{BADGE_BASE} text-white"
          style="background-color: {accent};"
        >
          {circled(response.response_no)} 반응
        </span>
        <!--
          AI 신뢰도 뱃지는 여기 두지 않는다 — **`CodingPanel`의 AI 제안 상자가
          이미 같은 값을 보여준다.** 같은 숫자가 한 화면에 두 번 있으면 둘이
          다른 것을 뜻하는 줄 알게 되고, 나중에 한쪽만 고치면 실제로 어긋난다.
          신뢰도는 **AI 제안 옆에** 있어야 무엇에 대한 신뢰도인지 읽힌다.
        -->
        {#if hasFinalCoding}
          <span class="{BADGE_BASE} bg-green-50 text-green-700"> 확정됨 </span>
        {/if}
        {#if canEditRecord}
          <!-- 어느 칸이 비었는지 — "누락 없음"의 최전선이다(§14-12) -->
          <span
            class="{BADGE_BASE} {region
              ? 'bg-green-50 text-green-700'
              : 'bg-gray-100 text-gray-500'}"
          >
            <Icon name={region ? 'check_circle' : 'edit_location'} size="xs" />
            영역
          </span>
          <span
            class="{BADGE_BASE} {hasInquiry
              ? 'bg-green-50 text-green-700'
              : 'bg-gray-100 text-gray-500'}"
          >
            <Icon
              name={hasInquiry ? 'check_circle' : 'help_outline'}
              size="xs"
            />
            질문
          </span>
        {/if}
      </div>
      <button
        onclick={onClose}
        onmousedown={(e) => e.stopPropagation()}
        class="text-gray-400 hover:text-gray-600 transition-colors p-1 cursor-pointer"
        aria-label="닫기"
      >
        <Close size={14} />
      </button>
    </header>

    <!--
      스크롤을 두지 않는다 — 내용 전체가 그대로 보인다(위 `popoverH` 주석).
      화면을 넘칠 것 같으면 `clampToViewport`가 팝오버를 위로 올린다.
    -->
    <div>
      <!--
        **AI 블록은 팝오버 맨 위에 있다** (채점 단계 전용).

        예전엔 채점 버튼이 기록 표와 코딩표 **사이**에 홀로 떠 있고 제안 상자는
        코딩표 안에 있었다. AI에 관한 것이 두 덩어리로 갈려 중간이 뚝 끊겨
        보였다. 지금은 채점·신뢰도·제안·전체 반영이 한 상자에 모인다.

        상자는 여기 있지만 **채택 동작은 `CodingPanel`이 한다**(`codingRef.adopt()`).
        채택 대상이 그쪽의 편집 중인 값이라, 로직까지 올리면 상태가 둘이 된다.

        근거(ai_reasoning)는 아직 안 띄운다(§14-8). **이유가 바뀌었다**:
        예전엔 목업이 입력을 되풀이하는 문자열만 내놨기 때문이었는데, 그 목업은
        2026-08-26에 걷어냈다(AI 실패는 이제 실패로 올라온다). 지금 남는 근거는
        AI 서버가 준 `발화 | 핵심 | Z=...`뿐이라, 띄울지는 실제 응답을 보고
        정한다 — 아직 실서버 응답을 눈으로 본 적이 없다.
      -->
      {#if !isAdmin}
        <div
          class="mx-3 mt-3 rounded-lg border border-purple-100 bg-purple-50/50 px-2.5 py-2"
        >
          <div class="mb-2 flex items-center gap-1.5">
            <span
              class="text-label-02-normal-bold tracking-wide text-purple-700 uppercase"
            >
              AI 제안
            </span>
            {#if aiConfidence !== null}
              <span class="text-label-02-normal-regular text-purple-500">
                신뢰도 {fmtConfidence(aiConfidence)}
              </span>
            {/if}

            {#if !readonly}
              <div class="ml-auto flex shrink-0 items-center gap-1.5">
                <!--
                  입력이 덜 찼으면 채점을 걸지 않는다 — **무엇이 없는지 이름을
                  댄다**(§14-12). 그냥 비활성이면 임상가는 왜 안 눌리는지 모른 채
                  화면을 뒤진다.
                -->
                <button
                  onclick={() =>
                    onAiScore(response.free_association_text ?? '')}
                  disabled={isScoring || !scoreReady}
                  title={scoreReady
                    ? undefined
                    : `${missingInputs.join(' · ')}이(가) 없어 AI 채점을 걸 수 없습니다.`}
                  class="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2.5 text-label-02-normal-medium transition-colors disabled:cursor-not-allowed {isScoring
                    ? 'cursor-wait bg-purple-100 text-purple-400'
                    : 'bg-purple-500 text-white hover:bg-purple-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:hover:bg-gray-200'}"
                >
                  {#if isScoring}
                    <span
                      class="h-3 w-3 animate-spin rounded-full border-2 border-purple-300 border-t-transparent"
                    ></span>
                    분석 중
                  {:else}
                    <Icon name="auto_awesome" size="sm" />
                    {hasAiCoding ? '재채점' : 'AI 채점'}
                  {/if}
                </button>

                <!--
                  ⚠️ **버튼은 항상 그린다.** 반영할 게 없다고 텍스트로 갈아끼우면
                  높이가 달라 상자가 위아래로 튄다 — 하필 채택을 누른 직후에
                  튀므로 아래 코딩표가 통째로 밀려 보인다. 자리·크기를 고정하고
                  상태만 바꾼다.

                  채택은 **비어 있는 칸만** 채운다(§14-8). 임상가가 이미 고른
                  값은 건드리지 않으므로 잃는 것이 없다 — 그래서 확인창이 없다.
                -->
                {#if aiCoding}
                  <Tooltip
                    text={adoptable
                      ? 'AI가 제안한 값을 비어 있는 칸에만 채웁니다. 이미 고른 값은 그대로 둡니다.'
                      : '반영할 제안이 없습니다 — 모든 칸을 확인했습니다.'}
                    placement="top"
                  >
                    <button
                      onclick={() => codingRef?.adopt()}
                      disabled={!adoptable}
                      class="h-7 shrink-0 rounded-lg border px-2.5 text-label-02-normal-medium transition-colors {adoptable
                        ? 'border-purple-200 text-purple-700 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-800'
                        : 'cursor-default border-gray-200 bg-gray-50 text-gray-400'}"
                    >
                      {adoptable ? '전체 반영' : '확인됨'}
                    </button>
                  </Tooltip>
                {/if}
              </div>
            {/if}
          </div>

          {#if aiCoding}
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
              {#each AI_FIELDS as f (f.key)}
                {@const v = aiValue(f.key)}
                {#if v}
                  <span class="flex items-center gap-1">
                    <span
                      class="text-label-02-normal-regular text-purple-400 uppercase"
                    >
                      {f.label}
                    </span>
                    <span class="text-label-01-normal-medium text-gray-700">
                      {v}
                    </span>
                  </span>
                {/if}
              {/each}
            </div>
          {:else}
            <p class="text-label-02-normal-regular text-purple-400">
              아직 AI 채점을 하지 않았습니다.
            </p>
          {/if}
        </div>
      {/if}

      <!--
        기록 칸 — **채점 패널과 같은 표 골격**이다.
        (w-14 회색 라벨 + flex-1 내용, 행 사이 border-t)

        한 팝오버 안에서 두 디자인 언어가 섞이면 같은 컴포넌트인데도 다른
        화면처럼 보인다. 실시와 채점이 같은 팝오버를 쓰는 이상 안쪽도 같은
        골격이어야 한다.
      -->
      <!--
        `overflow-hidden`은 장식이 아니다 — 안쪽 셀이 `bg-gray-50`으로 자기
        배경을 칠하는데, 그 모서리는 각져 있다. 부모만 `rounded-lg`면 셀의
        각진 모서리가 둥근 테두리 위로 삐져나와 네 귀퉁이가 지저분해진다.
        부모가 잘라줘야 자식이 그 곡률을 따른다.
      -->
      <div
        class="relative m-3 overflow-hidden rounded-lg border border-gray-200 bg-white text-sm"
      >
        <div class="flex">
          <div
            class="flex w-14 shrink-0 items-center border-r border-gray-200 bg-gray-50 px-2 py-2 text-label-01-normal-medium text-gray-600"
          >
            반응
          </div>
          <div class="min-w-0 flex-1 px-2 py-1.5">
            {#if canEditRecord}
              <!--
                ⚠️ **반응 칸에는 마이크가 없다.** 질문 칸에만 있다.

                팝오버는 지난 반응을 고치려고 열 때가 많은데, 그 상태로 받아쓰기를
                켜면 **지금 말하는 다른 반응의 말이 이 칸에 들어간다.** 자유반응은
                R을 결정하는 원자료라 오염 비용이 크다. 질문 답변은 그 반응을 놓고
                지금 대화하는 중이라 시점이 어긋나지 않는다.

                자유반응을 음성으로 받는 정본 경로는 **내담자 화면의 탭 + 툴바
                받아쓰기**다. 거기는 도착 순서가 아니라 시각으로 주인을 찾는
                `routeClip`이 따로 있다 — 순서로 붙이면 한 칸씩 밀리기 때문.
                여기에 마이크를 두면 같은 dictation을 쓰면서 정책만 다른 두 번째
                경로가 생긴다.
              -->
              <ResponseInput
                value={freeDraft}
                rows={1}
                enterMode="newline"
                placeholder="피검자가 무엇으로 봤는지"
                onInput={(v) => (freeDraft = v)}
                onCommit={() => {}}
                onBlur={() => onSaveText?.(freeDraft)}
              />
            {:else if response.free_association_text}
              <p class="leading-relaxed text-gray-700">
                {response.free_association_text}
              </p>
            {:else}
              <p class="text-label-02-normal-regular text-gray-400 italic">
                반응 내용이 없습니다.
              </p>
            {/if}
          </div>
        </div>

        <div class="flex border-t border-gray-200">
          <div
            class="flex w-14 shrink-0 items-center border-r border-gray-200 bg-gray-50 px-2 py-2 text-label-01-normal-medium text-gray-600"
          >
            질문
          </div>
          <div class="min-w-0 flex-1 px-2 py-1.5">
            {#if canEditRecord}
              <ResponseInput
                value={inquiryDraft}
                {phase}
                rows={3}
                enterMode="newline"
                placeholder="어디가 그렇게 보였는지"
                onInput={(v) => (inquiryDraft = v)}
                onCommit={() => {}}
                onBlur={() => onSaveInquiry?.(inquiryDraft)}
                {onToggleMic}
              />
            {:else if response.inquiry_text}
              <p class="leading-relaxed text-gray-700">
                {response.inquiry_text}
              </p>
            {:else}
              <p class="text-label-02-normal-regular text-gray-400 italic">
                아직 묻지 않았습니다.
              </p>
            {/if}
          </div>
        </div>

        {#if canEditRecord}
          <!-- 어디를 봤나 — 부호와 그리기가 한 자리에 있다(§14-5) -->
          <div class="flex border-t border-gray-200">
            <div
              class="flex w-14 shrink-0 items-center border-r border-gray-200 bg-gray-50 px-2 py-2 text-label-01-normal-medium text-gray-600"
            >
              위치
            </div>
            <div class="flex min-w-0 flex-1 flex-col gap-1.5 px-2 py-1.5">
              <LocationPicker
                value={response.area_code}
                showLabel={false}
                onChange={(code) => onChangeLocation?.(code)}
              />
              <!--
                그리기는 **호출부가 그릴 수 있을 때만** 보인다. 채점 화면은
                카드 무대를 `editable={false}`로 두므로 이 버튼을 눌러도 아무
                일이 없다 — 눌러도 안 되는 버튼을 보여주는 것이 안 보여주는
                것보다 나쁘다(CardCanvas와 같은 규칙).
                위치 **부호**는 채점에서도 고칠 수 있다(피드백 v2-3).
              -->
              {#if onStartDrawing}
                <button
                  type="button"
                  onclick={onStartDrawing}
                  class="flex h-8 items-center justify-center gap-1.5 rounded border border-dashed text-label-02-normal-medium transition-colors {region
                    ? 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    : 'border-primary-300 bg-primary-50/50 text-primary-700 hover:bg-primary-50'}"
                >
                  <Icon name="gesture" size="sm" />
                  {region ? '영역 다시 그리기' : '영역 그리기'}
                </button>
              {/if}
            </div>
          </div>

          <!--
            어느 쪽으로 놓고 봤나 — 기록이지 화면 표시가 아니다(§5-1).

            **채점 화면에서도 보인다.** 예전엔 `onChangeOrientation`이 있을
            때(=실시)만 그렸는데, 회전은 채점에 직접 쓰이는 정보다 — 피검자가
            카드를 돌려 본 반응은 영역·형태질을 그 방향에서 봐야 하고, 자주
            돌리는 것 자체가 해석 대상이다(§5-1). 채점하면서 확인할 수 없으면
            임상가는 실시 화면으로 돌아갔다 와야 한다.

            수정 가능 여부는 다른 기록과 같은 축이다 — 확정 전이면 고칠 수 있다
            (§14-14 축 전환, 피드백 v2-3).
          -->
          <div class="flex border-t border-gray-200">
            <div
              class="flex w-14 shrink-0 items-center border-r border-gray-200 bg-gray-50 px-2 py-2 text-label-01-normal-medium text-gray-600"
            >
              방향
            </div>
            <!--
              방향 버튼도 **28px(h-7)** — 표 안 다른 컨트롤과 같은 규격이다
              (`CodingPanel`의 `CONTROL_*`, `LocationPicker`). 24px이던 시절
              같은 표에서 이 줄만 바닥선이 어긋났다.
            -->
            <div class="flex min-w-0 flex-1 items-center gap-1 px-2 py-1.5">
              {#each ORIENTATION_ORDER as o (o)}
                {@const active = orientation === o}
                <button
                  type="button"
                  onclick={() => onChangeOrientation?.(o)}
                  title={ORIENTATION_LABEL[o]}
                  class="flex h-7 w-7 items-center justify-center rounded border transition-colors {active
                    ? 'border-primary-400 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-400 hover:border-gray-300'}"
                  aria-label="카드 방향 — {ORIENTATION_LABEL[o]}"
                >
                  <!--
                    ORIENTATION_ICON은 Material Icon **이름**이다. 문자열을
                    그대로 찍으면 'expand_less'가 텍스트로 나온다.
                  -->
                  <Icon name={ORIENTATION_ICON[o]} size="sm" />
                </button>
              {/each}
            </div>
          </div>
        {/if}

        <!--
          채점 표는 **같은 상자 안에 이어 붙는다** — 채점지는 한 장이다.

          예전엔 기록 표와 채점 표가 각자 테두리를 가진 두 상자였다. 같은
          반응의 정보인데 화면에서는 두 장으로 읽혔다. 지금은 바깥 테두리를
          여기서 한 번만 그리고, `CodingPanel`은 행만 내놓는다.

          **채점 단계에서만 보인다**(§3-2) — 실시 중에 채점 UI가 보이면
          임상가의 눈이 화면에 붙는다. 접기 버튼은 없앴다(§14-8): 접기가 하는
          일이 팝오버 닫기의 부분집합이고, 드래그 이동이 있어 "가려서 접는다"는
          이유도 사라졌다.
        -->
        {#if !isAdmin}
          <CodingPanel
            title=""
            {aiCoding}
            {finalCoding}
            areaCode={response.area_code}
            cardNo={response.card_no}
            {aiConfidence}
            {aiReasoning}
            {readonly}
            bind:this={codingRef}
            bind:adoptable
            bind:dirty
            onSave={(coding) =>
              onSaveCoding(coding, response.free_association_text ?? '')}
          />
          {#if isScoring}
            <div
              class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm"
            >
              <div
                class="mb-2 h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent"
              ></div>
              <span class="text-xs font-medium text-purple-600"
                >AI 분석 중…</span
              >
            </div>
          {/if}
        {/if}
      </div>

      <!--
        저장 — **푸터다.** 표 안 마지막 행이 아니라 팝오버 바닥에 붙는다.

        표 안에 있으면 채점 항목 하나처럼 읽히는데, 저장은 항목이 아니라 이
        팝오버 전체에 대한 행위다. 위치가 정보의 층위를 말해야 한다(§14-5).

        값은 `CodingPanel`이 갖고 있으므로 여기서는 부르기만 한다
        (`codingRef.save()`), 활성 여부는 `dirty`로 받는다.
      -->
      {#if !readonly && (onDelete || !isAdmin)}
        <div
          class="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50/60 px-3 py-2.5"
        >
          <!--
            삭제 — **반응 전체에 대한 행위라 푸터에 있다.**

            예전엔 '방향' 행 안에 `ml-auto`로 붙어 있었다. 방향은 기록의 한
            칸이고 삭제는 그 줄 자체를 없애는 것이라, 층위가 다른 둘이 같은
            행에 있었다. 저장을 표 밖으로 뺀 것과 같은 이유다(§14-5).

            저장과 **반대쪽 끝**에 둔다 — 실수 비용이 전혀 다른 두 버튼이
            나란히 있으면 안 된다. 강조도 낮춘다(테두리·채움 없음).
          -->
          {#if onDelete}
            <button
              onclick={onDelete}
              class="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-label-02-normal-medium text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <Icon name="delete" size="sm" />
              반응 삭제
            </button>
          {/if}

          {#if !isAdmin}
            <button
              onclick={() => codingRef?.save()}
              disabled={!dirty}
              class="h-8 rounded-lg px-4 text-label-01-normal-medium text-white shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              style="background-color: {accent};"
            >
              {dirty ? '저장' : '저장됨'}
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}
