/**
 * Agent Chat 타입 정의 (v3 Pipeline)
 *
 * 백엔드 Schema → 프론트 Type 1:1 미러링.
 * 백엔드 수정 시 이 파일도 반드시 동기화할 것.
 */

// ========== SSE 이벤트 타입 ==========

/** SSE 이벤트 타입 — agent-flow.md SSE Event 목록과 1:1 (assistant flat 루프) */
export type SSEEventType =
  | 'progress'
  | 'completion_delta'
  | 'conversation_done'
  | 'conversation_error'
  | 'step_tool_call'
  | 'step_tool_result'
  | 'checkpoint_waiting'
  | 'process_text'

/** SSE 스트림 이벤트 — 백엔드 yield dict 구조와 1:1 */
export interface SSEEvent {
  type: SSEEventType
  // progress / conversation_done / conversation_error
  message?: string
  // completion_delta — 답 초안 토큰 델타 (UI: content 말풍선 append)
  text?: string
  // step_tool_call(prefill) / step_tool_result
  step_id?: string
  tool?: string
  args?: Record<string, unknown>
  display?: string
  output?: unknown
  is_error?: boolean
  /** 도구가 실행된 홉 — 마지막 홉=결과 조회, 이전 홉=과정 조회 구분용 */
  hop?: number
  // checkpoint_waiting
  question?: string
  input?: Record<string, unknown>
}

// ========== 백엔드 미러 타입 (Schema 1:1) ==========

/** 백엔드 AssistantConversationResponse 미러 (목록·세션 항목) */
export interface AgentSession {
  id: string
  center_id: string
  member_id: string
  title: string | null
  status: string
  created_at: string
  updated_at: string
}

/** 백엔드 AssistantTurnResponse 미러 — 화면 복원(events 재생). events = 라이브 SSE와 동형 */
export interface AssistantTurnRecord {
  id: string
  user_message: string
  events: SSEEvent[]
  completion: string | null
  status: string
  created_at: string
}

/** 백엔드 AssistantConversationDetailResponse 미러 */
export interface AssistantConversationDetail {
  id: string
  title: string | null
  turns: AssistantTurnRecord[]
}

// ========== 입력/결과 타입 ==========

/** 폼 필드 정의 (form 모드 checkpoint) */
export interface FormFieldDef {
  name: string
  type: string          // text | datetime | select | textarea | number
  label: string
  required?: boolean
  choices?: string[]    // select 옵션
}

/** UI 사용자 입력 대기 (checkpoint_waiting) — text · selection · form */
export interface WaitingInput {
  stepId: string
  question: string
  inputType: 'text' | 'selection' | 'form'
  options?: unknown[]
  formTitle?: string
  formFields?: FormFieldDef[]
}

/** Tool 결과 렌더링 뷰 */
export interface ToolResultView {
  stepId: string
  tool: string
  output: unknown
}

// ========== UI 전용 타입 ==========

/** 에이전트 메시지 내부 세그먼트 (질문/답변/텍스트 인라인 표시) */
export interface MessageSegment {
  type: 'text' | 'question' | 'answer'
  content: string
  time?: string
}

/** 도구 결과 카드/표 — 본문 결과 또는 작업 과정(중간 hop) */
export interface ChatToolResult {
  tool: string
  display: string
  output: unknown
  isError?: boolean
  rolledBack?: boolean
  truncated?: boolean
  limit?: number | null
  hop?: number | null
  /** true = 중간 hop → 작업 과정 접기 안. false = 마지막 hop → 본문 결과 표 */
  inProcess?: boolean
  /**
   * 본문 표 최초 등장 appear 허용.
   * conversation_done 직전 false로 내려 remount 시 결과 표가 다시 appear 하지 않게 함.
   */
  playEnter?: boolean
}

/** UI 채팅 메시지 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  time: string
  isAnswer?: boolean
  segments?: MessageSegment[]
  toolResult?: ChatToolResult
  /** 스트림 종료 시점 마지막 메시지에만 true — 시각을 턴당 한 번만 표시 */
  showTime?: boolean
  /** @deprecated 작업 과정 SSOT는 processTools(응답 이전 hop). 호환용 잔존 */
  processText?: string
  /**
   * 작업 과정 = 응답 이전 hop 도구 결과.
   * 생성 중 본문 표시 → conversation_done 때 접힌 details로 묶음.
   */
  processTools?: ChatToolResult[]
  /** 작업 과정 접기 헤더 마커 */
  processHeader?: boolean
  /** @deprecated 항상 접힘 — 자동 펼침 시퀀스 제거 */
  processOpen?: boolean
  /** @deprecated 미사용 */
  processClosing?: boolean
}

/** UI 일시적 진행 메시지 */
export interface ViewProgress {
  message: string
}
