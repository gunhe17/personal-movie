/**
 * 로르샤하 검사 HTTP 액션
 * 백엔드: /institutions/{instId}/examinations/{examId}/rorschach/...
 *
 * 주의: 백엔드가 ApiResponse 래핑 없이 DTO를 직접 반환하므로
 *       PATCH/DELETE도 raw axios로 호출 (instances.ts의 patch/deleteResource는
 *       ApiResponse<T>를 가정하지만 실제 백엔드는 raw — 타입 안전을 위해 직접 호출).
 */
import { appInstance, get, postRaw } from '$lib/services/api/instances'
import type { Point } from './types'

// --- Server DTOs ---

export interface ServerRegion {
  id: string
  session_id: string
  /** 소유 반응. 관계 역전 이후 조각은 반응에 매달린다. */
  response_id: string | null
  /** 반응에서 파생된 값 — 조각 자신은 카드번호를 갖지 않는다. */
  card_no: number | null
  /**
   * 라벨·색은 없다(2026-08-26 제거). 둘 다 소유 반응의 표시 번호에서
   * 파생시킨다 — `labelOf` / `colorOf`(`responseColor`).
   * 조각이 값을 들고 있으면 반응을 지운 뒤 옛 번호에 머물러 화면과 갈린다.
   */
  path: { x: number; y: number }[]
  memo: string | null
  audio_timestamp_start_sec: number | null
  audio_timestamp_end_sec: number | null
  created_at: string
  updated_at: string
}

export interface ServerSession {
  id: string
  examination_id: string
  audio_url: string | null
  audio_duration_sec: number | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  updated_at: string
}

export interface ServerCoding {
  location: string | null
  dq: string | null
  determinants: string[]
  fq: string | null
  /**
   * null=미확인 / true=쌍반응 / false=쌍 아님 확정.
   * P와 같은 3상태다 — (2)는 자아중심성 지표 3r+(2)/R에 직접 들어가므로
   * "안 봤다"가 "쌍 아님"으로 집계되면 지표가 조용히 낮아진다.
   */
  pair: boolean | null
  contents: string[]
  /** null=미확인 / true=P / false=P 아님 확정 (types.ts 참조) */
  popular: boolean | null
  z_score: string | null
  special_scores: string[]
}

export interface ServerResponseDetail {
  id: string
  session_id: string
  card_no: number
  /**
   * 이 반응의 조각 — **0개 또는 1개**(§14-7). 위치는 반응당 하나이고,
   * 다시 그리면 서버가 기존 것을 대체한다.
   */
  region_ids: string[]
  phase: string
  is_formal: boolean
  response_no: number | null
  /** 피검자가 카드를 어느 쪽으로 놓고 봤는가 — 기록이지 화면 표시가 아니다 */
  card_orientation: CardOrientation | null
  /** 위치 부호 — 반응당 1개(§14-7). 조각이 아니라 여기 있다. */
  area_code: string | null
  free_association_text: string | null
  /** 기계가 들은 원문 — 임상가가 고친 free_association_text와 대조된다(§4-2) */
  free_association_stt_raw: string | null
  inquiry_text: string | null
  /** 질문 답변의 원문 — 자유반응과 **같은 쌍**이다(§4-2) */
  inquiry_stt_raw: string | null
  ai_coding: ServerCoding | null
  final_coding: ServerCoding | null
  ai_confidence: number | null
  ai_reasoning: string | null
  /**
   * 채점의 근거가 바뀌었는가 — 실시로 돌아가 반응 텍스트·질문·위치 부호·카드
   * 회전을 고친 뒤 아직 이 반응의 채점을 다시 저장하지 않았다는 뜻이다.
   *
   * 채점값은 지우지 않는다(오타 하나에 임상가가 한 채점이 날아가면 임상가가
   * 오타를 안 고치게 된다). 대신 **확정 게이트가 막힌다** — 서버
   * `completion.response_coded`가 이 값을 보고, 프론트 `isCoded`도 같은
   * 규칙이어야 한다.
   */
  coding_stale: boolean
  confirmed_at: string | null
  confirmed_by: string | null
}

/**
 * 세션 녹음의 화자분리 전사 구간.
 *
 * **지금 화면에서 쓰는 곳이 없다.** 세션 통째 녹음을 올리는 UI가 사라지면서
 * 새 검사에서는 생성되지 않고, 반응 텍스트는 실시 화면에서 반응별로 직접
 * 받아쓴다(§14-14). 타입은 서버가 여전히 이 필드를 보내므로 남긴다 —
 * 기존 검사 22건의 기록이 여기 들어 있다.
 */
export interface ServerTranscriptSegment {
  start: number
  end: number
  speaker: string
  text: string
  card_no: number | null
}

export interface SessionStartResponse {
  session: ServerSession
  examination_status: string
}

