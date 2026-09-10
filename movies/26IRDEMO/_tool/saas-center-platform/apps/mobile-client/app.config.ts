import { ExpoConfig, ConfigContext } from 'expo/config';

const IS_DEV = process.env.APP_VARIANT === 'development';

// NCP 신규 Maps 상품(Mobile Dynamic Map)의 Client ID — 패키지명에 바인딩되는 공개 키라 커밋 가능.
// 발급 전까지 빈 값: 지도가 인증 실패로 빈 화면이 된다(앱 크래시는 아님). 발급 후 교체 + prebuild + 재빌드 필요.
const NAVER_MAP_CLIENT_ID = 'u17n8mfzww';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? '마인드스코프 (Dev)' : '마인드스코프',
  slug: 'mindscope-client',
  scheme: IS_DEV ? 'mindscope-client-dev' : 'mindscope-client',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: false,
    bundleIdentifier: IS_DEV ? 'kr.mindscope.client.dev' : 'kr.mindscope.client',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // remote-notification: 백그라운드 푸시 수신 (전문가앱과 동일)
      UIBackgroundModes: ['remote-notification'],
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
        NSAllowsLocalNetworking: true,
      },
    },
  },
  android: {
    package: IS_DEV ? 'kr.mindscope.client.dev' : 'kr.mindscope.client',
    // FCM 자격증명 — 없으면 안드로이드 푸시 토큰 발급이 실패한다
    googleServicesFile: './google-services.json',
  },
  // edge-to-edge에서 시스템이 내비 바 뒤에 까는 대비 스크림을 끈다(기본 true).
  // 켜두면 라이트 배경 앱에선 흰 띠로 보이고, SystemNavBarScrim 틴트와 두 겹으로 쌓인다.
  // 스크림이 사라지면 아이콘 기본색이 흰색이라 barStyle로 어둡게 고정해야 한다.
  androidNavigationBar: {
    enforceContrast: false,
    barStyle: 'dark-content',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-splash-screen',
    [
      'expo-notifications',
      {
        // 안드로이드 알림 아이콘 틴트 — primary 액센트(blue[700])
        color: '#1A669E',
        sounds: [],
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: '아이 프로필 사진을 고르기 위해 사진 접근이 필요해요.',
        // 앨범에서 고르기만 쓴다 — 촬영은 시안에 없어 카메라 권한을 넣지 않는다
        cameraPermission: false,
      },
    ],
    [
      '@mj-studio/react-native-naver-map',
      {
        client_id: NAVER_MAP_CLIENT_ID,
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          // 네이버 지도 SDK(com.naver.maps:map-sdk)는 Maven Central에 없다 — 전용 저장소 필수
          extraMavenRepos: ['https://repository.map.naver.com/archive/maven'],
        },
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: '주변 상담·검사 센터를 찾기 위해 위치를 사용해요.',
      },
    ],
  ],
  extra: {
    apiUrl: process.env.API_URL || undefined,
    // 푸시 토큰 발급에 필요 — Expo가 대신 FCM/APNs를 호출한다. 전문가앱과 별개 projectId.
    eas: {
      projectId: 'cfaeebe1-ffd9-412d-a3e2-d728874da4d9',
    },
  },
});
