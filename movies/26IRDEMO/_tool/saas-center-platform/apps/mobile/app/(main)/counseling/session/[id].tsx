import { useLocalSearchParams, useRouter } from 'expo-router';
import { SessionDetailView } from '@/features/counseling/session';

/**
 * 상담 회기 상세 — route 진입점 (case 상세, 홈, push 알림 등).
 *
 * 캘린더 카드 진입은 morph overlay로 처리되어 이 라우트를 거치지 않는다 (schedule.tsx 참고).
 * 페이지 본문은 `SessionDetailView` 컴포넌트가 담당.
 */
export default function CounselingSessionDetailScreen() {
  const { id: sessionId, scheduleId, openNote, openWizard } =
    useLocalSearchParams<{
      id: string;
      scheduleId?: string;
      openNote?: string;
      openWizard?: string;
    }>();
  const router = useRouter();

  return (
    <SessionDetailView
      sessionId={sessionId}
      scheduleId={scheduleId}
      openNote={openNote}
      openWizard={openWizard}
      onClose={() => router.back()}
      withSafeArea
    />
  );
}
