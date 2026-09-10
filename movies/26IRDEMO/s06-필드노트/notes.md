# s06-필드노트 — 기억으로 쓰는 일지

## 앱 절반 — 데모 라우트로 풀었다 (2026-09-11)

**선택본 `s06_phone_fieldnote-rec_t04` — 30.02초 · 804×1748.** 목업 `mockup/s06_phone_fieldnote-rec_t04_phone.mp4`.

> **경과 타이머는 전사 시각을 따라간다.** t03은 타이머가 00:14인데 전사가 03:34이라 어긋났다 —
> 녹음은 이미 몇 분째 돌고 있는 것이므로, 줄이 뜰 때마다 타이머를 그 줄의 시각으로 맞춘다(03:03 → 03:47).

녹음 화면이 **움직이는 모습**은 시뮬레이터로 못 찍는다 — `idb`가 없어 `바로 녹음`을 못 누르고,
시뮬레이터에 마이크 입력이 없어 실시간 전사가 애초에 돌지 않는다. 그래서 제품에 촬영용 라우트를 하나 더했다.

**`app/(main)/field-note/demo.tsx`** — 제품의 `RecordingScreen`을 **그대로** 렌더하고 상태만 대본으로 흘린다.
화면을 다시 그리지 않으므로 디자인·치수·색이 앱과 어긋날 수가 없다. 새 파일 하나뿐이고 다른 제품 코드는 안 건드린다.
(HTML로 화면을 재현한 판도 만들어 봤지만 — t01 — 아무리 값을 맞춰도 같지 않아 버렸다.)

| 흘리는 것 | 무엇 |
|---|---|
| `timerFormatted` | 1초씩 오르는 경과 시간 |
| `meteringRef` | 말–쉼이 번갈아 드는 진폭(dBFS) → **제품의 파형이 실제로 움직인다** |
| `recOpacity` | 녹음 배지 깜박임 — 제품이 쓰는 그 값 |
| `recordingTimeline` | 전사 줄이 시각과 함께 쌓인다. 대사는 `s06-setup.sql`의 윤도현 1회기 전사 |
| `handlers` | 전부 무동작 — 조작이 없는 장면이다 |

```bash
cd .claude/skills/phone-stage/scripts
CAP_PASSWORD=… node stage.mjs up --account counselor1 --route /field-note/demo
# 촬영은 **앱을 내리고 촬영 중에 딥링크로 새로 연다** — 안 그러면 이미 돌던 타이머가 00:56에서 시작한다(t02)
xcrun simctl terminate booted kr.mindscope.app.dev
cd ../../capture-service/scripts
( sleep 4; xcrun simctl openurl booted 'mindscope-dev:///field-note/demo' ) &
node capture-phone.mjs --scene s06-필드노트 --action fieldnote-rec --udid booted \
  --app kr.mindscope.app.dev --seed _seed/saas-2026-09-10e.json --manual --seconds 24
```

> ⚠️ **`demo.tsx`는 촬영용이다.** 운영 빌드에 들어가면 안 된다. `_tool/`은 커밋되지 않으므로
> 이 줄과 STATUS.md의 제품 변경 표가 그 존재의 유일한 기록이다.

### 앱 절반은 테이크 셋이다

| 테이크 | 무엇 | 비고 |
|---|---|---|
| `fieldnote-app_t01` (18.60s) | 앱 홈 → 필드노트 홈 → 회기 선택 시트 | 진짜 앱 |
| `fieldnote-list_t01` (14.00s) | **필드노트 홈 — 최근 노트 목록** | 진짜 앱 |
| `fieldnote-rec_t04` (30.02s) | **녹음 화면**(타이머 03:03→03:47 · 전사가 쌓인다) | 데모 라우트 |

