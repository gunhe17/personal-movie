# 진행 상태 — 26IRDEMO

**다른 세션은 여기부터 읽는다.** 아홉 장면이 지금 어디까지 와 있고, 무엇이 막혀 있고, 환경을 어떻게 세우는지.
갱신 시각: **2026-09-10 밤 (s01 재촬영 t09 — SPEC v5: 스크롤을 거리 비례 ease-out으로. t07의 140px·3프레임 점프가 16프레임 연속 움직임이 됐다. 시드 `_seed/saas-2026-09-10d.json`(`cebd9e33`) → s04는 이 시드 위에서 다시 찍는다)**
이전: **2026-09-10 저녁 (s06 앱 절반의 '검은 화면'은 오해로 판명 — 앱은 정상 렌더 중이다. `care_board_entries` 0행을 `backfill_care_board`로 재구축)**
이전: 2026-09-10 (s07 재준비 — 배역을 이하준 → 윤도현으로 옮기고 초안 본문을 새 전사에서 다시 씀. 리허설·시뮬레이션 종료 코드 0 · s06-setup.sql §4 제거 · 회기 시각을 09-09로 이동)

읽는 순서: 이 파일 → `CAST.md`(배역의 정본) → 그 장면의 `sNN-*/features.md` → `notes.md`

## 한 줄 요약

**아홉 장면 촬영 완료 (2026-09-10).** 한 세션에서 몰아 찍었고 드롭 0이다.
시드 스냅샷 `_seed/saas-2026-09-10b.json` · `_seed/mindbom-2026-09-10b.json` 위에서 찍었다.
**편집 구성은 [CUT.md](CUT.md)가 정본** — 선택본 · 인아웃 · 순서 · 자막 · 스틸 목록이 거기 있다.

> ⚠️ **s01 · s03 · s04는 재촬영 대상이다** (2026-09-10 오후). 검사 축을 윤도현 한 사람으로 통일하면서
> s01의 검사 항목이 2건 → 4건이 됐고, s03의 배역이 박지우 → 윤도현으로, 선택본이 `aireview` 하나로 바뀌었다.
> s04는 흐름은 그대로지만 찍힌 카드가 검사 2건짜리라 새 s01과 같은 편에 못 붙는다.
> 아래 표는 **그 재촬영 전까지의 선택본**이다. 각 장면 줄과 `sNN-*/notes.md`가 정본이다.
>
> ⚠️ **`raw/`에서 사라진 mov는 둘이 아니라 31개다** (09-10 저녁 실측).
> meta·manifest는 **56 테이크**인데 `.mov`는 **25개**뿐이다. 없어진 31개는 전부 이른 테이크이고,
> **어느 문서도 그 삭제를 기록하지 않았다**(기록된 것은 `s02_web_receive-entry_t01/t02` 둘뿐이었다).
> 촬영 규칙 4를 생각하면 의도된 정리가 아니라 **사고로 지워진 것으로 봐야 한다**.
> **선택본 12개는 mov·meta·manifest 모두 온전하다** — 편집 손실은 없다.
>
> ⚠️ **`.mov`는 git이 지켜주지 않는다** — `.gitignore:7`이 `movies/26IRDEMO/**/raw/*.mov`를 제외한다.
> 추적되는 mov는 **0개**다. 되돌릴 수단이 없고, **`git clean -fdx`(또는 `-fdX`) 한 번이면 남은 25개도 사라진다**.
> 이 저장소에서 `git clean`에 `-x`/`-X`를 붙이지 마라. 백업은 저장소 밖에 따로 둬야 한다.

## 선택본 (각 조작의 마지막 테이크)

| 장면 | 파일 | 길이 | 드롭 | 노컷 |
|---|---|---|---|---|
| s01 접수 | `s01_web_intake_t09.mov` (v5 · 시드 10d) | 25.77s | 0 | 2 |
| s02 검사 실시 | `s02_web_collect_t12.mov` | 24.12s | 0 | 2 |
| s03 채점·보고서 A | ⚠ `s03_web_draft_t01.mov` (본편 제외 — 배역이 박지우) | 19.07s | 0 | 1 |
| s03 채점·보고서 B | ⚠ `s03_web_aireview_t01.mov` (재촬영 대상) | 28.78s | 0 | 3 |
| s03 마인드봄 보고서 | ⚠ `s03_web_report_t02.mov` (본편 제외 — 배역이 박지우) | 18.45s | 0 | 2 |
| s04 바로링크 | ⚠ `s04_web_sendlink_t03.mov` (재촬영 대상) | 12.22s | 0 | 1 |
| s05 일정 | `s05_web_approve_t05.mov` | 17.63s | 0 | 1 |
| s06 필드노트 (웹) | ⚠ `s06_web_fieldnote_t02.mov` (재촬영 대상 — 배역이 이하준) | 12.10s | 0 | 1 |
| s06 필드노트 (앱) | `s06_phone_fieldnote-app_t01.mov` | 18.60s | 0 | 1 |
| s07 자동일지 | `s07_web_draft_t04.mov` | 15.13s | 0 | 1 |
| s08 케어보드 | `s08_web_careboard_t03.mov` | 17.65s | 0 | 1 |
| s09 회기·정산 | `s09_web_noshow_t03.mov` | 12.75s | 0 | 1 |

**합계 3분 45초 · 전 테이크 드롭 0 · 검은 프레임 없음.** 웹은 3200×1800, 앱은 804×1748.
앞 테이크는 지우지 않지만 컷에 넣지 않는다. 본편이 쓰는 것과 빼는 것은 CUT.md §2.

화면에서 한 일이 DB에도 남았다: 기관 1 · 내담자 10(시드 7 + s01의 3) · 검사케이스 4 · 바로링크 1 ·
승인된 변경요청 1 · 노쇼 차감 1 · 일지 생성 1.

**실패 테이크 하나** — `s07_web_draft_t01`(케이스 id가 세션과 어긋나 회기 상세가 안 열림). 파일은 남겼고
t02가 `--retake-of t01`로 사유와 함께 대체한다.

## 장면별 (준비 상태)

`scene-prep` 스킬의 여섯 조건(features 근거 · CAST 축 일치 · 목 대본 통과 · 리허설 0 · 시뮬레이션+DB 확인 · 실측 노컷)을 다 채우면 **준비 완료**.

