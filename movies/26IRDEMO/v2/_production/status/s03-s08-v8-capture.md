DONE — S3~S8 웹 8컷 SPEC v8 재촬영. 폰 4컷(C3.6 · C4.3 · C5.6 · C7.4)은 기존 촬영본 유지(v8은 웹 헬퍼만 바꾼다). 목업은 다음 단계.

# s03-s08-v8-capture — 2026-09-14 12:00~

시드 `reset-seed.sh`(counselor1 · admin) → `_seed/saas-2026-09-14c.json`(sha256 `be9b9e983301`). 리허설 8/8 exit 0(헤드리스). 사람이 보는 브라우저 시뮬레이션은 하지 않았다 — 촬영본 프레임 4장씩으로 검토했다.

## 촬영본

| 컷 | 촬영본 | 길이 | 충실도 | 노컷 | 스크립트 · 준비 |
|---|---|---|---|---|---|
| C3.7 겹침 확인 → 승인 | `v2/s03-c7-겹침확인승인/raw/s03_web_approve_t01` | 13.18s | 100.0% | 2.20–11.38 | `c37-approve.mjs` · `c37-approve-setup.sql` + `_scripts/s05-schedules.sql` |
| C4.4 화자별 전사 | `v2/s04-c4-화자별전사/raw/s04_web_fieldnote_t02` | 9.00s | 99.6% | 2.77–7.23 | `c44-fieldnote.mjs` · `_scripts/s06-setup.sql` + `c44-time-fix.sql` |
| C4.5 일지 초안 | `v2/s04-c5-일지초안6.7초/raw/s04_web_draft_t02` | 9.42s | 99.9% | 2.20–5.54 | `c45-draft.mjs` · `_scripts/s07-setup.sql` |
| C5.5 공유문 | `v2/s05-c5-공유문검토발행/raw/s05_web_share_t01` | 10.48s | 99.7% | 4.57–5.58 | `c55-share.mjs` · `c55-share-setup.sql` |
| C6.4 케이스 분석 | `v2/s06-c4-케이스분석/raw/s06_web_analysis_t01` | 16.47s | 100.1% | 3.74–11.33 | `c64-analysis.mjs` · `c64-analysis-setup.sql` |
| C6.5 제출 서류 파생 | `v2/s06-c5-제출서류파생/raw/s06_web_derive_t01` | 8.58s | 100.0% | 3.86–5.03 | `c65-derive.mjs` · `c65-derive-setup.sql` |
| C7.3 노쇼 → 차감 | `v2/s07-c3-노쇼차감/raw/s07_web_noshow_t01` | 9.87s | 100.1% | 6.86–8.06 | `c73-noshow.mjs` · `c73-noshow-setup.sql` |
| C8.2 단가 질문 | `v2/s08-c2-이바우처단가가얼마죠/raw/s08_web_voucherask_t01` | 10.37s | 99.6% | 4.35–6.92 | `c76-voucher.mjs` + `_mocks/c76-voucher.json` (admin) |

전부 meta `steps[].t` 단조 증가 · manifest 22~29행 · `--retake-of`로 옛 테이크를 남겼다.
DB 확인: 요청 approved(14회기 → 9/22 08:00 UTC) · 초안 1 · 전달문 published(덧쓴 줄 포함) · 분석 completed · 파생 draft · 13회기 no_show + 차감.

## 촬영 순서와 데이터 축 (한 번 되돌린 시드 위에서)

`reset-seed` → `s01-intake` 리허설(윤도현 생성 — 캡처 아님) → `c64-analysis-setup`(12회기) → `s05-schedules` · `c37-approve-setup` · `c73-noshow-setup` → `s06-setup` · `s07-setup` → `c55-share-setup` · `c65-derive-setup` → 촬영(C8.2 → C3.7 → C4.4 → C4.5 → C5.5 → C6.4 → C6.5 → C7.3).

