# application/전 GET 엔드포인트 골든 — 전(b2108bd5) vs 후 — 2026-06-30

application 작업 완료 후, 제외했던 application 표면 포함 전 GET 엔드포인트의 런타임 in/out 동일성.
러너: [test_12_endpoint_golden.py](test_12_endpoint_golden.py) — OpenAPI GET 전수 → path param 시드 id 치환 → 인증 호출 → 정규화 기록. PRE(worktree)·POST 각자 시드 후 diff(status + shape; 값차=시드노이즈).

대상 164 GET. **admin/internal·쓰기는 제외**(쓰기 orchestration은 flow 테스트 test_02–09가 체이닝 커버).

## 집계
compared=164 | STATUS-diff=7 SHAPE-diff=1 value-only(seed)=27

## 실제 회귀 (수정 보류 — 배치)
- **`GET /centers/{cid}/voucher-catalog` : PRE 200 → POST 500**
  - `DevelopError: center_id: <class 'str'> 필요 (실제: ServerContext)`
  - 원인: 핸들러에 `ctx.center_id` 대신 **`ctx`(ServerContext) 통째**가 전달됨(배선 버그). PRE는 정상.
  - 영향: voucher-catalog 조회 전면 500. 명백한 리팩토링 회귀.

## 의도된 변경 (회귀 아님)
- **IDOR 하드닝 (200/[]→404, 없는/타센터 부모)**: `agent/conversations/{id}/messages`·`/tokens`, `assessment-cases/{id}/assessment-sessions`·`/tasks`. 모듈 #5와 동일 계열. 정상 흐름 동일, 크로스테넌트 차단.
- **페이지네이션 (shape)**: `GET /centers/{cid}/agent/conversations` list→`{items,…}`. Tier-1 일치.

## 인증 변화 (의도 확인 필요)
- `GET /persons`, `GET /centers/applications/` : PRE 200(account/center 토큰) → POST 401 "어드민 토큰이 아닙니다". admin 전용으로 좁힘 — PII/심사 표면 이동 의도로 보이나 확정 필요.

## 비고
- `GET /centers/{cid}/clients/with-relations` 는 전/후 **둘 다 500**(seed enrichment ValidationError) → diff상 동일이라 회귀 아님(별도 데이터/하네스 이슈, 추적 보류).
- 쓰기 application 흐름(create_individual·create_case_with_sessions·voucher/form 추출 등)은 flow 테스트가 POST에서 pre-authored 단언 통과(34 pass) = in/out 보존 확인.

재현: `bash scripts/run_e2e.sh -k endpoint_golden` (POST) / worktree 동일 + `golden_sweep_diff.py appget_pre.json appget_post.json`
