---
name: phone-stage
description: 전문가 앱(apps/mobile)을 iOS 시뮬레이터에 세우고 촬영할 화면까지 데려간다. 빌드·설치·로그인 상태 주입·딥링크 이동·상태 점검. "앱이 시뮬레이터에 없다", "폰 화면 준비", "앱 세워줘", "필드노트 홈까지 띄워줘", "시뮬레이터 상태 봐줘" 요청에 쓴다. 캡처는 하지 않는다 — 촬영은 capture-service의 capture-phone.mjs다.
---

# phone-stage — 폰 무대 세우기

**무대까지가 이 스킬이다.** 시뮬레이터를 켜고, 앱을 설치하고, 로그인 상태를 심고, 딥링크로 화면까지 데려간다.
**그 다음 프레임 한 장도 이 스킬이 만들지 않는다** — 촬영은 `capture-service`의 `capture-phone.mjs`가 한다
(규칙 1·6, `.claude/rules/capture.md`). 이 스킬 안에 `sckcap`·`simctl io`·`screencapture`·`page.screenshot`은 없다.

러너 하나: `scripts/stage.mjs`.

```bash
cd .claude/skills/phone-stage/scripts

node stage.mjs status                      # 무엇이 준비됐고 무엇이 빠졌나 (+ 다음에 칠 명령)
node stage.mjs sim                         # 부팅 + SPEC 설정(베젤 off · 터치 표시 on · Point Accurate) 강제
node stage.mjs build                       # ios/ 없으면 prebuild → xcodebuild (Release · 시뮬레이터)
node stage.mjs install                     # simctl install
CAP_PASSWORD=… node stage.mjs login        # API 로그인 → AsyncStorage 주입 → 실행 → 실제로 로그인됐는지 검증
# 시드 비밀번호는 _state/accounts.json의 최상위 `password` 하나다 (계정별이 아니다). 값을 찍지 말고 그대로 넘겨라:
#   export CAP_PASSWORD=$(python3 -c "import json;print(json.load(open('$DEMO/_state/accounts.json'))['password'])")
node stage.mjs goto /field-note/list          # --route 로 줘도 된다
CAP_PASSWORD=… node stage.mjs up           # sim → install → login → goto (한 번에)
node stage.mjs selftest                    # 시뮬레이터 없이 도는 자체 검사
```

옵션: `--udid <UDID|booted>` · `--account <_state/accounts.json 키, 기본 counselor1>` · `--center <코드|이름>` · `--route <경로>` · `--api <URL, 기본 http://localhost:3502>`

## 무대의 정의 (앱 상수 — 코드에서 확인한 것)

| | 값 | 근거 |
|---|---|---|
| 번들 | `kr.mindscope.app.dev` | `app.config.ts` `ios.bundleIdentifier`, `IS_DEV = APP_VARIANT === 'development'` |
| 스킴 | `mindscope-dev` | 같은 파일 `scheme` |
| Xcode 스킴·워크스페이스 | `MindScopeDev` / `MindScopeDev.xcworkspace` | prebuild 산출물 |
| 기기 | `iPhone 17 Pro` · 베젤 off · 터치 표시 on · Point Accurate(스케일 1.0) | **capture-service `SPEC_PHONE`이 정본** — 여기서는 검사·강제만 한다 |
| 필드노트 라우트 | `/field-note/home` · `/field-note/list` · `/field-note/<scheduleId>` · `/field-note/link` | `app/(main)/field-note/*.tsx` (expo-router) |

## 왜 이렇게 하나

### 1. 조작을 idb에 걸지 않는다

이 기계에 `idb`가 없다. 대신 둘로 간다.

- **이동은 딥링크로.** `xcrun simctl openurl booted 'mindscope-dev:///field-note/home'` — expo-router가 라우트를 그대로 연다. 탭 없이 정확한 화면에 도달하고, 매번 같은 자리에서 시작한다.
- **로그인은 상태 주입으로.** 웹의 `login.mjs`가 storageState를 만드는 것과 같은 일을 앱에서 한다.

`idb`가 깔려 있으면 탭·스와이프·입력은 `capture-phone.mjs`의 `--script`가 쓴다. 이 스킬은 idb를 요구하지 않는다.

### 2. 로그인 상태를 어떻게 심나

