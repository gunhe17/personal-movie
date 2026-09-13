# s09-회기정산 — 수를 세서 낸다, 그 숫자로 급여가 정해진다

## 촬영 (2026-09-11 · SPEC v6 · s01 배치 규칙)

**선택본 `s09_web_noshow_t04` — 11.10초 · 충실도 99% · 드롭 0 · 노컷 7.82–9.35.**
DB 확인: `no_show · 차감 true · 메모 "연락 없이 미참석…"`. 목업 `mockup/s09_web_noshow_t04_imac.mp4`.

t03(12.75초 · SPEC v4)에서 고친 것 둘:
- **노쇼 모달 도착에 `h.modal()`** — `until`의 settle 0.26초만으로는 사유 칸과 차감 스위치가 한 모달에 같이 있다는 걸 읽을 틈이 없다. 박자의 정본은 SPEC의 `modal`(600)이다
- **끝맺음 `hold(2000)` → `hold(600)`** — s01·s04·s05와 같은 값. 뒤에 tail 1.2초가 붙어 실제로 보이는 시간은 1.8초다

되돌리기는 `_scripts/s09-reset.sql` 하나면 된다(행을 지우지 않아 sessionId가 유지된다 — 촬영 URL 그대로).

기기: web
배역: 회기 축 — 이하준의 회기·바우처  (정본 CAST.md)

## 조작 순서
회기 상세(어제 5회기) → `노쇼했어요` → 노쇼 모달 → **사유 입력** → **회기 차감 스위치 켜기** → `변경`
→ 노쇼로 굳고 회기가 잠긴다 → **잠긴 화면에 노쇼 사유 카드 + 회기 차감 배지**.
준비는 `_scripts/s09-setup.sql`(행 생성) · 되돌리기는 `_scripts/s09-reset.sql`(행 유지).

사유 문안(정본): `연락 없이 미참석. 보호자 통화 안 됨. 다음 회기 전 재확인.`
— 이하준(만 9세) 놀이치료. 실명·실제 데이터 없음. 500자 제한 안.

## 캡처 지점

리허설 실측(2026-09-10 사유 입력 추가 재구성, **SPEC v4**). 촬영 시각은 lead 1.5초가 앞에 붙는다.

- 시작: 어제 5회기 상세, 출결 미확인
- 종료: 노쇼로 잠긴 회기 — 사유 카드와 차감 배지가 나란히
- 전체 길이: 조작 **10.6초** + lead 1.5 / tail 1.2 ≈ **13.3초**

| 구간 | 리허설 t | 무엇 |
|---|---|---|
| **증거 컷 ①** | 2.2 – 4.4 | 노쇼 모달의 **사유 입력**. "손으로 기록한다"가 "여기 쓴다"로 바뀐 자리 (글자가 실제로 찍힌다) |
| **증거 컷 ②** | 5.0 – 6.1 | 같은 모달의 **회기 차감** 스위치. "구분되지 않는다"가 "선택한다"로 바뀐 자리 |
| **노컷** | 6.1 – 7.8 | 변경 → 잠김 → **사유 카드 + 회기 차감 배지**가 함께 선다 |
| 마무리 | 7.8 – 9.8 | 회기 기록에 남은 사유를 읽는 시간 |

단계 기록(실측): beat 0.71 · click 노쇼했어요 1.54 · until 모달 2.18 · type 사유 4.41 ·
hover 스위치 5.04 · click 스위치 5.76 · click 변경 6.88 · until 사유 카드 7.53 · until 차감 배지 7.80 · hold 9.80

## 리허설
`node .claude/skills/scene-prep/scripts/rehearse.mjs --scene s09-회기정산 --url "http://localhost:3503/counseling/status/<caseId>?session=<sessionId>" --state _state/local-saas-counselor1.json --script _scripts/s09-noshow.mjs`
전제: 시드 위에 `psql < _scripts/s09-setup.sql` (id는 재시드마다 바뀌므로 다시 조회).
**한 번 돌리면 회기가 잠긴다** — 다시 돌리기 전에 되돌려야 한다. 시드 전체 리셋(`reset-seed.sh`)은 같은 DB를 쓰는
다른 작업을 깨뜨리므로 쓰지 않는다.

### 되돌리기 (리허설·재촬영 전 매번)

```bash
docker exec -i saas-postgres psql -U imomtae -d imomtae < _scripts/s09-reset.sql
```

행을 지우지 않고 값만 되돌리므로 **sessionId·URL이 그대로다**(`UPDATE 1` / `UPDATE 1`이 두 줄 나오면 성공).
회기 `status → scheduled` · 참여자 `attendance_status → scheduled` · `is_consumed → false` · `memo → null` · `attended_at → null`.

행 자체가 없을 때(재시드 직후)만 생성 SQL을 넣는다 — 이때는 sessionId가 새로 생긴다:

```bash
docker exec -i saas-postgres psql -U imomtae -d imomtae < _scripts/s09-setup.sql
```

2026-09-10 현재: caseId `7b9d6e01-87d0-4e5c-a303-e3aed38e3560` · 5회기 sessionId `785f13b4-9ada-4e45-9f4e-ad77d65cd9e9`
**sessionId는 `s09-setup.sql`로 행을 새로 만들 때만 바뀐다**(`s09-reset.sql`은 유지) — 그때는 다시 조회한다:
```bash
docker exec saas-postgres psql -U imomtae -d imomtae -tA -c \
  "select cs.id from counseling_sessions cs join schedules s on s.id=cs.schedule_id where s.title='C00002 - 5회기' and cs.deleted_at is null;"
```
마지막 결과: **종료 코드 0 · 오류 0 · 10단계 10.6초** (2026-09-10 사유 입력 추가 재구성).
DB: `attendance_status=no_show` · `is_consumed=t` · `memo='연락 없이 미참석. 보호자 통화 안 됨. 다음 회기 전 재확인.'` · 회기 `status=cancelled`

DB 확인 한 줄:
```bash
docker exec saas-postgres psql -U imomtae -d imomtae -c "select cs.status, p.attendance_status, p.is_consumed, p.memo from counseling_sessions cs join schedules s on s.id=cs.schedule_id join counseling_session_participants p on p.session_id=cs.id where s.title='C00002 - 5회기' and cs.deleted_at is null;"
```

**촬영 전 상태**: 되돌리기를 넣어 5회기가 `scheduled` · 출결 `scheduled`(미확인) · `memo=null`로 놓여 있다.

## 테이크
| take | 파일 | 결과 | 재촬영 사유 |
|---|---|---|---|
| t01 | | | |
