# MindScope 모바일 앱 실행 가이드

## 사전 준비

### 필수 도구 설치

```bash
# 1. EAS CLI (Expo Application Services)
npm install -g eas-cli

# 2. Expo 계정 로그인
eas login

# 3. 프로젝트 의존성 설치
cd apps/mobile
pnpm install
```

### Firebase 설정 파일 (.gitignore 대상, 수동 배치 필요)

| 플랫폼  | 파일                      | 위치                    | 발급처                  |
| ------- | ------------------------- | ----------------------- | ----------------------- |
| Android | `google-services.json`    | `apps/mobile/`          | Firebase Console        |
| iOS     | `GoogleService-Info.plist` | `apps/mobile/`          | Firebase Console        |

> Firebase Console → 프로젝트 설정 → 앱 추가 → 각 플랫폼 설정 파일 다운로드

---

## iOS 실행

### 1단계: Dev Client 빌드 (최초 1회 또는 네이티브 모듈 변경 시)

```bash
cd apps/mobile

# 실제 디바이스용 빌드 (Apple Developer 계정 필요)
eas build --profile development --platform ios

# 시뮬레이터용 빌드 (푸시 알림 불가)
eas build --profile development-simulator --platform ios
```

**빌드 완료 후 설치:**
- **실제 디바이스**: EAS 대시보드에서 QR 코드 스캔 또는 링크로 설치
- **시뮬레이터**: 빌드 결과물(.app) 다운로드 후 시뮬레이터에 드래그&드롭

### 2단계: 개발 서버 시작

```bash
# 같은 네트워크에 있을 때 (사무실 등)
cd apps/mobile
pnpm start              # expo start --dev-client

# 다른 네트워크일 때 (재택, 외부 등)
pnpm dev:mobile          # expo start --dev-client --tunnel
```

### 3단계: 앱 실행

1. 디바이스/시뮬레이터에서 **MindScope** 앱 실행
2. 개발 서버 URL이 자동 감지됨 (또는 수동 입력)
3. JS 번들 로딩 후 앱 시작

### iOS 참고사항

- **푸시 알림**: 실제 디바이스에서만 동작 (시뮬레이터 불가)
- **Apple Developer**: 유료 계정 필요 ($99/년)
- **Provisioning**: EAS가 자동 처리 (Managed Credentials)
- **TestFlight 배포**: `eas build --profile preview --platform ios` 후 `eas submit`

---

## Android 실행

### 1단계: Dev Client 빌드 (최초 1회 또는 네이티브 모듈 변경 시)

```bash
cd apps/mobile

# Android 빌드 (에뮬레이터 + 실제 디바이스 모두 사용 가능)
eas build --profile development --platform android
```

**빌드 완료 후 설치:**
- **실제 디바이스**: EAS 대시보드에서 QR 코드 스캔 → APK 설치
- **에뮬레이터**: APK 다운로드 후 에뮬레이터에 드래그&드롭

### 2단계: 개발 서버 시작

```bash
cd apps/mobile
pnpm start              # 같은 네트워크
# 또는
pnpm dev:mobile          # 다른 네트워크 (tunnel)
```

### 3단계: 앱 실행

1. 디바이스/에뮬레이터에서 **MindScope** 앱 실행
2. 개발 서버 연결
3. JS 번들 로딩 후 앱 시작

### Android 참고사항

- **푸시 알림**: 에뮬레이터에서도 동작 (Google Play Services 포함 이미지 필요)
- **google-services.json**: 빌드 시 `apps/mobile/` 루트에 있어야 함
- **APK vs AAB**: 개발 빌드는 APK, 프로덕션은 AAB (Play Store용)

---

## 빌드 프로필

| 프로필                    | 용도             | API 서버                              |
| ------------------------- | ---------------- | ------------------------------------- |
| `development`             | 개발 (실제 기기) | `https://dev-api.mindscope.kr/api/v1` |
| `development-simulator`   | iOS 시뮬레이터   | `https://dev-api.mindscope.kr/api/v1` |
| `preview`                 | 내부 테스트      | `https://dev-api.mindscope.kr/api/v1` |
| `production`              | 스토어 배포      | `https://api.mindscope.kr/api/v1`     |

---

## 자주 쓰는 명령어

```bash
# 개발 서버 (캐시 초기화)
npx expo start --dev-client --clear

# 빌드 상태 확인
eas build:list

# 프로덕션 빌드
eas build --profile production --platform all

# 스토어 제출
eas submit --platform ios
eas submit --platform android

# OTA 업데이트 (JS만 변경 시, 네이티브 코드 변경 없을 때)
eas update --branch production --message "설명"
```

---

## 트러블슈팅

### Metro 번들러 오류
```bash
npx expo start --dev-client --clear    # 캐시 초기화
rm -rf node_modules && pnpm install    # 의존성 재설치
```

### 앱이 개발 서버를 찾지 못할 때
```bash
pnpm dev:mobile    # --tunnel 모드 사용 (ngrok 경유)
```

### 푸시 알림이 오지 않을 때
1. 실제 디바이스인지 확인 (시뮬레이터 불가)
2. 알림 권한이 허용되었는지 확인 (설정 → MindScope → 알림)
3. Firebase 설정 파일 존재 여부 확인
4. 서버 로그에서 토큰 등록/발송 상태 확인

### iOS 빌드 실패
- Xcode 최신 버전 확인
- Apple Developer 계정 연결 확인: `eas credentials`
- Provisioning Profile 재생성: `eas credentials --platform ios`
