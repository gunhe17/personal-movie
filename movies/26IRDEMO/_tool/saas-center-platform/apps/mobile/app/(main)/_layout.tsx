import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Redirect, Stack, useRouter, usePathname } from 'expo-router';
import { useAuthStore } from '@/features/auth';
import { useCenterStore, usePermissionStore } from '@/features/center';
import { usePushNotifications, getInitialNotification, handleNotificationNavigation } from '@/features/notification';
import { RecordingHost } from '@/features/field-note/RecordingHost';
import { ProcessingHost } from '@/features/field-note/ProcessingHost';
import { FieldNoteFab } from '@/features/field-note/components/FieldNoteFab';
import { MainAppFieldNotePlatformProvider } from '@/features/field-note/platform/mainApp';
import { GlobalToastHost } from '@/features/toast';
import { LoadingScreen } from '@/shared/components/ui/LoadingScreen';
import { COLORS, MOTION } from '@/shared/constants/theme';

/**
 * 등장만 지연하고 사라짐은 즉시인 게이트.
 * - true(표시)로 바뀔 땐 `delayMs` 뒤에 반영 — 라우트 전환이 끝난 '도착 화면'에서 뜨도록.
 * - false(숨김)로 바뀔 땐 즉시 — 필드노트로 들어갈 때 FAB 가 새어 보이지 않게.
 */
function useDelayedAppear(active: boolean, delayMs: number): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const t = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(t);
  }, [active, delayMs]);
  return shown;
}

