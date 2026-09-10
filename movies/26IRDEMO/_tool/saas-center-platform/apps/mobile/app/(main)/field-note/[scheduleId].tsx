import { FieldNoteDetailView } from '@/features/field-note/components/FieldNoteDetailView';

/**
 * 필드노트 상세/녹음 라우트.
 *
 * 본문은 `FieldNoteDetailView`(목록 morph 오버레이와 공용). props 없이 렌더하면
 * orchestrator 가 route params(scheduleId/fieldNoteId)로 동작하고 뒤로가기는 router.back.
 */
export default function FieldNoteScreen() {
  return <FieldNoteDetailView />;
}