| 장면 | 축 | 상태 | 리허설 실측 | 남은 것 |
|---|---|---|---|---|
| **s01 접수** | 검사 | ✅ **t09 촬영 완료 (SPEC v5 · 09-10 밤)** | **17단계 22.9초(시뮬레이션)** · 종료 코드 0 · 오류 0 (v5) · 촬영 노컷 7.16–11.24 / 21.22–24.44 · 시드 `saas-2026-09-10d`(`cebd9e33`) | **검사 항목이 2건 → 4건이 됐다** — 로르샤흐(→s02) · HTP(→s03) · SCT(→s03) · 스마트폰중독검사(온라인 →s04). 마인드봄 종합보고서 배터리가 박지우 → 윤도현으로 옮겨져 검사 축이 한 사람이 됐다. 등록 클릭이 기관 1 · 내담자 3 · **케이스 3(각 검사 4건, 전부 온라인 검사 포함)** 을 실제로 만든다 — **재실행은 재시드부터** |
| s02 검사 실시 | 검사 | ✅ **재촬영 완료 t12 (09-10 저녁)** | **17단계 22.3초 · 종료 코드 0 · 오류 0** · 노컷 2.21–16.83 / 16.84–22.31 | 마인드봄 · **윤도현** 로샤 `seed:yun-rorschach`. **매번 `_scripts/s02-reset.sh` 먼저** — 시드 기본이 `confirmed`+반응 22라 안 돌리면 쓰기가 전부 400이다(s03은 그 반대 상태를 쓴다). **t12는 반응 하나를 두 바퀴 다 돌린다** — 말 → 탭으로 줄 생성 → 칩 선택 → 영역 그리기 → 말 → 질문 칸. **임상가가 타이핑하는 칸이 없다.** t11(반응 둘·39초)은 편에 길어 폐기했다. DB 검증 통과(자유반응·질문·`W`·영역·**원문 둘 다**). 함정 셋 — ① 조각의 `startedAt`은 앞 조각이 끊긴 시각이라 칩 선택이 한 칸씩 어긋난다(대본의 빈 줄 하나로 비운다) · ② 마지막 조각을 내담자 화면 안에서 받아야 `inquiry_stt_raw`가 남는다 · ③ 마인드봄 리프레시 수명이 **7일**이다(러너가 `auth-check.mjs`로 먼저 막는다) |
| **s03 채점·보고서** | **검사** | ✅ **흐름 재구성 · 준비 완료 (09-10 저녁) · 재촬영 필요** | **17단계 17.5초 · 종료 코드 0 · 오류 0** · 노컷 0.71–6.78 / 6.78–11.85 / 11.85–16.10 | **선택본은 `aireview` 하나.** 흐름을 사용자 요구로 바꿨다 — **AI 종합 리뷰 → 사이드바 SCT `영역별 점수 요약`을 본문 `4) 자기개념` 아래로 드래그 앤 드롭 → Ⅲ 행동 관찰 `초안 작성`·적용 → 77점·2건**. 드래그 앤 드롭은 제품 사본에 이날 추가한 실기능(`features.md` §드래그 앤 드롭 · `human.mjs` `h.drag`). HTP 그림이 아니라 표를 넣는 이유는 그림(666×942)이 900px 뷰포트에 안 잡혀서(t05~t07). raw에는 `aireview_t02`~`t08`이 이미 있다(전부 폐기, 이력은 notes.md 테이크 표). **DB 충돌 주의** — s02 촬영이 같은 로샤를 `in_progress`로 움직이므로 s02가 끝난 뒤 재시드(`seed`+`seed_content`)하고 리허설 오류 0을 본 다음 찍는다 |
| **s04 바로링크** | 검사 | ✅ **준비 완료 (웹만) · 검사 4건으로 재검증 09-10** — **기존 테이크(t01~t03) 전부 무효, 재촬영 필요** | **헤드리스 10단계 9.8초 / 시뮬레이션 10.0초 · 종료 코드 0 · 오류 0 · 노컷 6.32–7.93** | 폰 파트는 뺐다(아래 결정 사항). 검사가 2→4건이 돼도 **조작·셀렉터·타이밍은 한 글자도 안 바뀐다**: `hasOnlineLink`는 `uids.some(...)`이라 건수 무관(`status/view-model.ts:45-54`), 모달에는 여전히 **온라인 1건만**(`SendResultModal.svelte:175-183`), 전송 내역은 검사명을 안 싣는다(`SendLinkHistory.svelte:147-180`). `.last()`도 그대로 — 버튼 수는 검사가 아니라 **카드 수**를 따른다(모달 전 3 · 후 4). **무효인 이유는 데이터다** — 세 테이크 전부 `s01 t07`(검사 2건) 위에서 찍혀 오프닝 카드가 `로르샤흐 검사 외 1건 · 0/2`다. **s01을 다시 찍을 때 같은 시드에서 t04를 찍는다.** 4건에서 드러났던 카드 검사줄 잘림은 제품을 고쳐 없앴다(아래 제품 변경 표) |
| **s05 일정** | 회기 | ✅ **준비 완료 (웹만)** | **17단계 14.8초** · 오류 0 (절차 재구성 후 · 새 시드 09-10b) | 내담자 앱은 뺐다. 요청은 `_scripts/s05-setup.sql`, 일간·주간·월간에 뜰 일정은 `_scripts/s05-schedules.sql`(35건). 절차: 요청 확인 → 스케줄 일간→주간→**월간** → 월간에서 변동 확인으로 확정. 노컷 구간은 재구성 후 다시 잡아야 한다 |
| **s06 필드노트** | **검사** | ✅ **웹 재준비 완료 (배역·대기 방식 교체 09-10) · 재촬영 필요** · 앱 절반 무대 완료(조작 `--manual` 남음) | **웹 16단계 10.5초(헤드리스) / 10.6초(시뮬레이션) · 종료 코드 0 · 오류 0 · 노컷 1.28–9.18** | **주인공이 이하준 → 윤도현**(만 12세)으로 옮겨 회기 축에서 검사 축이 됐다. 윤도현에겐 상담 케이스가 없어 `_scripts/s06-setup.sql`이 **개인상담 C00003 + 일정 + 회기 + 참여자 + 필드노트 + 전사(23세그·침묵2)** 를 통째로 만든다 — **s01을 먼저 돌려야 한다**(재시드하면 윤도현이 사라진다. SQL이 그때 `raise exception`으로 멈춘다). SQL은 재실행 가능(제 것만 지우고 다시 만든다)하고 **fieldNoteId는 매번 바뀐다** — 마지막 select로 뽑는다. 스크립트는 SPEC v4로 다시 썼다: 도착은 `until`, 전사는 **안쪽 스크롤 영역**이라 첫 발화에 `hover` 후 `reveal` 5회(침묵 → "말해도 돼요?" → "참으면 되니까요" → 17:22 → 과제). `hold`는 끝맺음 0.6초 하나. 시드 `_seed/saas-2026-09-10c.json`(`c901b092`). **앱 절반 — 무대는 섰다(09-10 저녁)**: `.claude/skills/phone-stage/`가 Release 빌드를 설치하고 토큰 주입·딥링크까지 세운다(`stage.mjs status` 전부 초록). 앞선 세션이 '검은 화면'으로 본 `stills/calibrate-phone.png`는 **오해였다** — 앱은 정상 렌더 중이고, 다크 테마라 YAVG가 33.9일 뿐이다(YMAX=255 · 흰 글자가 있다). 남은 것은 조작뿐이다 — `idb` 미설치라 `capture-phone.mjs --manual`(사람이 탭)로 간다. **연쇄 해소(09-10): s07도 윤도현으로 따라왔다** — s06-setup.sql의 §4(이하준 전사)는 지웠고, 회기 시각은 s07의 `isBeforeStart` 때문에 **2026-09-09 (수) 16:00–16:50**(어제 방과 후)으로 옮겼다. 그 뒤 s06 웹 절반은 **다시 돌려 보지 않았다** — 조작·셀렉터는 그대로지만 회기 카드의 날짜 줄이 09-09로 바뀐다(자세히는 s06/s07 features.md) |
| **s07 자동일지** | **검사** | ✅ **준비 완료 (배역 이동 + 초안 본문 재작성 09-10) · 재촬영 필요** | **7단계 11.5초(시뮬레이션) / 11.6·15.7초(헤드리스) · 오류 0 · 종료 코드 0 · 노컷 0.71–8.32** | **주인공이 이하준 → 윤도현**(개인상담 **C00003** 1회기)으로 옮겨 회기 축에서 검사 축이 됐다 — s06이 녹음한 **그 회기**의 일지라 한 쌍으로 묶었다. `s07-setup.sql`이 `case_code`를 C00003으로 고르고 `production_ai_configs` 행으로 초안 본문을 고정한다(진짜 gpt-4o-mini 호출을 받아쓰기만 시킨다 · 제품 코드 무수정 · 재시작 없음). **본문을 윤도현 전사에서 다시 썼고 네 번 돌려 `counseling_notes.content`가 문자 단위로 동일**(md5 `538ff837…`). 스크롤 뒤 세 칸 위치는 옛 본문과 픽셀이 같아 조작은 그대로다. **s06-setup.sql의 §4(이하준 전사)는 지웠다** — s08은 안 깨진다(케어보드는 `status=completed`+`summary`만 본다 · `field_note/repository.py:317-337`). **새 함정: 회기 시작 시각이 미래면 일지가 통째로 안 열린다**(`InlineJournalEditor.svelte:145-150` `isBeforeStart`) — s06의 회기를 오늘 16:00 → **어제(2026-09-09) 16:00**으로 옮겨 해결했다. **노컷 길이가 테이크마다 다르다** — LLM 응답 6.1~10.1초. 기존 테이크 t04(15.13s)는 이하준이라 폐기 |
| **s08 케어보드** | 모임 | ✅ **t01 촬영 완료 · t02(재구성) 준비 완료** | **t02 · SPEC v4: 17단계 15.3초 · 종료 코드 0 · 오류 0 · 노컷 3.64–12.98** | **구성을 바꿨다** — 탭 훑기(t01)에서 **우측 케어보드 도크 안의 구성원 간 메모 공유**로. 남의 메모 → 내 답 → `공지로 고정` → 접었다 열면 **김원장이 다른 계정으로 실제 API로 남긴 답이 도착**. 선행 `_scripts/s08-setup.sql`(되돌리기 SQL 동봉) · 두 번째 계정 상태 파일 `_state/local-saas-admin.json`(refresh 토큰으로 access 재발급). 404(보호자 이름 N+1)는 제품을 고쳐 없앴다(아래 표). 이하준 clientId `77458809-…` |
| **s09 회기·정산** | 회기 | ✅ **준비 완료** (사유 입력 추가 재구성) | **SPEC v4: 10단계 10.6초 · 오류 0 · 종료 코드 0 · 노컷 6.1–7.8** | 노쇼 모달의 **사유 입력 → 잠긴 회기의 사유 카드**까지 간다. 되돌리기는 `_scripts/s09-reset.sql`(행 유지 = sessionId 유지), 행 생성은 `s09-setup.sql` |

