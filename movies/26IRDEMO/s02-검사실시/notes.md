# s02-검사실시 — 검사는 207분

기기: web · tablet
배역: 검사 축 — **윤도현**(s01이 접수한 셋 중 하나)의 로샤. 마인드봄에서 clinician 정상담이 실시  (정본 CAST.md)

## 먼저 — 시드 기본은 `confirmed`이고 s02는 되돌리기에서 시작한다

**다음 세션이 여기서 넘어진다.** 마인드봄 종합보고서 배터리가 박지우 → **윤도현**으로 옮겨지면서
(`seed.py:48` `battery-yundohyun`) s02가 쓰는 `seed:yun-rorschach`가 그 배터리의 일원이 됐다.
그래서 **시드 직후의 기본 상태는 s03 기준**이다 — `status=confirmed` · 반응 22 · 영역 22 · 카드 10 · 촉구 2.

그 상태로 s02를 돌리면 실시 화면은 열리지만 **쓰기가 전부 400**이다
(`rorschach/services.py:80-95` `_ensure_editable`). 반응이 안 생겨 `반응 1 선택`을 영영 못 기다린다.

```bash
_scripts/s02-reset.sh          # 반응·영역·촉구·카드·세션을 지우고 status를 created로
```

**리허설·테이크 전에 매번 돌린다.** 마인드봄 전체 재시드는 하지 않는다 — exam id가 바뀌어 촬영 URL이 죽고
같은 DB를 쓰는 다른 작업을 깬다. 검사는 `note='seed:yun-rorschach'`로 찾으므로 id 하드코딩이 없다.
(`docker exec`는 이 기계에서 권한이 막혀 있다 — 스크립트는 `psql -h localhost -p 4501`로 직접 붙는다.)

**s03은 같은 검사를 반대 상태로 쓴다.** DB가 s03 촬영 지점(로샤 `confirmed` · 반응 22)에 맞춰져 있으면
reset이 그걸 깬다 — 돌리기 전에 지금 그 DB를 누가 쓰는지 확인한다.

## 조작 순서

실시 화면(`/collect`)에서 시작한다. 목록은 지나가지 않는다 — 보여줄 것은 **반응 한 줄이 끝까지 채워지는 것**이다.

**1바퀴(자유반응)** 내담자 화면 → 받아쓰기 → 말 → **카드 탭**(반응 ① 생성)
**2바퀴(질문)** 칩 ① 선택(카드가 그리기 판이 된다) → 말 → 영역 그리기
**확인** 임상가 화면으로 → 팝오버가 열린 채로 돌아온다 → 위치 부호 `W`

**임상가가 타이핑하는 칸이 하나도 없다.** 자유반응과 질문을 받아쓰기가 채우고,
칩을 고른 채 나가므로 임상가 화면에서는 한 줄의 모든 칸이 이미 열려 있다. 마지막 `W` 클릭 하나가 사람 몫이다.

**반응은 하나만 다룬다.** 둘을 돌린 t11은 39초였고 편에 안 맞았다 — 논지("말한 것이 그대로 기록이 된다")는 한 줄이면 선다.

## 캡처 지점

리허설 실측(2026-09-10, SPEC v4). 무대는 마인드봄(4503). 실시 화면에서 시작한다.

- 시작: 카드 I · 반응 없음
- 종료: 방향까지 채워진 한 줄
- 전체 길이: 조작 28.7초 + lead/tail 2.7초 ≈ **30초**

| 구간 | 무엇 |
|---|---|
| **노컷 ①** 2.21–16.83 | 내담자 화면 → 마이크 → 탭(잔물결만 퍼진다) → 칩을 고르면 카드가 그리기 판이 된다 → **영역을 그리고, 아이가 답하면 질문 칸이 찬다** |
| **노컷 ②** 16.84–22.31 | 임상가 화면으로 돌아오면 **팝오버가 열린 채 다 적혀 있다** → 위치 부호 `W`, 배지가 초록으로 |

## 리허설

```bash
# 26IRDEMO 에서. 매번 reset 먼저 — 안 그러면 반응이 쌓이고 촉구가 꺼진다
_scripts/s02-reset.sh
EX=$(PGPASSWORD=mindbom_dev psql -h localhost -p 4501 -U mindbom -d mindbom -t -A \
      -c "select id from examinations where note='seed:yun-rorschach'")
node ../../.claude/skills/scene-prep/scripts/rehearse.mjs --scene s02-검사실시 \
  --url "http://localhost:4503/examinations/$EX/collect" \
  --state _state/local-mindbom-counselor1.json \
  --script _scripts/s02-collect.mjs --stt _mocks/s02-stt.json --headless
```

