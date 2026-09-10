/**
 * 푸시 표시·탭 처리.
 *
 * setNotificationHandler가 없으면 앱이 떠 있는 동안 온 푸시는 아예 표시되지 않는다.
 * 탭 리스너가 없으면 서버가 실어 보내는 data.link/type이 그대로 사장된다.
 */
import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** 서버 data.link가 앱 라우트면 그리로, 아니면 알림함으로 */
function resolveRoute(data: Record<string, unknown> | undefined): string {
  const link = typeof data?.link === 'string' ? data.link : null;
  return link && link.startsWith('/') ? link : '/(main)/notifications';
}

export function useNotificationResponder() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener(() => {
      // 푸시가 왔다는 건 서버에 인앱 알림도 생겼다는 뜻 — 배지·목록을 맞춘다
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    const responded = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as
          | Record<string, unknown>
          | undefined;
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        router.push(resolveRoute(data) as never);
      },
    );

    return () => {
      received.remove();
      responded.remove();
    };
  }, [router, queryClient]);
}
