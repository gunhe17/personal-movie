import { useRecordingStore, selectIsActive } from './recordingStore';

/**
 * FAB(필드노트 진입 버튼)의 상태/액션.
 *
 * 탭 동작은 호출 측(DraggableFab)이 조합한다:
 * - 녹음 중(일시정지 포함) → 탭 시 시트 복원(`openSheet`)
 * - 녹음 X → 탭 시 미니메뉴(녹음하기/목록보기) 토글. `start`/네비게이션은 메뉴 항목이 호출
 *
 * - `start`: 권한 체크 + createFieldNote + 녹음 시작 (RecordingHost 가 주입)
 *
 * ⚠️ elapsed(매초 갱신)는 여기서 구독하지 않는다 — 이 훅을 쓰는 화면(필드노트 홈 등)이
 * 녹음 중 매초 통째로 리렌더되어 긴 리스트 성능을 깎는다. 시간 표시가 필요한 작은
 * 컴포넌트(ActiveFabPill·RecordCtaButton)가 각자 직접 구독한다.
 */
export function useFieldNoteFabBehavior() {
  const isActive = useRecordingStore(selectIsActive);
  const isPaused = useRecordingStore((s) => s.isPaused);
  const sheetVisible = useRecordingStore((s) => s.sheetVisible);
  const start = useRecordingStore((s) => s.start);
  const openSheet = useRecordingStore((s) => s.openSheet);
  // 회기 카드 녹음 충돌 해소용 — 현재 활성 녹음의 노트/회기 연결 상태 + 전환 액션.
  const fieldNoteId = useRecordingStore((s) => s.fieldNoteId);
  const scheduleId = useRecordingStore((s) => s.scheduleId);
  const switchToSchedule = useRecordingStore((s) => s.switchToSchedule);

  return {
    isActive,
    isPaused,
    sheetVisible,
    start,
    openSheet,
    fieldNoteId,
    scheduleId,
    switchToSchedule,
  };
}
