# s06 회기 진행 — 필드노트 : 기억으로 쓰는 일지

장면이 약속한 것: `scenes9.html` §06 — 회기 중 관찰이 **치료사의 머릿속에만** 있다가 밤까지 버티던 것이,
앱에서 녹음을 켜면 **실시간으로 전사**되고 화자가 분리되고 요약이 만들어지는 것으로 바뀐다.
웹에서는 원본 전사 · 화자별 대화 · 요약을 **시간 축으로** 열람한다.

**배역: 회기 축.** 이하준 C00002 · 상담사 정상담. 앱 로그인도 같은 계정이다.

## 두 화면으로 나눈다

| | 무대 | 무엇 |
|---|---|---|
| 앞 | **전문가 앱**(시뮬레이터) | 필드노트 홈 — `오늘 기록할 일정 1건` · `최근 노트` · **`바로 녹음`** |
| 뒤 | 웹 | `/schedule/field-notes/[id]` — 원본 전사 · 화자별 대화 · 요약을 시간 축으로 |

**녹음 자체는 찍지 않는다.** 시뮬레이터에 마이크 입력이 없어 실시간 전사가 돌지 않는다.
앱에서는 **녹음을 켜기 직전까지**(필드노트 홈과 바로 녹음 버튼), 결과는 웹의 완료된 필드노트로 보여준다.
시드가 완료 상태의 필드노트 3건을 만들어 두므로 결과 화면은 진짜다.

## 전문가 앱 환경 (한 번만 세우면 된다)

빌드가 이미 끝나 시뮬레이터에 설치돼 있다. 다시 세울 일이 생기면 순서는 이렇다.

```bash
open -a Simulator && xcrun simctl boot F6685208-9C34-4057-AAAC-71D26601D555
cd apps/mobile && APP_VARIANT=development npx expo run:ios --device <UDID> --no-bundler   # 빌드만
# ↑ 마지막 '실행' 단계는 osascript 자동화 권한이 없어 실패한다. 빌드는 성공하므로 아래로 우회:
xcrun simctl install <UDID> ~/Library/Developer/Xcode/DerivedData/MindScopeDev-*/Build/Products/Debug-iphonesimulator/MindScopeDev.app
APP_VARIANT=development npx expo start --dev-client --port 8081     # Metro
xcrun simctl launch <UDID> kr.mindscope.app.dev "mindscope-dev://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

**조작은 idb**(SPEC). 설치가 까다로웠다 — 아래 함정 참조.

## 실측으로 확인한 화면

로그인(정상담) 후 홈 → `필드노트 홈 열기` → 필드노트 홈:

- `오늘 기록할 일정 **1건**이 있어요` · `오늘 일정 1` · `김영희 검사 펼치기`
- `최근 노트` — `필드노트, 30분, 2026년 09월 10일` 3건(시드)
- 하단 `홈` · **`바로 녹음`** · `노트`

## 함정 (실측)

- **`idb`는 `/usr/local/bin/idb_companion`을 고정 경로로 찾는다.** Apple Silicon의 `/opt/homebrew/bin`에 있으면 못 본다 →
  `idb_companion --udid <UDID> --grpc-port 10882`를 직접 띄우고 `idb connect localhost 10882`
- **`brew install idb-companion`이 신뢰 게이트에 막힌다** — `brew trust facebook/fb` 먼저
- **`idb ui tap`은 픽셀이 아니라 포인트다.** iPhone 17 Pro는 402×874pt(1206×2622px, ×3). 스크린샷 좌표를 3으로 나눈다
- **`idb ui text`가 마지막 몇 글자를 흘린다** — 입력 후 `describe-all`로 `AXValue`를 확인하고 모자라면 이어 친다.
  지우기(백스페이스)는 포커스가 풀려 잘 안 되므로 **앱을 재시작해 폼을 비우는 편이 빠르다**
- **개발 클라이언트가 두 번 막는다** — `'MindScope (Dev)'에서 열겠습니까?` 시스템 다이얼로그, 그리고 번들 로드 후 개발자 메뉴.
  둘 다 탭으로 넘긴다(`열기` · `Close`)

## 준비 단계 — `_scripts/s06-setup.sql`

**시드의 필드노트에는 전사가 없다.** `status=completed`인데 `field_note_entries` 0 · `field_note_audios` 0 ·
`refined_transcript` NULL이라 화면이 **"전사 데이터가 없어요."**다. 이 장면의 전부가 전사이므로 채운다.

웹이 읽는 우선순위는 `refined_transcript` > `audios[0].diarized_transcript` > 청크별 `transcript`
(`view-model.ts:140-166`)이고 형식은 `{speaker, text, start}` 배열(`:102-126`)이다.
이하준 회기(C00002)에 12 세그먼트를 넣었다 — 시드 요약("행동 활성화 계획 수립. 주 3회 운동 시작 합의.")과
앞뒤가 맞는 놀이치료 대화다.

```bash
docker exec -i saas-postgres psql -U imomtae -d imomtae < _scripts/s06-setup.sql
```

## 촬영

| | |
|---|---|
| 앱 조작 | `_scripts/s06-fieldnote-phone.mjs` — `capture-phone.mjs --script`(idb) |
| 웹 조작 | `_scripts/s06-fieldnote-web.mjs` |
| 웹 시작 | `/schedule/field-notes/<이하준 fieldNoteId>` |
| 전제 | `s06-setup.sql` · 앱은 정상담으로 로그인된 상태 |

웹 리허설 실측: **8단계 13.0초 · 서버 오류 0**. 화면 확인 — 화자(`상담사`/`내담자`)로 갈린 대화가
타임스탬프와 함께 뜬다(`하준아, 지난주에 …` / `음... 축구요.` / `일주일에 세 번, 공 차기부터`).

앱 파트는 리허설 러너(Playwright)로 돌릴 수 없다 — 라벨을 idb `describe-all`로 직접 확인했다:
`필드노트 홈 열기` · `오늘 기록할 일정 1건` · `최근 노트` 3건 · `바로 녹음`.