회기 번호: 1~12회기 완료(6/21~**9/6**) → **13회기 9/13 노쇼(C7.3)** → **14회기 9/18 16:00 → 9/22 17:00 변경 요청(C3.6·C3.7)**.
C3.6 폰 촬영본은 회기 번호를 화면에 안 보여서 13 → 14로 옮겨도 이어진다. v1 스크립트는 meta가 sha256을 들고 있어 제자리에서 안 고치고 v2 사본을 만들었다.

## 스크립트에서 바꾼 것 (v8 규칙 2-2 · 실측 `_probe-c44/c45/c64b.mjs`)

| 컷 | 전 | 후 |
|---|---|---|
| C4.4 | `reveal` 다섯 번 | `scrollTo('잠이 잘 안 와요', center)` 한 번 — 스크롤러 532 · 내용 2092 |
| C4.5 | `scroll(180)` | `scrollTo('다음 상담 내용', end)` 141px |
| C6.4 | `scroll(560)` · `7회기 >> nth=0` | `scrollTo('개입 기법과 반응', start)` · 근거 칩을 리포트 스크롤러 안의 칩으로 좁힘(`data-cap` 표식) |
| C3.7 · C7.3 | 옛 데이터(4회기 · 5회기) | 14회기 · 13회기 |

## 함정 (이번에 새로 밟은 것)

- **API가 `OPENAI_BASE_URL` 없이 떠 있었다** — `.env`에 없고 프로세스 env에도 없어 LLM이 **진짜 OpenAI**로 갔다. C4.5 실측 프로브에서 **1콜 발생**(gpt-4o-mini · 1,411/528 토큰). 촬영 테이크는 전부 `local-stub`이다(`llm_calls.model`로 확인).
- **다른 프로젝트(`domain/imomtae/imomtae-v3/TF`)의 batch 워커 6개가 같은 redis(3505/db0)와 같은 DB(3501)를 본다.** 그들이 이쪽 AI 작업을 가져가면 스텁을 안 탄다. 그 프로세스는 건드리지 않고 **이쪽 API · event · stream · batch를 redis db1로** 옮겼다.
- 촬영용 API·워커 기동(셸에서 export 후 직접 — `nohup` 금지):
  `DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib MESSAGING_DRY_RUN=true S3_BUCKET_ENABLED=false OPENAI_BASE_URL=http://localhost:3599/v1 OPENAI_API_KEY=local-stub REDIS_URL=redis://localhost:3505/1`
  → `uvicorn app.main:app --port 3502` · `app.worker.event` · `app.worker.stream` · `app.worker.batch` · `node _scripts/llm-stub.mjs`
- **12회기 날짜가 시드 날짜를 따라간다** — 시드 3회기는 상대 날짜라 오늘은 9/7이 됐고 `c55`·`c65` setup(9/6 고정)이 0행이었다. `c64-analysis-setup.sql`이 9/6 10:00으로 박도록 고쳤다.
- **파생본은 setup이 안 지웠다** — 리허설이 남긴 `counseling_note_derivations`가 있으면 모달이 채워진 채 열린다. `c65-derive-setup.sql`에 삭제를 넣었다.
- **`최근 대화`는 `assistant_conversations`** — 리허설 대화가 에이전트 화면 사이드바에 뜬다. 촬영 전 `assistant_turns` · `assistant_conversations`를 비웠다.
- **분석 리포트는 `role=dialog`가 아니다**(`CaseAnalysisPanel`) — 모달 뒤 케이스 화면에도 `7회기`가 있어 셀렉터로 못 가른다.

## 결정 (사용자: 추천안대로)