**검사 축은 순서가 있다.** s01을 먼저 돌려야 s04의 케이스(AC0002~4, 로르샤흐 · HTP · SCT · 스마트폰중독검사 4건)가 생긴다.
s01 없이 s04를 돌리면 `바로링크 전송` 버튼 자체가 안 뜬다.
**s01을 다시 찍으면 s04도 같이 다시 찍는다** — 두 장면은 같은 시드 위에서만 한 편으로 붙는다(s04 테이크가 전부 무효가 된 이유).

## 환경 세우기

```bash
# 1) DB · 캐시
cd movies/26IRDEMO/_tool/saas-center-platform && pnpm db:up

# 2) API (3502) — reload 쓰지 말 것(WeasyPrint가 죽는다), 드라이런 켤 것
cd apps/api && DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib \
  REDIS_URL=redis://localhost:3505/0 MESSAGING_DRY_RUN=true \
  uv run uvicorn app.main:app --host 0.0.0.0 --port 3502

# 3) 웹 (3503)
cd ../.. && pnpm dev:web

# 4) 시드·로그인 되돌리기 (사이클마다)
.claude/skills/scene-prep/scripts/reset-seed.sh --yes
```

| | |
|---|---|
| 포트 | web **3503** · API **3502** · postgres **3501** · redis **3505** |
| 계정 | 정상담 `counselor1@mindscope.com` / `test1234` · 상태 파일 `_state/local-saas-counselor1.json` |
| 시드 기준선 | 마인드스코프 아동심리상담센터 · 내담자 7 · 기관 0 · 상담케이스 2 · 검사케이스 1 · 필드노트 3 |

### 마인드봄 (s02·s03의 무대)

투사검사(로샤·HTP·SCT) 해석 보조. **saas와 연동되지 않는다** — `center_link`는 보호자 앱↔센터 연결이지 제품 간 다리가 아니다.
두 제품을 잇는 것은 `_tool/mindbom/apps/api/scripts/cast.py`의 **배역**뿐이고 정본은 saas develop 시드다(`_scripts/check-cast.py`가 점검).

```bash
cd movies/26IRDEMO/_tool/mindbom && pnpm db:up && pnpm dev:api && pnpm dev:web

# 시드 — 이 세 줄이 전부다. 순서를 지킨다
# uv run·nohup·/bin/sh 셔뱅을 거치면 macOS가 DYLD_*를 벗긴다 — .venv/bin/python을 직접 부른다
cd apps/api && .venv/bin/python -m scripts.seed \
  && .venv/bin/python -m scripts.seed_content \
  && .venv/bin/python -m scripts.seed_notifications
```

**`seed_rorschach_full`을 이 흐름에 넣지 마라** — 박지우에게 note 없는 로샤를 한 건 더 만든다(껍데기 시드 시절의 도구다).

