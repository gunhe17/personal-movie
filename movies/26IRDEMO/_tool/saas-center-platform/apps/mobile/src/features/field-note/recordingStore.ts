import { create } from 'zustand';
import type { RecordingContext } from './components/RecordingSheet';

/**
 * Quick mode 필드노트 녹음의 전역 상태.
 *
 * RecordingHost가 (main)/_layout에서 1회 마운트되어
 * 실제 useRecorder/useTimer를 보유하고, 그 상태/액션을 이 스토어로 노출한다.
 *
 * - state: FAB pulse, 시트 가시성, 디스플레이용 elapsed 등 외부에서 구독해야 하는 값
 * - actions: Host가 마운트 시 setState로 실제 함수를 주입. 마운트 전에는 no-op.
 */
interface RecordingStore {
  fieldNoteId: string | null;
  /**
   * 현재 활성 녹음에 연결된 회기 id. null이면 미연결 녹음(나중에 연결).
   * 회기 카드 녹음 충돌 해소(연결 제안 vs 회기 전환) 판단에 쓰인다.
   * RecordingHost가 시작 시 낙관적으로, 이후 서버(fieldNote.schedule_id)로 동기화.
   */
  scheduleId: string | null;
  /** 현재 활성 녹음에 연결된 검사 항목(task) id. 검사별 필드노트 녹음일 때만. null이면 미연결/회기 녹음. */
  taskId: string | null;
  /**
   * 좌상단 표기용 녹음 대상 컨텍스트(내담자명·프로그램/검사명). 선택 시점에 담아 둔다.
   * linkable-tasks 등 "노트 있는 항목 제외" 필터가 걸린 쿼리로 재조회하면 녹음 시작 직후
   * 그 항목이 목록에서 빠져 컨텍스트를 못 찾으므로, 선택 당시 값을 그대로 보존한다.
   */
  context: RecordingContext | null;
  isRecording: boolean;
  isPaused: boolean;
  /** 시트가 화면에 떠 있는지. false라도 isRecording은 유지될 수 있음(최소화 상태). */
  sheetVisible: boolean;
  /** 경과 시간 (정수 초). FAB 등에서 시간 표시용. RecordingHost가 매 초 동기화. */
  elapsed: number;

  // Host가 주입하는 실제 액션
  // resume 전달 시: 새 노트 생성 대신 기존 noteId 로 이어/추가 녹음(전역 RecordingSheet 사용).
  // scheduleId 전달 시(resume 없을 때): 그 회기에 연결된 새 노트로 녹음 시작(필드노트 홈 회기 녹음).
  start: (
    resume?: { fieldNoteId: string; baseDuration: number; startChunkIndex: number },
    scheduleId?: string,
    taskId?: string,
    context?: RecordingContext | null,
  ) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  requestStop: () => void;
  /**
   * 진행 중 녹음을 멈춰 분석으로 보내고(폐기 아님), 곧바로 그 회기에 연결된 새 녹음을 시작.
   * 다른 회기 녹음 중 또 다른 회기 녹음을 누른 "회기 전환" 상황에서 사용.
   */
  switchToSchedule: (scheduleId: string) => Promise<void>;

  // 빌트인 액션
  openSheet: () => void;
  minimizeSheet: () => void;
}

export const useRecordingStore = create<RecordingStore>((set) => ({
  fieldNoteId: null,
  scheduleId: null,
  taskId: null,
  context: null,
  isRecording: false,
  isPaused: false,
  sheetVisible: false,
  elapsed: 0,

  start: async () => {},
  pause: async () => {},
  resume: async () => {},
  requestStop: () => {},
  switchToSchedule: async () => {},

  openSheet: () => set({ sheetVisible: true }),
  minimizeSheet: () => set({ sheetVisible: false }),
}));

/** 녹음 활성(녹음 중 또는 일시정지) 여부 — FAB pulse 트리거 등에 사용. */
export const selectIsActive = (s: RecordingStore) => s.isRecording || s.isPaused;