1. **C4.5 새벽 1시 → 16:00으로 교정, C4.4 · C4.5 재촬영(t02).**
   - 데이터: `v2/_scripts/c44-time-fix.sql` — C00003 1회기를 UTC 07:00(=16:00 KST)으로. `s06-setup.sql` 다음에 넣는다(v1 setup은 안 고쳤다).
   - **제품 사본 수정**: `apps/web/src/routes/(protected)/schedule/field-notes/[id]/+page.svelte:313` — `new Date(naive UTC 문자열)`이 브라우저 로컬(KST)로 읽혀 `formatUtcToKst`의 +9h가 상쇄됐다(회기 화면 16:00 · 필드노트 화면 07:00). 문자열을 그대로 넘겨 `parseAsUtc`가 UTC로 읽게 했다. 실측: 두 화면 모두 `2026-09-09 (수) 16:00`. t01은 raw에 남아 있다.
2. **"6.7초"를 컷 이름에서 뺐다** — cuts.json `C4.5` name `일지 초안`, situation에 "소요 시간을 자막으로 주장하지 않는다". 스텁 소요(2.6초)를 실제로 늘려 보이게 하지 않는다(§4-1: 제품이 걸리는 시간을 꾸미면 거짓말).
   폴더명 `s04-c5-일지초안6.7초`는 manifest·meta 경로라 그대로 두었다. `storyboard.html`은 cuts.json에서 다시 뽑아야 반영된다.
3. 촬영용 `production_ai_configs` 고정 행(`c55` · `c64` · `c65` · `s07`)은 **남겨 두었다** — 목업·재촬영이 끝나면 지운다.

## 목업 (2026-09-14 오후) — 12컷

규격: iMac v2(`right 0.2 · width 0.78 · top 5.6 · bezel 0.55 · chin 3.4 · stand 0.45` + 파랑 shade) · 폰(`phoneH 86 · top 9.5` + 같은 shade, 시뮬레이터 804×1748이라 띠 0 · `shotRatio 0.46`) · 절차 표시줄은 cuts.json `steps`의 head/hold/tail 그대로. spec은 컷 폴더의 `CX.X.json`, 촬영본을 `start`·`duration`으로 직접 자른다(`_mockups/src/`는 없다).

| 컷 | 무대 | 원본 구간 | 길이 | 비고 |
|---|---|---|---|---|
| C3.6 | phone | `s03_phone_request_t02` 12.4–25.0 | 12.6s | 목표 6s보다 길다 — 노컷(변경 요청 → 요청 보냄) 보존. 옛 목업은 전체 29.1s |
| C3.7 | imac | `s03_web_approve_t01` 1.9–12.9 | 11.0s | |
| C4.3 | phone | v1 `s06_phone_fieldnote-app_t01` 5.0–13.0 | 8.0s | 옛 구간 그대로 |
| C4.4 | imac | `s04_web_fieldnote_t02` 2.0–8.6 | 6.6s | |
| C4.5 | imac | `s04_web_draft_t02` 1.9–9.2 | 7.3s | |
| C5.5 | imac | `s05_web_share_t01` 1.9–10.3 | 8.4s | |
| C5.6 | phone | `s05_phone_arrive_t02` 11.6–19.2 | 7.6s | 상담 기록 → 12회기 글 → 스크롤 |
| C6.4 | imac | `s06_web_analysis_t01` 1.9–16.2 | 14.3s | 생성 대기 5.6s 포함(노컷) — 편집에서 줄인다 |
| C6.5 | imac | `s06_web_derive_t01` 4.4–8.4 | 4.0s | 버튼 → 채워짐 → 같은 문장 오가기 |
| C7.3 | imac | `s07_web_noshow_t01` 1.9–9.7 | 7.8s | spec이 잔여 폰 컷을 가리키던 것 바로잡음 |
| C7.4 | phone | `s07_phone_remaining_t01` 7.4–12.2 | 4.8s | spec이 없던 것 새로 만듦 |
| C8.2 | imac | `s08_web_voucherask_t01` 1.9–10.1 | 8.2s | |

## 폰 재촬영 (2026-09-14 13:00~) — C4.3 · C5.6

옛 폰 테이크가 새 데이터 축과 어긋났다(C5.6 목록의 "13회기 9/18 예정" · C4.3의 "강영희 23:00"). 둘 다 다시 찍고, C4.4 · C4.5도 날짜를 맞춰 한 번 더 찍었다.