마지막 결과(2026-09-10, 배터리 이관 후 재시드 위에서): **종료 코드 0 · 서버 오류 0 · 24단계 26.9초**.
DB: 자유반응·`_stt_raw`·질문·`W`·`right`·영역 전부 저장 · 촉구 0.
노컷 실측 **0.70–13.24 / 13.24–23.73**.

리허설 뒤 확인 — `W`가 아니면 그 판은 버린다(features.md §영역 자동 매칭):

```bash
PGPASSWORD=mindbom_dev psql -h localhost -p 4501 -U mindbom -d mindbom -x -c \
"select r.free_association_text, r.inquiry_text, r.area_code, r.card_orientation,
 exists(select 1 from rorschach_regions g where g.response_id=r.id and g.deleted_at is null) as has_region
 from examinations e join rorschach_sessions s on s.examination_id=e.id
 join rorschach_responses r on r.session_id=s.id where e.note='seed:yun-rorschach'"
```

## 테이크

| 테이크 | 길이 | 무엇 |
|---|---|---|
| t01 | 20.88s | 목록에서 진입 — 폐기(실시 화면만 보여주기로) |
| t02 | 17.73s | 김영희 검사(`dc9aecb0…`) — **배역이 어긋났다**. 폐기 |
| t03 | 25.33s | **윤도현 `seed:yun-rorschach`** · 개선 시드 · SPEC v4 · 노컷 4.6–19.9. DB 확인 — 자유반응·질문·`W`·`right`·영역·촉구 전부 |
| t04 | — | 촉구 제외. **60Hz 기록기가 굶어** 22초가 15.4초로 압축됐다(ticks 924). 폐기 |
| **t05** | **30.43s** | **자유반응을 받아쓰기로** — 내담자 화면 + 마이크. 노컷 2.2–15.2 / 15.2–26.9. DB 전부 확인 |
| t06 | 2.18s | 실패 — `goto` ERR_ABORTED 뒤 브라우저가 닫혔다. 파일은 남긴다 |
| t07 | 32.02s | 실패 — **마인드봄 토큰 만료**(`401 GET /api/auth/check`). 화면은 뜨는데 `내담자 화면` 버튼이 영영 안 온다 |
| t08 | 29.00s | SPEC v5 재촬영 · 반응 한 줄 · 드롭 0. **받아쓰기를 더 쓰기로 하면서 폐기** |
| t09 | 35.43s | 받아쓰기로 자유반응 세 줄. **질문·영역까지 말로 채우기로 하면서 폐기** |
| t10 | 37.77s | 두 바퀴 받아쓰기 첫 판 — 마지막 조각이 화면 전환과 0.3초 차로 겹쳐 **②의 질문 원문이 빠졌다.** 폐기 |
| t11 | 39.07s | 두 바퀴 전부 받아쓰기 · 반응 둘 · 드롭 0. **39초는 편에 길어 폐기** |
| **t12** | **24.12s** | **반응 하나로 줄인 판** — 말 → 탭 → 줄 생성 → 칩 선택 → 영역 그리기 → 말 → 질문. 타이핑 0 · 드롭 0(ticks/s 60.0) · 노컷 **2.21–16.83 / 16.84–22.31** · DB 자유반응·질문·`W`·영역·원문 전부 |
| **t09** | **35.43s** | **받아쓰기로 세 반응** — 내담자 화면에 머물며 탭 세 번, 임상가 화면에서 ②·①을 열어 자동 기록을 보인다. 드롭 0(ticks/s 60.0) · 노컷 **2.21–16.93 / 16.93–21.37 / 21.37–31.94** · DB 세 줄 각각 제 마디 |

## 조각의 주인이 한 칸씩 어긋난다 (2026-09-10 실측)

받아쓰기로 질문 칸까지 채우려면 이걸 알아야 한다. **조각의 `startedAt`은 말이 시작된 시각이 아니라
앞 조각이 끊긴 시각이다**(`dictation.svelte.ts:144` — 녹음은 연속이고 침묵에서 잘린다).
질문 바퀴는 "고른 뒤에 시작된 말"만 그 줄의 것으로 인정하므로(`FreeAssociation.svelte:399`),

- ①의 질문이 **도착하기 전**에 ②를 고르면 → ①이 그 말을 잃는다
- ①의 질문이 **도착한 뒤**에 ②를 고르면 → ②가 받을 조각은 이미 시작돼 주인을 잃는다