인증은 AsyncStorage에 붙어 있다 (`src/shared/utils/storage.ts` → `TokenStorage`).
`useAuthStore.hydrate()`가 `access_token`을 읽어 `/auth/me`로 복원하고, `centerId`는 별도 persist 스토어(`center-store`)에 있다.
**둘 다 없으면 앱은 로그인 화면 또는 센터 선택 화면에 갇힌다** (`app/index.tsx` · `app/(main)/_layout.tsx`의 두 `Redirect`).

`stage.mjs login`이 하는 일:

1. `POST {api}/api/v1/auth/login` — 이메일은 `_state/accounts.json`의 계정, **비밀번호는 `CAP_PASSWORD` 환경변수로만**
2. 앱이 떠 있으면 `simctl terminate` — AsyncStorage는 메모리 캐시를 들고 있어 살아 있는 앱은 파일 수정을 안 읽는다
3. `simctl get_app_container … data` → `Library/Application Support/kr.mindscope.app.dev/RCTAsyncLocalStorage_V1/manifest.json`
4. 그 JSON에 `access_token` · `refresh_token` · `center-store`(zustand persist 형식 `{state:{centerId,centerName,roleCode},version:0}`)를 **합쳐 쓴다**
5. 실행하고, `permission-store`의 `state.context`가 채워질 때까지 20초 기다린다

**5가 검증이다.** 그 값은 `centerId`가 있고 토큰이 살아 있어야만 오는 인증 API 응답이다
(`permission-store.ts` `fetchPermissions` → `GET /centers/{id}/me/permissions`). 화면을 안 찍고 로그인 성공을 확인하는 방법이 이것이다.

> AsyncStorage의 iOS 저장 형식은 `RNCAsyncStorage.mm`에서 확인했다 — `Application Support/<bundleID>/RCTAsyncLocalStorage_V1/manifest.json`,
> **1024자 이하 값은 manifest에 인라인**, 넘으면 `md5(key)` 파일로 나가고 manifest에는 `null`이 남는다(`RCTInlineValueThreshold`).
> 시드 토큰은 348·43자라 전부 인라인이다. 넘으면 러너가 **조용히 넘어가지 않고 멈춘다**(파일 쓰기는 아직 구현 안 했다).

### 3. pnpm이 babel을 못 찾는다 (`build`가 먼저 메운다)

이 워크스페이스의 `apps/mobile/node_modules`에는 `babel-preset-expo`도, 그 프리셋이 **문자열로 부르는** `@babel/*` 플러그인도 없다.
pnpm은 직접 의존만 링크하는데 `babel.config.js`가 쓰는 것들은 전부 전이 의존이고, Babel은 플러그인 이름을 **프로젝트 루트 기준**으로 resolve한다.
그래서 JS 번들 단계가 두 번 연달아 죽는다 (실측):

```
error: expo-router/entry.js: Cannot find module 'babel-preset-expo'
error: expo-router/entry.js: Cannot find module '@babel/plugin-transform-react-jsx'
```

**Release만의 문제가 아니다** — Metro(Debug)도 같은 babel 설정을 타므로 같은 데서 죽는다.
`stage.mjs build`가 시작할 때 이미 pnpm 스토어에 있는 것을 `apps/mobile/node_modules`로 **심링크**한다
(`babel-preset-expo` 하나 + 숨은 스토어의 `@babel` 스코프 통째로). 제품의 `package.json`·락파일은 건드리지 않는다 — `node_modules`는 생성물이다.
근본 해결은 워크스페이스 `.npmrc`의 `node-linker=hoisted`지만 그건 제품 전체를 다시 설치시킨다.

### 4. 왜 `expo run:ios`가 아니라 `xcodebuild`인가

`expo run:ios`는 마지막 '실행' 단계에서 **osascript 자동화 권한**을 요구하고 거기서 죽는다(STATUS.md 함정).
빌드는 `xcodebuild`로 직접 하고 `simctl install` + `simctl launch`로 우회한다.

### 5. 왜 Debug가 아니라 Release인가

Debug 빌드는 Metro(8081)를 붙들고 살고, 개발 클라이언트가 **시스템 다이얼로그(`열기`)와 개발자 메뉴로 두 번 막는다**(s06 features.md 함정).
Release는 JS 번들이 앱 안에 박혀 **Metro 없이 혼자 서고**, 촬영을 가리는 것이 하나도 안 뜬다.
`__DEV__`가 꺼지면 API 주소가 운영으로 가므로 빌드 환경에 **`API_URL=http://localhost:3502`를 박는다**
(`app.config.ts` `extra.apiUrl` → `src/shared/api/client.ts` `API_BASE_URL`). 러너가 자동으로 넣는다.