| | |
|---|---|
| 포트 | web **4503** · API **4502** · postgres **4501** |
| 계정 | 같은 배역. 상태 파일 `_state/local-mindbom-counselor1.json` |
| 역할 매핑 | ADMIN·MANAGER→admin · STAFF→researcher · **COUNSELOR→clinician**(정상담이 검사 실시·채점·확정) |
| 지원 검사 | **로샤 · HTP · SCT 셋뿐.** 등록 모달의 나머지 15종은 `comingSoon` 회색 — saas 18종과 3+15로 정확히 대응 |
| 로샤 단계 | `실시(collect)` → `채점하기(review)` → `결과 보기(results)`. 확정 전엔 결과가 **잠김** |
| 데이터 기준선 | 검사 **14건** · 로샤 반응/영역/카드 **44/44/20** · HTP 그림 20(실제 PNG 1050×1485)·객체 148·해석 56 · SCT 3건(`result_data` JSONB) · 종합보고서 1 · 배터리 1 · AI잡 8 |

**시드가 껍데기였던 문제는 끝났다.** 예전엔 status 컬럼만 있고 속이 비어서, `under_review` 로샤를 열면 "반응 없음 · R 0",
`ai_draft_ready` HTP를 열면 "그림을 업로드하세요"였다. 지금은 DOM으로 확인된 것만 적으면:

- 로샤 채점(이하준 `under_review`) — `R 22 · 채점 8/22`, 부호 표(`D9 + Ma H P ZW 5.5 COP`), `임상가 확인이 남은 반응: 카드 IV ②…`
- 로샤 결과 Exner CS(박지우) — `Sum6 2 · WSum6 3 · COP 3 · MOR 2 · AG 1`
- HTP(김민준 `in_progress`) — 그림 네 장이 프록시로 실제 로드. 해석 표는 `나무 / 자아강도 / 가늘다 / 기둥이 가늘어…`
- SCT(김영희 `confirmed`) — `A 가족 관계 36/54` 등 5영역 + 문항별
- 내담자 박지우 — 배터리 3종 확정 → **`종합보고서 작성` 버튼 활성**(s03 진입로)

**DYLD_FALLBACK_LIBRARY_PATH가 없으면 API가 안 뜬다** — WeasyPrint가 `libgobject`를 못 찾는다.
**마이그레이션 체인은 빈 DB에서 안 돈다** — 최초 리비전이 기존 스키마를 전제한다. `init_db → alembic stamp head → seed.develop` 순서가 정본이고 `reset-seed.sh`가 그대로 한다.

## 결정된 것

| | |
|---|---|
| 촬영 시점 | **마지막에 한 세션으로 몰아서.** 그 전까지는 준비만 |
| 주인공 | 상담사 **정상담** 고정 (CAST.md) |
| 배역 축 | 검사(s01·s02·s03·s04) · 회기(s05·s06·s07·s09) · 모임(s08) |
| s01 검사 항목 | **네 건** — 로르샤흐 · HTP · SCT(대면 셋 = 윤도현의 마인드봄 배터리 → s03) + 스마트폰중독검사(온라인 → s04). 한 접수가 두 갈래로 갈린다. 나이(만 10~12세)가 여기서 역산됐다 |
| s04 폰 파트 | **뺀다.** 폰이 아니라 모바일 웹이라 현재 촬영 SPEC에 경로가 없다 |
| 문자 발송 | `MESSAGING_DRY_RUN=true` — 자격증명 없는 로컬에서 발송 실패가 흐름을 끊지 않게 |
| **모바일 촬영 범위** | **전문가 앱(`apps/mobile`)만** 찍는다. 내담자 앱(`mobile-client`)은 찍지 않고, 그 화면이 필요한 자리는 비운다 — 대신 그 상태를 만드는 **데이터는 준비 단계에서 진짜로 만든다**(s05가 그 예) |
| s08 배역 | 김민준 → **이하준**. COUNSELOR는 담당 내담자만 열람된다(`access_level=own`, `get_client.py:14-19`) |
| **s08 구성 (t02)** | 탭 훑기 대신 **우측 케어보드 도크 안의 공유**. §08의 아날로그 문장 둘 중 ①("네 곳에 흩어져")은 t01이 이미 찍었고, t02가 ②("같은 일지를 필요로 하는데 한 사람의 파일에만 있다 → 그 대화는 사라진다")를 찍는다. 도크 스트림 자체가 상담·검사·문서·바우처·필드노트·메모를 한 줄기에 세우므로 ①도 첫 프레임에 남는다 |
| **s08 두 번째 배역** | **김원장(관리자)**. 메모를 쓸 상대는 `access_level=all`이어야 한다 — 최치료(COUNSELOR)는 담당 아닌 이하준의 보드에 접근 자체가 404다 |
| **s03의 주장 · 선택본** | **`aireview` 하나다** — `draft`(AI 초안 생성)는 안 찍는다. 주장은 **"AI가 초안을 *검토*한다"**: `preset-body.ts`의 본문이 상담사가 이미 쓴 글이 되고, AI는 그 위에서 누락·표현·모순을 잡는다. 심어둔 결함 셋(Ⅲ 공란 · '되어진'·'환자'·'매우' · '중등도' vs '경미한')이 그 연출의 재료고 실측으로 셋 다 지적으로 뜬다. **"개발 예정" 라벨은 편집에서 사용자가 직접 넣는다** — 제품·스크립트에 넣지 않는다 |

## 제품에 손댄 것 (촬영을 위해)

`_tool/saas-center-platform`은 이 저장소에 커밋되지 않는다. 다른 세션이 이 변경을 모르면 재현이 안 된다.

