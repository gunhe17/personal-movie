<script lang="ts">
  /**
   * 로르샤하 실시 — 자유반응과 질문이 **한 화면**이다 (§14-1).
   *
   * ## 반응은 채점지의 한 줄이다 (§14-2)
   *
   * 한 줄의 칸 — 자유반응 텍스트 / 질문 답변 / 위치 — 을 **아무 순서로나
   * 언제든** 채울 수 있다. 그래서 "자유반응 모드 / 질문 모드"라는 축이 없다.
   * 모드가 둘이라는 건 "지금은 이 칸만 채울 수 있다"는 뜻이고, 그건 위
   * 전제와 모순이다. §3-1의 "벽 없음"이 스텝 사이에서 반응 내부로 내려온 것.
   *
   * 표준 절차의 **"두 바퀴"는 유지된다** — 1바퀴에 카드 I~X 자유반응만 채우고
   * 지나가고, 2바퀴에 카드 I로 돌아와 같은 줄의 나머지 칸을 채운다. 화면이
   * 순서를 강제하지 않고 임상가가 알아서 한다.
   *
   * ⚠️ 카드별로 섞으면(카드 I 반응 → 즉시 카드 I 질문) 피검자가 방어적이 되어
   * R이 줄고, R은 거의 모든 Exner 지표의 분모다. CTO가 "타당도는 그렇게
   * 고려하지 않아도 된다"고 명시해 화면 통합은 진행했지만 위험은 §14-1에 남겼다.
   *
   * ## 레이아웃 — 우측 사이드바가 없다 (§14-3)
   *
   * 카드가 화면 거의 전부를 쓰고, 반응 하나의 정보는 **팝오버**에, 이동·추가는
   * 카드 위에 얹힌 **페이저**에 있다. 예전에는 w-100 사이드바가 상시 자리를
   * 먹었는데, 내담자 모드에서 그게 통째로 사라진다는 사실 자체가 "항상 필요한
   * 게 아니다"를 이미 인정한 것이었다.
   *
   * ## 정보 군집 (§14-5)
   *
   * 거부·촉구는 **"지금 이 카드"에 대한 기록**이므로 카드·반응을 고르는 줄에 있다.
   * 푸터에는 되돌리기 어려운 **단계 전환** 하나만 둔다 — 실수 비용이 전혀 다른
   * 두 버튼이 나란히 있으면 안 된다.
   *
   * 촉구(prompt)는 **클릭 한 번, 문장 없음**이다. 예전에 이 기능을 걷어낸 이유는
   * "버튼 하나로 정해진 문구를 남기는 것이 실제 개입을 반영하지 못한다"였는데,
   * 진단이 반쯤 틀렸다 — 문제는 문구가 가짜라는 게 아니라 **애초에 문구가 필요
   * 없다는 것**이었다. 해석에 쓰이는 것은 "이 카드에서 촉구가 있었나" 하나이고,
   * 실시 중에 타이핑을 요구하면 아무도 기록하지 않는다.
   * (한계검증만 예외 — 무엇을 유도했는지 없으면 해석이 안 되므로 서버가 요구한다.)
   */
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { slide } from 'svelte/transition'
  import { institutionId } from '$lib/stores/institution.store'
  import { snackbarStore } from '$lib/stores/snackbar'

  import {
    RORSCHACH_CARDS,
    cardToIndex,
    indexToCard,
    responseColor,
    type CardOrientation
  } from '$lib/features/examination/rorschach/constants'
  import type { Point, RorschachCard } from '$lib/features/examination/rorschach/types'
  import {
    startSession,
    completeSession,
    getSessionDetail,
    createResponse,
    deleteResponse,
    setCardStatus,
    transcribeClip,
    updateResponse,
    createRegion,
    deleteRegion,
    createIntervention,
    deleteIntervention,
    type CardStatus,
    type ServerRegion,
    type ServerResponseDetail,
    type ServerCardAdministration,
    type ServerIntervention,
  } from '$lib/features/examination/rorschach/actions'
  import { getExamContext } from '$lib/features/examination/core/exam-context.svelte'

  import ExamLayoutShell from '$lib/features/examination/core/ExamLayoutShell.svelte'
  import CardTabs from '$lib/features/examination/rorschach/components/sync/CardTabs.svelte'
  import CardCanvas from '$lib/features/examination/rorschach/components/sync/CardCanvas.svelte'
  import ResponseToolbar from '$lib/features/examination/rorschach/components/sync/ResponseToolbar.svelte'
  import ResponsePopover from '$lib/features/examination/rorschach/components/sync/ResponsePopover.svelte'
  import { createDictation } from '$lib/features/examination/rorschach/hooks/dictation.svelte'
  import Icon from '$lib/components/ui/Icon.svelte'
  import Switch from '$lib/components/ui/Switch.svelte'
  import ArrowRight from '$lib/assets/icons/ArrowRight.svelte'

  const layoutCtx = getExamContext()

  let examId = $derived(page.params.examId ?? '')
  let isInitialized = $state(false)
  let isSaving = $state(false)
  let isCompleting = $state(false)
  let isSavingPrompt = $state(false)

  let currentCard = $state<RorschachCard>('I')
  let responses = $state<ServerResponseDetail[]>([])
  let regions = $state<ServerRegion[]>([])
  let cards = $state<ServerCardAdministration[]>([])
  let interventions = $state<ServerIntervention[]>([])

  /** 지금 다루는 반응 — 이 화면의 축이다 */
  let selectedId = $state<string | null>(null)
  let isDrawingMode = $state(false)

  /**
   * 반응을 고른 시각 — **질문 단계에서 받아쓰기의 경계다.**
   *
   * 자유반응에서는 탭이 경계였다(탭과 탭 사이의 말이 그 반응의 것). 질문
   * 단계에는 탭이 없다 — 줄이 새로 생기면 R이 틀어지므로 생겨서도 안 된다.
   * 대신 **검사자가 반응을 고르는 행위**가 그 자리를 대신한다: 고른 뒤의 말이
   * 그 반응에 대한 질문 답변이다.
   *
   * $state가 아니다 — 화면이 이걸 그리지 않는다.
   */
  let selectedAt: Date | null = null

  /**
   * 내담자 모드 — 태블릿을 피검자 쪽으로 돌릴 때 (§14-2).
   *
   * **명시적 버튼으로만 바뀐다.** 인터랙션으로 자동 추론하면 안 된다 —
   * 잘못 뜨면 피검자가 이전 반응("박쥐 같아요")을 보고 다음 반응이 오염된다.
   * 실패 비용이 비대칭이다.
   */
  let clientMode = $state(false)

  /**
   * 내담자 화면의 두 바퀴 — **고른 반응이 있는가가 가른다.**
   *
   * | 상태 | 카드 | 받아쓰기 |
   * |---|---|---|
   * | 미선택 = 자유반응 | 탭 판(누르면 새 줄) | 탭 경계 → `free_association_text` |
   * | 선택 = 질문 | 그리기 캔버스 | 선택 경계 → `inquiry_text` |
   *
   * 별도 스텝을 두지 않는다. 질문은 "두 바퀴째"일 뿐이고(§14-1) 화면이 순서를
   * 강제하지 않기로 했으므로 **선택 상태 하나로 두 바퀴가 표현된다.**
   *
   * 카드 위에서 두 동작이 충돌하기 때문에도 이렇게 갈라야 한다 — 탭 판이 살아
   * 있으면 영역을 그리려는 드래그가 새 반응을 만든다. R이 틀어지는 자리다.
   */
  let clientInquiryMode = $derived(clientMode && selectedId !== null)

  /**
   * 아직 주인을 못 찾은 전사 조각들 — **탭보다 늦게 도착한 말**.
   *
   * ⚠️ 여기가 이 화면에서 가장 틀리기 쉬운 자리다. 처음에는 문자열 버퍼 하나를
   * 두고 "탭하면 비운다"로 만들었는데 **체계적으로 한 칸씩 밀린다**:
   *
   *   피검자 발화 종료 → +1200ms 침묵 확인 → 전사 요청 → 수 초 뒤 도착
   *   검사자 탭은 발화 직후(~0.5초)에 온다 → 그 순간 버퍼는 비어 있다
   *
   * 검사자는 반응이 끝나자마자 누르므로 **탭이 항상 전사보다 빠르다.** 도착
   * 시점으로 주인을 정하면 모든 반응이 이전 반응의 말을 갖게 된다.
   *
   * 그래서 **시각으로 주인을 찾는다.** 순서가 어느 쪽이든 같은 답이 나온다:
   *   - 탭이 먼저(정상): 조각이 도착하면 자기 구간 뒤에 찍힌 첫 마크를 찾는다
   *   - 조각이 먼저(드묾): 주인이 아직 없으니 여기 담아뒀다가 다음 탭이 가져간다
   *
   * ⚠️ **기준은 `endedAt`이 아니라 `startedAt`이다.** `endedAt`은 조각을 끊은
   * 시각이라 침묵 확인 1200ms가 이미 들어가 있고, 탭은 발화 직후(~0.5초)에
   * 오므로 **자기 조각의 endedAt보다 앞선다**. endedAt으로 재면 자기 탭을
   * 건너뛰고 다음 탭이 주인이 되어 여전히 한 칸씩 밀린다.
   * 조각은 연속이라(끊는 즉시 다음 조각 시작) 탭은 항상 자기 조각의
   * `[startedAt, endedAt]` 구간 안에 떨어진다 — 그래서 startedAt이 맞다.
   */
  let pendingClips = $state<{ text: string; startedAt: Date }[]>([])

  /**
   * 탭이 남긴 자국 — 이 시각에 이 반응이 만들어졌다.
   *
   * 조각의 주인은 **자기 구간이 시작된 뒤에 찍힌 첫 마크**다. 반응 N의 발화는
   * 반응 N을 만든 탭보다 먼저 시작되기 때문이다.
   *
   * $state가 아니다 — 화면이 이걸 그리지 않는다. 반응성을 붙이면 조각이 도착할
   * 때마다 화면 전체가 다시 계산된다.
   */
  let tapMarks: { responseId: string; tapAt: Date }[] = []

  /**
   * 방금 줄이 만들어졌다는 순간 피드백 — 누른 자리에서 퍼지는 잔물결.
   *
   * **상시 표시가 아닌 이유:** 반응 수가 화면에 남아 있으면 피검자가 자기가 몇 개
   * 말했는지 알고 페이스를 계산한다(§14-2). 검사자에게는 "기록됐다"만 알려주면
   * 되고, 그건 순간이면 충분하다.
   *
   * ⚠️ **색을 쓰지 않는다.** 카드 위에 얹히는 신호라 색상을 넣으면 잉크반점의
   * 색 자극이 변한다 — 색채결정인(FC/CF/C)이 채점 축이라 이건 미관이 아니라
   * 타당도 문제다. 밝기만 아주 옅게 건드리고 400ms 안에 사라진다.
   *
   * key는 잔물결을 다시 트리거하기 위한 것이다 — 같은 자리를 연달아 누르면
   * 좌표가 같아서 DOM이 재생성되지 않고 애니메이션이 안 돈다.
   */
  let ripple = $state<{ x: number; y: number; key: number } | null>(null)
  let rippleTimer: ReturnType<typeof setTimeout> | null = null
  let rippleSeq = 0

  /** 연타로 반응이 두 번 생기는 것을 막는 최소 간격 — `handleClientTap` 참조 */
  const TAP_COOLDOWN_MS = 400
  /**
   * 마지막으로 받아들인 탭 시각. `$state`가 아니다 — 화면이 이 값을 그리지
   * 않으므로 반응성을 붙이면 탭마다 화면이 다시 계산된다.
   */
  let lastTapAt = 0

  /**
   * 카드 탭 줄이 나타나고 사라지는 시간.
   *
   * 툭 사라지면 화면이 통째로 바뀐 것처럼 읽혀서, 검사자가 "뭐가 없어졌지"를
   * 한 번 확인하게 된다. 미끄러지면 그게 같은 화면의 접힘으로 읽힌다.
   *
   * 움직임을 줄이도록 설정한 사용자에게는 0 — 잔물결과 같은 규칙이다.
   */
  const TABS_SLIDE_MS =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? 0
      : 200

  let cardBox = $state<HTMLDivElement | null>(null)

  let cardNo = $derived(cardToIndex(currentCard))
  let cardIndex = $derived(RORSCHACH_CARDS.indexOf(currentCard))
  let selectedResponse = $derived(
    responses.find((r) => r.id === selectedId) ?? null
  )
  /** 선택된 반응의 조각 — 위치는 반응당 하나다(§14-7) */
  let selectedRegion = $derived(
    regions.find((g) => g.response_id === selectedId) ?? null
  )

  let cardResponses = $derived(
    responses
      .filter((r) => r.card_no === cardNo)
      .sort((a, b) => (a.response_no ?? 0) - (b.response_no ?? 0))
  )
  /**
   * 화면에 그릴 조각 — **임상가 화면에서는 이 카드의 전부, 내담자 화면에서는 없음.**
   *
   * 예전에는 두 축이 거꾸로였다. 선택된 반응의 조각 하나만 그렸고, 그마저도
   * 내담자 모드에서 그대로 남아 있었다 — 정확히 반대다.
   *
   * **임상가는 다 봐야 한다.** 아날로그 채점지에서 위치 도표는 한 장이고 그 위에
   * 반응이 겹쳐 그려진다. 앞 반응과 같은 영역인지, 겹치는지, 아직 안 그린 반응이
   * 있는지가 카드 위에서 바로 읽혀야 한다. 하나만 보이면 그걸 알려고 반응을
   * 하나씩 눌러가며 기억에 의존해 비교하게 된다.
   * "지금 어느 반응인가"는 `RegionOverlay`가 굵기(2→3)와 농도(1A→33)로 이미 말한다.
   *
   * **내담자는 하나도 보면 안 된다.** 자기가 방금 본 자리의 윤곽선을 보면 다음
   * 반응이 오염된다(§14-2). 실물 카드에는 아무 표시도 없다.
   */
  let visibleRegions = $derived.by(() => {
    if (clientMode) return []
    const cardResponseIds = new Set(cardResponses.map((r) => r.id))
    return regions.filter((g) => g.response_id && cardResponseIds.has(g.response_id))
  })

  let responseCounts = $derived.by(() => {
    const counts = {} as Record<RorschachCard, number>
    for (const c of RORSCHACH_CARDS) counts[c] = 0
    for (const r of responses) {
      const c = indexToCard(r.card_no)
      counts[c] = (counts[c] ?? 0) + 1
    }
    return counts
  })

  let statusByCard = $derived.by(() => {
    const map: Partial<Record<RorschachCard, CardStatus>> = {}
    for (const c of cards) map[indexToCard(c.card_no)] = c.status
    return map
  })

  /**
   * 반응 하나가 실시 완료인가 — 세 칸을 **모두** 채웠는가.
   *   자유반응 텍스트 / 영역 / 질문 답변
   *
   * 서버 `completion.response_recorded`와 **같은 규칙**이다. 두 곳이 다르면
   * 화면은 완료라는데 완료 처리가 거부된다.
   *
   * 텍스트를 검사하는 이유: 반응 생성 시엔 빈 값을 허용한다(줄을 먼저 만들고
   * 내용을 나중에 적는다). 입력을 조이지 않는 대신 여기서 잡는다.
   */
  function isDone(r: ServerResponseDetail): boolean {
    if (!r.is_formal) return true
    if (!(r.free_association_text ?? '').trim()) return false
    if (!regions.some((g) => g.response_id === r.id)) return false
    return (r.inquiry_text ?? '').trim() !== ''
  }

  /**
   * 조각 → 소유 반응 번호. 라벨과 색이 **같은 번호**를 봐야 한다.
   *
   * 조각마다 `responses.find`를 두 번(라벨·색) 돌지 않도록 번호를 한 번만
   * 찾는다. 반응 25개 × 조각 25개면 순회가 눈에 띄기 시작한다.
   */
  let responseNoById = $derived.by(() => {
    const map = new Map<string, number | null>()
    for (const r of responses) map.set(r.id, r.response_no)
    return map
  })

  // 주인 없는 조각(`response_id`가 null)은 역전 마이그레이션 이전 잔재다.
  // 라벨은 '?', 색은 중립색으로 떨어진다 — 조용히 1번 색을 주면 실제 1번
  // 반응과 구분되지 않는다.
  function regionLabel(responseId: string | null): string {
    const no = responseId == null ? null : responseNoById.get(responseId)
    return no == null ? '?' : String(no)
  }

  /** 조각 색 = 소유 반응 색. 칩과 같은 규칙이라 둘이 어긋날 수 없다. */
  function regionColor(responseId: string | null): string {
    return responseColor(responseId == null ? null : responseNoById.get(responseId))
  }

  /** 카드별 완료 — 그 카드의 모든 정식 반응이 칸을 다 채웠는가 */
  let doneByCard = $derived.by(() => {
    const map: Partial<Record<RorschachCard, boolean>> = {}
    for (const c of RORSCHACH_CARDS) {
      const rs = responses.filter(
        (r) => r.card_no === cardToIndex(c) && r.is_formal
      )
      map[c] = rs.length > 0 && rs.every(isDone)
    }
    return map
  })

  let formalResponses = $derived(responses.filter((r) => r.is_formal))
  let doneCount = $derived(formalResponses.filter(isDone).length)

  let currentCardRejected = $derived(statusByCard[currentCard] === 'rejected')

  /**
   * 이 카드에 촉구를 했는가 — 거부와 나란히 읽혀야 뜻이 생긴다.
   *
   * **횟수가 아니라 있음/없음이다.** 표준 절차에서 격려성 촉구는 카드 I에서
   * 반응이 하나뿐일 때 한 번뿐이고, 해석에 쓰이는 것도 "이 카드에서 촉구가
   * 있었나" 하나다. 누적으로 세면 실시 중 오조작과 실제 반복이 구분되지 않는다.
   */
  let currentCardPrompt = $derived(
    interventions.find((i) => i.card_no === cardNo && i.kind === 'prompt') ?? null
  )

  /**
   * 완료 게이트 — 10장 전부 실시/거부 **AND** 모든 반응이 칸을 채웠는가.
   *
   * 서버 `completion.administration_done`과 같은 규칙이다. 화면을 합치면서
   * "자유반응 완료" 중간 게이트가 사라졌으므로, 여기서 빠뜨린 것을 잡지
   * 못하면 카드 하나가 통째로 누락된 채 채점으로 간다 — R이 줄면 Exner
   * 지표 전부가 틀어진다(§14-12).
   */
  let unfinishedCards = $derived(
    RORSCHACH_CARDS.filter((c) => {
      const st = statusByCard[c]
      if (st === 'rejected') return false
      if (st !== 'responded') return true
      return !doneByCard[c]
    })
  )
  let canComplete = $derived(unfinishedCards.length === 0)
  /** 이름을 대야 임상가가 찾을 수 있다 — 버튼만 비활성이면 못 찾는다 */
  let completeHint = $derived(
    canComplete ? '' : `아직 끝나지 않은 카드: ${unfinishedCards.join(', ')}`
  )

  /**
   * 음성 전사 — 발화를 감지해 그 구간만 전사하고 **활성 칸에 이어붙인다.**
   *
   * 칩으로 자동 등록하지 않는다. 한 반응이 침묵으로 끊길 수 있어
   * ("박쥐 같아요… 날개가 펴져 있어서") VAD 경계를 반응 경계로 삼으면
   * 한 반응이 두 개로 쪼개져 R이 틀어진다. 경계는 임상가가 정한다.
   */
  const dictation = createDictation({
    transcribe: async (clip, durationSec) => {
      const instId = $institutionId
      if (!instId) return ''
      const res = await transcribeClip(instId, examId, clip, durationSec)
      // detected=true인데 text가 비면 환각으로 걸러진 것이다.
      if (res.detected && !res.text) {
        snackbarStore.info('음성이 감지됐지만 인식하지 못했습니다. 직접 입력해주세요.')
      }
      return res.text
    },
    onText: (text, clip) => {
      if (!text) return

      /*
       * 내담자 화면에서는 **도착한 순서가 아니라 시각으로** 주인을 찾는다.
       * 그 화면에는 "지금 편집 중인 칸"이 없고(팝오버가 없다), 전사가 탭보다
       * 늦게 오므로 "지금 선택된 반응"에 넣으면 한 칸씩 밀린다.
       */
      if (clientMode) {
        /*
         * 질문 바퀴 — 고른 반응이 있으면 그 반응의 **질문 칸**으로 간다.
         *
         * 경계는 `selectedAt`이다. 고르기 **전에** 시작된 말은 그 반응에 대한
         * 답이 아니다 — 아직 무엇을 묻는지 정해지기 전의 말이고, 대개 직전
         * 반응의 잔여이거나 검사자가 질문을 꺼내는 말이다. 시작 시각으로
         * 재는 이유는 자유반응 쪽과 같다(도착 시각으로 재면 한 칸씩 밀린다).
         *
         * 못 미치는 조각은 `routeClip`으로 흘려보낸다 — 자유반응 바퀴의
         * 규칙이 거기서 다시 판단한다. 조용히 버리지 않는다.
         */
        if (selectedId && selectedAt && clip.startedAt >= selectedAt) {
          void appendInquiry(selectedId, text)
          return
        }
        void routeClip(text, clip.startedAt)
        return
      }

      /*
       * 임상가 화면에서 받아쓰기의 목적지는 **질문 답변 하나뿐이다.**
       * 팝오버 마이크가 질문 칸에만 있기 때문이다(§자유반응 오염 위험).
       * 그래서 "어느 칸에 받아쓰나"를 상태로 들고 다니지 않는다 — 화면 모드가
       * 목적지를 완전히 결정한다: 내담자 화면이면 routeClip, 아니면 질문 칸.
       */
      if (!selectedResponse) return
      const prev = (selectedResponse.inquiry_text ?? '').trimEnd()
      void saveField('inquiry_text', prev ? `${prev} ${text}` : text)
    },
    onError: (msg) => snackbarStore.error(msg)
  })

  $effect(() => () => dictation.dispose())

  // --- Init ---
  $effect(() => {
    const instId = $institutionId
    if (!instId || !examId || isInitialized) return
    void initialize(instId, examId)
  })

  async function initialize(instId: string, eId: string) {
    try {
      // 세션이 없으면 만든다 — 이 화면이 검사의 첫 화면이다.
      await startSession(instId, eId)
      await reload(instId, eId)
      isInitialized = true
      selectFirstOfCard(currentCard)
    } catch (err) {
      console.error('[실시 화면 init] 실패', err)
      snackbarStore.error('검사 화면을 불러오지 못했습니다.')
    }
  }

  async function reload(instId: string, eId: string) {
    const detail = await getSessionDetail(instId, eId)
    responses = detail.responses
    regions = detail.regions
    cards = detail.cards
    interventions = detail.interventions
  }

  function replaceResponse(updated: ServerResponseDetail) {
    responses = responses.map((r) => (r.id === updated.id ? updated : r))
  }

  function selectFirstOfCard(card: RorschachCard) {
    /*
     * 내담자 화면에서는 **아무것도 고르지 않은 채로 시작한다.**
     *
     * 자동 선택하면 카드를 넘기는 순간 질문 바퀴로 들어가고, 탭 판이 사라져
     * 반응을 만들 수가 없다. 자유반응이 기본이고 질문은 검사자가 칩을 골라
     * 들어가는 것이다 — 그 선택은 명시적이어야 한다.
     */
    if (clientMode) {
      selectResponse(null)
      isDrawingMode = false
      return
    }
    const first = responses
      .filter((r) => r.card_no === cardToIndex(card))
      .sort((a, b) => (a.response_no ?? 0) - (b.response_no ?? 0))[0]
    selectResponse(first?.id ?? null)
    isDrawingMode = false
  }

  function handleCardChange(next: RorschachCard) {
    currentCard = next
    selectFirstOfCard(next)
  }

  // --- 반응 ---

  /**
   * 새 반응 — 빈 줄을 먼저 만들고 칸은 나중에 채운다.
   *
   * 예전에는 텍스트를 입력해야 반응이 생겼는데, 그러면 "먼저 만들고 아무 칸이나
   * 채운다"(§14-2)가 성립하지 않는다.
   */
  async function handleAdd(utteranceAt?: Date) {
    const instId = $institutionId
    if (!instId || isSaving || currentCardRejected) return
    isSaving = true

    /*
     * 이 반응의 구간 안에서 시작된 조각들만 가져온다.
     *
     * 보통은 비어 있다 — 전사가 탭보다 늦게 오기 때문이다. 그 늦게 오는 것들은
     * `routeClip`이 아래에서 남기는 마크를 보고 찾아온다. 여기는 그 반대,
     * **탭이 늦은 경우**(검사자가 뒤늦게 누름)를 위한 회수 경로다.
     *
     * ⚠️ **하한이 있어야 한다.** 예전에는 `startedAt <= utteranceAt` 하나뿐이라
     * 상한만 있었다. 그런데 `pendingClips`에는 **영영 주인이 없을 조각**도
     * 쌓인다 — 카드 제시 직후의 "음…", 검사자 자신의 말, 반응이 아닌 잡담.
     * 그런 조각은 탭이 오지 않으니 계속 남아 있다가, **다음 탭이 무조건
     * 가져갔다.** 10분 전 말이 방금 만든 반응에 들어가는 것이다.
     *
     * 이 반응의 구간은 **직전 탭 이후**다. 그 앞의 말은 이전 반응의 것이거나
     * 아무의 것도 아니다. 첫 반응이면 하한이 없다 — 카드를 제시하고 처음 나온
     * 말은 그 반응의 것으로 보는 게 맞다.
     *
     * 하한 밖 조각은 **버리지 않고** `pendingClips`에 남는다. 화면을 나갈 때
     * "배정되지 않은 발화"로 보여준다(아래 $effect) — 조용히 사라지면
     * 무엇을 잃었는지 아무도 모른다(§14-12).
     */
    const prevTapAt = tapMarks.at(-1)?.tapAt
    const claimed = utteranceAt
      ? pendingClips.filter(
          (c) =>
            c.startedAt.getTime() <= utteranceAt.getTime() &&
            (!prevTapAt || c.startedAt.getTime() > prevTapAt.getTime())
        )
      : []
    if (claimed.length) {
      pendingClips = pendingClips.filter((c) => !claimed.includes(c))
    }
    const draft = claimed.map((c) => c.text).join(' ').trim()

    try {
      // 방향은 그 카드의 마지막 반응을 따른다 — 실물에서 피검자가 카드를
      // 돌리면 돌린 채로 다음 반응을 한다. 매번 정위로 되돌아가지 않는다.
      const lastOrientation = cardResponses.at(-1)?.card_orientation ?? 'up'
      const created = await createResponse(instId, examId, {
        card_no: cardNo,
        free_association_text: draft,
        // 초안이 있으면 원문도 굳힌다 — 나중에 임상가가 고친 것과 대조된다(§4-2).
        free_association_stt_raw: draft || null,
        card_orientation: lastOrientation as CardOrientation,
      })
      responses = [...responses, created]
      /*
       * 내담자 화면에서는 만든 줄을 **고르지 않는다.** 고르면 질문 바퀴로
       * 들어가 탭 판이 사라지고, 다음 반응을 기록할 수 없다. 자유반응 중에는
       * 계속 자유반응이어야 한다.
       */
      if (!clientMode) selectResponse(created.id)

      /*
       * 탭 자국을 남긴다 — **아직 도착하지 않은 전사가 이걸 보고 찾아온다.**
       *
       * 정상 경로가 이쪽이다: 검사자는 발화 직후에 누르고, 전사는 몇 초 뒤에
       * 온다. 그때 `routeClip`이 "이 조각이 끝난 뒤 첫 마크"로 여기를 찾는다.
       *
       * 마크는 시각 오름차순으로 유지된다(탭은 시간순으로만 생긴다). `find`가
       * **첫** 마크를 고르는 것이 곧 가장 가까운 뒤쪽 탭이다.
       */
      if (utteranceAt) {
        tapMarks = [...tapMarks, { responseId: created.id, tapAt: utteranceAt }]
      }

      // 반응이 생기면 서버가 카드를 실시됨으로 바꾼다. 화면도 맞춘다.
      if (statusByCard[currentCard] !== 'responded') {
        const detail = await getSessionDetail(instId, examId)
        cards = detail.cards
      }
    } catch (err) {
      console.error('[createResponse] 실패', err)
      snackbarStore.error('반응 추가에 실패했습니다.')
    } finally {
      isSaving = false
    }
  }

  /**
   * 칸 저장 — 낙관적 갱신 후 서버 저장.
   *
   * 검사 중에 "저장하셨나요"를 신경 쓰게 만들면 안 되므로 즉시 반영하고,
   * 실패하면 되돌린다.
   */
  async function saveField(
    field: 'free_association_text' | 'inquiry_text' | 'area_code',
    value: string | null
  ) {
    const target = selectedResponse
    const instId = $institutionId
    if (!target || !instId) return

    const prev = responses
    replaceResponse({ ...target, [field]: value })
    try {
      const updated = await updateResponse(instId, examId, target.id, {
        [field]: value
      })
      replaceResponse(updated)
    } catch (err) {
      console.error(`[updateResponse ${field}] 실패`, err)
      snackbarStore.error('저장에 실패했습니다.')
      responses = prev
    }
  }

  async function handleChangeOrientation(next: CardOrientation) {
    const target = selectedResponse
    const instId = $institutionId
    if (!target || !instId) return
    const prev = responses
    replaceResponse({ ...target, card_orientation: next })
    try {
      const updated = await updateResponse(instId, examId, target.id, {
        card_orientation: next
      })
      replaceResponse(updated)
    } catch (err) {
      console.error('[updateResponse orientation] 실패', err)
      snackbarStore.error('방향 수정에 실패했습니다.')
      responses = prev
    }
  }

  async function handleDeleteResponse() {
    const target = selectedResponse
    const instId = $institutionId
    if (!target || !instId) return
    const prevR = responses
    const prevG = regions
    responses = responses.filter((r) => r.id !== target.id)
    // 반응을 지우면 딸린 조각도 함께 사라진다(서버가 강제하는 불변식)
    regions = regions.filter((g) => g.response_id !== target.id)
    selectResponse(null)
    try {
      await deleteResponse(instId, examId, target.id)
    } catch (err) {
      console.error('[deleteResponse] 실패', err)
      snackbarStore.error('반응 삭제에 실패했습니다.')
      responses = prevR
      regions = prevG
    }
  }

  // --- 영역 ---

  async function handleDrawEnd(path: Point[]) {
    isDrawingMode = false
    const target = selectedResponse
    const instId = $institutionId
    if (!target || !instId) return

    try {
      // 라벨·색은 보내지 않는다(2026-08-26 제거). 예전엔 "DB만 보는
      // 소비자를 위해" 같은 규칙으로 채워 보냈는데, 반응 번호가 순서에서
      // 파생되므로 반응 하나만 지워도 저장값이 옛 번호에 머문다.
      // 그 소비자를 돕는 게 아니라 속이는 값이었다 — 실제로 PDF가 그
      // 옛 번호를 찍고 있었다. 없으면 파생시킨다.
      const saved = await createRegion(instId, examId, {
        response_id: target.id,
        path
      })
      // 위치는 반응당 하나 — 서버가 기존 조각을 대체하므로 화면도 대체한다.
      // (append하면 서버는 1개인데 화면은 2개가 되어 조용히 어긋난다)
      regions = [...regions.filter((g) => g.response_id !== target.id), saved]
      replaceResponse({ ...target, region_ids: [saved.id] })
    } catch (err) {
      console.error('[createRegion] 실패', err)
      // 저장에 실패해도 그린 것을 말없이 지우지 않는다 — 임상가가 다시
      // 그렸는지 아닌지도 알 수 없게 된다.
      snackbarStore.error('영역 저장에 실패했습니다. 다시 시도해주세요.')
    }
  }

  async function handleDeleteRegion() {
    const g = selectedRegion
    const instId = $institutionId
    if (!g || !instId) return
    const prev = regions
    regions = regions.filter((x) => x.id !== g.id)
    if (selectedResponse) {
      replaceResponse({ ...selectedResponse, region_ids: [] })
    }
    try {
      await deleteRegion(instId, examId, g.id)
    } catch (err) {
      console.error('[deleteRegion] 실패', err)
      snackbarStore.error('영역 삭제에 실패했습니다.')
      regions = prev
    }
  }

  /**
   * 내담자 화면의 탭 — **이 화면에서 검사자가 하는 유일한 기록 동작**이다.
   *
   * 반응이 하나 나올 때마다 카드를 한 번 누른다. 아날로그에서 채점지에 줄을
   * 긋는 것과 같다 — 줄을 긋는 것과 채우는 것은 원래 별개 동작이다(§14-2).
   *
   * **왜 여기서는 텍스트를 못 받나.** 입력란에 포커스가 가면 소프트 키보드가
   * 뜨고, 검사자가 타이핑하는 내용이 피검자 화면에 그대로 보인다. 실물 검사는
   * 검사자가 자기 채점지에 적고 피검자는 못 본다 — 그 비대칭이 깨진다.
   * 그래서 이 화면이 남길 수 있는 것은 내용이 아니라 **사건과 시각**뿐이다.
   */
  /**
   * 전사 조각 하나를 주인에게 붙인다 — **시각 기준**.
   *
   * 주인은 "이 조각이 시작된 뒤에 찍힌 첫 탭"이다. 조각은 연속이라 탭은 자기
   * 조각의 구간 안에 떨어지고, 그 탭이 가장 가까운 뒤쪽 마크가 된다.
   *
   * 못 찾으면(= 아직 탭이 안 왔으면) 담아뒀다가 다음 탭이 가져간다. 검사자가
   * 탭을 늦게 누르거나 아예 빠뜨린 경우가 여기 온다.
   */
  async function routeClip(text: string, startedAt: Date) {
    const mark = tapMarks.find((m) => m.tapAt.getTime() >= startedAt.getTime())
    if (!mark) {
      pendingClips = [...pendingClips, { text, startedAt }]
      return
    }
    await appendStt(mark.responseId, text)
  }

  /**
   * 반응의 자유반응 칸에 전사 텍스트를 이어붙인다.
   *
   * `_stt_raw`도 같이 채운다 — 나중에 임상가가 `_text`를 고치면 "기계가 들은
   * 것"과 대조된다(§4-2). 두 칸이 같은 값으로 시작해서 한쪽만 변해 나간다.
   *
   * ⚠️ `saveField`를 쓰지 않는다. 그건 **지금 선택된 반응**에 저장하는데,
   * 조각이 도착할 무렵엔 이미 다음 반응이 선택돼 있다.
   */
  async function appendStt(responseId: string, text: string) {
    const instId = $institutionId
    const target = responses.find((r) => r.id === responseId)
    if (!instId || !target) return

    const prevText = (target.free_association_text ?? '').trimEnd()
    const nextText = prevText ? `${prevText} ${text}` : text
    const prevRaw = (target.free_association_stt_raw ?? '').trimEnd()
    const nextRaw = prevRaw ? `${prevRaw} ${text}` : text

    const snapshot = responses
    replaceResponse({
      ...target,
      free_association_text: nextText,
      free_association_stt_raw: nextRaw
    })
    try {
      const updated = await updateResponse(instId, examId, responseId, {
        free_association_text: nextText,
        free_association_stt_raw: nextRaw
      })
      replaceResponse(updated)
    } catch (err) {
      console.error('[appendStt] 실패', err)
      responses = snapshot
      snackbarStore.error('전사 내용을 저장하지 못했습니다.')
    }
  }

  /**
   * 고른 반응의 **질문 답변 칸**에 전사 텍스트를 이어붙인다.
   *
   * `appendStt`(자유반응)와 나란한 함수다. 합치지 않는 이유는 **어느 칸에
   * 쓰는지가 곧 무엇을 기록했는지**이기 때문이다 — 필드명을 인자로 받으면
   * 부르는 쪽 한 곳만 틀려도 자유반응 자리에 질문 답변이 들어가고, 그건
   * 화면에서 구별되지 않는다(§4-2가 두 칸을 나눈 이유와 같은 축).
   *
   * `inquiry_stt_raw`도 같이 채운다 — 임상가가 나중에 고치면 "기계가 들은 것"과
   * 대조된다. **이 주석은 한동안 거짓이었다**(2026-08-26 수정): 코드는
   * `inquiry_text`만 보냈고 백엔드 `ResponseUpdate`에 그 칸 자체가 없었다.
   * §4-2가 자유반응에만 지켜지고 질문 답변에는 안 지켜진 상태였다.
   */
  async function appendInquiry(responseId: string, text: string) {
    const instId = $institutionId
    const target = responses.find((r) => r.id === responseId)
    if (!instId || !target) return

    const prevText = (target.inquiry_text ?? '').trimEnd()
    const nextText = prevText ? `${prevText} ${text}` : text
    const prevRaw = (target.inquiry_stt_raw ?? '').trimEnd()
    const nextRaw = prevRaw ? `${prevRaw} ${text}` : text

    const snapshot = responses
    replaceResponse({ ...target, inquiry_text: nextText, inquiry_stt_raw: nextRaw })
    try {
      const updated = await updateResponse(instId, examId, responseId, {
        inquiry_text: nextText,
        inquiry_stt_raw: nextRaw
      })
      replaceResponse(updated)
    } catch (err) {
      console.error('[appendInquiry] 실패', err)
      responses = snapshot
      snackbarStore.error('질문 답변을 저장하지 못했습니다.')
    }
  }

  /**
   * 반응을 고른다 — **고른 시각을 함께 남긴다.**
   *
   * 그 시각이 질문 바퀴에서 받아쓰기의 경계가 된다(`selectedAt` 주석).
   * 선택을 푸는 것(null)도 경계다: 자유반응 바퀴로 돌아간다.
   */
  function selectResponse(id: string | null) {
    selectedId = id
    selectedAt = id ? new Date() : null
  }

  function handleClientTap(e: MouseEvent) {
    if (isSaving || currentCardRejected) return

    /*
     * **연타 방어.** `isSaving`만으로는 부족하다 — 그 플래그는 요청이 도는
     * 동안만 서 있는데, 서버가 200ms만에 답하면 두 번째 탭이 그 뒤에 들어와
     * 통과한다. 손가락이 튀거나 태블릿이 한 번의 터치를 두 번으로 보고하면
     * **반응 하나가 두 줄이 되고, R이 1 늘어난다.** R은 거의 모든 Exner 지표의
     * 분모라 조용히 전 지표가 틀어진다.
     *
     * 400ms인 이유: 피검자가 연달아 두 반응을 말하는 것("박쥐요… 아 나비
     * 같기도 하고")은 실제로 일어나지만 그 사이는 최소 1초 이상이다. 400ms
     * 안의 두 번째 탭은 사람의 의도가 아니라고 본다.
     *
     * 삼킨 탭에는 진동·잔물결을 주지 않는다 — 신호가 없는 것이 곧
     * "기록되지 않았다"는 표시다. 반대로 신호를 주면 두 줄이 생긴 줄 모른다.
     */
    const now = Date.now()
    if (now - lastTapAt < TAP_COOLDOWN_MS) return
    lastTapAt = now

    const at = new Date()

    // 진동은 **기기를 잡은 사람만 느낀다** — 피검자 화면에는 아무 변화가 없다.
    // iOS Safari는 이 API가 없어서 조용히 지나간다(그래서 잔물결도 함께 준다).
    navigator.vibrate?.(12)

    // 누른 자리에서 퍼지게 — 검사자의 시선이 이미 거기 있다.
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
    ripple = { x: e.clientX - box.left, y: e.clientY - box.top, key: ++rippleSeq }
    if (rippleTimer) clearTimeout(rippleTimer)
    rippleTimer = setTimeout(() => (ripple = null), 450)

    void handleAdd(at)
  }

  /**
   * 카드를 제시한 시각 — 반응시간(R/T)의 시작점이다(§4-3).
   *
   * **첫 제시만 기록한다.** 되돌아와 다시 본 시각으로 덮어쓰면 R/T가 음수이거나
   * 터무니없이 짧아진다. 서버는 보낸 값을 그대로 넣으므로 여기서 거른다.
   *
   * status는 지금 값을 그대로 되보낸다 — 이 호출은 "제시했다"는 시각만 남기는
   * 것이지 실시 상태를 바꾸는 것이 아니다. 반응이 생기면 서버가 알아서
   * responded로 올린다.
   */
  async function markPresented(card: RorschachCard) {
    const instId = $institutionId
    if (!instId) return
    const no = cardToIndex(card)
    const admin = cards.find((c) => c.card_no === no)
    if (admin?.presented_at) return
    if (admin?.status === 'rejected') return

    try {
      const updated = await setCardStatus(
        instId,
        examId,
        no,
        admin?.status ?? 'pending',
        new Date().toISOString()
      )
      cards = [...cards.filter((c) => c.card_no !== no), updated]
    } catch (err) {
      // 제시 시각을 못 남겨도 실시는 계속돼야 한다 — 조용히 넘긴다.
      console.error('[markPresented] 실패', err)
    }
  }

  /**
   * 내담자 화면이 켜지는 순간이 곧 **카드를 건네는 순간**이다.
   *
   * 그래서 모드 전환과 카드 전환이 제시 시각의 출처가 된다. 예전에는 이 값을
   * 채우는 곳이 아예 없어서 컬럼만 있고 데이터가 0건이었다.
   */
  $effect(() => {
    if (!clientMode || !isInitialized) return
    void markPresented(currentCard)
  })

  /**
   * 내담자 화면을 나가면 마이크를 끈다.
   *
   * 켜둔 채 나가면 조각이 계속 버퍼로 흘러들어가는데, 그 화면에는 탭이 없어서
   * 아무도 그 조각을 반응으로 굳히지 못한다. 조용히 쌓이다가 다음에 내담자
   * 화면에서 탭할 때 **엉뚱한 반응의 초안**으로 들어간다.
   *
   * ⚠️ 나갈 때 남은 조각이 있으면 알린다. 그건 "말은 들렸는데 검사자가 반응으로
   * 선언하지 않은 것"이라 버려도 되는 경우가 많지만("다 봤어요"), 탭을
   * 빠뜨린 경우일 수도 있어서 조용히 지우면 안 된다.
   */
  $effect(() => {
    if (clientMode) return
    if (dictation.phase !== 'idle') dictation.stop()

    /*
     * 마크는 화면을 나갈 때 버린다. 임상가 화면에서 만든 반응은 탭이 아니라
     * 버튼으로 생기고 시각이 없으므로, 옛 마크를 남겨두면 다음에 내담자
     * 화면으로 돌아왔을 때 **지난 카드의 반응**이 주인으로 뽑힐 수 있다.
     */
    tapMarks = []

    if (pendingClips.length) {
      // 주인을 못 찾은 말 — 검사자가 탭을 빠뜨렸거나 반응이 아닌 말("다 봤어요")이다.
      // 어느 쪽인지 화면은 모른다. 조용히 지우지 않고 보여주고 넘긴다.
      snackbarStore.info(
        `배정되지 않은 발화가 있습니다: "${pendingClips.map((c) => c.text).join(' ')}"`
      )
      pendingClips = []
    }
  })

  $effect(() => () => {
    if (rippleTimer) clearTimeout(rippleTimer)
  })

  // --- 카드 레벨 기록 (§14-5: 카드를 고르는 줄에 있다) ---

  /**
   * 거부 기록 — **토글이다.** 잘못 눌렀거나 피검자가 뒤늦게 반응하면
   * 되돌릴 수 있어야 한다. 되돌리면 `pending`(미실시)으로 간다 — 거부와
   * 미실시는 R 판정에서 다르게 취급되므로 '실시함'으로 되돌리면 안 된다.
   */
  async function handleToggleReject() {
    const instId = $institutionId
    if (!instId) return
    const next: CardStatus = currentCardRejected ? 'pending' : 'rejected'
    try {
      const updated = await setCardStatus(instId, examId, cardNo, next)
      cards = [...cards.filter((c) => c.card_no !== cardNo), updated]
      snackbarStore.success(
        next === 'rejected'
          ? `카드 ${currentCard}를 거부로 기록했습니다.`
          : `카드 ${currentCard}의 거부 기록을 취소했습니다.`
      )
    } catch (err) {
      console.error('[setCardStatus] 실패', err)
      // 반응이 있는 카드는 서버가 막는다 — 그 사유를 그대로 보여준다.
      snackbarStore.error(
        cardResponses.length > 0
          ? '반응이 기록된 카드는 거부로 표시할 수 없습니다.'
          : '거부 기록에 실패했습니다.'
      )
    }
  }

  /**
   * 촉구 기록 — 거부 바로 옆이다. 둘은 같은 성질(지금 이 카드에 대한 기록)이고
   * **함께 읽혀야 뜻이 생긴다**: 촉구 없는 거부와 촉구 후에도 안 나온 거부는
   * 임상적으로 다른 사실이다.
   *
   * **클릭 한 번, 문장 없음.** 해석에 쓰이는 것은 "이 카드에서 촉구가 있었나"
   * 하나다. 실시 중에 타이핑을 요구하면 피검자 앞에서 손이 묶여 아무도 기록하지
   * 않게 되고, 기록되지 않는 필수 기록은 없는 것과 같다.
   *
   * **거부와 같은 토글이다.** 실시 중에는 피검자를 보며 누르므로 오조작이
   * 흔하고, 되돌릴 수 없으면 틀린 기록이 그대로 굳는다. 서버는 soft delete라
   * "기록했다가 취소했다"는 이력은 남는다.
   */
  async function handleTogglePrompt() {
    const instId = $institutionId
    if (!instId || isSavingPrompt) return

    const existing = currentCardPrompt
    isSavingPrompt = true
    try {
      if (existing) {
        await deleteIntervention(instId, examId, existing.id)
        interventions = interventions.filter((i) => i.id !== existing.id)
        snackbarStore.success(`카드 ${currentCard}의 촉구 기록을 취소했습니다.`)
      } else {
        const saved = await createIntervention(instId, examId, {
          card_no: cardNo,
          kind: 'prompt',
          phase: 'free_association',
          // 특정 반응을 두고 물었으면 그 반응에, 카드 전체에 대한 것이면 null.
          response_id: selectedId
        })
        interventions = [...interventions, saved]
        snackbarStore.success(`카드 ${currentCard}의 촉구를 기록했습니다.`)
      }
    } catch (err) {
      console.error('[intervention:prompt] 실패', err)
      snackbarStore.error(
        existing ? '촉구 기록 취소에 실패했습니다.' : '촉구 기록에 실패했습니다.'
      )
    } finally {
      isSavingPrompt = false
    }
  }

  /**
   * 채점 화면으로 — **이동은 막지 않는다.**
   *
   * 예전엔 `canComplete`가 아니면 버튼이 잠겨 있었다. 그런데 §3-1의 "벽 없음"은
   * 게이트가 **결과 하나뿐**이라고 못 박았고, §14-12도 "게이트가 벽으로만
   * 작동하면 안 된다"고 했다. 실시가 덜 끝났다고 채점을 못 보게 하면, 채점하다
   * 빠진 반응을 발견해 되돌아오는 실제 경로가 막힌다.
   *
   * 그래서 둘을 나눈다:
   *   - **완료 표시**(`completeSession`)는 조건을 다 채웠을 때만
   *   - **이동**은 언제나
   *
   * 조건 미달이면 완료 표시 없이 그냥 이동한다.
   *
   * ⚠️ **여기서 토스트를 띄우지 않는다.** 예전엔 미완 카드 이름을 경고
   * 토스트로 알렸는데, 실시와 채점을 오가는 것은 드문 일이 아니라(§3-1
   * "벽 없음"이 오히려 권하는 경로다) 오갈 때마다 같은 경고가 떴다. 매번
   * 뜨는 경고는 곧 안 읽는 경고가 되고, 정작 읽어야 할 다른 토스트까지
   * 묻힌다.
   *
   * 미완 카드 이름을 잃는 것은 아니다 — `completeHint`가 **푸터에 상시**
   * 떠 있고 버튼 `title`에도 붙는다(§14-12의 "이름을 대라"는 그것으로
   * 이미 지켜진다). 토스트는 같은 말을 한 번 더 하는 것뿐이었다.
   */
  async function handleComplete() {
    const instId = $institutionId
    if (!instId || isCompleting) return

    if (!canComplete) {
      goto(`/examinations/${examId}/review`)
      return
    }

    isCompleting = true
    try {
      await completeSession(instId, examId, null)
      snackbarStore.success(`실시가 완료되었습니다. (R ${formalResponses.length})`)
      // 세션 종료로 progress.collect_done이 바뀐다. 갱신하지 않고 이동하면
      // 다음 화면의 진입 가드가 옛 progress를 보고 되돌려 보낸다.
      await layoutCtx.refreshExam()
      goto(`/examinations/${examId}/review`)
    } catch (err) {
      console.error('[completeSession] 실패', err)
      // 서버가 미완 카드 이름을 대며 거부한다 — 그 메시지를 그대로 보여준다.
      snackbarStore.error(
        err instanceof Error ? err.message : '완료 처리에 실패했습니다.'
      )
    } finally {
      isCompleting = false
    }
  }
