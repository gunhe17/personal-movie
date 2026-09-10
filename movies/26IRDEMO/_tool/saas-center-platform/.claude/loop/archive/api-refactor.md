# apps/api 리팩토링 loop — 반복 절차

매 반복(iteration)은 작업 단위 **하나**에 대해 아래 7단계를 게이트로 통과한다. 게이트 실패 시 다음 단계로 가지 않고 멈춰 기록한다(추측해서 진행하지 않는다 — [apps/api/CLAUDE.md](../../apps/api/CLAUDE.md) §1).

작업 선정: [.claude/todo/api/](../todo/api/)의 미완 항목 중 하나(touch-to-fix ratchet). 한 반복 = 한 슬라이스 = 한 로컬 커밋. 대량 일괄 금지.

가독성 기준: [personal_secret 참조](../../apps/api/CLAUDE.md) — 표현(스타일·흐름·오류 메시지)은 빌리되 구조(모듈 슬라이스)는 유지.

---

## 통일성 — 이 loop의 제1 목표

같은 기능이 모듈마다 다른 형태이면 **오류**다(스타일 선호가 아니라 결함). 매 반복의 렌즈: "이 슬라이스가 다른 모듈의 같은 기능과 같은 형태인가?"

- 정본(canonical) 출처: [rules/api/](../rules/api/) + 레퍼런스 [activity_log](../../apps/api/app/modules/activity_log/) + 다수 모듈이 이미 쓰는 지배적 형태. 셋이 어긋나면 **rule을 따른다**.
- 수렴 대상 기능(예): 페이지네이션 조회(`list_*_with_page` → `tuple[list, Page]`), 유일성 생성(`verify_*` → `add`), soft-delete(`remove_in_center`), must-exist 조회(`get_*` 404), update(`unset` + `update_in_center`), facade 두 반환, service phase 마커, router summary/desc.
- 한 기능을 고치면 **그 기능을 가진 다른 모듈도 같은 형태인지 확인** — divergence를 발견하면 [todo](../todo/api/)에 적어 다음 반복이 잇는다.
- 어느 형태가 정본인지 불명하면 **멈추고 기록** — 임의로 한쪽을 택하지 않는다.

---

## 1. 계획 읽기 (plan)
- 입력: `.claude/todo/api/{layer}.md` 잔여 작업 + 해당 [rule](../rules/api/).
- 산출: 이번 반복이 건드릴 파일·범위를 명시.
- 게이트: 범위가 한 모듈/슬라이스로 한정되는가? 넓으면 쪼갠다.

## 2. 의도 파악 (intent)
- 기존 코드·테스트를 읽어 "이 코드가 보장해야 하는 것"을 한 줄로 적는다.
- 게이트: 의도가 불명확하면 멈추고 기록(추측 금지).

## 3. 설계 (design)
- rule 컨벤션 + personal_secret 가독성으로 변경 형태 결정.
- 크로스모듈이면 [cross-module-write.md](../rules/api/cross-module-write.md) §2(신설/이동/재사용) + §4(이식 함정) 확인.
- 게이트: 타 모듈 internals(repository/models/service) import 안 하는가(경계 hook이 경고).

## 4. 구현 (implement)
- surgical — 이번 작업 범위만. 매 Edit 전 Read.
- 게이트: 변경 라인이 전부 이번 작업에 추적되는가([CLAUDE.md](../../apps/api/CLAUDE.md) §3). 인접 코드 "개선" 금지.

## 5. 테스트 (test)
- 스코프 한정 pytest(바뀐 모듈만). 없으면 추가.
- 게이트: 그린.

## 6. 검증 (verify)
- 옛 경로/심볼 잔재 0(grep), 동치성(주석만 바꿨으면 docstring 제거 후 AST 대조), 마이그레이션 드리프트 가드([migration.md](../rules/api/migration.md)).
- 게이트: 전부 통과. 소비처 컴파일 확인.

## 7. 의도 부합 확인 (confirm)
- 2단계 의도와 결과를 대조 — 보장이 유지/개선됐는가.
- 게이트: 부합하면 로컬 커밋(브랜치). 불일치면 되돌리고 기록. 해당 todo 체크박스 갱신.

---

## 제약 (모든 반복)

- **git: 로컬 커밋만.** `push`/`fetch`/`pull`/`reset` 금지(PreToolUse hook이 차단). 원격 동기화·히스토리 되감기가 필요하면 진행하지 말고 사용자에게 알린다.
- **한 반복 = 한 슬라이스 = 한 커밋.** 되돌리기 어려운 대량 변경은 착수 전 사용자 확인.
- **막히면 멈추고 기록** — 의도·범위·게이트 어디서든 불확실하면 추측 대신 정지.
- 진행 상태는 `.claude/todo/api/{layer}.md` 체크박스로 갱신해 다음 반복이 이어받게 한다.