export interface SessionDetail {
  session: ServerSession
  regions: ServerRegion[]
  responses: ServerResponseDetail[]
  /** 옛 세션 녹음의 전사 — 새 검사에서는 항상 빈 배열이다 */
  transcript: ServerTranscriptSegment[]
  /** 카드 실시 기록 — 거부는 반응이 0개라 responses만 봐선 알 수 없다. */
  cards: ServerCardAdministration[]
  interventions: ServerIntervention[]
}

export interface RegionCreateBody {
  /** 조각은 반드시 반응에 붙는다 — card_no로 추론하지 않는다. */
  response_id: string
  path: Point[]
  memo?: string | null
  audio_timestamp_start_sec?: number | null
  audio_timestamp_end_sec?: number | null
}

/** 카드 회전 ∧ ∨ < > — 반응마다 붙는다 */
export type CardOrientation = 'up' | 'down' | 'left' | 'right'
/** 반응이 만들어진 단계 */
export type ResponsePhase = 'free_association' | 'inquiry' | 'limits_testing'
/** 카드 레벨 사실 — 거부와 미입력을 구분한다 */
export type CardStatus = 'pending' | 'responded' | 'rejected'
export type InterventionKind = 'prompt' | 'pull' | 'repeat' | 'limits' | 'other'

export interface ServerCardAdministration {
  id: string
  session_id: string
  card_no: number
  status: CardStatus
  presented_at: string | null
  completed_at: string | null
}

/**
 * 검사자 개입 기록 (촉구·재질문·한계검증 등).
 *
 * 촉구는 실시 화면의 토글 버튼이 만든다(문장 없이 플래그만).
 * 한계검증은 아직 진입점이 없다(§14-9 — 이번 범위 밖).
 */
export interface ServerIntervention {
  id: string
  session_id: string
  card_no: number
  response_id: string | null
  phase: string
  kind: InterventionKind
  /** 촉구는 null이다 — 있었다는 사실이 기록의 전부다 */
  text: string | null
  created_at: string
}

export interface ResponseCreateBody {
  card_no: number
  free_association_text: string
  /**
   * STT가 들은 원문 — 초안으로 줄을 만들 때 함께 보낸다.
   * 이후 임상가가 `free_association_text`를 고쳐도 여기는 안 변한다.
   */
  free_association_stt_raw?: string | null
  phase?: ResponsePhase
  is_formal?: boolean
  card_orientation?: CardOrientation
}

export interface ResponseUpdateBody {
  free_association_text?: string
  /** 전사가 도착할 때마다 이어붙는 원문 — 임상가는 이 칸을 안 고친다 */
  free_association_stt_raw?: string
  inquiry_text?: string
  /** 질문 답변의 원문 — `free_association_stt_raw`와 같은 규칙이다 */
  inquiry_stt_raw?: string
  card_orientation?: CardOrientation
  is_formal?: boolean
  /**
   * 위치 부호 — **반응당 1개**. 'W' / 'D6' / 'DS6' / 'Dd99'.
   * 서버가 형식을 검증한다(못 읽는 값은 구조요약에서 조용히 사라지므로).
   */
  area_code?: string | null
}

// --- Endpoints ---

const base = (instId: string, examId: string) =>
  `/institutions/${instId}/examinations/${examId}/rorschach`

/** 반응 기록 — 자유반응 단계. response_no는 서버가 매긴다. */
export async function createResponse(
  instId: string,
  examId: string,
  body: ResponseCreateBody,
): Promise<ServerResponseDetail> {
  return postRaw<ServerResponseDetail>(`${base(instId, examId)}/responses`, body)
}

export async function updateResponse(
  instId: string,
  examId: string,
  responseId: string,
  body: ResponseUpdateBody,
): Promise<ServerResponseDetail> {
  const res = await appInstance.patch<ServerResponseDetail>(
    `${base(instId, examId)}/responses/${responseId}`,
    body,
  )
  return res.data
}

export async function deleteResponse(
  instId: string,
  examId: string,
  responseId: string,
): Promise<void> {
  await appInstance.delete(`${base(instId, examId)}/responses/${responseId}`)
}

/** 카드 실시 기록 — 거부와 미입력을 구분한다. */
export async function setCardStatus(
  instId: string,
  examId: string,
  cardNo: number,
  status: CardStatus,
  presentedAt?: string | null,
): Promise<ServerCardAdministration> {
  const res = await appInstance.put<ServerCardAdministration>(
    `${base(instId, examId)}/cards/${cardNo}/status`,
    { status, presented_at: presentedAt ?? null },
  )
  return res.data
}

export interface InterventionCreateBody {
  card_no: number
  kind: InterventionKind
  /**
   * 촉구(prompt)는 **비운다** — 있었다는 사실이 기록의 전부다.
   * 한계검증(limits)만 서버가 요구한다: 무엇을 유도했는지 없으면 해석이 안 된다.
   */
  text?: string | null
  phase?: ResponsePhase
  /** 특정 반응에 대한 개입이면 그 id — 카드 전체에 대한 것이면 null */
  response_id?: string | null
}