</script>

<!--
  onExit을 넘기지 않는다 — 셸이 "보던 목록 페이지·필터"로 되돌린다.
  모든 칸이 입력 즉시 서버에 저장되므로 나가기 전에 따로 할 일이 없다.
-->
<!--
  툴바 오른쪽 끝 — 화면에 따라 앞에 받아쓰기가 하나 더 붙는다.

  받아쓰기 토글이 내담자 화면에만 있는 이유: 임상가 화면에서는 팝오버 안에
  칸별 마이크 버튼이 있다(어느 칸에 받아쓸지가 거기서 정해진다). 내담자
  화면에는 팝오버가 없으므로 여기 나와야 한다.
-->
{#snippet toolbarActions()}
  {#if clientMode}
    <!--
      받아쓰기 — **선택사항이다.** 켜면 탭으로 만든 줄에 초안이 들어가고,
      끄면 빈 줄만 생긴다. 어느 쪽이든 줄을 만드는 동작(탭)은 똑같다.

      말하는 중임을 점으로 보여주는데 이건 피검자에게도 보인다. 자기가 말하는
      중이라는 사실은 이미 아는 것이라 오염이 아니다 — 감춰야 하는 건
      **이전 반응의 내용**이다.
    -->
    <!--
      지금 어느 바퀴인가 — **받아쓰기가 어디로 가는지**를 말한다.
      번호만 보이므로 피검자가 봐도 오염이 아니다(§14-2: 감춰야 하는 건 내용).
    -->
    {#if clientInquiryMode}
      <span
        class="flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-label-01-normal-medium text-amber-800"
        title="반응을 고른 상태입니다 — 받아쓰기는 이 반응의 질문 답변으로 들어가고, 카드를 드래그하면 이 반응의 영역이 됩니다. 칩을 다시 누르면 자유반응으로 돌아갑니다."
      >
        <Icon name="help" size="sm" />
        질문 {selectedResponse?.response_no ?? ''}
      </span>
    {/if}

    <button
      type="button"
      onclick={() => dictation.toggle()}
      title={dictation.phase === 'idle'
        ? clientInquiryMode
          ? '받아쓰기를 켠다 — 고른 반응의 질문 답변으로 들어간다'
          : '받아쓰기를 켠다 — 탭으로 만든 줄에 초안이 들어간다'
        : '받아쓰기를 끈다'}
      class="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-label-01-normal-medium transition-colors {dictation.phase !==
      'idle'
        ? 'border-primary-500 bg-primary-500 text-white hover:bg-primary-600'
        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'}"
    >
      <Icon name={dictation.phase === 'idle' ? 'mic_off' : 'mic'} size="sm" />
      받아쓰기
      {#if dictation.speaking}
        <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-white"></span>
      {/if}
    </button>
  {/if}

  {@render cardActions()}
{/snippet}

{#snippet cardActions()}
  <!--
    촉구 — 거부와 나란히 둔다. 함께 읽혀야 뜻이 생긴다: 촉구 없는 거부와
    촉구 후에도 안 나온 거부는 다른 사실이다. 거부와 **같은 모양의 토글**이다 —
    성질이 같으니 생김새도 같아야 하고, 되돌리는 방법도 같아야 한다.
  -->
  <button
    type="button"
    onclick={handleTogglePrompt}
    disabled={isSavingPrompt}
    title={currentCardPrompt
      ? '촉구 기록을 취소한다'
      : '촉구했음을 기록한다 — 촉구 전 거부와 촉구 후에도 안 나온 거부는 다른 사실이다'}
    class="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-label-01-normal-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 {currentCardPrompt
      ? 'border-amber-500 bg-amber-500 text-white hover:bg-amber-600'
      : 'border-amber-200 text-amber-600 hover:border-amber-300 hover:bg-amber-50'}"
  >
    <Icon name="campaign" size="sm" />
    {currentCardPrompt ? '촉구 취소' : '촉구'}
  </button>

  <!--
    거부 — 제시했으나 반응이 없었다는 사실이고, 미실시와 구분되어 기록돼야
    한다 — R 판정에서 그 둘은 다르게 취급된다.
  -->
  <button
    type="button"
    onclick={handleToggleReject}
    disabled={cardResponses.length > 0}
    title={currentCardRejected
      ? '거부 기록을 취소하고 미실시로 되돌린다'
      : '제시했으나 반응이 없었음 — 미실시와 구분해 기록한다'}
    class="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-label-01-normal-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 {currentCardRejected
      ? 'border-red-500 bg-red-500 text-white hover:bg-red-600'
      : 'border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50'}"
  >
    <Icon name="block" size="sm" />
    {currentCardRejected ? '거부 취소' : '거부'}
  </button>
{/snippet}

<ExamLayoutShell headerTitle="실시">
  {#snippet headerExtras()}
    <!--
      내담자 모드 — 태블릿을 돌릴 때 켠다. 자동 추론하지 않는다(§14-2).

      **버튼이 아니라 스위치다.** 이건 실행하는 행위가 아니라 화면이 계속
      머무는 **상태**이고, 스위치는 지금 켜져 있는지를 누르지 않고도 말한다.
      버튼은 "누르면 무슨 일이 일어난다"까지만 말해서, 지금 어느 쪽인지
      라벨을 읽어야 알 수 있었다.

      **라벨은 고정한다.** 스위치의 라벨은 "무엇을 켜는가"여야 한다 —
      상태에 따라 글자가 바뀌면(임상가 화면 ↔ 내담자 화면) 켠 것이 어느
      쪽인지 오히려 헷갈린다. 상태는 스위치가 말한다.

      켜졌을 때 글자색만 바꾼다 — 실패 비용이 비대칭이라서다. 모르고 켜진 채
      두면 피검자가 이전 반응을 본다.
    -->
    <div class="inline-flex shrink-0 items-center gap-2">
      <span
        class="text-label-01-normal-medium {clientMode ? 'text-primary-500' : 'text-gray-600'}"
      >
        내담자 화면
      </span>
      <Switch
        bind:checked={clientMode}
        ariaLabel="내담자 화면 — 켜면 카드만 남고 기록이 전부 가려진다"
      />
    </div>
  {/snippet}

<!--
  카드 레벨 기록 — 촉구·거부. **두 화면이 같은 것을 쓴다.**

  내담자 화면에도 남기는 이유: 이 둘은 태블릿이 피검자 쪽을 향한 **바로 그
  순간에 일어나는 사건**이다. "잘 모르겠어요"에 검사자가 촉구하는데, 기록하려고
  화면을 도로 돌려야 하면 그 사이에 잊는다. 기록되지 않는 필수 기록은 없는 것과
  같다.

  반대로 **반응 목록(칩)은 내담자 화면에서 빠진다.** ①②③이 보이면 피검자가
  자기가 몇 개 말했는지 알게 되고, 그때부터 페이스를 계산한다(§14-2). R은 거의
  모든 Exner 지표의 분모라 이건 UI 취향이 아니라 데이터가 흔들리는 문제다.
  칩 색이 말하는 완성도도 피검자에겐 "내 대답이 부족하다"로 읽힌다.

  즉 선은 문서가 이미 그은 자리와 같다 — **반응 내용·개수는 오염, 카드 레벨
  기록은 오염이 아니다.**
-->

  <!--
    카드 탭 줄 — 내담자 화면에서는 **접힌다.**

    툭 사라지지 않고 미끄러지는 이유: 이 줄에는 카드별 반응 수가 있어서 모드가
    바뀔 때 화면에서 가장 크게 변하는 자리다. 순간이동하면 "화면이 통째로
    바뀌었다"로 읽히고, 검사자가 무엇이 없어졌는지 한 번 확인하게 된다.

    이 줄만 접는다 — 아래 툴바 줄은 내용만 바뀌고 자리는 그대로다.
  -->
  {#if !clientMode}
    <div transition:slide={{ duration: TABS_SLIDE_MS }}>
      <CardTabs
        activeCard={currentCard}
        regionCounts={responseCounts}
        countLabel="반응"
        allCodedByCard={doneByCard}
        {statusByCard}
        onCardChange={handleCardChange}
      />
    </div>
  {/if}

  <!--
    반응 선택 — 채점 화면과 **같은 툴바**를 쓴다. 카드 탭이 "어느 카드"를,
    이 줄이 "어느 반응"을 고른다. 두 선택이 같은 층에 나란히 있다(§14-5).

    **내담자 화면에서도 같은 줄을 쓴다.** 칩(번호·완성도)은 그대로 두고 내용만
    감춘다(`hideContent`) — 피검자가 자기 반응이 몇 개인지 아는 것은 실물
    검사에서 검사자가 채점지에 줄을 늘리는 걸 보는 것과 다르지 않다. 감춰야
    하는 것은 **무엇을 말했는지**이고, 그 유출 경로는 칩의 툴팁 하나였다.

    대신 '추가' 버튼은 빠진다. 내담자 화면에서 줄을 만드는 길은 카드 탭 하나뿐
    이어야 한다 — 버튼으로 만들면 어느 발화가 그 줄의 것인지 정할 수 없다.
    (탭 시각은 전사 조각의 주인을 찾는 유일한 기준이다.)
  -->
  <ResponseToolbar
    responses={cardResponses}
    {selectedId}
    {isDone}
    hideContent={clientMode}
    onSelect={selectResponse}
    onAdd={clientMode ? undefined : () => handleAdd()}
    addDisabled={isSaving || currentCardRejected}
    trailing={toolbarActions}
  />

  <!--
    카드가 화면 거의 전부다. 팝오버가 그 위에 얹힌다.

    내담자 화면에서 **칩을 고른 것 자체가 그리기 모드다**(`clientInquiryMode`).
    질문 바퀴에서 하는 일이 곧 "어디서 그렇게 보았나"를 카드 위에 표시하는
    것이므로, 별도 버튼을 한 번 더 누르게 할 이유가 없다.

    임상가 화면은 팝오버의 '영역 그리기' 버튼을 그대로 쓴다 — 그쪽에서 칩
    선택은 "지금 편집 중인 줄"이라는 다른 뜻을 이미 갖고 있어서, 고르는 것만으로
    그리기가 켜지면 텍스트를 고치려고 고른 순간 카드가 캔버스로 바뀐다.
  -->
  <div class="relative flex min-h-0 flex-1 overflow-hidden">
    <CardCanvas
      cardNumber={currentCard}
      regions={visibleRegions}
      {selectedId}
      isDrawingMode={clientInquiryMode || isDrawingMode}
      nextRegionColor={responseColor(selectedResponse?.response_no)}
      areaCode={selectedResponse?.area_code ?? null}
      labelOf={(g) => regionLabel(g.response_id)}
      colorOf={(g) => regionColor(g.response_id)}
      onDrawEnd={handleDrawEnd}
      onSelect={selectResponse}
      onDeleteRegion={handleDeleteRegion}
      onUpdateAreaCode={(code) => saveField('area_code', code)}
      onBoxReady={(el: HTMLDivElement | null) => (cardBox = el)}
    />

    {#if clientMode && !clientInquiryMode}
      <!--
        반응 기록 탭 판 — 카드 전체가 하나의 버튼이다.

        **자유반응 바퀴에서만 깔린다.** 칩을 고르면(질문 바퀴) 사라져야 한다 —
        남아 있으면 영역을 그리려는 드래그가 새 반응을 만들고, R은 거의 모든
        Exner 지표의 분모다.

        검사자가 화면을 잘 못 보는 자세(태블릿을 피검자 쪽으로 돌린 상태)에서
        누르므로, 조준이 필요한 작은 버튼이면 안 된다. 카드 어디를 눌러도 된다.

        우상단 카드 넘기기 바는 이 위에 얹혀 있고 `pointer-events-auto`라 탭이
        새어들지 않는다 — 카드를 넘기려다 반응 줄이 생기면 R이 틀어진다.
        (반대 방향도 막아야 해서 넘기기 바를 화면 아래에서 위로 옮겼다. 손이
        자연히 가는 아래쪽에 두면 반응을 기록하려다 카드를 넘기게 된다.)
      -->
      <button
        type="button"
        onclick={handleClientTap}
        disabled={isSaving || currentCardRejected}
        aria-label="반응 기록 — 피검자가 반응할 때마다 누른다"
        class="absolute inset-0 z-10 cursor-default disabled:cursor-not-allowed"
      ></button>

      <!--
        기록됐다는 순간 신호 — 누른 자리에서 퍼지는 잔물결.

        숫자나 목록을 띄우지 않는 이유는 §14-2다: 반응 수가 화면에 남으면
        피검자가 자기 페이스를 계산한다. 검사자에게 필요한 것은 "방금 하나
        들어갔다"뿐이고 그건 순간이면 충분하다. 진동이 되는 기기에서는
        그쪽이 주 신호이고 이건 보조다.
      -->
      {#if ripple}
        {#key ripple.key}
          <span
            class="ripple pointer-events-none absolute z-30"
            style="left: {ripple.x}px; top: {ripple.y}px;"
          ></span>
        {/key}
      {/if}

      <!--
        내담자 모드 — **카드 넘기기만** 남는다 (§14-2).
        실물 검사에서도 검사자가 카드를 집어 건네는 동작은 다 보이므로 오염
        요인이 아니다.

        ## 자리: 우상단 (2026-08-25 변경)

        아래 가운데에 있었는데, 카드 탭 판(카드 전체가 버튼이다) 위에 얹혀
        있어서 **반응을 기록하려다 잘못 누르기 쉬운 자리**였다. 손이 자연히
        가는 곳이 화면 아래쪽인데 거기가 넘기기 바였다. 위로 올리면 탭 영역과
        멀어진다.

        ## 카드 번호를 보여준다 (2026-08-25 결정 변경)

        예전 주석은 "**번호와 개수는 금지** — 실물 카드 뭉치에 없는 정보"라고
        못 박았다. 그 금지는 유지하되 **범위를 개수로 좁힌다.**

        - **개수는 여전히 금지**다. 반응이 몇 개인지, 카드가 몇 장 남았는지가
          보이면 피검자가 자기 페이스를 계산한다("아직 7장 남았네").
        - **현재 카드 번호는 보여준다.** 실물 로르샤하 도판은 뒷면에 로마숫자가
          있어 건네받는 피검자가 볼 수 있는 정보이고, "지금 몇 번째"만으로는
          남은 장수를 알 수 없다(총 10장임을 아는 피검자가 아니라면).

        ⚠️ 그래서 **`I / 10` 같은 표기를 쓰면 안 된다.** 분모가 붙는 순간
        금지하려던 바로 그 정보가 된다.
      -->
      <div
        class="pointer-events-none absolute inset-x-2 top-2 z-20 flex justify-end p-4"
      >
        <div
          class="pointer-events-auto flex items-center gap-1 rounded-full border border-gray-200 bg-white/95 px-1.5 py-1 shadow-lg backdrop-blur-sm"
        >
          <button
            type="button"
            onclick={() => cardIndex > 0 && handleCardChange(RORSCHACH_CARDS[cardIndex - 1])}
            disabled={cardIndex === 0}
            class="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-30"
            aria-label="이전 카드"
          >
            <Icon name="chevron_left" size="md" />
          </button>
          <!--
            로마숫자만. 분모(총 장수)는 붙이지 않는다 — 위 주석 참조.
            `tabular-nums`는 카드가 바뀔 때 폭이 흔들리지 않게 한다(I↔VIII).
            폭을 고정해 좌우 버튼이 밀리지 않는다.
          -->
          <span
            class="min-w-9 text-center text-label-01-normal-bold text-gray-700 tabular-nums select-none"
            aria-live="polite"
            aria-label="현재 카드 {currentCard}"
          >
            {currentCard}
          </span>
          <button
            type="button"
            onclick={() =>
              cardIndex < RORSCHACH_CARDS.length - 1 &&
              handleCardChange(RORSCHACH_CARDS[cardIndex + 1])}
            disabled={cardIndex === RORSCHACH_CARDS.length - 1}
            class="flex h-8 w-8 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-30"
            aria-label="다음 카드"
          >
            <Icon name="chevron_right" size="md" />
          </button>
        </div>
      </div>
    {/if}

  </div>

  <!--
    반응 한 줄의 모든 칸 — 카드 위에 뜨고, 드래그로 옮길 수 있다(§14-5).
    그리기 중에는 카드를 가리지 않도록 반투명해진다.
  -->
  {#if selectedResponse && cardBox && !clientMode}
    <ResponsePopover
      mode="administer"
      response={selectedResponse}
      region={selectedRegion}
      canvasBox={cardBox}
      dimmed={isDrawingMode}
      phase={dictation.phase}
      aiCoding={null}
      finalCoding={null}
      aiConfidence={null}
      aiReasoning={null}
      isScoring={false}
      readonly={false}
      onSaveText={(v) => saveField('free_association_text', v)}
      onSaveInquiry={(v) => saveField('inquiry_text', v)}
      onChangeLocation={(code) => saveField('area_code', code)}
      onChangeOrientation={handleChangeOrientation}
      onStartDrawing={() => (isDrawingMode = true)}
      onDelete={handleDeleteResponse}
      onToggleMic={() => dictation.toggle()}
      onAiScore={() => {}}
      onSaveCoding={() => {}}
      onClose={() => selectResponse(null)}
    />
  {/if}

  {#snippet footer()}
    <!-- 푸터에는 **단계 전환 하나만** 있다 (§14-5) -->
    <div
      class="flex h-16 shrink-0 items-center justify-between border-t border-gray-200 bg-white px-6"
    >
      <div class="text-sm text-gray-600">
        R <span class="font-semibold text-gray-900">{formalResponses.length}</span>
        <span class="ml-3 text-xs text-gray-400">
          · 완료 {doneCount}/{formalResponses.length}
          {#if completeHint}
            · {completeHint}
          {/if}
        </span>
      </div>

      <button
        type="button"
        onclick={handleComplete}
        disabled={isCompleting}
        title={completeHint || '실시를 완료로 표시하고 채점으로 이동합니다'}
        class="flex items-center gap-1.5 rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-primary-600"
      >
        {isCompleting ? '완료 중…' : '채점으로'}
        <ArrowRight size={20} />
      </button>
    </div>
  {/snippet}
</ExamLayoutShell>

<style>
  /*
   * 탭 잔물결 — 누른 자리에서 한 번 퍼지고 사라진다.
   *
   * **브랜드 primary(#2979FF)를 아주 옅게 쓴다.**
   *
   * ⚠️ 흰색 단색은 흰 여백에서 사라진다 — 한 색으로는 검은 반점과 흰 배경을
   * 동시에 만족시킬 수 없다. primary는 둘 다에서 보인다.
   *
   * 색 자극을 건드리는 건 사실이라(색채결정인 FC/CF/C가 채점 축) 불투명도를
   * 낮게 잡고 420ms 안에 완전히 사라지게 한다. 링 두께도 1px이다.
   *
   * 크기를 고정(2rem)하지 않고 스케일로 키우는 이유는 레이아웃을 건드리지 않기
   * 위해서다 — width를 애니메이션하면 매 프레임 리플로우가 돈다.
   */
  .ripple {
    width: 2rem;
    height: 2rem;
    margin-left: -1rem;
    margin-top: -1rem;
    border-radius: 9999px;
    background: radial-gradient(
      circle,
      color-mix(in srgb, var(--color-primary) 10%, transparent) 0%,
      transparent 70%
    );
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-primary) 30%, transparent);
    animation: tap-ripple 420ms ease-out forwards;
  }

  @keyframes tap-ripple {
    from {
      transform: scale(0.35);
      opacity: 0.75;
    }
    to {
      transform: scale(4.5);
      opacity: 0;
    }
  }

  /* 움직임을 줄이도록 설정한 사용자에게는 퍼지지 않고 밝기만 스친다. */
  @media (prefers-reduced-motion: reduce) {
    .ripple {
      animation: tap-fade 300ms ease-out forwards;
    }
    @keyframes tap-fade {
      from {
        opacity: 0.9;
      }
      to {
        opacity: 0;
      }
    }
  }
</style>
