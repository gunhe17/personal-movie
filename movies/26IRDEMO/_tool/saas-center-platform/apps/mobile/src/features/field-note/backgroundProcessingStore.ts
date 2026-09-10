import { create } from 'zustand';

export interface ProcessingJob {
  fieldNoteId: string;
  /** Quick 모드는 null, schedule 연결된 흐름은 schedule_id */
  scheduleId: string | null;
  /** 토스트에 표시할 라벨 (예: "필드노트", 회기명 등) */
  label?: string;
  startedAt: number;
}

interface BackgroundProcessingState {
  jobs: Record<string, ProcessingJob>;
  addJob: (job: ProcessingJob) => void;
  removeJob: (fieldNoteId: string) => void;
  hasJob: (fieldNoteId: string) => boolean;
}

/**
 * 분석이 진행 중인 필드노트들을 글로벌 추적.
 * 사용자가 ProcessingScreen 에서 뒤로 가도 polling 이 유지되도록
 * (main)/_layout 의 ProcessingHost 가 이 store 를 구독하여 폴링 수행.
 */
export const useBackgroundProcessingStore = create<BackgroundProcessingState>(
  (set, get) => ({
    jobs: {},
    addJob: (job) =>
      set((state) => ({
        jobs: { ...state.jobs, [job.fieldNoteId]: job },
      })),
    removeJob: (fieldNoteId) =>
      set((state) => {
        if (!state.jobs[fieldNoteId]) return state;
        const next = { ...state.jobs };
        delete next[fieldNoteId];
        return { jobs: next };
      }),
    hasJob: (fieldNoteId) => !!get().jobs[fieldNoteId],
  }),
);
