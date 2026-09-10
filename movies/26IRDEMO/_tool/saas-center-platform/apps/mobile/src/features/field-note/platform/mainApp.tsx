/**
 * 필드노트 플랫폼 어댑터 — 메인(상담사) 앱 구현.
 *
 * ⚠️ 결합 집약 지점. 필드노트 코어가 필요로 하는 바깥 의존성(@/features/*, @/shared/*)을
 * 이 한 파일에 모아 포트(FieldNotePlatform)로 구현한다. 필드노트를 별도 앱으로 추출할 때는
 * 이 파일만 새 앱용 어댑터로 교체하면 되고, 코어 68파일은 손대지 않는다.
 *
 * (스케줄 데이터 훅·REST apiClient 등 아직 포트로 빼지 않은 잔여 결합은
 *  같은 폴더의 EXTRACTION.md 참고.)
 */
import { useMemo, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { useCenterStore } from '@/features/center';
import { useToastStore, GlobalToastHost } from '@/features/toast';
import { API_BASE_URL, API_PREFIX } from '@/shared/api/client';
import { TokenStorage } from '@/shared/utils/storage';
import { FieldNotePlatformProvider } from './context';
import type { FieldNotePlatform } from './types';

export function MainAppFieldNotePlatformProvider({ children }: { children: ReactNode }) {
  const centerId = useCenterStore((s) => s.centerId);
  const router = useRouter();
  const showToast = useToastStore((s) => s.show);

  const value = useMemo<FieldNotePlatform>(
    () => ({
      centerId,
      config: {
        getApiBaseUrl: () => API_BASE_URL,
        getApiPrefix: () => API_PREFIX,
        getAccessToken: () => TokenStorage.getAccessToken(),
      },
      notify: (opts) => {
        showToast(opts);
      },
      ToastHost: GlobalToastHost,
      navigate: {
        toFieldNoteHome: () => router.push('/(main)/field-note/home'),
        toFieldNoteDetail: (scheduleId) =>
          router.push(`/(main)/field-note/${scheduleId}` as never),
        toFieldNoteQuick: (fieldNoteId) =>
          router.push(`/(main)/field-note/_quick?fieldNoteId=${fieldNoteId}` as never),
        toCounselingNotes: () => router.push('/(main)/counseling/notes'),
        toAssessmentCase: (caseId) =>
          router.push({ pathname: '/(main)/assessment/[id]', params: { id: caseId } }),
        toNotifications: () => router.push('/(main)/notifications'),
      },
    }),
    [centerId, router, showToast],
  );

  return <FieldNotePlatformProvider value={value}>{children}</FieldNotePlatformProvider>;
}