| 컷 | 촬영본 | 충실도 | 무대 구간 | 스크립트 · 준비 |
|---|---|---|---|---|
| C4.3 녹음 | `v2/s04-c3-녹음/raw/s04_phone_record_t02` 14.17s | 100.1% | 3.9–11.8 (7.9s) | `c43-record.mjs` · `c44-time-fix.sql` → `c43-pre-record.sql` → 촬영 → `c43-restore.sql` |
| C4.4 화자별 전사 | `v2/s04-c4-화자별전사/raw/s04_web_fieldnote_t03` 8.98s | 99.3% | 2.0–8.6 (6.6s) | 회기가 오늘 16:00 |
| C4.5 일지 초안 | `v2/s04-c5-일지초안6.7초/raw/s04_web_draft_t03` 9.33s | 99.6% | 1.9–9.2 (7.3s) | 회기가 오늘 16:00 · `s07-setup.sql` |
| C5.6 도착 | `v2/s05-c6-도착/raw/s05_phone_arrive_t02` 23.35s | 100.0% | 11.2–20.6 (9.4s) | `c56-arrive.mjs`(스와이프 + 멈춤 추가) · `phone-link.mjs` |

- **회기 축 추가**: 윤도현 C00003 1회기를 **오늘(9/14) 16:00**으로 — 폰에서 녹음하는 그 회기가 C4.4 필드노트 · C4.5 일지의 회기다. 오늘의 채움 일정 넷(`s05-schedules.sql`)은 지웠다(`c44-time-fix.sql`에 포함).
- **녹음 전 장면**: 회기는 이미 끝났고 필드노트가 붙어 있어 앱이 `저장됨 · 이어서 녹음`을 띄운다. 폰 촬영 동안만 `c43-pre-record.sql`로 예정 · 필드노트 숨김, 끝나면 `c43-restore.sql`(실측값 그대로 복원).
- **김영희 검사 AC0001 2회기**가 23:00 KST로 녹음 시트에 보였다 → 10:00 KST로 옮김(t01 폐기 사유).
- 상태바는 `simctl status_bar override`로 C4.3 15:52(회기 직전) · C5.6 20:10(저녁에 받아 봄), 촬영 뒤 `clear`.
- **C5.6 t01 폐기**: 스와이프 관성이 멈추기 전에 12회기 라벨 위치를 읽고 눌러 11회기가 눌렸다 — 글이 안 열렸다. 스크립트에 `hold(1200)` 추가.

### 폰 환경 (새로 세운 것)

- 기기 `iPhone 17 Pro 2964900F-E9FC-4EB4-B58F-4C0349E448E1`(이전 F6685208은 사라졌다). 전문가 앱은 기존 Release 빌드, **내담자 앱은 새로 빌드**: `apps/mobile-client`에서 `APP_VARIANT=development API_URL=http://localhost:3502 npx expo prebuild --platform ios --no-install --clean` → `npx expo run:ios --configuration Release --device <UDID> --no-bundler`(약 8분).
- **idb 설치**: `brew trust facebook/fb`(사용자 승인) → `brew install idb-companion` → `/usr/bin/python3 -m pip install --user fb-idb` → `~/Library/Python/3.9/bin/idb`. 쓰기 전에 `idb connect <UDID>` — 안 하면 describe가 "fullscreen dialog"로 실패한다. 탭 좌표는 **정수만** 받는다.
- **phone-link 409**: `c37-approve-setup.sql`이 같은 전화번호로 `guardian.leesujin@…` 계정을 먼저 만들어 signup이 막혔다. `CAP_GUARDIAN_EMAIL=guardian.leesujin@mindscope.com`으로 그 계정에 연결(스크립트에 env 추가).

## 컷 폴더 정리 (2026-09-14) — s01-c8처럼 무대가 쓰는 촬영본을 컷 폴더 안에