**목록 → 녹음의 진입 전환은 컷으로 잇는다.** 딥링크로 그 전환을 찍으려 세 판(`fieldnote-open_t01~t03`)을
태웠는데 전부 실패했다 — expo-router가 데모 화면을 **스택에 물고 있어** 다시 링크해도 새로 마운트되지 않고
(타이머도 리셋되지 않는다) 전환이 기록기가 켜지기 전에 끝나 버린다. `idb`가 있으면 탭으로 해결되는 자리다.

> 앱의 **필드노트 상세**(`_quick?fieldNoteId=…`)는 지금 데이터로는 `녹음된 음성이 없어요`다 —
> 시드의 필드노트 넷이 전부 `field_note_audios` 0행이라 그렇다. 전사는 웹 절반이 보여준다.

앞 테이크 `s06_phone_fieldnote-app_t01`(18.60초)은 **진짜 앱**으로 찍은 앱 홈 → 필드노트 홈 → 회기 선택 시트다.
목업도 있다(`mockup/s06_phone_fieldnote-app_t01_phone.mp4`). 둘을 이어 붙이면 앱 절반이 선다.

## 촬영 (2026-09-11 새벽 · SPEC v6 · s01 배치 규칙)

**선택본 `s06_web_fieldnote_t05` — 15.47초 · 충실도 100% · 드롭 0 · 노컷 2.79–13.67.**
목업 `mockup/s06_web_fieldnote_t05_imac.mp4`.

배치는 이미 규칙에 맞았다 — 내려가서 읽는 `reveal`은 s01의 ③(보이는 것을 다 전달했으면 그때 내린다)에 해당해 유지했다. SPEC v4 → v6 재촬영이다.

부하로 굶은 판은 `_scripts/capture-until-good.sh`가 자동으로 다시 찍는다(기준 충실도 98%).

기기: 전문가 앱(시뮬레이터) + web  ※ 실기기 녹음은 하지 않는다 — features.md
배역: **검사 축 — 윤도현**(2014-05-08 · 만 12세) · 개인상담 C00003 1회기(**2026-09-09 (수) 16:00–16:50**) · 상담사 정상담  (정본 CAST.md)
시드: `_seed/saas-2026-09-10c.json` (sha256 앞 8자리 `c901b092`)

## 선행 의존 — 이 장면은 s01 없이 서지 않는다

**윤도현은 시드에 없다.** s01(접수)이 촬영·리허설 중에 만든다.
`.claude/skills/scene-prep/scripts/reset-seed.sh --yes`를 돌리면 윤도현이 사라지고 이 장면의 SQL이 멈춘다.
되돌린 뒤에는 **s01을 먼저 돌려 윤도현을 다시 만든 다음** s06 준비를 한다.

```bash
.claude/skills/scene-prep/scripts/reset-seed.sh --yes                       # ① 되돌리기 (윤도현이 사라진다)
node .claude/skills/scene-prep/scripts/rehearse.mjs --scene s01-접수 \
  --url http://localhost:3503/agent --state _state/local-saas-counselor1.json \
  --script _scripts/s01-intake.mjs --mock _mocks/s01-intake.json --headless   # ② 윤도현 다시 만들기
PGPASSWORD=imomtae_dev psql -h localhost -p 3501 -U imomtae -d imomtae \
  -f _scripts/s06-setup.sql                                                   # ③ 케이스·회기·전사
```

(이 기계는 `docker exec` 권한이 막혀 있다 — `psql -h localhost -p 3501`로 붙는다.)

## 조작 순서
앱: 홈 → `필드노트 홈 열기` → 필드노트 홈(오늘 기록할 일정 · 최근 노트 · `바로 녹음`)
웹: `/schedule/field-notes/<fieldNoteId>` — 도착 → 첫 발화에 커서 → **전사를 다섯 번 끌어올린다**
※ 녹음 자체는 찍지 않는다(시뮬레이터에 마이크 입력이 없다).

웹 스크롤이 보여주는 것 — 전사는 **안쪽 영역**이 스크롤되므로 커서를 그 안에 두고(hover) `reveal`로 끌어올린다.

