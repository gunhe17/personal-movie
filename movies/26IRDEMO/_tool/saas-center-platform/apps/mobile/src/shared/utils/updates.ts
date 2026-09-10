import { Alert } from 'react-native';

/**
 * OTA 업데이트 확인 및 적용.
 * - development 빌드에서는 무시 (expo-updates 네이티브 모듈 없음)
 * - expo-updates를 동적 import하여 dev client에서 크래시 방지
 */
export async function checkForUpdate(silent = true): Promise<void> {
  if (__DEV__) {
    if (!silent) {
      Alert.alert('개발 모드', '개발 모드에서는 OTA 업데이트를 확인할 수 없습니다.');
    }
    return;
  }

  try {
    const Updates = await import('expo-updates');

    const update = await Updates.checkForUpdateAsync();

    if (!update.isAvailable) {
      if (!silent) {
        Alert.alert('최신 버전', '현재 최신 버전을 사용 중입니다.');
      }
      return;
    }

    const result = await Updates.fetchUpdateAsync();

    if (result.isNew) {
      Alert.alert(
        '업데이트 안내',
        '새로운 업데이트가 있습니다. 앱을 재시작하시겠습니까?',
        [
          { text: '나중에', style: 'cancel' },
          {
            text: '재시작',
            onPress: () => Updates.reloadAsync(),
          },
        ],
      );
    }
  } catch (error) {
    if (!silent) {
      Alert.alert('오류', '업데이트 확인 중 오류가 발생했습니다.');
    }
    console.error('[Updates] 업데이트 확인 실패:', error);
  }
}