컷 폴더 하나 = `CX.X.json` · `CX.X_<stage>.mp4` · `raw/`(무대가 쓰는 촬영본 + meta) · `stills/`. spec의 `screen`은 전부 `raw/…`다(절차 표시줄만 공용 `../_assets/steps/`).

- **C3.6** `s03_phone_request_t02` · **C7.4** `s07_phone_remaining_t01`은 옛 씬 폴더(`v2/s03-일정/raw` · `v2/s07-정산/raw`)에 있었다 → 컷 폴더 `raw/`로 **복사**했다. 원본은 규칙 4대로 두었다.
  복사본 meta에 `copied_from`을 남기고 `scene`을 컷 폴더로 바꿨다. manifest에 컷 폴더 행을 더했다(s01-c8의 `s01_web_formsend_t01`이 두 폴더에 행이 있는 것과 같은 방식).
- 조작 스크립트 · setup SQL · 목 대본은 여러 컷이 같이 쓰므로 `v2/_scripts/` · `_mocks/`에 그대로 둔다(컷별 스크립트 이름은 `cNN-*` 규칙).

## 폰 목업 모서리 깨짐 (2026-09-14) — C3.6 · C4.3 · C5.6 · C7.4

증상: 폰 화면 네 모서리와 오른쪽 가장자리 끝에 **검은 초승달**. 원인: 시뮬레이터 촬영본(804×1748)은 기기 모양대로 모서리가 검게 둥글다(대각선 36px ≈ 반경 6cqh)
— 무대의 화면 반경 4.7cqh가 그보다 작아 검은 부분이 그대로 보였다. 폰-웹 촬영본(C1.9)은 모서리가 없어 안 보였다.
처리: `phone.html`에 `screenRadius`(화면 반경 cqh · 프레임 바깥 반경이 +0.5로 따라온다) 추가, 시뮬레이터 컷 넷에 `6.8`. 기본값은 4.7 그대로라 C1.9는 안 바뀐다.

## S3 기존(A) 정리 (2026-09-14) — 카카오톡 · 통화 컴포넌트 · C3.5 제거

| 컷 | 산출물 (컷 폴더 안) | 내용 |
|---|---|---|
| C3.2 문자 한 통 | `s03-c2-문자한통/kakao/kakao-변경요청.png` (+ HTML) | 보호자 이수진 → 센터 데스크 카카오톡 · 수요일 오전 10:02 · "내일 목요일 4시 상담 못 갈 것 같아요 ㅠㅠ / 회사에 갑자기 일정이 생겨서요 / 다른 날로 옮길 수 있을까요?" · 답 없음 |
| C3.3 답이 늦다 | `s03-c3-답이늦다/kakao/kakao-빈시간-대기.png` → `kakao-빈시간-답.png` (+ HTML `?state=wait\|reply`) | 실장 → 상담사 10:06 "하준이 어머님이 내일 목요일 4시 못 오신대요 / 다음 주에 비는 시간 있으세요?"(읽지 않음 1) → 12:14 "앗 죄송해요, 상담 중이었어요! / 다음 주 화요일 5시 괜찮아요" |
| C3.4 전화 둘, 부재중 하나 | `s03-c4-전화둘부재중하나/call/call-보호자-부재중.png` → `call-보호자-통화.png` (+ HTML `?state=missed\|talk`) | 12:18 발신 부재중 → 12:24 다시 발신(2분 41초) · 발화 셋: 실장 "다음 주 화요일 5시 괜찮으세요?" → 어머님 "네, 그날은 될 것 같아요" → 실장 "화요일 5시로 적어 둘게요" |
| ~~C3.5 다시 쓴다~~ | `v2/_dropped/s03-c5-다시쓴다/` | **제거**(사용자 지시). cuts.json에서 뺐고, C3.4가 A의 마지막 컷이라 절차 표시줄 `tail: 99_out.mov`를 받았다 |

