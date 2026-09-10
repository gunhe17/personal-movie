# s08-케어보드 — 남긴 메모가 팀에게 가 닿는다 (t02 재구성)

## 촬영 (2026-09-11 새벽 · SPEC v6 · s01 배치 규칙)

**선택본 `s08_web_careboard_t04` — 15.93초 · 충실도 99% · 드롭 0 · 노컷 6.51–14.20.**
목업 `mockup/s08_web_careboard_t04_imac.mp4`.

끝의 `beat` + `hold(1500)`을 닫는 `hold(600)` 하나로 — s01·s04·s05와 같은 모양이다. 전제 둘을 밟았다: **`care_board_entries`가 재시드로 1행뿐이라** `backfill_care_board`로 22행을 재구축했고, 김원장 상태 파일(`_state/local-saas-admin.json`)의 refresh 토큰이 죽어 다시 받았다. 되돌리기는 `_scripts/s08-reset.sh`.

부하로 굶은 판은 `_scripts/capture-until-good.sh`가 자동으로 다시 찍는다(기준 충실도 98%).

기기: web
배역: 모임 축 — **이하준**(회기 축과 같은 사람 · 놀이치료 C00002 · 진행률 4/8)에게 일어난 일을
**정상담(주인공)** 과 **김원장(센터장 · 관리자)** 이 같은 보드에서 주고받는다. (정본 CAST.md)
최치료로는 성립하지 않는다 — COUNSELOR는 `access_level=own`이라 담당 아닌 보드에 접근 자체가 404.

**t01(24.55s · 촬영 완료)은 탭 훑기**였다(진행 현황 → 문서 → 바우처 → 내담자 정보).
**t02는 우측 케어보드 도크 안에서만** 돈다 — 근거는 features.md 머리.

## 조작 순서

도크 자동 펼침(진입 600ms) → 스트림 훑어 올리기(8월 회기) → 다시 최근 →
**김원장의 메모 읽기** → 답을 타이핑 → `메모 등록` → 그 메모를 `공지로 고정` →
`케어보드 접기` → *(그 사이 김원장이 다른 계정으로 실제 API로 답을 남긴다)* → `케어보드 열기` →
**김원장의 답이 도착해 있다**

## 캡처 지점

리허설 실측(2026-09-10 · **SPEC v4**). 촬영 시각은 lead 1.5초가 앞에 붙는다.

- 시작: 도크가 펼쳐진 화면 — 좌측 진행 현황(4/8) + 우측 스트림(접수 · 회기 · 바우처 · 필드노트)
- 종료: 김원장의 답이 스트림 맨 아래에 있는 화면
- 전체 길이: 조작 **15.3초** + lead/tail 2.7초 ≈ **18초**

| 구간 | 리허설 t | 무엇 |
|---|---|---|
| 증거 컷 | 0.3 – 1.0 | 흩어져 있던 것이 한 줄기로 (종류 배지 · 날짜 구분선) |
| 인계 | 1.6 – 3.2 | 8월 회기까지 스크롤을 올렸다 내린다 |
| **노컷** | **3.64 – 12.98 (9.3초)** | 남의 메모 → 내 답 → 공지 고정 → 접기 → **도착**. 이 구간이 장면의 전부다 |
| 마무리 | 13.0 – 14.5 | 세 사람의 대화가 한 줄기에 남은 화면 |

편집이 쓸 프레임 셋 — ① 김원장 메모(이름·`담당자`·시각) ② 내 메모가 쌓이는 순간
③ 상단 반투명 공지 카드 ④ 다시 열었을 때 새로 와 있는 김원장의 답.

## 촬영 전 준비 (순서대로)

```bash
# 0) 김원장 상태 파일 — refresh 토큰이 필요하다(없거나 오래되면 다시 만든다)
CAP_EMAIL=admin@mindscope.com CAP_PASSWORD=<시드 비번> \
  node ../../.claude/skills/capture-service/scripts/login.mjs \
  --base http://localhost:3503 --out _state/local-saas-admin.json

# 1) 되돌리기 — 메모·핀·읽음 기준선을 시드 상태로
docker exec saas-postgres psql -U imomtae -d imomtae -c \
 "delete from care_board_entries where source_table='care_memos'; delete from care_memos; \
  update care_board_reads set last_seen_at='2026-09-09 21:50:28.293676' \
  where client_id=(select id from clients where name='이하준' and deleted_at is null);"

# 2) 선행 상태 — 유령 엔트리 정리 + 김원장 메모 1건(now-40분)
docker exec -i saas-postgres psql -U imomtae -d imomtae < _scripts/s08-setup.sql
```

**1→2는 매 테이크마다 다시 돌린다.** 안 돌리면 메모가 누적돼 스트림이 지저분해지고,
`s08-setup.sql`의 멱등 가드(`care_memos`가 비어 있을 때만 넣는다) 때문에 김원장의 메모가 다시 안 들어간다.

## 리허설

```bash
node ../../.claude/skills/scene-prep/scripts/rehearse.mjs --scene s08-케어보드 \
  --url "http://localhost:3503/clients/77458809-084e-4779-bb30-eabd17a868f6" \
  --state _state/local-saas-counselor1.json --script _scripts/s08-careboard.mjs --headless
```

URL의 clientId는 재시드마다 바뀐다. 2026-09-10 시드에서 이하준 = `77458809-084e-4779-bb30-eabd17a868f6`.
마지막 결과: **17단계 15.3초 · 종료 코드 0 · "깨끗하다"** (오류 0).

## 이 장면에서 밟은 함정

- **핀은 엔트리 id로 걸린다.** 메모를 등록하면 낙관 행이 임시 id로 먼저 그려지므로, 재조회를 기다리지 않고
  핀을 누르면 `POST /entries/optimistic-memo-…/pin`이 404다. 스크립트가 `/care-board/stream` 응답을
  기다리는 이유(`restreamed`)
- **안 읽음 배지는 실제로 안 뜬다.** 배지는 닫힌 진입 버튼에 붙는데 그 값을 만드는 쿼리는 도크가 열려야 돈다.
  "빨간 숫자"를 연출 재료로 쓰려 하지 말 것 — features.md "제품에서 발견한 것"
- **메모 작성은 알림을 보내지 않는다.** 배선이 없다. 알림 화면을 붙이면 거짓이 된다
- **차트 버튼은 전부 목업이다.** 누르지 않는다
- **시각은 UTC(naive)로 저장되고 화면은 그 값을 로컬로 그린다.** 그래서 `s08-setup.sql`은 절대 시각을 박지 않고
  `now() - 40분`을 쓴다. **KST 09:00 이전에 찍으면 방금 쓴 메모가 `어제` 구분선 아래로 들어간다** — 낮에 찍는다
- **s09를 되돌리면 유령 엔트리가 남는다** — `놀이치료 5회기 · 취소됨 · 원본 삭제됨`. 원천이 하드 삭제돼
  `backfill_care_board`도 못 지운다. `s08-setup.sql` ①이 지운다
- **최치료로 바꾸지 말 것** — 두 번째 계정은 `access_level=all`이어야 한다(김원장·이사무·박접수)

## 테이크
| take | 파일 | 결과 | 재촬영 사유 |
|---|---|---|---|
| t01 | `s08_web_careboard_t01.mov` | 24.55s · 드롭 0 · 노컷 1 | — (탭 훑기 버전. 버리지 않는다) |
| t02 | | | 구성 변경 — 패널 안 인터랙션 · 구성원 간 공유가 장면의 축 (`--retake-of t01`) |
