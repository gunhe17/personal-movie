# MindScope Mobile 배포 가이드

## 버전 관리

- `version` (X.Y.Z): `app.config.ts`에서 **수동** 변경
- `buildNumber` / `versionCode`: EAS가 빌드마다 **자동** +1

| 변경 유형 | 버전 | 예시 |
|----------|------|------|
| 버그 수정 | Z +1 | 1.0.0 → 1.0.1 |
| 기능 추가 | Y +1 | 1.0.1 → 1.1.0 |
| 대규모 개편 | X +1 | 1.1.0 → 2.0.0 |

---

## 빌드 프로필

| 프로필 | 용도 | API 서버 |
|--------|------|----------|
| `preview` | TestFlight / Play 내부 테스트 | staging |
| `production` | App Store / Play Store | production |

---

## 배포 명령어

```bash
cd apps/mobile

# 테스트 배포
eas build -p all --profile preview           # iOS + Android 빌드
eas submit -p ios --profile preview           # iOS → TestFlight 자동 제출
# Android → 아래 "Android AAB 다운로드" 참고

# 프로덕션 배포
eas build -p all --profile production
eas submit -p ios --profile production        # iOS → App Store Connect
# Android → 아래 "Android AAB 다운로드" 참고

# JS만 변경 시 (스토어 빌드 없이 즉시 반영)
eas update --branch preview --message "설명"
```

---

## Android AAB 다운로드

빌드 완료 후 터미널에 AAB 다운로드 URL이 출력된다:

```
🤖 Android app:
https://expo.dev/artifacts/eas/xxxxx.aab
```

해당 URL을 브라우저에서 열면 `.aab` 파일이 다운로드된다.
다운로드한 AAB를 Google Play Console → 내부 테스트 (또는 프로덕션) → App Bundle 업로드에 드래그 앤 드롭한다.

URL을 놓쳤을 경우:

```bash
eas build:list -p android          # 최근 빌드 목록에서 확인
```

---

## OTA vs 스토어 빌드

| 변경 내용 | 방식 |
|----------|------|
| JS/TS 코드, 이미지 변경 | `eas update` (OTA) |
| 네이티브 모듈, SDK, app.config 변경 | `eas build` (스토어) |

---

## 민감 파일

`google-services.json` 등은 git에 올리지 않고 EAS 파일 환경 변수로 관리한다.

```bash
eas env:create --name GOOGLE_SERVICES_JSON --type file \
  --value ./google-services.json --visibility sensitive --environment production
```