- 틀은 C1.3의 `kakao-명단.html`과 같다 — 900px 카드 · Chrome 헤드리스 2x · 투명 배경(`--default-background-color=00000000`). 편집에서 AI 첫 프레임 위에 얹는다.
- 절차 표시줄 `S3-기존`을 4단계(상담 진행 · 문자 수신 · 빈 시간 확인 · 보호자 통화)로 다시 구웠다(`_assets/steps/steps.json` → `node build.mjs S3`). 옛 5단계 클립은 `v2/_dropped/steps-S3-기존-5단계/`.
- 남은 글: cuts.json의 S3 `case`("…→ 화요일 5시로 다시 쓴다" · "B로 이음새 — A의 마지막 컷(다시 쓰는 손)") · `briefs/S3.md`의 C3.5 절은 손대지 않았다 — 카피라 사람이 고친다.
- **C3.2 메시지별 조각으로 바꿈** — s01-c3 카카오톡 명단과 같은 방식: `01-header` · `02-msg-안녕하세요` · `03-msg-못가요` · `04-msg-옮길수있을까요` 조각 PNG(상자+사방 24px · @2x · 투명, 말풍선 배경 없음) + 합본 `kakao-변경요청.png`(980×1200 창). 원본 HTML 옆 `render.mjs`(s01-c3 사본)로 `node render.mjs` 한 번에 굽는다. 프로필은 🌼.
- **카카오톡은 메시지 PNG만 둔다**(사용자 지시) — 합본 · 헤더 조각을 지웠다. C3.2 `01-msg-안녕하세요 · 02-msg-못가요 · 03-msg-옮길수있을까요`, C3.3 `01-msg-못오신대요 · 02-msg-비는시간(1 · 10:06) · 03-reply-상담중이었어요 · 04-reply-화요일5시(12:14)`. C3.3의 옛 두 장짜리 카드(`kakao-빈시간*`)도 지웠다. 두 폴더 모두 `node render.mjs`로 다시 굽는다.
- **C3.4 통화도 조각으로**(사용자 지시) — 카드 한 장(`call-보호자*`)을 지우고 독립 투명 컴포넌트 5장: `01-call-부재중`(12:18) · `02-call-다시발신`(12:24 · 2분 41초) · `03-say-실장-제안` · `04-say-어머님-수락` · `05-say-실장-확정`. 통화 줄은 흰 카드 자체가 컴포넌트, 발화는 화자 태그 + 말풍선. `node render.mjs`.
- **폰 목업 둘레 어두운 실선** (2026-09-14, C3.6 모달 장면에서 눈에 띔) — spec의 `screenBg:#000000`이 원인. 화면의 둥근 가장자리를 자를 때 안티에일리어싱 픽셀이 뒤의 검정을 섞어 매트 알파에 어두운 테두리가 남았다. 시뮬레이터 넷을 `screenBg:"transparent"`로 바꿔 다시 구웠다(투명이면 유리 테와 섞인다). 촬영본 가장자리는 깨끗했다(모달 딤 122 · 흰 시트 253 균일).
  같이 고친 것: 프레임 바깥 반경을 `화면 반경 + .76cqh`(패딩 .62 + 테두리 .14)로 — 전엔 +.5라 동심이 아니었다.
- **폰 목업이 촬영본을 잘라 먹고 있었다** (2026-09-14, 수정안 HTML로 보여 드리고 적용) — 셋이 겹쳤다.
  ① `phone.html` 슬롯 높이가 프레임 패딩·테두리(1.52cqh)를 안 빼 슬롯이 화면보다 길었고, 합성은 잘린 사각형(428×914, 촬영본보다 넓은 비율)에 cover로 채워 **위아래 약 31px(1.8%)**를 잘랐다 → 빼도록 고침(C1.9 포함 모든 폰 목업).
  ② `shotRatio 0.46`(반올림) → `0.459954`(804/1748).
  ③ 1080 무대에서 화면이 0.52배로 줄어 글자가 뭉갬 → 시뮬레이터 넷을 **4K(3840×2160) · phoneH 82.446**로: 화면 804×1748 = 원본 1:1. 합성의 가장자리용 1px 확대가 804→806 리샘플이 되던 것도 크기가 같으면 끄게 했다(`render.mjs`).
  대조(C3.6 11초, 화면 가운데 804×1400 PSNR): 현재 19.1dB · 1080 수정 21.2dB · **4K 1:1 43.7dB**(H.264 crf14 왕복 상한 43.3dB). 절차 표시줄 자산(1920×1080)은 4K 무대에 맞춰 늘려 얹는다.