| 변경 | 왜 |
|---|---|
| `receive-service.ts` — `resolveInstitutionId()` 추가, 기관 확정을 내담자 생성보다 앞으로 | 에이전트가 얹은 신규 기관 스텁이 승격되지 않아 `POST /assessment-cases/batch`가 **404**였다. s01 첫 촬영이 이걸로 실패했다 |
| `config.py` `MESSAGING_DRY_RUN` + `infrastructure/messaging/dryrun.py` | 위 참조. 기본값 False, 촬영 환경만 켠다 |
| `handlers/field_note/generate_counseling_note.py` — dispatch `params`에 **`client_ids` 추가** | 계산해 놓고 안 넘겨서 `GenerateCounselingNoteService`의 upsert 루프가 빈 채로 돌았다. 일지가 한 건도 안 써지는데 **단계는 completed로 찍혀** UI가 영원히 "전사 분석 중…". s07이 이걸로 막혀 있었다 |
| **검사 케이스 카드의 검사명에 `min-w-0`** (s04) — `apps/web/.../cards/AssessmentCaseCard.svelte:282-289`, 검사명 `Typography`의 `truncate-safe` 옆에 `min-w-0` 추가(+ 이유 주석) | 플렉스 자식의 `min-width:auto` 때문에 `truncate-safe`의 말줄임이 발동하지 못했다. `기관 배지(103) + 집-나무-사람 그림검사(137) + 외 3건(37) + 갭 12 = 289px`가 쓸 수 있는 233px를 **56px 넘겨**, 카드 `overflow-hidden`이 이름을 말줄임표 없이 자르고 **`외 3건`이 통째로 사라졌다**. 검사 2건일 때는 1px 초과라 안 보였고, **s01이 4건이 되며 첫 이름이 HTP로 바뀌자 드러났다**. 고친 뒤 실측: 넘침 0px · `외 3건` 보임 · 이름은 말줄임표 처리 |
| **관계 목록에 상대 이름 동반** (s08) — `client/relation/schemas.py` `RelationResponse.related_client_name` 추가 · `relation/handlers/list_relations.py`가 `ListClientsByIdsService`로 한 번에 채움 · `apps/web/.../detail-service.ts` `fetchRelations`가 `getClientDetail()` 호출 제거 · `client.action.ts` 타입 동반 | 케어보드가 보호자 **이름 하나** 때문에 담당 범위 가드가 걸린 단건 조회를 관계마다 불러 **404**, `Promise.all` 거부로 `가족관계` 행이 통째로 사라졌다. **가드(`_resolve_assigned_client_ids`·`get_client.py`)는 한 줄도 안 건드렸다** — 레포 자체 규약(`rules/api/agent-query.md` "`{ref}_id`에는 `{ref}_name`을 동반")이 이미 요구하던 형태다. 전문가 앱(`mobile/.../hooks.ts useClientRelations`)은 `phone`까지 쓰므로 그대로 남겼다 |

**s07 상담일지 초안 본문은 제품 코드가 아니라 데이터로 고정한다.** 초안은 스텁이 아니라 진짜 `gpt-4o-mini` 호출이라
(`AIGateway._get_llm_client`, `llm_calls`에 기록됨) 테이크마다 문안이 달라졌다. `_scripts/s07-setup.sql`이
`production_ai_configs`에 `module=field_note · pipeline_step=counseling_note` 행을 하나 넣어 `system_prompt`를 덮는다 —
`resolve_config`가 호출마다 DB를 읽으므로 **코드 수정도 워커 재시작도 필요 없다**. 재시드하면 사라지니 촬영 전 setup을 꼭 돌린다.

`_tool/mindbom`도 커밋되지 않는다. 여기도 손댔다.

| 변경 | 왜 |
|---|---|
| `scripts/seed_content.py` + `content_htp.py` · `content_sct.py` **신규** | 시드가 status만 세팅한 껍데기라 화면이 비었다. 검사 속(반응·영역·그림·객체·해석·보고서)을 채운다. `seed:<slug>` 자연키라 멱등 |
| `scripts/seed.py` — 박지우 `battery-htp`·`battery-sct` 2건과 `BATTERY` 추가 | 종합보고서 버튼은 **같은 battery_id로 묶인 확정 검사 2건 이상**에서만 열린다. 로샤 하나로는 s03 진입로가 없었다 |
| `scripts/seed_rorschach_full.py` — `_find_existing`에 `exam_type='rorschach' AND note IS NULL` 조건 | **버그.** 박지우의 *모든* 검사를 찾아 `--drop` 한 번에 로샤·SCT·HTP 3건이 같이 soft delete됐다 |

## 촬영 도구 상태 (SPEC v3)

| | |
|---|---|
| **스크롤 (v5, 09-10 밤)** | `h.scroll`이 **거리를 먼저 정하고** 커서 이동과 같은 시간(`moveMin + 거리×movePerPx`, `moveMax` 상한)·ease-out으로 16ms마다 작은 휠 델타를 보낸다. v4의 140px 휠은 CDP 합성 이벤트라 smooth scrolling을 안 타 **한 프레임 점프**였다(s01 t07: 364px이 3프레임). t09 실측: 16프레임 연속, 최대 57px/프레임. 델타는 정수 누적이라 합이 정확히 dy — 172→140 반올림도 사라졌다. `rehearse.mjs --fast`는 `scrollFrame: 4` |
| 커서 | `sckcap`이 프레임에 합성 — 진짜 `NSCursor` 이미지(arrow · ibeam · pointer). 페이지 오버레이 아님 |
| 포커스 | **뺏지 않는다.** 전체화면·`bringToFront` 없음, 창 필터로 그 창만 잡는다 |
| 크롬 높이 | 매 촬영 자동 측정(마젠타 띠 + 창 전체 스냅샷). 실측 87pt |
| 번역 풍선 | 문서 응답의 `<html lang>`을 ko로 바꿔 제거(제품 `app.html`이 `lang="en"`이라 뜬다) |
| 실측 | 11초 테이크에서 고유 프레임 639 · 드롭 0 ≈ 57fps (v2는 약 20fps) |
| `login.mjs` | **`/select-institution` 분기를 더했다**(2026-09-10) — 마인드봄은 기관이 하나여도 그 화면을 거치고, 버튼을 안 누르면 기관 쿠키가 없어 API가 403이다. saas의 `/welcome` 분기 바로 뒤 |
| **알려진 한계** | 창이 **완전히 가려지면** macOS가 렌더를 멈춰 프레임이 검게 나온다. `MacWebContentsOcclusion` 플래그를 껐지만 **검증 미완**. 촬영 중 그 창을 완전히 덮지 말 것 |

## 함정 (같은 데서 두 번 넘어지지 말 것)

- **같은 날 두 번째 시드 스냅샷은 접미사를 줘야 한다** — `reset-seed.sh --yes --snapshot`은 `_seed/saas-<오늘>.json`이 있으면 "이미 있음"으로 건너뛴다(에러 아님, 조용히 지나간다). DB는 이미 다시 만들어져 id가 바뀐 뒤라 옛 스냅샷은 틀린 것이다. `./_scripts/seed-snapshot.sh saas 2026-09-10d`처럼 날짜 인자를 직접 준다

- **일정 시각은 UTC(naive)로 저장된다** — 시드의 `10:00`은 KST 19:00이다. 변경 요청을 KST로 넣으면 9시간이 밀려 승인이 **항상 409**
- **COUNSELOR는 담당 내담자만 본다** — 목록에 안 보이는 사람은 URL로도 못 연다. 케어보드는 보호자 프로필을 따로 부르는데 그것도 막혀 404가 난다
- **AI 작업은 API만 띄우면 안 돈다** — `pnpm dev:api`는 uvicorn + `app.worker.stream` + `app.worker.batch` 셋을 띄운다. uvicorn만 띄우면 조용히 멈춘다(그래도 여전히 미해결 — s07 참조)