| reveal | 전사 시각 | 무엇이 보이나 |
|---|---|---|
| 1 | 0:41 | **13.2초 침묵** 구분선 — 대답 전에 오래 멈춘 것까지 남는다 |
| 2 | 2:17 | "…이런 것도 말해도 돼요?" — 확인을 구하는 태도 |
| 3 | 3:01 | "그냥 제가 참으면 되니까요" — 혼자 감내하는 대처 |
| 4 | 17:22 | 3:10 바로 아래가 17:22다. **두 시각이 한 화면에** — 시간 축이 제일 크게 읽히는 자리 |
| 5 | 26:28 | 다음 주 과제(하루 한 단어 기분 기록)까지 시간 축 위에 있다 |

## 캡처 지점

리허설 실측(2026-09-10, **SPEC v4**) — 웹 절반. 고정 `hold`는 마지막 끝맺음 0.6초 하나만 남았다.

- 시작: 필드노트 헤더(30분 0초 · 연결됨) + 회기 카드(C00003 · 윤도현 · 개인상담 · **2026-09-09 (수) 16:00-16:50**)
  ※ 날짜는 2026-09-10에 오늘→어제로 옮겼다 — s07의 `isBeforeStart`가 오늘 16:00 회기를 막는다(s07 features.md). 이 줄은 이동 뒤 다시 재보지 않았다
- 종료: 마지막 과제 발화
- 웹 길이: 조작 **10.6초** + lead/tail 2.7초 ≈ **13.3초**

| 구간 | 리허설 t | 무엇 |
|---|---|---|
| **노컷** | 1.28 – 9.18 (7.9초) | 첫 발화 → 침묵 → "말해도 돼요?" → "참으면 되니까요" → 17:22 → 과제. **머릿속에만 있던 것이 시간 축이 되는 자리** |

앱 절반은 **돌려 보지 못했다** — 시뮬레이터에 전문가 앱이 없고 idb도 없다(features.md §앱 절반).

## 리허설
```bash
FN=$(PGPASSWORD=imomtae_dev psql -h localhost -p 3501 -U imomtae -d imomtae -tAc \
  "select fn.id from field_notes fn
     join counseling_sessions cs on cs.schedule_id=fn.schedule_id
     join counseling_cases cc on cc.id=cs.counseling_case_id
    where cc.case_code='C00003' and fn.deleted_at is null")
node .claude/skills/scene-prep/scripts/rehearse.mjs --scene s06-필드노트 \
  --url "http://localhost:3503/schedule/field-notes/$FN" \
  --state _state/local-saas-counselor1.json --script _scripts/s06-fieldnote-web.mjs --headless
```
전제: 위 §선행 의존의 ①②③.  **fieldNoteId는 setup을 다시 돌릴 때마다 바뀐다** — 위처럼 그때 뽑는다.

마지막 결과 — **종료 코드 0 · 오류 0 · 16단계 10.5초**(헤드리스) / **10.6초**(눈으로 본 시뮬레이션, 2026-09-10).
DB 확인: 상담케이스 C00003 1 · 케이스 참여자 2 · 일정 1 · 회기 1(completed) · 회기 참여자 2 ·
필드노트 1(전사 23 세그먼트 · 침묵 마커 2 · 30분).

## 테이크
| take | 파일 | 결과 | 재촬영 사유 |
|---|---|---|---|
| t01 | `raw/s06_web_fieldnote_t01.meta.json` (mov 없음) | 폐기 — 배역이 이하준 | |
| t02 | `raw/s06_web_fieldnote_t02.mov` | **본편 제외** — 배역이 이하준(SPEC v3) | 윤도현으로 옮기며 무효 |
| phone t01 | `raw/s06_phone_fieldnote-app_t01.mov` | 유효할 수 있다 — 이 컷에 인물이 안 나온다. 오늘 일정 건수만 확인 | |