- **iMac 목업도 4K로** (2026-09-14, 사용자 지시) — 12컷(C1.7 · C1.8 · C2.4 · C2.5 · C3.7 · C4.4 · C4.5 · C5.5 · C6.4 · C6.5 · C7.3 · C8.2) `size [3840,2160]`. 화면 1474px(×0.46) → 약 2948px(×0.92). 레이아웃은 cqw 단위라 그대로다. 이제 v2 무대 영상은 폰 · iMac 모두 3840×2160.
  → 완료(2026-09-14): iMac 12컷 전부 3840×2160 · 화면 2947×1658 · 길이 spec 그대로. C1.9(폰-웹)도 4K로 다시 구웠다 — 화면 774×1674(촬영본 1170×2532의 ×0.66, 비율 일치). 컷당 22~50초.
- **C3.5 되돌림** (2026-09-14, 사용자 지시) — `_dropped/s03-c5-다시쓴다` → `v2/s03-c5-다시쓴다`. cuts.json에 HEAD의 C3.5 항목을 그대로 C3.4 뒤에 다시 넣었고(C3.4의 `tail` 뺌 · C3.5가 마지막 컷), 절차 표시줄 `S3-기존`을 5단계로 되돌렸다(보관해 둔 5단계 클립을 복원 · 4단계 판은 `_dropped/steps-S3-기존-4단계`).

## C3.6 재구성 · 재촬영 (2026-09-14) — SPEC_PHONE v2

사용자: "다른 것에 비해서 느린 느낌". 원인 — 탭 사이가 약 2초(v1 preTap 400 + postTap 900 + 라벨 조회 · 탭 idb 호출이 preTap 밖), 탭 8번이라 무대 구간이 12.6s.

- **SPEC_PHONE v1 → v2**(`capture-phone.mjs`): postTap 900→600 · afterSwipe 900→800 · beat 1200→800, `phone.mjs`의 `tap`이 라벨 조회 시간을 preTap 안에서 센다. SKILL.md 폰 타이밍 · `rules/capture.md` 규칙 8 같이 고침. 옛 폰 컷(C4.3 · C5.6 · C7.4)은 v1 그대로.
- 스크립트 `c36-request-v2.mjs`(옛 판은 t02 meta sha 때문에 둠) — 달력 앞 beat 제거 · 끝 hold 1200.
- 데이터: `c36-phone-setup.sql`을 **14회기 축으로 다시 씀**(옛 판은 13회기를 따로 만들어 C7.3과 겹쳤다) — `c37-approve-setup.sql` 뒤에 돌리면 요청을 지우고 9/18 16:00으로 되돌린다. 리허설(캡처 없이 같은 헬퍼 · exit 0 · DB에 9/22 08:00 UTC 요청) → setup 다시 → 앱 종료 → 촬영.
- 촬영본 `raw/s03_phone_request_t03` 20.32s · 충실도 **100.1%** · 탭 간격 1.14s · 노컷 8.03–16.10 · `--retake-of t02`. 촬영 뒤 DB: 요청 pending 9/18 07:00 → 9/22 08:00 UTC(C3.7이 받는 그 요청 — C3.7 웹은 이미 approved 상태로 찍었다).
- 목업 `C3.6.json` screen t03 · **7.8–17.1 (9.3s, 전 12.6s)** → `C3.6_phone.mp4` 덮어씀. 상태바는 실제 시각(6:32).