/**
 * 검사자 개입 기록 — 촉구·한계검증 등.
 *
 * 거부 전에 촉구했는지가 남아야 **진짜 거부**와 **촉구 후에도 안 나온 것**이
 * 구분된다. 백엔드는 처음부터 있었는데 화면에 진입점이 없어서 한 건도
 * 쌓이지 않고 있었다.
 */
export async function createIntervention(
  instId: string,
  examId: string,
  body: InterventionCreateBody,
): Promise<ServerIntervention> {
  return postRaw<ServerIntervention>(`${base(instId, examId)}/interventions`, body)
}

/**
 * 개입 기록 취소 — 실시 중 오조작을 되돌린다.
 *
 * 서버는 soft delete라 "기록했다가 취소했다"는 이력이 남는다.
 */
export async function deleteIntervention(
  instId: string,
  examId: string,
  interventionId: string,
): Promise<void> {
  await appInstance.delete(`${base(instId, examId)}/interventions/${interventionId}`)
}

export interface TranscriptClip {
  text: string
  /**
   * 음성이 있다고 판단했는가.
   * (detected=true, text='')는 "말은 있었는데 인식하지 못했다" —
   * 환각으로 의심돼 버려진 경우다. 틀린 문장보다 빈 칸이 낫다.
   */
  detected: boolean
}

/** 발화 한 조각 전사 — 결과는 초안이고 서버에 저장되지 않는다. */
export async function transcribeClip(
  instId: string,
  examId: string,
  clip: Blob,
  durationSec: number,
): Promise<TranscriptClip> {
  const form = new FormData()
  form.append('audio', clip, 'clip.webm')
  form.append('duration_sec', String(durationSec))
  const res = await appInstance.post<TranscriptClip>(
    `${base(instId, examId)}/transcribe-clip`,
    form,
    // 배치 전사는 15초 발화가 3~5초. 네트워크를 감안해 넉넉히 둔다.
    { timeout: 60_000 },
  )
  return res.data
}

export async function startSession(instId: string, examId: string): Promise<SessionStartResponse> {
  return postRaw<SessionStartResponse>(`${base(instId, examId)}/start`, {})
}

export async function createRegion(
  instId: string,
  examId: string,
  body: RegionCreateBody,
): Promise<ServerRegion> {
  return postRaw<ServerRegion>(`${base(instId, examId)}/regions`, body)
}

export async function deleteRegion(
  instId: string,
  examId: string,
  regionId: string,
): Promise<void> {
  await appInstance.delete(`${base(instId, examId)}/regions/${regionId}`)
}

export async function completeSession(
  instId: string,
  examId: string,
  audioDurationSec: number | null,
): Promise<ServerSession> {
  return postRaw<ServerSession>(`${base(instId, examId)}/complete`, {
    audio_duration_sec: audioDurationSec,
  })
}

// === Phase 3: 채점 / 검토 / 확정 ===

export async function getSessionDetail(instId: string, examId: string): Promise<SessionDetail> {
  return get<SessionDetail>(`${base(instId, examId)}/detail`)
}

/**
 * 세션 일괄 AI 채점 — **모든 정식 반응**을 채점한다 (`ScoreSessionService`).
 *
 * 채우는 것은 `ai_coding`뿐이고 `final_coding`은 건드리지 않는다. 완료 판정과
 * 확정 게이트가 보는 것은 `final_coding`이므로(§14-4), 일괄로 돌려도 임상가가
 * 한 번도 안 본 채점이 확정을 통과하지는 않는다 — CDSS 원칙 그대로다.
 *
 * ⚠️ **이미 있는 AI 초안도 덮는다.** 서버가 정식 반응 전체를 다시 채점하므로,
 * 임상가가 검토 중이던 제안이 다른 값으로 바뀔 수 있다. 부르는 쪽에서 그
 * 사실을 알리고 확인을 받는다.
 *
 * ⚠️ **동기 처리다.** 반응 하나당 ~25초가 걸리고 그동안 요청 하나가 물려
 * 있으므로, 타임아웃을 반응 수에 맞춰 받는다. 기본값으로 두면 R이 조금만
 * 커져도 **서버는 채점을 끝냈는데 화면만 실패로 보인다.**
 */
export async function scoreSession(
  instId: string,
  examId: string,
  timeoutMs: number,
): Promise<SessionDetail> {
  const res = await appInstance.post<SessionDetail>(
    `${base(instId, examId)}/score`,
    {},
    { timeout: timeoutMs },
  )
  return res.data
}

