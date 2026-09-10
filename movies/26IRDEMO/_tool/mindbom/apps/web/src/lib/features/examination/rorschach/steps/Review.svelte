<script lang="ts">
  import { page } from '$app/state'
  import { goto } from '$app/navigation'
  import { institutionId } from '$lib/stores/institution.store'
  import { snackbarStore } from '$lib/stores/snackbar'
  import { modalUtils } from '$lib/stores/modal'

  import { isConfirmed } from '$lib/features/examination/core/status'
  import {
    RORSCHACH_CARDS,
    canAiScore,
    cardToIndex,
    circled,
    indexToCard,
    responseColor,
    type CardOrientation
  } from '$lib/features/examination/rorschach/constants'
  import type {
    RorschachCard,
    RorschachCoding
  } from '$lib/features/examination/rorschach/types'
  import {
    getSessionDetail,
    scoreResponse,
    scoreSession,
    updateResponse,
    updateResponseCoding,
    confirmSession,
    type ServerCoding,
    type ServerRegion,
    type ServerResponseDetail,
  } from '$lib/features/examination/rorschach/actions'
  import { getExamContext } from '$lib/features/examination/core/exam-context.svelte'

  import ExamLayoutShell from '$lib/features/examination/core/ExamLayoutShell.svelte'
  import CardTabs from '$lib/features/examination/rorschach/components/sync/CardTabs.svelte'
  import CardCanvas from '$lib/features/examination/rorschach/components/sync/CardCanvas.svelte'
  import ResponseToolbar from '$lib/features/examination/rorschach/components/sync/ResponseToolbar.svelte'
  import ResponsePopover from '$lib/features/examination/rorschach/components/sync/ResponsePopover.svelte'
  import CodingFooter from '$lib/features/examination/rorschach/components/coding/CodingFooter.svelte'
  import CodingSequenceTable from '$lib/features/examination/rorschach/components/coding/CodingSequenceTable.svelte'
  import type { ExamStatus } from '$lib/features/examination/common/constants'
  import { EXAM_STATUS_VISUAL } from '$lib/features/examination/common/exam-visual'

  // --- Layout context ---
  const layoutCtx = getExamContext()
  let exam = $derived(layoutCtx.exam)

  // --- State ---
  let examId = $derived(page.params.examId ?? '')
  let isInitialized = $state(false)
  let isConfirming = $state(false)
  /** 채점 진행 중인 **반응** id — 채점 단위는 반응이다(§14-4) */
  let scoringIds = $state<Set<string>>(new Set())

  let currentCard = $state<RorschachCard>('I')

  /**
   * **이 화면의 축은 반응이다** (§14-4).
   *
   * 예전에는 조각을 순회하고 `조각→반응` 역인덱스를 들고 다녔다. 그래서
   * **조각이 0개인 반응이 화면에서 아예 보이지 않았고, 확정 게이트 검사도
   * 받지 않았다.** 서버(`completion.uncoded_responses`)는 반응을 순회하는데
   * 프론트만 조각을 순회해 기준이 달랐다.
   *
   * 위치는 반응당 하나이므로(§14-7) 조각은 반응에서 파생된다.
   */
  let responses = $state<ServerResponseDetail[]>([])
  let regions = $state<ServerRegion[]>([])
  /** 지금 채점 중인 반응 */
  let selectedId = $state<string | null>(null)

  function replaceResponse(updated: ServerResponseDetail) {
    responses = responses.map((r) => (r.id === updated.id ? updated : r))
  }


  /** 선택 "행위" 카운터 — 같은 반응을 다시 눌러도 녹취록이 스크롤되도록 */
  let selectionNonce = $state(0)
  function selectResponse(id: string | null) {
    selectedId = id
    selectionNonce++
  }

  /** 카드 박스 ref — 팝오버가 viewport 좌표를 계산할 때 쓴다 */
  let canvasBox = $state<HTMLDivElement | null>(null)

  // 카드 줌 (1=100%). 25% 단위로 50%~300% 범위.
  let zoom = $state(1)
  const ZOOM_MIN = 0.5
  const ZOOM_MAX = 3
  const ZOOM_STEP = 0.25
  function zoomIn() {
    zoom = Math.min(ZOOM_MAX, +(zoom + ZOOM_STEP).toFixed(2))
  }
  function zoomOut() {
    zoom = Math.max(ZOOM_MIN, +(zoom - ZOOM_STEP).toFixed(2))
  }
  function zoomReset() {
    zoom = 1
  }

  // 카드 바뀌면 줌 초기화 (사용자 컨텍스트가 카드별로 달라지므로)
  $effect(() => {
    currentCard
    zoom = 1
  })

  /**
   * 화면에 그릴 조각 — 서버 DTO를 그대로 쓴다.
   *
   * 예전에는 `serverToLocal`로 로컬 `Region`(숫자 id·색·라벨)으로 변환했는데,
   * 그 로컬 형태는 "한 카드에 조각 여러 개"를 구분하려던 장치였다. 위치가
   * 반응당 하나이므로 변환할 것이 없다. (같은 함수가 Inquiry에도 복제돼 있었다)
   */
  function regionOf(responseId: string | null): ServerRegion | null {
    if (!responseId) return null
    return regions.find((g) => g.response_id === responseId) ?? null
  }

  /** 조각 위 라벨 = 반응 번호. 조각 자신의 label은 옛 "카드 내 순번"이다. */
  function labelOf(g: ServerRegion): string {
    const r = responses.find((x) => x.id === g.response_id)
    return String(r?.response_no ?? '?')
  }

  /**
   * 조각 색 = 소유 반응 색. 실시 화면과 **같은 규칙**을 쓴다.
   *
   * 번호에서 파생시킨다. 예전엔 조각에 `color` 컬럼이 있었는데 그릴 당시
   * 규칙이 박제된 값이라(기존 조각은 전부 파랑) 그걸 읽으면 실시 화면과
   * 다른 색이 나왔다. 같은 조각이 화면마다 다른 색이면 색으로 잇는다는
   * 전제가 깨진다. 컬럼은 2026-08-26에 없앴다(`label`과 함께).
   */
  function colorOf(g: ServerRegion): string {
    const r = responses.find((x) => x.id === g.response_id)
    return responseColor(r?.response_no)
  }

  /** 조각의 시간 구간 — 녹취록 매칭이 쓰는 것은 이것뿐이다 */
  function timeSpanOf(g: ServerRegion | null) {
    if (!g) return null
    return {
      audioStartSec: g.audio_timestamp_start_sec,
      audioEndSec: g.audio_timestamp_end_sec
    }
  }

  function localCodingFromServer(
    c: ServerCoding | null
  ): RorschachCoding | null {
    if (!c) return null
    return {
      location: c.location,
      dq: c.dq,
      determinants: c.determinants,
      fq: c.fq,
      pair: c.pair,
      contents: c.contents,
      popular: c.popular,
      zScore: c.z_score,
      specialScores: c.special_scores
    }
  }

  function localToServerCoding(c: RorschachCoding): ServerCoding {
    return {
      location: c.location,
      dq: c.dq,
      determinants: c.determinants,
      fq: c.fq,
      pair: c.pair,
      contents: c.contents,
      popular: c.popular,
      z_score: c.zScore,
      special_scores: c.specialScores
    }
  }

  // --- Init ---
  $effect(() => {
    const instId = $institutionId
    if (!instId || !examId || isInitialized) return
    void initializeSession(instId, examId)
  })

  async function initializeSession(instId: string, eId: string) {
    try {
      const detail = await getSessionDetail(instId, eId)
      responses = detail.responses
      regions = detail.regions

      isInitialized = true
    } catch (err) {
      console.error('[Coding init] 실패', err)
      snackbarStore.error('채점 화면을 불러오지 못했습니다.')
      return
    }

  }

  // exam refresh 는 layout context 가 담당
  const refreshExam = layoutCtx.refreshExam

  // --- Derived ---

  /** 정식 반응만 — 한계검증은 채점 대상이 아니다(§14-9) */
  let formalResponses = $derived(responses.filter((r) => r.is_formal))

  let cardResponses = $derived(
    responses
      .filter((r) => r.card_no === cardToIndex(currentCard))
      .sort((a, b) => (a.response_no ?? 0) - (b.response_no ?? 0))
  )

  let responseCounts = $derived.by(() => {
    const counts = {} as Record<RorschachCard, number>
    for (const card of RORSCHACH_CARDS) counts[card] = 0
    for (const r of responses) {
      const c = indexToCard(r.card_no)
      counts[c] = (counts[c] ?? 0) + 1
    }
    return counts
  })

  /**
   * 반응 하나가 채점 완료인가 — **임상가가 저장했는가** (§14-4).
   *
   * `final_coding`은 사람이 저장 버튼을 눌러야만 채워진다. 예전에는 "반응이
   * 존재하는가"로 봤는데 AI 채점만 해도 반응은 존재하므로, 임상가가 한 번도
   * 안 본 AI 초안이 확정을 통과했다. 서버 `completion.response_coded`와
   * **같은 규칙**이다 — 두 곳이 다르면 버튼은 켜지는데 저장이 거부된다.
   */
  function isCoded(r: ServerResponseDetail): boolean {
    if (!r.is_formal) return true
    // 낡은 채점은 완료가 아니다 — 서버 `response_coded`와 **같은 규칙**이다.
    // 값은 남아 있지만 근거가 바뀌었으므로 임상가가 다시 저장해야 한다.
    return r.final_coding !== null && !r.coding_stale
  }

  /** 카드별 채점 완료 — 그 카드의 모든 정식 반응이 확정 코딩을 가졌는가 */
  let allCodedByCard = $derived.by(() => {
    const map = {} as Record<RorschachCard, boolean>
    for (const card of RORSCHACH_CARDS) {
      const rs = formalResponses.filter((r) => r.card_no === cardToIndex(card))
      map[card] = rs.length > 0 && rs.every(isCoded)
    }
    return map
  })

  /** 카드별 "AI 채점 진행 중" — 카드 탭 우상단 깜박이는 점 */
  let aiScoringByCard = $derived.by(() => {
    const map = {} as Record<RorschachCard, boolean>
    for (const card of RORSCHACH_CARDS) {
      map[card] = responses.some(
        (r) => r.card_no === cardToIndex(card) && scoringIds.has(r.id)
      )
    }
    return map
  })

  let selectedResponse = $derived(
    responses.find((r) => r.id === selectedId) ?? null
  )
  /** 선택된 반응의 조각 — 위치는 반응당 하나다(§14-7) */
  let selectedRegion = $derived(regionOf(selectedId))
  /** 이 카드의 조각들 — 반응에서 파생된다 */
  let currentRegions = $derived(
    regions.filter((g) =>
      cardResponses.some((r) => r.id === g.response_id)
    )
  )

  let selectedAiCoding = $derived(
    localCodingFromServer(selectedResponse?.ai_coding ?? null)
  )
  let selectedFinalCoding = $derived(
    localCodingFromServer(selectedResponse?.final_coding ?? null)
  )

  let isReadOnly = $derived(!!exam && isConfirmed(exam.status))

  /**
   * 확정 가능 — **모든 정식 반응**이 임상가 확인을 마쳤는가.
   *
   * 조각이 아니라 반응을 순회한다. 조각을 순회하면 조각 0개인 반응이
   * 검사를 아예 안 받고 통과했다(실데이터 7건).
   */
  let canConfirm = $derived.by(() => {
    if (!exam) return false
    if (exam.status !== 'ai_draft_ready' && exam.status !== 'under_review')
      return false
    if (formalResponses.length === 0) return false
    return formalResponses.every(isCoded)
  })

  /** 확정을 막는 반응들 — 이름을 대야 임상가가 찾을 수 있다(§14-12) */
  let uncoded = $derived(formalResponses.filter((r) => !isCoded(r)))
  let uncodedHint = $derived(
    uncoded.length === 0
      ? ''
      : `임상가 확인이 남은 반응: ${uncoded
          .slice(0, 3)
          .map((r) => `카드 ${indexToCard(r.card_no)} ${circled(r.response_no)}`)
          .join(', ')}${uncoded.length > 3 ? ` 외 ${uncoded.length - 3}건` : ''}`
  )


  let codedCount = $derived(formalResponses.filter(isCoded).length)

  let isScoring = $derived(!!selectedId && scoringIds.has(selectedId))

  /** 현재 반응의 선택 set — 미선택이면 빈 set */
  /**
   * 팝오버의 응답 텍스트 초기값.
   *
   * 예전에는 녹취록 발화를 토글해 합본을 만들었다. **그 경로가 사라졌다** —
   * 세션 녹음을 올리는 UI가 없어져 오디오·녹취록이 새로 생기지 않고, 반응
   * 텍스트는 실시 화면에서 반응별로 직접 받아쓴다(§14-14). 시간 매칭이라는
   * 개념 자체가 필요 없어졌다 — 반응이 시간을 갖는 게 아니라 텍스트를 갖는다.
   */
  let initialResponseText = $derived(
    selectedResponse?.free_association_text?.trim() ?? ''
  )

  // 기록(텍스트·질문·영역)은 **실시 단계에서만** 고친다.
  // 채점하며 원자료를 고치면 무엇을 근거로 채점했는지가 흐려진다.

  // --- Handlers ---
  function handleCardChange(card: RorschachCard) {
    currentCard = card
    selectResponse(null)
  }

  /**
   * 계열 기록지에서 반응을 고르면 **그 카드로 옮기고** 채점을 연다.
   *
   * 표는 프로토콜 전체를 담으므로 다른 카드의 반응이 눌릴 수 있다. 카드를
   * 안 옮기면 팝오버가 열려 있는 반응과 무대에 있는 카드가 달라진다 —
   * 임상가는 팝오버의 값이 눈앞의 반점 것인 줄 안다.
   *
   * `handleCardChange`를 못 쓴다: 그쪽은 선택을 비우는 게 일이라
   * 여기서 부르면 방금 고른 반응이 곧바로 풀린다.
   */
  function handleRowSelect(id: string) {
    const target = responses.find((r) => r.id === id)
    if (!target) return
    const card = indexToCard(target.card_no)
    if (card !== currentCard) currentCard = card
    selectResponse(id)
  }

  async function handleAiScore(transcriptText: string) {
    const target = selectedResponse
    const instId = $institutionId
    if (!target || !instId || scoringIds.has(target.id)) return

    scoringIds = new Set(scoringIds).add(target.id)
    try {
      const updated = await scoreResponse(instId, examId, target.id, transcriptText)
      replaceResponse(updated)
      // 채점 후 백엔드 상태가 ai_draft_ready 등으로 전이됐을 수 있어 항상 동기화
      if (!exam || !isConfirmed(exam.status)) {
        await refreshExam()
      }
      snackbarStore.success('AI 채점이 완료되었습니다.')
    } catch (err: any) {
      // 서버가 **왜** 못 했는지 말한다(AI 서버 연결 실패 / 미설정 / 입력 부족).
      // 한 줄로 뭉개면 임상가는 자기가 고칠 수 있는 것과 아닌 것을 못 가른다.
      // 여기서 실패하면 초안은 만들어지지 않는다 — 예전에는 목업이 대신 앉았다.
      console.error('[scoreResponse] 실패', err)
      snackbarStore.error(
        err?.response?.data?.detail || 'AI 채점에 실패했습니다.'
      )
    } finally {
      const after = new Set(scoringIds)
      after.delete(target.id)
      scoringIds = after
    }
  }

  /**
   * 일괄 AI 채점 — 서버의 세션 채점(`ScoreSessionService`)을 부른다.
   *
   * 프론트에서 반응마다 `scoreResponse`를 돌리지 않는다. 그러면 같은 일을
   * 하는 코드가 두 벌이 되고(서버는 조각·표시번호를 한 번에 묶어 N+1을
   * 피한다), 무엇보다 **표시 번호를 세는 기준이 갈린다** — 서버는 한계검증을
   * 포함한 세션 전체로 세고 프론트가 가진 목록은 정식 반응만이라, 프론트가
   * 번호를 붙여 보내면 AI 근거가 엉뚱한 반응을 가리키게 된다.
   */
  let isBatchScoring = $state(false)

  /**
   * 채점 입력이 다 찬 반응 — 팝오버의 단일 채점과 **같은 판정**(`canAiScore`)이다.
   *
   * 서버는 자격 미달 반응을 건너뛰므로(§ScoreSessionService), 여기 0건이면
   * 눌러봐야 아무 일도 일어나지 않는다. 그럴 땐 버튼을 잠근다.
   */
  let scorableCount = $derived(formalResponses.filter(canAiScore).length)

  async function handleScoreAll() {
    const instId = $institutionId
    if (!instId || isBatchScoring || isReadOnly) return
    if (scorableCount === 0) {
      snackbarStore.error(
        '채점할 수 있는 반응이 없습니다. 반응 내용·질문 답변·위치가 있어야 합니다.'
      )
      return
    }

    /**
     * 덮어쓰기를 먼저 알린다 — 서버는 **정식 반응 전체**를 다시 채점한다.
     * 확정값(`final_coding`)은 안전하지만 검토 중이던 AI 제안은 바뀐다.
     */
    const already = formalResponses.filter(
      (r) => canAiScore(r) && r.ai_coding
    ).length
    const warn =
      already > 0
        ? `이미 AI 초안이 있는 ${already}건도 다시 채점되어 제안이 바뀔 수 있습니다. `
        : ''
    // 입력이 덜 찬 반응은 서버가 건너뛴다 — 건수를 미리 알려 "왜 안 됐지"를 없앤다
    const skipped = formalResponses.length - scorableCount
    const skipNote =
      skipped > 0
        ? ` 반응 내용·질문 답변·위치가 덜 채워진 ${skipped}건은 제외됩니다.`
        : ''
    const minutes = Math.max(1, Math.ceil((scorableCount * 25) / 60))
    const ok = await modalUtils.confirm(
      `${warn}반응 ${scorableCount}건을 AI로 채점합니다. 약 ${minutes}분 걸리며, 그동안 이 화면을 벗어나면 결과를 받지 못합니다.${skipNote}`,
      'AI 일괄채점',
      { confirmText: '시작', cancelText: '취소' }
    )
    if (!ok) return

    isBatchScoring = true
    try {
      // 반응 하나당 ~25초. 넉넉히 잡지 않으면 서버는 끝냈는데 화면만 실패한다.
      const timeoutMs = Math.max(180_000, scorableCount * 40_000)
      const detail = await scoreSession(instId, examId, timeoutMs)
      responses = detail.responses
      regions = detail.regions
      if (!exam || !isConfirmed(exam.status)) {
        await refreshExam()
      }
      /**
       * **'완료'라고만 말하지 않는다.** 서버는 AI 호출이 실패한 반응을 초안
       * 없이 남기고 계속 간다(하나 때문에 21건을 잃지 않으려고). 예전에는
       * 그 자리에 목업 부호가 대신 앉아서 실패가 아예 안 보였다.
       * 초안이 안 생긴 건수를 세어 그대로 말한다 — 원인이 무엇이든 참이다.
       */
      const unscored = detail.responses.filter(
        (r) => canAiScore(r) && !r.ai_coding
      ).length
      if (unscored > 0) {
        snackbarStore.error(
          `${unscored}건은 채점되지 않았습니다. 표에 '미채점'으로 남아 있으니 다시 시도해 주세요.`
        )
      } else {
        snackbarStore.success('AI 일괄채점이 완료되었습니다.')
      }
    } catch (err: any) {
      console.error('[scoreSession] 실패', err)
      snackbarStore.error(
        err?.response?.data?.detail || '일괄채점에 실패했습니다.'
      )
    } finally {
      isBatchScoring = false
    }
  }

  /**
   * 표에서 AI 초안을 확정값으로 채택 — **`ai_coding`을 그대로 저장한다.**
   *
   * 팝오버의 '전체 반영'과 다른 점: 저쪽은 편집 중인 값에 얹기만 하고 저장은
   * 사람이 누른다. 여기는 표 한 줄을 통째로 확정하는 자리라 저장까지 간다.
   * 되돌릴 길은 남아 있다 — 확정 전이면 팝오버에서 고칠 수 있고, 무엇을
   * 채택했는지는 `ai_coding`이 그대로 남아 대조된다.
   *
   * ⚠️ `location`을 손대지 않는다. 서버가 반응(`area_code`)에서 파생시키므로
   * (피드백 v2 b) 여기서 채워 보내면 두 곳이 갈릴 자리를 다시 만드는 셈이다.
   */
  let adoptingId = $state<string | null>(null)

  async function handleAdoptAi(id: string) {
    const instId = $institutionId
    const target = responses.find((r) => r.id === id)
    if (!instId || !target?.ai_coding || adoptingId) return

    adoptingId = id
    try {
      const updated = await updateResponseCoding(
        instId,
        examId,
        id,
        target.ai_coding
      )
      replaceResponse(updated)
      if (!exam || !isConfirmed(exam.status)) {
        await refreshExam()
      }
    } catch (err) {
      console.error('[updateResponseCoding adopt] 실패', err)
      snackbarStore.error('제안값 확정에 실패했습니다.')
    } finally {
      adoptingId = null
    }
  }

  async function handleSaveCoding(coding: RorschachCoding, transcriptText: string) {
    if (!selectedResponse) return
    const instId = $institutionId
    if (!instId) return
    try {
      const updated = await updateResponseCoding(
        instId,
        examId,
        selectedResponse.id,
        localToServerCoding(coding),
        transcriptText,
      )
      replaceResponse(updated)
      // 코딩 저장 후 백엔드 상태가 under_review 등으로 전이됐을 수 있어 동기화
      if (!exam || !isConfirmed(exam.status)) {
        await refreshExam()
      }
      snackbarStore.success('코딩이 저장되었습니다.')
    } catch (err) {
      console.error('[updateResponseCoding] 실패', err)
      snackbarStore.error('저장에 실패했습니다.')
    }
  }

  /** 결과 보기로 이동. 미확정이면 confirm 후 이동, 이미 확정된 상태면 바로 이동. */
  async function handleNextStep() {
    if (isReadOnly) {
      goto(`/examinations/${examId}/results`)
      return
    }
    if (!canConfirm || isConfirming) return
    const ok = await modalUtils.confirm(
      '모든 채점을 확정하시겠습니까? 확정 후에는 수정할 수 없습니다.',
      '채점 확정',
      { confirmText: '확정', cancelText: '취소' }
    )
    if (!ok) return
    const instId = $institutionId
    if (!instId) return
    isConfirming = true
    try {
      const detail = await confirmSession(instId, examId)
      responses = detail.responses
      await refreshExam()
      snackbarStore.success('채점이 확정되었습니다.')
      goto(`/examinations/${examId}/results`)
    } catch (err) {
      console.error('[confirmSession] 실패', err)
      snackbarStore.error('확정에 실패했습니다.')
    } finally {
      isConfirming = false
    }
  }

  /** 위치 부호 저장 — 반응에 붙는다(§14-7). 서버가 형식을 검증한다. */
  async function handleChangeLocation(code: string | null) {
    const target = selectedResponse
    const instId = $institutionId
    if (!target || !instId) return
    const prev = target.area_code
    replaceResponse({ ...target, area_code: code })
    try {
      const updated = await updateResponse(instId, examId, target.id, {
        area_code: code
      })
      replaceResponse(updated)
    } catch (err) {
      console.error('[updateResponse area_code] 실패', err)
      snackbarStore.error('위치 부호 저장에 실패했습니다.')
      replaceResponse({ ...target, area_code: prev })
    }
  }

  /**
   * 원자료(자유반응·질문 답변) 교정 — **채점 화면에서도 고칠 수 있다.**
   *
   * §14-14는 "기록은 실시에서만 고친다"였다. 근거는 "채점하며 원자료를 고치면
   * 무엇을 근거로 채점했는지가 흐려진다"였는데, 실사용에서 뒤집혔다(피드백 v2-3):
   * 채점하다 오타나 빠진 질문을 발견했을 때 **되돌아갈 길이 화면에 없으면
   * 임상가는 틀린 채로 확정한다.** 흐려지는 것보다 틀린 게 나쁘다.
   *
   * 안전장치는 그대로다:
   *   - 확정 후에는 못 고친다 (`readonly` → 서버 `_ensure_editable`)
   *   - STT 원문(`*_stt_raw`)은 따로 남아 무엇을 고쳤는지 대조된다(§4-2)
   *   - 변경은 감사추적에 남는다
   *
   * 실패하면 되돌린다 — 화면만 바뀌고 서버는 옛 값이면 다음 새로고침에
   * 조용히 되돌아가 임상가가 고친 줄 안다.
   */
  async function handleSaveRecord(
    field: 'free_association_text' | 'inquiry_text',
    value: string
  ) {
    const target = selectedResponse
    const instId = $institutionId
    if (!target || !instId) return
    if ((target[field] ?? '') === value) return

    const prev = target[field]
    replaceResponse({ ...target, [field]: value })
    try {
      const updated = await updateResponse(instId, examId, target.id, {
        [field]: value
      })
      replaceResponse(updated)
    } catch (err) {
      console.error(`[updateResponse ${field}] 실패`, err)
      snackbarStore.error('기록 저장에 실패했습니다.')
      replaceResponse({ ...target, [field]: prev })
    }
  }

  /**
   * 카드 회전 교정 — 기록의 한 칸이므로 확정 전에는 채점에서도 고친다.
   *
   * 회전은 채점에 직접 쓰인다(§5-1) — 돌려 본 반응은 그 방향에서 형태질을
   * 봐야 하고, 자주 돌리는 것 자체가 해석 대상이다. 채점하다 잘못 기록된 걸
   * 발견하면 여기서 고칠 수 있어야 실시로 돌아가지 않는다.
   */
  async function handleChangeOrientation(o: CardOrientation) {
    const target = selectedResponse
    const instId = $institutionId
    if (!target || !instId || target.card_orientation === o) return
    const prev = target.card_orientation
    replaceResponse({ ...target, card_orientation: o })
    try {
      const updated = await updateResponse(instId, examId, target.id, {
        card_orientation: o
      })
      replaceResponse(updated)
    } catch (err) {
      console.error('[updateResponse card_orientation] 실패', err)
      snackbarStore.error('카드 방향 저장에 실패했습니다.')
      replaceResponse({ ...target, card_orientation: prev })
    }
  }

  function handleClosePopover() {
    selectResponse(null)
  }

  function statusLabel(s: string): string {
    // 채점 화면 컨텍스트: in_progress 는 "녹취·영역 기록 완료, 채점 대기" 의미라 별도 라벨링
    const contextual: Record<string, string> = {
      in_progress: '검사 진행됨 (채점 대기)',
      confirmed: '확정 완료'
    }
    return contextual[s] ?? EXAM_STATUS_VISUAL[s as ExamStatus]?.label ?? s
  }