Debug가 필요하면 `stage.mjs`의 `APP.config`를 `Debug`로 바꾸고 `npx expo start --dev-client`를 따로 띄운다. `status`가 Metro 여부를 같이 찍어 준다.

## s06에서 쓰는 순서

```bash
# ① 데이터 — s06 notes.md의 선행 의존(reset-seed → s01 리허설 → s06-setup.sql)이 먼저다
# ② 무대
cd .claude/skills/phone-stage/scripts
CAP_PASSWORD=… node stage.mjs up --account counselor1 --route /field-note/home
node stage.mjs status                    # 전부 ✅인지 확인
# ③ 촬영 — 여기서부터는 capture-service다
cd ../../capture-service/scripts
node capture-phone.mjs --scene s06-필드노트 --action fieldnote-app --udid booted \
  --app kr.mindscope.app.dev --seed _seed/saas-2026-09-10d.json --manual --seconds 25
```

`--manual`은 idb가 없을 때의 경로다(규칙 6). 딥링크로 화면까지는 이 스킬이 데려다 놓으므로,
사람이 할 일은 그 화면에서의 탭 몇 번뿐이다. `stage.mjs goto`로 화면을 바꿔 가며 **여러 컷을 나눠 찍는 쪽**이
한 테이크 안에서 손으로 헤매는 것보다 결정적이다.

## 실측 (2026-09-10)

| | |
|---|---|
| `expo prebuild -p ios` (pod install 포함) | 약 2분 |
| `xcodebuild` 첫 빌드 (Pods 105개 전부) | 약 12분 |
| 이후 증분 빌드 (JS 번들만) | 1~2분 |
| `install` → `login` → `goto` | 15초 안쪽 |

**확인한 것** — 빌드 `** BUILD SUCCEEDED **` · `simctl install` · 토큰·센터 주입 후 앱이 실제로 인증됐다(`권한 32개 · 역할 COUNSELOR`,
정상담 계정) · `Release` 빌드가 **Metro 없이** `http://localhost:3502`를 부른다(`EXConstants.bundle/app.config`의 `extra.apiUrl`로 확인) ·
`mindscope-dev:///field-note/home`·`/field-note/list` 딥링크가 스킴 등록을 타고 앱을 깨우며 **앱이 죽지 않는다** · `status`가 전부 ✅.

### 딥링크가 실제로 서는 화면 (2026-09-10 저녁 · 프레임을 눈으로 확인함)

앞서 "확인 못 한 것"으로 남겨 뒀던 항목이다. 라우트마다 보정 프레임을 뽑아 **직접 봤다.**

| 라우트 | 실제 화면 | 지금 내용 |
|---|---|---|
| `/field-note/home` | 필드노트 홈 | `오늘은 예정된 일정이 없어요` + `최근 노트` 카드 4장 · 하단 탭바 |
| `/field-note/list` | **회기 미지정 필드노트** (칩: 전체·분석완료·분석중·녹음만·실패) | **총 0개** — 비어 있다 |
| `/field-note/link` | **회기 연결** (요일 선택) | 09-10(목) 선택 · `해당 날짜에 상담/검사 일정이 없습니다` |
| `/field-note/<아무 문자열>` | **녹음 화면** (`녹음을 시작하세요` · `녹음 시작`) | 오타도 여기로 샌다 — 아래 함정 |

프레임 뽑는 법 (capture-service의 유일한 스틸 예외. `--out`으로 기존 보정본을 안 덮는다):

```bash
cd ../../capture-service/scripts
node capture-phone.mjs --scene s06-필드노트 --action probe --udid booted --dry --calibrate \
  --url 'mindscope-dev:///field-note/list' --out /tmp/list.png
```

`--seed` 대신 `--dry`를 쓴다 — 무대 점검이지 촬영이 아니다(규칙 7의 `--dry` 용도).

**아직 확인 못 한 것** — s06 앱 절반의 조작 라벨(`바로 녹음` 등)은 화면 안 버튼이라 `idb` 없이는 못 누른다.

## 알려진 한계