- **같은 문구의 버튼이 둘일 수 있다** — s04의 `바로링크 전송`은 카드에도 모달에도 있다. `.first()`가 모달 뒤 카드를 눌러 **오류도 토스트도 없이 아무 일도 안 일어났다**. `.last()`로 잡는다. (2026-09-10 재확인: 버튼 수는 검사 건수가 아니라 **카드 수**를 따른다 — 모달 전 3 · 후 4. `.last()`는 여전히 모달 제출이다)
- **카드가 `외 N건`을 안 보여주면 플렉스 `min-width:auto`를 의심한다** — `truncate-safe`(`overflow:clip`)만으로는 말줄임이 안 걸린다. 옆에 `min-w-0`이 있어야 한다. s04에서 검사가 4건이 되며 터졌고 제품을 고쳤다(위 제품 변경 표). **`_tool/`은 커밋되지 않으므로 그 표의 줄이 사라지면 다음 세션은 잘린 카드를 다시 만난다**
- **회기 상세는 시작 시각이 미래면 일지를 통째로 안 연다** — `InlineJournalEditor.svelte:145-150` `isBeforeStart`가 `new Date(session.start) > Date.now()`로 **벽시계 시각을 그대로** 본다. `status=completed`이고 출결이 `attended`여도 소용없고 `일지 초안 생성` 버튼 자체가 없어 셀렉터가 30초 타임아웃으로 죽는다. **선행 SQL이 만드는 회기는 반드시 과거로 둔다**(s07이 여기서 넘어졌다)
- **HTTP 오류가 없다고 저장된 게 아니다** — 그래서 사이클 6번에 DB 확인이 있다
- **저장이 있는 장면은 두 번 못 돌린다** — 같은 이름의 내담자가 있으면 `POST /clients`가 409. 리허설 사이에 `reset-seed.sh`
- **재시드하면 로그인 토큰이 죽는다** — 계정 id가 바뀐다. `reset-seed.sh`가 상태 파일을 같이 다시 만든다
- **`관계`는 input이 아니라 Select** — `input[placeholder="관계"]`는 없다
- **시드는 필드노트를 만들되 전사는 안 채운다** — `status=completed`인데 화면은 "전사 데이터가 없어요.". `s06-setup.sql`이 `refined_transcript`를 넣는다
- **버튼 라벨을 추측하지 말 것** — s09의 출결은 `노쇼`가 아니라 **`노쇼했어요`**. 안 맞으면 조용히 지나간다
- **확인 모달 안의 스위치가 기본 꺼짐일 수 있다** — s09의 `회기 차감`. 라벨을 맞춰도 DB는 안 바뀐다
- **케어보드 핀은 엔트리 id로 걸린다** — 메모를 등록하면 낙관 행이 **임시 id**로 먼저 그려진다. 재조회를 기다리지 않고 핀을 누르면 `POST /entries/optimistic-memo-…/pin`이 404다(s08 스크립트가 `/care-board/stream` 응답을 기다리는 이유)
- **케어보드 안 읽음 배지는 실제로 뜨지 않는다** — 배지는 *닫힌* 진입 버튼에 붙는데 그 값을 만드는 스트림 쿼리는 `enabled: () => open`이라 닫혀 있으면 돌지 않는다. 열리면 값이 오지만 그때 버튼은 사라졌고 `markSeen()`이 0으로 내린다. 연출 재료로 쓰지 말 것
- **케어보드 메모는 알림을 보내지 않는다** — `care_memo_created`가 `EVENT_REACTIONS`에 없다. 멘션·댓글도 없다(`docs/careboard/domain.md:508` 유보). 차트 모달은 전부 목업(`CareBoardDock.svelte` `CHART` 리터럴)
- **로그인은 파일로 판단하지 말고 물어봐라 — 물어보면 고쳐지기도 한다** (09-10 저녁, 웹·폰 양쪽 실측). 토큰이 `_state/*.json`·AsyncStorage에 남아 있어도 만료됐을 수 있고, 쿠키의 `expires`는 다음날까지 멀쩡해 보인다(그건 쿠키 수명이지 토큰 수명이 아니다). **증상이 401이 아니라 30초 타임아웃으로 오기도 한다** — 화면은 열리는데 셀렉터가 영영 안 뜬다(s02가 이걸로 테이크 둘을 태웠다). 반대로 **만료가 곧 죽음도 아니다**: 앱은 실행 때 `refresh_token`으로, 웹은 요청 때 서버가 갱신한다(마인드봄 `routes/api/auth/check/+server.ts` 2단계 · saas `hooks.server.ts:27-40`, `/api/proxy/*`도 탄다). 그래서 촬영 직전에 한 번 부르는 것이 진단이자 복구다 — 웹은 `capture-service/scripts/auth-check.mjs`, 폰은 `phone-stage`의 `stage.mjs status`·`goto`. 타임아웃도 실패로 센다. **자기 치유에는 기한이 있다** — 리프레시는 saas 30일(`refresh_tokens.expires_at` 실측) · **마인드봄 7일**(`apps/api/app/core/config.py:16`)이고, saas는 재발급 때 리프레시 토큰을 새로 주지 않아(`handlers/auth/refresh_token.py:86` `# 기존 토큰 그대로`) **시계가 최초 로그인부터 흐르고 리셋되지 않는다.** 그 기한이 지나면 다시 로그인하는 수밖에 없다
- **meta의 시드 sha는 세션 중 재시드를 못 잡는다** — `_seed/*.json`은 DB 덤프가 아니라 **지문 파일**이고 `seed-snapshot.sh`를 사람이 돌릴 때만 다시 써진다. 09-10 저녁 실측: s02 t06(17:05)과 t09(17:17)이 17:12 재시드를 사이에 두고도 sha가 같았다(`416e30f069ac`). **sha가 같아도 같은 DB였다는 뜻이 아니다.** 상태를 남기려면 촬영 직전에 DB를 직접 세라 — 예: `psql … -Atc "select count(*) from rorschach_responses;"`
- **`raw/*.mov`는 gitignore 대상이라 git으로 복구가 안 된다** — `git clean -fdx`·`-fdX`는 이 저장소에서 촬영 원본을 통째로 날린다. `git checkout --`은 안전하지만 `clean`의 `-x`는 아니다. 세 짝(mov·meta·manifest) 점검: `python3` 한 줄로 `manifest.csv`의 file 열과 `s0*/raw/*.mov`를 맞춰 본다
- **평균 밝기로 '검은 화면'을 판정하지 말 것** — 전문가 앱은 다크 테마다. 정상 렌더 프레임의 YAVG가 33.9/255다. 검은지 보려면 **YMAX**를 봐라(정상이면 255) 아니면 그냥 눈으로 봐라: `ffprobe -f lavfi -i "movie=X.png,format=gray,signalstats" -show_entries frame_tags=lavfi.signalstats.YAVG,lavfi.signalstats.YMAX -of csv=p=0`
- **`care_board_entries`가 통째로 비어 있을 수 있다** — 09-10 저녁 확인 시 0행이었다(s08은 여기가 축이다). 원천은 멀쩡하니 재구축하면 된다. `.venv/bin/python -m scripts.backfill_care_board` (멱등 · 7명 16행). 촬영 전에 `select count(*)`로 확인할 것
- **s09를 되돌리면 케어보드에 유령 행이 남는다** — 5회기 세션 행이 하드 삭제되는데 엔트리는 스냅샷이라 남고 `원본 삭제됨`이 찍힌다. `backfill_care_board`는 없는 원천을 못 본다 → `s08-setup.sql`이 가리키는 것 없는 행만 지운다
- **s09는 한 번만 돌아간다** — 노쇼 처리하면 회기가 잠긴다(`status=cancelled`). 다시 돌리려면 `_scripts/s09-reset.sql`을 넣는다 — 행을 지우지 않아 **sessionId·촬영 URL이 유지된다**. 행이 아예 없을 때만 `s09-setup.sql`(이쪽은 sessionId가 새로 생긴다). 시드 전체 리셋은 다른 세션의 DB를 깬다
- **모달 안의 입력 칸을 빼먹지 말 것** — s09 노쇼 모달에는 스위치 말고 **사유 textarea**가 있었고, 앞선 준비는 그것을 비운 채 통과했다(`memo=null` → "기록된 사유가 없어요"). 종료 코드 0은 화면이 장면의 논지를 보여준다는 뜻이 아니다 — 모달을 열면 안에 있는 것을 전부 센다
- **`h.reveal`은 이미 보이는 요소에 쓰지 않는다** — s09 모달(420px)은 뷰포트에 다 들어오는데도 dy=67로 배경이 밀렸다. 커서만 옮기면 될 때는 `h.hover`
- **준비 SQL의 상태값이 enum에 있는지 확인할 것** — s09 setup이 넣던 `pending`은 `AttendanceStatus`에 없는 값이었다. 화면이 멀쩡했던 것은 `InlineJournalEditor`가 예정 회기의 출결을 정규화해 준 우연 덕이다. `scheduled`로 고쳤다
- **관계 목록은 상대 이름을 응답에 싣는다** — 예전엔 이름 하나 때문에 관계마다 단건 조회를 불러 보호자가 404였고, `Promise.all` 거부로 `가족관계` 행이 통째로 사라졌다. 고쳤다(아래 제품 변경 표). **API에 reload가 없어 재시작해야 적용된다**
- **AI 파이프라인 로그의 `Step note_status completed`가 곧 상담일지 단계다** — `_COUNSELING_NOTE.status_field='note_status'`. 다른 단계로 오인하기 쉽다
- **AI 워커는 `pnpm dev:api`가 띄우는 셋 중 둘이다** — uvicorn만 띄우면 안 돈다. `app.worker.stream` · `app.worker.batch`도 같이
- **`expo run:ios`는 마지막 실행 단계에서 osascript 자동화 권한을 요구한다** — 빌드는 성공하므로 `simctl install` + `simctl launch`로 우회
- **idb는 `/usr/local/bin/idb_companion`을 고정 경로로 찾는다** — Apple Silicon에선 컴패니언을 직접 띄우고 `idb connect localhost 10882`
- **`brew install idb-companion`은 `brew trust facebook/fb` 먼저** 해야 설치된다
- **`idb ui tap`은 포인트 좌표다**(iPhone 17 Pro 402×874pt). 스크린샷 픽셀을 3으로 나눈다
- **`idb ui text`가 끝 글자를 흘린다** — `describe-all`의 `AXValue`로 확인하고 이어 친다. 지우는 것보다 앱 재시작이 빠르다
- **두 제품은 연동되지 않는다** — s01에서 접수한 사람이 마인드봄에 생기지 않는다. 이을 수 있는 것은 배역·센터·담당자·검사 종목까지고, **인물 동일성은 주장하지 말 것**. `check-cast.py`가 "지어낸 사람은 배역표에 넣지 않는다"로 막는다
- **s03 보고서 본문은 프리셋이다** — 사이드바 자료는 시드에서 오지만 본문 Ⅰ~Ⅴ는 `report/preset-body.ts`다. **AI 리뷰 시연용 결함이 일부러 심겨 있다**(Ⅲ 공란 → "섹션 누락", Ⅳ-5 '되어진'·'환자'·'매우' → 표현 교정, Ⅳ-2 '중등도' vs Ⅴ '경미한' → 모순). 지우면 리뷰 시연이 빈손이 된다. 2026-09-10에 본문을 **윤도현(만 12세)용으로 다시 썼고 실시한 검사를 실검사 3종으로 줄였다** — TCI·MMPI-2·S-척도는 사라졌다(`report-data.svelte.ts`의 `MOCK_MATERIALS` 제거 · `overall-review.svelte.ts`의 `REVIEWED_EXAMS`). 검사가 셋이 되면서 `Ⅱ. 실시한 검사`가 53자로 줄어 "서술이 짧습니다"(60자 미만, `overall-review.ts:205`)에 걸렸고, 불릿에 실시 방식 구절을 붙여 105자로 없앴다
- **시드로 못 고치는 목업 셋** — `report/mock-materials.ts`(TCI·MMPI-2·S척도, 결과지 이미지는 `static/mock-reports/`), `report/mock-longitudinal.ts`(교차분석 패널), `report/overall-review.ts`(AI 종합 리뷰 카드 고정 문안). 화면에 올리려면 목업임을 알고 올린다
- **SCT는 테이블이 없는 게 정상** — `examinations.result_data`(JSONB) 한 칸에 응답·채점·요약이 다 들어간다(`sct/services.py`). `sct_*` 테이블을 찾지 말 것
- **마인드봄 로그인 토큰도 죽는다** — 재시드하면 `401 GET /api/auth/check`이고 화면은 `403 기관이 선택되지 않았습니다`가 된다. `_state/local-mindbom-counselor1.json`을 다시 만든다(saas의 `reset-seed.sh`는 saas만 한다):
  `CAP_EMAIL=counselor1@mindscope.com CAP_PASSWORD=test1234 node ../../.claude/skills/capture-service/scripts/login.mjs --base http://localhost:4503 --out _state/local-mindbom-counselor1.json`