/** 단일 반응 AI 채점 — 채점 단위는 영역이 아니라 반응이다. */
export async function scoreResponse(
  instId: string,
  examId: string,
  responseId: string,
  transcriptText?: string | null,
): Promise<ServerResponseDetail> {
  const body =
    transcriptText !== undefined && transcriptText !== null
      ? { transcript_text: transcriptText }
      : {}
  // AI 채점은 서버에서 큐 잡 폴링 (단일 응답당 ~25s + α). 글로벌 30s 타임아웃 회피.
  const res = await appInstance.post<ServerResponseDetail>(
    `${base(instId, examId)}/responses/${responseId}/score`,
    body,
    { timeout: 130_000 },
  )
  return res.data
}

export async function updateResponseCoding(
  instId: string,
  examId: string,
  responseId: string,
  coding: ServerCoding,
  transcriptText?: string | null,
): Promise<ServerResponseDetail> {
  const body: { coding: ServerCoding; transcript_text?: string | null } = { coding }
  if (transcriptText !== undefined && transcriptText !== null) {
    body.transcript_text = transcriptText
  }
  const res = await appInstance.patch<ServerResponseDetail>(
    `${base(instId, examId)}/responses/${responseId}/coding`,
    body,
  )
  return res.data
}

export async function confirmSession(instId: string, examId: string): Promise<SessionDetail> {
  return postRaw<SessionDetail>(`${base(instId, examId)}/confirm`, {})
}

// === Phase 4-1: 구조요약 ===

export interface StructuralSummary {
  R: number
  /**
   * 프로토콜 타당성.
   *
   * Exner CS는 R<14인 프로토콜을 **해석하지 않고 재실시**하도록 한다.
   * 그런 경우 백엔드가 lower_section·special_indices를 비워 보내므로,
   * 화면은 이 값을 보고 재실시 권고를 띄워야 한다.
   */
  validity?: 'valid' | 'insufficient_r' | 'not_scored'
  location: Record<string, number>
  Zf: number
  ZSum: number
  ZEst: number
  dq: Record<string, number>
  determinants: Record<string, number>
  blends: string[]
  blends_count: number
  fq: Record<string, number>
  form_quality_extended: Record<string, number>
  contents: Record<string, number>
  special_scores: Record<string, number>
  P: number
  approach: Record<number, string[]>
  /**
   * null이면 **정의되지 않음**이다 — R=F(모든 반응이 순수 형태)라 분모가 0이다.
   * 0이 아니다: 0은 "순수 형태반응이 하나도 없다"는 정반대 소견이다.
   * 하단 클러스터에는 이미 `∞`로 들어와 있다(백엔드 표시값).
   */
  Lambda: number | null
  EA: number
  es: number
  FM: number
  m: number
  SumC_prime: number
  SumT: number
  SumV: number
  SumY: number
  SumM: number
  WSumC: number
  SumShading: number
  X_plus_pct: number
  X_u_pct: number
  X_minus_pct: number
  F_plus_pct: number
  P_pct: number

  /** Phase 4-3: 7개 클러스터 (core/affection/interpersonal/ideation/cognitiveMediation/informationProcessing/selfPerception) */
  lower_section: Record<string, Record<string, number | string>>

  /** 6개 지표 (sConstellation/depi/cdi/pti/hvi/obs) */
  special_indices: Record<string, ServerSpecialIndex>
}

/**
 * 특수지표 하나 — **항목 문장·판정 규칙·양성 여부를 서버가 함께 준다.**
 *
 * 예전에는 `{"0": "v", "1": ""}`만 오고 문장은 화면 배열에, 임계값은 화면과
 * PDF 두 곳에 손으로 적혀 있었다. 잇는 것이 인덱스뿐이라 한쪽에 항목을
 * 끼우면 조용히 밀렸다(HVI가 실제로 그랬다).
 *
 * 판정을 화면이 할 수 없기도 하다: 원전의 HVI는 "1번 필수 + 나머지 7개 중
 * 4개", OBS는 "4개 복합 규칙 중 하나"라 개수 비교로는 성립하지 않는다.
 */
export interface ServerSpecialIndex {
  /** 지표 이름 — 예: "S-CON (자살지표)" */
  label: string
  /** 판정 규칙 문장 — 예: "(필수) 1번 해당 + 나머지 7개 중 4개 이상" */
  rule: string
  items: { label: string; met: boolean }[]
  positive: boolean
}

export async function getStructuralSummary(
  instId: string,
  examId: string,
): Promise<StructuralSummary> {
  return get<StructuralSummary>(`${base(instId, examId)}/structural-summary`)
}

export async function downloadRorschachReportPdf(instId: string, examId: string): Promise<void> {
  const res = await appInstance.get(`${base(instId, examId)}/report/pdf`, {
    responseType: 'blob',
  })
  const blob = new Blob([res.data], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `rorschach_report_${examId.slice(0, 8)}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
