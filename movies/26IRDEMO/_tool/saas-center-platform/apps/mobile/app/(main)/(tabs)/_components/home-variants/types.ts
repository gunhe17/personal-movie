import type { ScheduleListItem } from "@/features/schedule";
import type { PrepSignalItem } from "@/features/home";

/**
 * 홈 시안 키 — 디자인 톤 & 매너(§0)에 따라 4가지로 구분.
 *  A = 친절 (Helpful)  → 안내·명확성·단일 CTA 강조
 *  B = 친근 (Friendly) → 따뜻함·사람 중심·대화체
 *  C = 재미 (Vibrant)  → 시각 리듬·데이터 풍부·컬러 액센트
 *  D = 균형 (Balanced) → 3 톤 혼합 + 마이크로 인터랙션(§8.3) 적극 활용
 */
export type HomeVariantKey = "A" | "B" | "C" | "D";

export interface WeekStats {
  range: string;
  counseling: number;
  assessment: number;
  unlinked: number;
}

export interface HomeVariantProps {
  centerName: string | null;
  /** 가입된 센터가 2개 이상일 때만 true — 센터 전환(드롭다운) 노출 조건 */
  hasMultipleCenters: boolean;
  personName: string | null;
  dateStr: string;
  today: Date;
  nextSession: ScheduleListItem | null;
  /** 오늘 이후 가장 가까운 다가오는 일정(미래) — 오늘 일정이 없을 때 "다음 일정" 카드에 사용 */
  upcomingSession: ScheduleListItem | null;
  todaySchedules: ScheduleListItem[];
  weekSchedules: ScheduleListItem[];
  weekStats: WeekStats;
  unreadCount: number;
  unlinkedCount: number;
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  onRefresh: () => void;
  onPressMyCenters: () => void;
  onPressNotifications: () => void;
  onPressNextSession: () => void;
  /** 다음 회기의 "일지 검토" 진입 — 페이지 이동 없이 홈 위에서 직접 일지 시트 오픈 */
  onPressNextSessionNote?: () => void;
  /** 홈에서 직접 띄우는 일지 시트의 현재 상태. null 이면 비활성 */
  noteSheet?: {
    visible: boolean;
    sessionId: string | null;
    clientId: string | null;
    clientName: string | null;
    sessionStart: string | null;
  } | null;
  /** 일지 시트 닫기 */
  onCloseNoteSheet?: () => void;
  onPressNextSessionRecord: () => void;
  onPressSchedule: (id: string) => void;
  onPressSchedulesAll: () => void;
  onPressFieldNoteList: () => void;
  onRetry: () => void;
  prepSignals?: PrepSignalItem[] | null;
  onPressSignal?: (signal: PrepSignalItem) => void;
}