둘 사이에 **한 주기를 비워야** 한다. `_mocks/s02-stt.json`의 **넷째 빈 줄**이 그 자리다 —
빈 문자열은 제품이 `if (!text) return`으로 무시하므로 화면에 아무 일도 안 생긴다.
같은 이유로 `silenceSec: 3.6`(주기 4.8초)을 쓴다. 기본 2.9초에서는 칩 선택과 영역 그리기가 한 주기에 안 들어간다.

**마지막 조각은 내담자 화면 안에서 받아야 한다.** 화면을 나가면 `dictation.stop()`이 조각을 끊어
보내는데(`dictation:263`), 그 말은 임상가 화면 경로로 들어가 `inquiry_text`만 저장되고
**`inquiry_stt_raw`가 안 남는다**(`onText:414`). t10에서 0.3초 차로 실제로 잃었다 — 화면으로는 안 보이고 DB에서만 보인다.

## 토큰이 먼저 죽는다 (2026-09-10 실측)

리허설이 통과한 뒤 **한 시간 안에** 같은 상태 파일로 촬영하면 `401 GET /api/auth/check`가 난다.
쿠키의 만료 시각(`accessToken` 다음날 12:36)은 멀쩡해 보이지만 **토큰 자체가 먼저 죽는다** — 쿠키를 보고 판단하지 않는다.
증상은 401이 아니라 **타임아웃**으로 온다: 화면은 열리고 `내담자 화면` 버튼만 30초를 기다리다 끝난다(t07).

```bash
CAP_EMAIL='counselor1@mindscope.com' CAP_PASSWORD="$(python3 -c "import json;print(json.load(open('_state/accounts.json'))['password'])")" \
node ../../.claude/skills/capture-service/scripts/login.mjs --base http://localhost:4503 --out _state/local-mindbom-counselor1.json
```

**다만 상태 파일이 오래됐다는 것만으로 다시 로그인할 필요는 없다.** `/api/auth/check`는 부르는 김에 리프레시 토큰으로 갱신까지 하고(`+server.ts:23`), 그 새 토큰이 같은 컨텍스트의 쿠키로 들어와 촬영에 쓰인다. 그래서 **러너의 검사가 통과하면 그 자리에서 살아난 것**이고, 실패하면 리프레시까지 죽은 진짜 만료다 — 그때만 다시 받는다.

**단 마인드봄의 리프레시 수명은 7일이다**(`apps/api/app/core/config.py:16`). saas는 30일이라 상태 파일을 한 달쯤 그냥 쓰지만, 이 장면은 일주일이 지나면 검사가 실패하기 시작한다. 게다가 재발급이 리프레시 토큰을 새로 주지 않아 **수명은 최초 로그인부터** 흐른다 — 자주 촬영해도 늘지 않는다.

2026-09-10 저녁부터 **러너가 먼저 막는다** — `capture.mjs`·`rehearse.mjs`가 시작 전에 `/api/auth/check`를 불러 200이 아니면 캡처를 시작하지 않고 재로그인 명령을 찍어 준다(`capture-service/scripts/auth-check.mjs`). 리허설은 종료 코드 `5`다. 그래도 위 명령을 미리 돌리는 습관이 낫다 — 막히면 그만큼 다시 시작해야 한다.

## 되돌리기

`_scripts/s02-reset.sh [note]` — 기본 인자는 `seed:yun-rorschach`.
지우는 것: 영역 · 반응 · 촉구 · 카드 실시기록 · 세션. 되돌리는 것: `status` → `created`, `started_at`/`completed_at` NULL.
세션까지 지우므로 화면이 `startSession`으로 `created → in_progress`를 직접 밟는다 — 실제 실시와 같은 경로다.
note가 정확히 1건이 아니면 아무것도 하지 않고 exit 1이다(재시드로 note가 바뀌면 여기서 걸린다).
끝나면 상태를 찍어 준다: `검사 <id> · status created · 반응 0 · 영역 0 · 촉구 0 · 카드 0 · 세션 0`.

**이 스크립트를 돌린 상태가 곧 s02의 촬영 대기 상태다.** 촬영이 끝난 뒤에도 다시 한 번 돌려 그 자리로 되돌린다.
마인드봄 전체 재시드는 하지 않는다(exam id가 바뀌고 다른 작업의 DB를 깬다).

> reset 뒤 윤도현의 로샤는 `created`라 **s03의 종합보고서 배터리는 확정 2건(HTP·SCT)만 남는다**.
> s03의 마인드봄 종합보고서를 찍으려면 그 앞에서 `.venv/bin/python -m scripts.seed && … seed_content`로
> 로샤를 다시 `confirmed`로 채워야 한다 — 두 장면은 같은 검사를 반대 상태로 쓴다.