- **넓은 셀렉터로 캔버스를 잡지 말 것** — s02의 `h.drawOnCanvas('svg, canvas')`가 우상단 사용자 메뉴의 16px 아이콘을 물어 드래그가 클릭이 됐다. 그리기 판은 `svg[aria-label="영역 그리기"]` 하나다
- **촬영 뒤 ticks를 본다** — `meta.capture.stats.ticks ÷ duration`이 60이 아니면 60Hz 기록기가 굶은 것이고 영상이 짧고 빠르게 나온다(s02 t04: 924 ticks / 22초 → 15.4초로 압축). 머신이 바쁘면 재발한다
- **전사 도착 전에 팝오버를 열면 자유반응이 덮인다** — 빈 초안이 블러 때 저장된다. 4xx가 안 뜬다(features.md)
- **영역 저장 확인은 `rorschach_regions.response_id`로** — `rorschach_responses.region_id`는 안 채워진다(링크가 반대). 이걸 보고 "영역이 저장 안 된다"고 한 번 오판했다
- **마인드봄 DB 계정은 `mindbom/mindbom`** — saas의 `imomtae`가 아니다. 반응 테이블의 키는 `examination_id`가 아니라 `session_id`(`rorschach_sessions` 경유)
- **s02의 로샤는 시드 기본이 `confirmed`다** — 배터리 `battery-yundohyun`의 일원이라 `seed.py`가 확정으로 만들고 `seed_content.py`가 반응 22를 채운다(s03의 재료). s02는 그 반대 상태에서 시작하므로 **`_scripts/s02-reset.sh`를 매번 먼저** 돌린다. 안 돌리면 화면은 열리는데 `POST …/rorschach/responses`가 400이고(`services.py:80-95` `_ensure_editable`) 9단계에서 멈춘다. **반대로 s03은 확정 상태를 쓴다 — 남의 촬영 지점에서 reset을 돌리면 그쪽이 깨진다**
- **`/collect`는 status로 잠기지 않는다 — 잠기는 건 쓰기다** — 로샤 모듈의 collect에는 `enabled`가 없다(`rorschach/module.ts:45-51`). 확정된 검사를 열어도 화면은 뜨므로 "열렸으니 됐다"로 판단하지 말 것
- **영역 자동 매칭이 임상가가 고른 위치 부호를 덮은 적이 있다** — `CardCanvas.svelte:257-262`가 부호가 비어 있을 때만 넣는다지만, `W` 클릭 직후 첫(콜드) 그리기 한 번이 `W`를 `D4`로 바꿔 저장했다(4회 중 1회). 오류도 토스트도 없다 — **테이크마다 `area_code`를 DB로 확인한다**
- **마인드봄 DB는 psql로 붙는다** — 이 기계에서 `docker exec`는 권한이 막혀 있다. `PGPASSWORD=mindbom_dev psql -h localhost -p 4501 -U mindbom -d mindbom`
- **촉구는 카드 단위 토글이다** — 같은 검사에서 s02 스크립트를 두 번 돌리면 두 번째가 촉구를 꺼버리고 반응만 쌓인다. 마인드봄 재시드 뒤 한 번만 돌린다
  `login.mjs`가 이제 마인드봄의 `/select-institution`도 넘어간다:
  `CAP_EMAIL=counselor1@mindscope.com CAP_PASSWORD=test1234 node ../../.claude/skills/capture-service/scripts/login.mjs --base http://localhost:4503 --out _state/local-mindbom-counselor1.json`
