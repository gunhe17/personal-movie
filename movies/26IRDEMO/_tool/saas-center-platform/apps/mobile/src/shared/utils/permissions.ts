import { Alert, Linking } from 'react-native';

/**
 * 마이크 권한 거부 시 표시할 알럿.
 * - canAskAgain=true: 단순 안내 (재시도하면 OS가 다시 묻거나 즉시 거부)
 * - canAskAgain=false: 설정 앱으로 이동 유도 (iOS는 첫 거부 후 항상 false)
 */
export function showMicPermissionDeniedAlert(canAskAgain: boolean) {
  if (canAskAgain) {
    Alert.alert(
      '마이크 권한이 필요합니다',
      '필드노트 녹음을 위해 마이크 권한을 허용해주세요.',
      [{ text: '확인', style: 'default' }],
    );
    return;
  }

  Alert.alert(
    '마이크 권한이 차단되었습니다',
    '설정에서 마이크 권한을 허용한 후 다시 시도해주세요.',
    [
      { text: '취소', style: 'cancel' },
      { text: '설정 열기', onPress: () => Linking.openSettings() },
    ],
  );
}