</script>

<ExamLayoutShell
  headerTitle="채점 검토"
  headerSubtitle={isReadOnly
    ? '확정된 채점입니다. 읽기 전용으로 표시됩니다.'
    : '영역을 클릭하면 AI 채점을 받거나 코딩을 검토·수정할 수 있습니다.'}
  exitMode={isReadOnly ? 'leave' : 'cancel'}
>
      <!--
        채점 화면만 **좌 카드 / 우 계열 기록지 2단**이다 (피드백 v2 6번-B).

        §14-3은 "우측 패널을 버린다"였고 그 근거는 실시 중 임상가의 눈이
        카드를 떠나면 안 된다는 것이었다. 채점은 그 조건이 다르다 — 반응
        하나를 부호로 옮기는 일이라 **직전까지의 계열이 옆에 있어야** 한다
        (접근방식·연쇄된 특수점수·P를 몇 개나 줬는지는 한 반응만 보면 안 보인다).

        카드 탭·반응 툴바는 카드에 매인 것이라 좌측에 남는다. 표는 프로토콜
        전체를 담으므로 카드를 바꿔도 그대로다.
      -->
      <!--
        카드 탭은 **2단 위에서 전폭**이다. 탭은 화면 전체의 축(지금 몇 번
        카드인가)이지 좌측 무대의 부속이 아니다 — 좌측 안에 넣으면 표와
        높이가 어긋나 두 컬럼의 시작선이 안 맞는다.
      -->
      <CardTabs
        activeCard={currentCard}
        regionCounts={responseCounts}
        countLabel="반응"
        {allCodedByCard}
        {aiScoringByCard}
        onCardChange={handleCardChange}
      />

      <div class="flex min-h-0 flex-1 overflow-hidden">
        <!-- 좌: 카드 무대 -->
        <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
          <!--
            반응 선택 — 실시 화면과 **같은 툴바**를 쓴다. 조각이 아니라 반응을
            순회하므로 영역이 없는 반응도 고를 수 있다(§14-4).
          -->
          <ResponseToolbar
            responses={cardResponses}
            {selectedId}
            isDone={isCoded}
            onSelect={selectResponse}
            {zoom}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onZoomReset={zoomReset}
          />

          <!--
            카드 무대는 실시 화면과 **같은 컴포넌트**다 (§14-14).
            예전에는 CodingCanvas가 따로 있었는데 이미지 로딩·`.card-box`·영역
            오버레이가 전부 복제였다. 줌만 이쪽에서 쓰는 옵션이다.

            **확정 전이면 여기서도 영역을 고칠 수 있다** — §3-1의 "벽 없음"이다.
            채점하다 영역이 잘못됐음을 발견하면 돌아가지 않고 바로 고친다.
          -->
          <div class="flex min-h-0 flex-1 overflow-hidden">
            <CardCanvas
              cardNumber={currentCard}
              regions={currentRegions}
              {selectedId}
              {labelOf}
              {colorOf}
              {zoom}
              isDrawingMode={false}
              editable={false}
              nextRegionColor={responseColor(selectedResponse?.response_no)}
              areaCode={selectedResponse?.area_code ?? null}
              onSelect={selectResponse}
              onDrawEnd={() => {}}
              onDeleteRegion={() => {}}
              onUpdateAreaCode={() => {}}
              onBoxReady={(el) => (canvasBox = el)}
            />
          </div>
        </div>

        <!--
          우: 계열 기록지. 카드와 1:1 폭이다.

          팝오버는 **항상 카드 박스 왼쪽 위**에 뜨므로(`ResponsePopover`의
          `pos`) 이 컬럼을 넘어올 수 없다 — 채점하는 동안에도 표가 가려지지
          않는다. 그 배치를 고정으로 바꾼 이유가 이 2단이다.
        -->
        <!--
          카드를 마주 보는 면이라 경계는 세로선 하나로 족하다. 테두리 상자로
          감싸면 화면 안에 상자가 하나 더 생겨 카드와 표가 형제가 아니라
          표만 따로 얹힌 것처럼 보인다.
        -->
        <aside
          class="flex w-1/2 min-w-0 shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-white"
        >
          <CodingSequenceTable
            {responses}
            {selectedId}
            onSelect={handleRowSelect}
            {isBatchScoring}
            {adoptingId}
            {scorableCount}
            {codedCount}
            onScoreAll={isReadOnly ? undefined : handleScoreAll}
            onAdoptAi={isReadOnly ? undefined : handleAdoptAi}
          />
        </aside>
      </div>

  {#snippet footer()}
    <CodingFooter
      {codedCount}
      totalCount={formalResponses.length}
      {canConfirm}
      {uncodedHint}
      {isConfirming}
      {isReadOnly}
      statusText={exam ? statusLabel(exam.status) : ''}
      onConfirm={handleNextStep}
      onPrev={() => goto(`/examinations/${examId}/collect`)}
    />
  {/snippet}

  <!-- 영역 팝업 (캔버스 박스 외부에서 fixed 좌표로 렌더 — 잘리지 않음) -->
  {#if selectedResponse && canvasBox}
    {#key selectedResponse.id}
      <ResponsePopover
        mode="coding"
        response={selectedResponse}
        region={selectedRegion}
        aiCoding={selectedAiCoding}
        finalCoding={selectedFinalCoding}
        aiConfidence={selectedResponse?.ai_confidence ?? null}
        aiReasoning={selectedResponse?.ai_reasoning ?? null}
        {isScoring}
        readonly={isReadOnly}
        {canvasBox}
        onClose={handleClosePopover}
        onAiScore={handleAiScore}
        onSaveCoding={handleSaveCoding}
        onChangeLocation={handleChangeLocation}
        onSaveText={(v) => handleSaveRecord('free_association_text', v)}
        onSaveInquiry={(v) => handleSaveRecord('inquiry_text', v)}
        onChangeOrientation={handleChangeOrientation}
      />
    {/key}
  {/if}
</ExamLayoutShell>
