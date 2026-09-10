/**
 * 필드노트 플랫폼 포트(port) — 호스트 앱이 주입하는 의존성 계약.
 *
 * 필드노트 코어(src/features/field-note/**)는 바깥 세계(@/features/*, @/shared/*)를
 * 직접 import하지 않고, 이 인터페이스를 통해서만 플랫폼 기능에 접근한다.
 * 이 파일은 어떤 앱 모듈도 import하지 않는다(자립) — 별도 앱으로 추출해도 그대로 이동.
 *
 * 실제 구현(어댑터)은 `platform/mainApp.tsx` 한 곳에 모여 있다.
 * 추출 시엔 그 어댑터 파일만 교체하면 된다.
 */
import type { ComponentType } from 'react';

export type FieldNoteNotifyType = 'success' | 'error' | 'info';

export interface FieldNoteNotifyOptions {
  type: FieldNoteNotifyType;
  message: string;
  /** 표시 시간(ms) */
  durationMs?: number;
  /** 탭 시 호출 (호출 후 자동 닫힘) */
  onPress?: () => void;
}

/**
 * 필드노트 밖(호스트 앱)의 라우팅. 앱마다 라우트 구조가 다르므로,
 * 하드코딩 경로 문자열 대신 이 어댑터를 통해서만 이동한다.
 */
export interface FieldNoteNavigator {
  /** 필드노트 다크 홈 */
  toFieldNoteHome: () => void;
  /** 회기(schedule) 연결 상세 */
  toFieldNoteDetail: (scheduleId: string) => void;
  /** 회기 미연결(_quick) 상세 — fieldNoteId 로 진입 */
  toFieldNoteQuick: (fieldNoteId: string) => void;
  /** 상담일지 목록 (cross-domain) */
  toCounselingNotes: () => void;
  /** 검사 케이스 상세 (cross-domain). caseId = task 의 case_id */
  toAssessmentCase: (caseId: string) => void;
  /** 알림 목록 (cross-domain) */
  toNotifications: () => void;
}

/** 전송 계층 설정 — 스트리밍 WS URL 조립·인증에 사용 */
export interface FieldNoteTransportConfig {
  getApiBaseUrl: () => string;
  getApiPrefix: () => string;
  getAccessToken: () => Promise<string | null>;
}

export interface FieldNotePlatform {
  /** 멀티테넌트 센터 ID (reactive — 값이 바뀌면 소비처 재렌더) */
  centerId: string | null;
  /** 전송 계층 설정 */
  config: FieldNoteTransportConfig;
  /** 토스트 알림 */
  notify: (options: FieldNoteNotifyOptions) => void;
  /**
   * 상위(elevated) 토스트 렌더 호스트 — 시트(Modal) 안에서 렌더해 시트 위에 토스트를 띄운다.
   * (notify 로 큐에 넣은 토스트가 모달보다 위 레이어에 보이도록.)
   */
  ToastHost: ComponentType;
  /** 앱 라우팅 */
  navigate: FieldNoteNavigator;
}