- **접수 폼의 `등록` 버튼은 DOM에 둘이다** — 사이드바(`ReceiveStepperLayout.svelte:386`, `hidden … 2xl:flex`)와 하단 고정 액션바(`:434`, `2xl:hidden`). SPEC 1600px는 2xl(1536)을 넘어 사이드바만 보인다. **뷰포트를 1536 아래로 내리면 둘 다 잡혀 `.first()`가 안 보이는 쪽을 누른다**
- **검사 세트(패키지)를 시드에 넣으면 s01 셀렉터가 깨진다** — 세트 카드 버튼은 안에 든 검사의 `kor_name`을 이어 붙여 그린다(`AssessmentSelector.svelte:70-74`). 지금은 `assessment_packages`가 0행이라 `button:has-text("로르샤흐")`가 유일하다
- **접수 폼 우측 `접수 진행`의 검사 항목 요약은 영문이다** — `selectedAssessmentItems`가 `eng_name`이라(`+page.svelte:154,498-510`) 화면에 `Rorschach Inkblot Test 외 3개`로 뜬다. 좌측 버튼만 한글이다. 셀렉터 충돌은 없지만 **프레임에 영문이 남는다**
- **`_mocks/`에는 에이전트 대본이 아닌 파일도 있다** — `s02-stt.json`은 `turns`가 없는 STT 클립 파일이라 `check-mock.mjs`가 통째로 깨졌다. 이제 `clips`만 있는 파일은 건너뛴다
- **`초안 생성`은 `AI 초안 생성`의 부분 문자열이다** — `has-text`로 잡으면 모달 뒤 헤더 버튼을 눌러 아무 일도 안 나고 오류도 없다. `exact: true`로 잡는다
- **CDSS 푸터에 `모델 rule-based-fallback`이 찍힌다** — `AI_COMPREHENSIVE_URL`(저장소 밖 외부 서비스)이 없어 서버가 룰베이스로 폴백한다. 본 촬영 전에 모델을 연결하든 그 줄을 프레임에서 빼든 정할 것
- **마인드봄 장면의 시작 URL에는 시드 id가 박혀 있다** — s03(aireview)은 `/examinations/<yun-rorschach>/report?ids=<로샤>,<HTP>,<SCT>`이고 `?ids=`의 순서가 본문·사이드바 순서다. 재시드하면 note(`seed:…`)로 다시 뽑는다 — psql 한 줄은 각 features.md
- **마인드봄 토큰은 30분이면 만료된다** — `.env` `ACCESS_TOKEN_EXPIRE_MINUTES=30`. 만료된 상태 파일로 열면 `401 GET /api/auth/check`이고 화면이 안 떠 조작이 첫 단계에서 멈춘다. **리허설·촬영 직전에 `login.mjs`로 `_state/local-mindbom-counselor1.json`을 다시 만든다**
- **마인드봄 `.env`에 `STORAGE_BACKEND=local`이 없으면 HTP 그림이 전부 500이다** — `config.py:50` 기본값이 `"s3"`라 파일이 `/tmp/mindbom-storage/`에 정상적으로 있는데도 빈 버킷으로 S3를 불러 `botocore ParamValidationError`가 난다. 사이드바 `검사자료`의 HTP 썸네일 넷이 빈 칸이 되고 리허설 종료 코드가 3이 된다. **2026-09-10에 그 줄을 넣고 API를 재기동해 해소했다** — API에 reload가 없다

## 갱신 규칙

장면 하나를 준비 완료로 만들 때마다 위 표의 그 줄과 "갱신 시각"을 고친다.
제품에 손대거나 촬영 도구를 바꾸면 해당 절도 같이 고친다. **이 파일이 낡으면 다른 세션이 헛수고한다.**