export default function MainLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authHydrated = useAuthStore((s) => s.isHydrated);
  const centerId = useCenterStore((s) => s.centerId);
  const centerHydrated = useCenterStore((s) => s.isHydrated);
  const fetchPermissions = usePermissionStore((s) => s.fetchPermissions);
  const permissionContext = usePermissionStore((s) => s.context);
  const permissionHydrated = usePermissionStore((s) => s.isHydrated);
  const initialNotificationHandled = useRef(false);

  // 필드노트 FAB 숨김 — FAB 는 필드노트로 '들어가는' 입구라, 필드노트 섹션 안에선 전부 숨긴다.
  // (홈·목록·상세·재개[/field-note/_quick]·링크 등 하위 라우트 모두 포함. 재개 화면엔
  //  이미 '이어서 녹음하기' CTA 가 있어 FAB 가 중복·충돌). + lab 시안 검토용 숨김.
  // 그 외 모든 화면(탭·상세)에선 항상 노출 — 전역 고정이라 페이지 전환에도 같은 자리에 유지.
  const hideFieldNoteFab =
    (pathname?.startsWith('/field-note') ?? false) ||
    (pathname?.startsWith('/lab') ?? false);

  // FAB 노출은 라우트 전환(slide, fast=150ms)이 끝난 뒤로 지연.
  // 그래야 필드노트 홈에서 뒤로 갈 때, 슬라이드-아웃 중인 홈 위에 FAB 가 먼저 튀어나오지 않고
  // 도착 화면에서 자연스럽게 등장한다. (숨김은 즉시 — 들어갈 땐 곧바로 사라짐.)
  const showFieldNoteFab = useDelayedAppear(!hideFieldNoteFab, MOTION.duration.fast + 80);

  // 푸시 알림: 권한 요청 + 토큰 등록 + 수신 리스너
  usePushNotifications(isAuthenticated ? centerId : null);

  useEffect(() => {
    if (isAuthenticated && centerId && permissionHydrated && !permissionContext) {
      fetchPermissions(centerId);
    }
  }, [isAuthenticated, centerId, permissionHydrated, permissionContext, fetchPermissions]);

  // 앱이 종료 상태에서 알림 탭으로 열렸을 때 초기 네비게이션
  useEffect(() => {
    if (!isAuthenticated || !centerId || initialNotificationHandled.current) return;
    initialNotificationHandled.current = true;

    getInitialNotification().then((data) => {
      if (data) {
        handleNotificationNavigation(data as Record<string, unknown>, router);
      }
    });
  }, [isAuthenticated, centerId, router]);

  if (!authHydrated || !centerHydrated) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!centerId) {
    return <Redirect href="/(auth)/center-select" />;
  }

  return (
    <MainAppFieldNotePlatformProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          // iOS: 네이티브 default 전환을 쓴다 — 스와이프-백 시 이전 화면이 드래그한 만큼
          //   parallax 로 따라 나온다(네이티브 interactive pop). 커스텀 JS 애니메이션
          //   (ios_from_right)을 animationMatchesGesture 로 제스처에 물리면, 드래그 중
          //   이전 화면이 합성되지 않고 씬 배경(회색 #F7F8F8)만 보이다가 전환이 완전히
          //   끝난 뒤에야 이전 화면이 렌더되는 문제가 있어 iOS 는 네이티브로 둔다.
          // Android: 네이티브 default 엔 parallax 가 없어 iOS식 ios_from_right 로 흉내낸다.
          //   (slide_from_right 는 새 화면만 덮어 parallax 없음)
          // 속도(Android): animationDuration prop 은 Android 에서 무시되므로 anim XML 을
          //   오버라이드하는 config plugin(plugins/withScreenTransitionDuration, 현재 250ms)
          //   으로 조절한다. 값 변경 시 prebuild + 재빌드 필요.
          animation: Platform.OS === 'ios' ? 'default' : 'ios_from_right',
          gestureEnabled: true,
          // 화면 어디서 스와이프해도 뒤로가기 (iOS18- 기본은 왼쪽 가장자리만이라 전체 폭으로 확장).
          // iOS 는 네이티브 default 전환이라 제스처도 네이티브 interactive pop 을 그대로 타,
          // animationMatchesGesture(커스텀 애니메이션을 제스처에 강제)는 쓰지 않는다 — 이게
          // 바로 드래그 중 회색 화면을 유발하던 설정이라 제거.
          fullScreenGestureEnabled: true,
          contentStyle: { backgroundColor: '#F7F8F8' },
        }}
      >
        {/* 필드노트 다크 화면 — 기본 scene 배경(#F7F8F8)을 다크로 덮는다. */}
        {['field-note/index', 'field-note/home', 'field-note/list', 'field-note/link'].map(
          (name) => (
            <Stack.Screen
              key={name}
              name={name}
              options={{ contentStyle: { backgroundColor: COLORS.fieldnoteDark.bg } }}
            />
          ),
        )}
        {/* 상세 — 일반 push 전환(slide/fade)은 안드로이드 window 배경(흰색)을 드러낸다
            (이전 화면이 detach 되어 그 아래 흰 레이어가 비침). transparentModal 은 이전
            화면(다크 홈/목록)을 mount 된 채로 두므로, 다크 상세가 슬라이드인하는 동안
            덜 덮인 영역에 흰색이 아니라 '이전 다크 화면'이 비쳐 부드럽게 전환된다.
            (contentStyle 로 컨테이너를 불투명하게 만들면 다시 detach→흰색 → 일부러 안 줌. 상세 콘텐츠 자체가 불투명 다크.) */}
        <Stack.Screen
          name="field-note/[scheduleId]"
          options={{
            presentation: 'transparentModal',
            animation: 'slide_from_right',
          }}
        />
      </Stack>
      <RecordingHost />
      {/* 백그라운드 분석 polling — ProcessingScreen 에서 뒤로 가도 polling 유지.
          완료/실패 감지 시 GlobalToastHost 로 알림 띄움. */}
      <ProcessingHost />

      {/* 필드노트 FAB — (main) 전역에서 항상 접근 가능, 우측 하단 고정.
          탭 화면은 바텀 내비 도킹 FAB이 입구라 평소 숨김(녹음 중에만 노출).
          필드노트/lab 경로에선 숨김. */}
      {showFieldNoteFab && <FieldNoteFab />}

      {/* 글로벌 토스트 — 최상위에 마운트하여 어떤 화면 위에도 노출 */}
      <GlobalToastHost />
    </MainAppFieldNotePlatformProvider>
  );
}
