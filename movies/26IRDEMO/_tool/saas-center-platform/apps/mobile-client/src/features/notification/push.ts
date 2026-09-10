/**
 * 푸시 토큰 등록/해제.
 *
 * 서버는 토큰 등록을 곧 동의로 본다 — 등록 시점에 전역 설정 행(channel_push=true)이
 * 생기므로, OS 권한을 거부하면 아예 등록하지 않는다.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { registerPushToken, unregisterPushToken } from './api';

/**
 * 서버에 올린 토큰을 디스크에 남긴다 — 메모리에만 두면 앱 재실행 뒤 로그아웃 시
 * 해제할 대상을 몰라 공용 기기에서 이전 계정이 계속 푸시를 받는다.
 */
const PUSH_TOKEN_KEY = 'registered_push_token';

export async function registerForPushNotifications(): Promise<string | null> {
  // 에뮬레이터·시뮬레이터는 푸시 토큰을 발급받지 못한다
  if (!Device.isDevice) return null;

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: '알림',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    await registerPushToken({
      token,
      platform: Platform.OS,
      device_info: Device.modelName ?? undefined,
    });
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    return token;
  } catch (error) {
    // 푸시가 없어도 앱은 동작해야 한다 — 다만 조용히 삼키면 설정 누락(플러그인·
    // projectId·google-services)이 드러나지 않으므로 반드시 남긴다.
    console.warn('[push] 토큰 등록 실패:', error);
    return null;
  }
}

export async function unregisterCurrentPushToken(): Promise<void> {
  const token = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  if (!token) return;
  try {
    await unregisterPushToken(token);
  } catch (error) {
    // 해제 실패로 로그아웃을 막지 않는다
    console.warn('[push] 토큰 해제 실패:', error);
  } finally {
    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  }
}
