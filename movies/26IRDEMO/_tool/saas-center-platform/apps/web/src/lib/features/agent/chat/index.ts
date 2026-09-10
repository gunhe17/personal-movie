/**
 * Agent Chat Feature 모듈 - 공개 API (v3)
 */

// Types
export type {
  AgentSession,
  AssistantTurnRecord,
  AssistantConversationDetail,
  SSEEventType,
  SSEEvent,
  WaitingInput,
  ToolResultView,
  ChatMessage,
  MessageSegment,
  ViewProgress,
} from './types'

// Constants
export {
  MAX_MESSAGE_LENGTH,
  MAX_SESSION_TITLE_LENGTH,
  DEFAULT_SESSION_PAGE_SIZE,
  SSE_DONE_SIGNAL,
} from './constants'

// SSE Client
export { streamChat, streamResume, type SSECallbacks } from './sse-client'

// ViewModel
export {
  formatSessionTime,
  extractCheckpointWaiting,
} from './view-model'

// Transitions (AgentChatArea · playground SSOT)
export {
  appear,
  fadeOut,
  APPEAR_MS,
  EXIT_MS,
  APPEAR_X,
  APPEAR_Y,
  MOTION_IN_CLASS,
  MOTION_OUT_CLASS,
} from './transitions'

// Service
export { createAgentService, type AgentServiceDeps } from './agent-service'
