import { useRouter } from 'expo-router';
import { FieldNoteListContent } from '@/features/field-note/components/FieldNoteListContent';
import { useDarkNavBarOnFocus } from '@/features/field-note/useFieldNoteNavBar';

/**
 * 필드노트 전체 목록 — FAB 미니메뉴 "목록보기"로 진입.
 *
 * 전환은 네이티브 스택 애니메이션(slide_from_bottom, _layout 지정)에 맡긴다 —
 * iOS/Android 동일하게 매끄럽고, 뒤로가기/스와이프 dismiss 도 네이티브가 처리.
 */
export default function FieldNoteListScreen() {
  useDarkNavBarOnFocus();
  const router = useRouter();
  return <FieldNoteListContent onBack={() => router.back()} />;
}
