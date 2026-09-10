import { useEffect } from 'react';
import { Platform, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { registerPushToken, unregisterPushToken } from './api';

/**
 * Expo Go 감지
 *
 * SDK 53부터 Expo Go에서 원격 푸시(remote push) 기능이 제거되어
 * getDevicePushTokenAsync / getExpoPushTokenAsync / addPushTokenListener 호출이 실패함.
 * 실제 푸시 테스트는 development build로 실행해야 함.
 */
const isExpoGo = Constants.executionEnvironment === 'storeClient';

// 포그라운드 알림 동작 설정: 배너 + 목록 + 소리 + 배지 표시
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * 푸시 토큰 가져오기
 *
 * - Android: FCM 네이티브 토큰 (google-services.json 기반, 서버에서 FCM 직접 발송)
 * - iOS: Expo Push Token (서버에서 Expo Push API 경유 → APNs 발송)
 *
 * iOS에서 getDevicePushTokenAsync()는 APNs 토큰을 반환하는데,
 * FCM Admin SDK는 FCM 등록 토큰만 수용하므로 APNs 토큰 직접 사용 불가.
 * Expo Push Token을 사용하면 Expo 서버가 APNs 변환을 처리함.
 */
async function getPushToken(): Promise<string | null> {
  if (isExpoGo) {
    console.warn(
      '[Push] Expo Go에서는 원격 푸시를 사용할 수 없습니다. development build로 실행하세요.'
    );
    return null;
  }

  if (!Device.isDevice) {
    console.warn('[Push] 시뮬레이터에서는 푸시 알림을 사용할 수 없습니다.');
    return null;
  }

  // Android: 알림 채널 설정 + FCM 네이티브 토큰 사용
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '기본 알림',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#256ef4',
    });

    const tokenData = await Notifications.getDevicePushTokenAsync();
    return tokenData.data as string;
  }

  // iOS: Expo Push Token 사용
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.error('[Push] EAS projectId가 설정되지 않았습니다.');
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenData.data;
}

/**
 * 알림 권한 요청
 * @returns true: 허용, false: 거부
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (isExpoGo) return false;
  if (!Device.isDevice) return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * 푸시 토큰 등록 (권한 요청 → 토큰 획득 → 서버 전송)
 */
export async function registerForPushNotifications(centerId: string): Promise<string | null> {
  const granted = await requestNotificationPermission();
  if (!granted) return null;

  const token = await getPushToken();
  if (!token) return null;

  try {
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    const deviceInfo = `${Device.manufacturer ?? ''} ${Device.modelName ?? ''} (${Platform.OS} ${Platform.Version})`.trim();
    await registerPushToken(centerId, token, platform, deviceInfo);
  } catch (error: any) {
    console.error('[Push] 토큰 등록 실패:', error?.message);
  }

  return token;
}

/**
 * 푸시 토큰 해제
 */
export async function unregisterPushNotifications(centerId: string, token: string): Promise<void> {
  try {
    await unregisterPushToken(centerId, token);
  } catch (error) {
    console.error('[Push] 토큰 해제 실패:', error);
  }
}

/**
 * 현재 디바이스의 푸시 토큰을 서버에서 해제 (로그아웃 시 사용)
 */
export async function unregisterCurrentDevice(centerId: string): Promise<void> {
  try {
    const token = await getPushToken();
    if (token) {
      await unregisterPushToken(centerId, token);
    }
  } catch (error) {
    console.error('[Push] 현재 디바이스 토큰 해제 실패:', error);
  }
}

/**
 * 푸시 알림 전역 훅
 * - 앱 시작 시 권한 요청 + 토큰 등록
 * - 포그라운드 알림 수신 → 알림 목록 새로고침
 * - 알림 탭 → 딥링크 네비게이션
 */
export function usePushNotifications(centerId: string | null) {
  const router = useRouter();
  const queryClient = useQueryClient();

  // 토큰 등록
  useEffect(() => {
    if (!centerId) return;
    if (isExpoGo) return;

    registerForPushNotifications(centerId);
  }, [centerId]);

  // 토큰 갱신 감지 (OS에 의해 토큰이 변경될 때 자동 재등록)
  useEffect(() => {
    if (!centerId) return;
    if (isExpoGo) return;

    const subscription = Notifications.addPushTokenListener(({ data: newToken }) => {
      const token = typeof newToken === 'string' ? newToken : (newToken as any)?.data;
      if (token) {
        const platform = Platform.OS === 'ios' ? 'ios' : 'android';
        const deviceInfo = `${Device.manufacturer ?? ''} ${Device.modelName ?? ''} (${Platform.OS} ${Platform.Version})`.trim();
        registerPushToken(centerId, token, platform, deviceInfo).catch((err) => {
          console.error('[Push] 토큰 갱신 등록 실패:', err);
        });
      }
    });

    return () => subscription.remove();
  }, [centerId]);

  // 포그라운드 알림 수신 리스너
  useEffect(() => {
    if (!centerId) return;

    const subscription = Notifications.addNotificationReceivedListener(() => {
      // 알림 수신 시 목록 + 미읽음 카운트 새로고침
      queryClient.invalidateQueries({ queryKey: ['notificationList', centerId] });
      queryClient.invalidateQueries({ queryKey: ['notificationUnreadCount', centerId] });
    });

    return () => subscription.remove();
  }, [centerId, queryClient]);

  // 알림 탭 (사용자가 알림을 눌렀을 때) 리스너
  useEffect(() => {
    if (!centerId) return;

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      handleNotificationNavigation(data, router);
    });

    return () => subscription.remove();
  }, [centerId, router]);

  // 앱이 백그라운드에서 포그라운드로 올 때 새로고침
  useEffect(() => {
    if (!centerId) return;

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        queryClient.invalidateQueries({ queryKey: ['notificationUnreadCount', centerId] });
      }
    });

    return () => subscription.remove();
  }, [centerId, queryClient]);
}

/**
 * 알림 데이터 기반 딥링크 네비게이션
 *
 * 서버 data 구조:
 *   type: "assessment" | "counseling" | "schedule" | "client" | "system"
 *   case_id?: string (검사/상담 케이스 ID)
 *   case_code?: string
 *   session_id?: string
 *   client_id?: string
 *   schedule_id?: string
 */
export function handleNotificationNavigation(
  data: Record<string, unknown> | undefined | null,
  router: ReturnType<typeof useRouter>,
) {
  if (!data) {
    router.push('/(main)/notifications');
    return;
  }

  const { type, schedule_id, case_id, client_id } = data as Record<string, string>;

  switch (type) {
    case 'assessment':
      // 검사 관련 알림 → 검사 현황 화면
      router.push('/(main)/assessment');
      break;
    case 'counseling':
      // 상담 관련 알림 → 상담 현황 화면
      router.push('/(main)/counseling');
      break;
    case 'schedule':
      if (schedule_id) {
        router.push(`/(main)/schedule/${schedule_id}`);
      } else {
        router.push('/(main)/(tabs)/schedule');
      }
      break;
    case 'client':
      if (client_id) {
        router.push(`/(main)/client/${client_id}`);
      } else {
        router.push('/(main)/(tabs)/clients');
      }
      break;
    default:
      router.push('/(main)/notifications');
      break;
  }
}

/**
 * 앱이 종료 상태에서 알림 탭으로 열렸을 때 초기 알림 확인
 */
export async function getInitialNotification() {
  const response = await Notifications.getLastNotificationResponseAsync();
  return response?.notification.request.content.data ?? null;
}