- **로그인 상태는 파일로 판단하면 안 된다 — API에 물어야 한다.** `access_token`은 30분이면 만료된다(`ACCESS_TOKEN_EXPIRE_MINUTES=30` · saas도 마인드봄과 같다). 파일만 보는 검사는 **양쪽으로 틀린다**:
  - **죽은 토큰을 통과시킨다** — 만료돼도 앱이 401을 받기 전까지 파일에 그대로 있고, `permission-store`도 지난 성공의 잔상이라 같이 참으로 보인다. 실측으로 이 조합을 봤다(`/auth/me → 401`인데 `권한 받아옴`).
  - **살릴 수 있는 토큰을 죽었다고 한다** — 앱은 실행/하이드레이트 때 `refresh_token`으로 **스스로 갱신한다**. 만료된 채로 앱을 띄우면 잠시 뒤 새 토큰이 파일에 써진다. 실측: `status`가 401이던 것이 `goto` 시점엔 200이었고, 다시 부른 `status`도 200이었다.
  - 갱신까지 실패하면 그때 앱이 토큰을 **지우고** 로그인 화면으로 간다. 프로세스는 살아 있어 `pgrep`으로는 멀쩡해 보인다.

  그래서 `status`와 `goto`는 저장된 토큰으로 **`GET /auth/me`를 직접 부른다**(`authOk`). 200이 아니면 `goto`는 종료 코드 1로 죽는다. 판단 시점이 중요하다 — 앱이 갓 떴으면 갱신을 기다렸다가 봐야 한다.

  > 이 함정은 s02를 찍던 세션이 알려줬다. 마인드봄 쪽에서는 증상이 **401이 아니라 30초 타임아웃**으로 왔다고 한다 — 화면은 열리는데 버튼이 영영 안 뜬다. **쿠키 만료 시각은 다음날까지 유효해 보이니 그걸로 판단하지 마라.** `authOk`가 타임아웃도 실패로 센다.
- **오타 라우트는 404가 아니다.** `[scheduleId].tsx`가 무엇이든 받아 **녹음 화면**에 세운다. `goto`가 정적 라우트 파일과 대조해 경고하지만 **막지는 않는다**(진짜 scheduleId도 동적이라서). 경고가 뜨면 철자를 다시 봐라.
- **`idb`가 없으면 탭·스와이프·입력을 못 한다.** 딥링크는 화면까지만 데려간다 — 화면 안의 버튼(`바로 녹음` 등)은 사람이 누른다(`capture-phone.mjs --manual`).
- **AsyncStorage 값이 1024자를 넘으면 주입이 멈춘다.** 지금 시드 토큰은 348·43자라 문제가 없다. 토큰이 길어지면 `md5(key)` 파일 쓰기를 더해야 한다.
- **딥링크는 앱이 이미 로그인된 상태를 전제한다.** 로그인 전에 열면 `app/index.tsx`의 `Redirect`가 로그인 화면으로 보낸다 — `login`을 먼저.
- **`node_modules`에 심링크를 남긴다** — `babel-preset-expo` · `@babel`. 제품 저장소에서 `pnpm install`을 다시 돌리면 사라질 수 있다. `build`가 매번 확인해서 없으면 다시 잇는다.
- **`ios/`는 생성물이다**(`.gitignore`의 `/ios`). 제품 코드가 바뀌면 `build`가 다시 굽는다. `app.config.ts`의 플러그인 설정을 바꿨으면 `ios/`를 지우고 다시 `build`.
- **시뮬레이터에 마이크 입력이 없다** — 필드노트 실시간 전사는 여기서 돌지 않는다(s06 features.md). 녹음 자체는 찍지 않는다는 장면 결정과 같은 이유다.

## 하지 않는 것

- **캡처하지 않는다.** `sckcap` · `simctl io … recordVideo` · `screencapture` · 스크린샷 전부. 촬영은 `capture-service`.
- **SPEC을 바꾸지 않는다.** 뷰포트·fps·타이밍·시뮬레이터 설정값의 정본은 `capture-service`의 `SPEC_PHONE`이다. 여기서는 어긋난 것을 맞출 뿐이다.
- **제품 코드를 고치지 않는다** (`apps/mobile/src`·`app/`·`package.json`·락파일). 생성물만 예외 — `ios/`와 `node_modules`의 babel 심링크.
- **자격증명을 파일에 쓰지 않는다.** `CAP_PASSWORD`·`CAP_EMAIL` 환경변수로만 받고, 토큰 값은 로그에도 남기지 않는다.
- **`raw/`를 건드리지 않는다.**
