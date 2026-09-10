import { ExpoConfig, ConfigContext } from 'expo/config';

const IS_DEV = process.env.APP_VARIANT === 'development';

/**
 * 필드노트 다크 시스템 내비게이션 바(투명 + 버튼색) 기능 토글.
 *
 * - true  : 필드노트 진입 시 Android 시스템 내비 바가 투명해져 다크 배경이 비치고 버튼이 밝아짐.
 * - false : 원상복구(대비 스크림 ON = 기본 흰 바, 버튼색 전환 없음).
 *
 * 이 값 하나만 바꾸면 네이티브(플러그인) + 런타임(extra) 양쪽이 함께 따라간다.
 * ⚠️ 네이티브(투명) 적용/해제는 재빌드 필요: 값 변경 → `npx expo prebuild -p android` → `npx expo run:android`.
 *    (런타임 버튼색은 JS 리로드만으로 즉시 반영)
 */
const FIELD_NOTE_DARK_NAVBAR = true;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_DEV ? 'MindScope (Dev)' : 'MindScope',
  slug: 'mindscope',
  scheme: IS_DEV ? 'mindscope-dev' : 'mindscope',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#256ef4',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: IS_DEV ? 'kr.mindscope.app.dev' : 'kr.mindscope.app',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      UIBackgroundModes: ['remote-notification', 'audio'],
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
        NSAllowsLocalNetworking: true,
      },
    },
  },
  android: {
    package: IS_DEV ? 'kr.mindscope.app.dev' : 'kr.mindscope.app',
    adaptiveIcon: {
      backgroundColor: '#256ef4',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
  web: {
    bundler: 'metro',
    favicon: './assets/icon.png',
  },
  updates: {
    url: 'https://u.expo.dev/badaa64f-66b1-49ef-8775-c71b13c000b7',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-splash-screen',
    [
      'expo-notifications',
      {
        color: '#256ef4',
        sounds: [],
      },
    ],
    // edge-to-edge: 시스템 내비 바 대비 스크림 제거 → 화면 배경이 바 뒤로 비침 (필드노트 다크 몰입)
    // enabled=false 면 스크림을 다시 켜 원상복구. FIELD_NOTE_DARK_NAVBAR 단일 플래그로 제어.
    ['./plugins/withNavBarNoContrast', { enabled: FIELD_NOTE_DARK_NAVBAR }],
    // Android ios_from_right 화면 전환 속도(기본 200ms→300ms). animationDuration prop 은
    // Android 에서 무시되므로 anim XML 을 오버라이드. ease-out 곡선이라 거리는 앞에서 거의
    // 끝나 체감은 빠르고, 늘린 시간은 끝의 감속(부드러운 안착) 꼬리를 보이게 하는 데 쓰인다.
    // 값 변경 시 prebuild + 재빌드 필요.
    ['./plugins/withScreenTransitionDuration', { durationMs: 300 }],
  ],
  extra: {
    apiUrl: process.env.API_URL || undefined,
    // 런타임 버튼색 전환 토글 (useFieldNoteNavBar 에서 읽음)
    fieldNoteDarkNavBar: FIELD_NOTE_DARK_NAVBAR,
    eas: {
      projectId: 'badaa64f-66b1-49ef-8775-c71b13c000b7',
    },
  },
});
