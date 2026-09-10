# OpenAPI 계약 diff — 리팩토링 전(b2108bd5) vs 후(현재) — 2026-06-30

Tier 1(정적 계약 동일성). `/openapi.json`을 전(워크트리 @ b2108bd5)·후(워킹트리)에서 덤프 →
구조 레벨 diff(스키마 이름변경 무시, 필드/타입/status/param만). 스크립트: scratchpad/golden_openapi_diff.py.

대상: **모듈 소유 엔드포인트 우선**(application handler 엔드포인트는 WIP라 이번 판정에서 분리).

## 총평

**428 경로 전/후 동일(추가·삭제 0). 558개 오퍼레이션 중 실제 계약 차이는 15개, 그중 모듈 엔드포인트 실차이 4개.**
나머지는 전부 **auth 헤더 노출 아티팩트**(아래) — 클라이언트 계약 영향 없음. 즉 리팩토링은 API 계약을 사실상 보존했고, 진짜 바뀐 건 4곳뿐.

## 전역 아티팩트 (회귀 아님 — 무시)

- 후(post)는 `behavior.request`가 `authorization` 헤더를 **명시 파라미터로 노출**한다. 전(pre)은 security scheme로 모델링 → OpenAPI상 헤더 param이 안 보였음. 그래서:
  - 전 엔드포인트에 `(authorization, header, optional)` param 추가(필터함).
  - 검증 param이 0이던 GET 9개가 **422 응답을 자동 획득**(`['200'] → ['200','422']`, 방향 확인됨). FastAPI가 param 있으면 422를 문서화하기 때문. **클라 영향 0.**
- 해당 9개(422-only): `/auth/devices`, `/auth/me`(GET·DELETE), `/role/roles/`, `/centers/{center_id}/subscription/plans` (+ admin/internal: ai-usage/rate-config·platform-settings·platform-settings/plans·subscriptions/stats·internal/ai-lab/metadata·internal/subscriptions/process-expirations).

## 모듈 엔드포인트 실제 계약 차이 (4) — 기록, 수정 보류

| 엔드포인트 | 차이 | 상세 | 의도? |
|---|---|---|---|
| `PUT /api/v1/centers/{center_id}/credit/rate-config` | **메서드 제거** | 전: get+put, 후: get만. 쓰기가 `PUT /admin/ai-usage/rate-config`(admin)로 이전된 듯 | 의도(이관) 가능성 높음 — 단 구 center PUT 호출자는 404(breaking) |
| `GET /api/v1/persons` | **응답 모양 변경** | 전: `list[id,name,phone]`(평면 배열), 후: `{items,total,page,size,pages}`(페이지 엔벌롭) | 표준화 의도 가능 — 배열 기대 클라는 breaking |
| `PUT /api/v1/centers/{center_id}/roles/{role_code}` | **요청 body +필드** | 후에 `expected_version` 추가(낙관적 동시성 가드) | 의도 가능 — required면 breaking, optional이면 additive(요확인) |
| `GET /api/v1/centers/{center_id}/agent/conversations` | **응답 200 스키마 변경** | 미상세화(배치 때 drill) | 미상 |

## application/admin 표면 (이번 스코프 제외 — WIP)

`/admin/*`·`/internal/*`의 차이는 전부 위 422 아티팩트뿐(실 계약차 0). application handler 본격 판정은 그쪽 이행이 끝난 뒤.

## 다음 (배치 결정용)

1. 위 4개가 **의도된 변경인지 회귀인지** 확인 — credit PUT 이관/persons 페이지네이션/roles version-guard는 의도로 보이나 확정 필요.
2. `agent/conversations` 응답 차이 1건 drill.
3. Tier 1로 못 보는 **값·런타임 행위** 동일성은 Tier 2(status 골든)로 — 단 그건 별도 사이클.

재현: 두 openapi 덤프 + `python scratchpad/golden_openapi_diff.py openapi_pre.json openapi_post.json`

---

## [완료] paginated envelope 정합화 (정본 `Page`로 수렴)

실행 결과(2026-06-30): 정본 = `{items,total,page,size,pages}`(평탄 5필드, 비옵셔널). 헬퍼 `single_page`(비페이지=전체가1페이지)·`offset_page`(skip/limit환산)를 `new_repository.py`에 추가. 변종 25개 수렴(A+ 9 pages추가 · 비페이지 14 single_page · offset 2). census: **76 전부 정본화**(73 순수 + 3 정본+집계 stats/summary/total_counts). e2e 35 passed. 프론트: `Page<T>` 정본 + `RowPaginationRes` 별칭 + 레거시 `{data,pagination}`은 **mock 레이어 전용**이라 deprecated 표기만(제거 시 mock 깨짐). mock-backed 피처(assessment/transmission/counseling)의 실백엔드 이행은 별도 피처 작업.

### (원본 분류)


성격: **회귀 아님 — 리팩토링 이전부터 있던 정합성 부채**(7변종이 전/후 동일). in/out 동일성과 무관하므로 별도 정리 작업.

정본 = `{items,total,page,size,pages}` ([persistence-repository.md] §3 `Page`). 아래 비정본 변종을 정본으로 수렴(단, summary/stats/total_counts 등 **의미있는 추가 필드는 정본 base + 추가**로 보존).

### `{items,page,pages,size,total}`  (48개) — 정본  정본 — 변경 없음
- /api/v1/admin/accounts/
- /api/v1/admin/admin-accounts/
- /api/v1/admin/ai-lab/feature-test/{center_id}/counseling-cases
- /api/v1/admin/ai-usage/by-center
- /api/v1/admin/ai-usage/calls
- /api/v1/admin/assessments/
- /api/v1/admin/audit-logs
- /api/v1/admin/center-applications/
- /api/v1/admin/centers/
- /api/v1/admin/centers/terminated
- /api/v1/admin/cs-memos/
- /api/v1/admin/documents
- /api/v1/admin/faqs/
- /api/v1/admin/form-extractions
- /api/v1/admin/inquiries/
- /api/v1/admin/notices/
- /api/v1/admin/voucher-extractions
- /api/v1/admin/vouchers
- /api/v1/assessments
- /api/v1/centers/applications/
- /api/v1/centers/{center_id}/activity-logs
- /api/v1/centers/{center_id}/agent/conversations
- /api/v1/centers/{center_id}/assessment-cases
- /api/v1/centers/{center_id}/assessment-sets
- /api/v1/centers/{center_id}/billables/
- /api/v1/centers/{center_id}/billings/
- /api/v1/centers/{center_id}/center-vouchers
- /api/v1/centers/{center_id}/client-vouchers
- /api/v1/centers/{center_id}/clients/
- /api/v1/centers/{center_id}/clients/link-requests/
- /api/v1/centers/{center_id}/clients/with-relations
- /api/v1/centers/{center_id}/counseling/
- /api/v1/centers/{center_id}/document-accesses/accounts/{account_id}
- /api/v1/centers/{center_id}/document-accesses/documents/{document_id}
- /api/v1/centers/{center_id}/documents/
- /api/v1/centers/{center_id}/members/
- /api/v1/centers/{center_id}/members/invitations
- /api/v1/centers/{center_id}/members/{member_id}/non-working-times/
- /api/v1/centers/{center_id}/notifications
- /api/v1/centers/{center_id}/price-lists/
- /api/v1/centers/{center_id}/programs/
- /api/v1/centers/{center_id}/roles/{role_code}/members
- /api/v1/centers/{center_id}/voucher-catalog
- /api/v1/document/share/share/documents/{document_id}
- /api/v1/institutions/
- /api/v1/notices/
- /api/v1/persons
- /api/v1/support/faqs

### `{items,total}`  (15개) — 수렴대상  누락:['page', 'pages', 'size']
- /api/v1/admin/message-templates/centers/{center_id}
- /api/v1/admin/message-templates/system
- /api/v1/centers/{center_id}/center-vouchers/{center_voucher_id}/clients
- /api/v1/centers/{center_id}/client-vouchers/{client_voucher_id}/form-instances
- /api/v1/centers/{center_id}/clients/favorites
- /api/v1/centers/{center_id}/clients/{client_id}/attendance-pattern
- /api/v1/centers/{center_id}/clients/{client_id}/documents
- /api/v1/centers/{center_id}/clients/{client_id}/form-instances
- /api/v1/centers/{center_id}/clients/{client_id}/signals
- /api/v1/centers/{center_id}/counseling/cases/{case_id}/sessions
- /api/v1/centers/{center_id}/counseling/counselors/me/unlogged-sessions
- /api/v1/centers/{center_id}/counseling/notes
- /api/v1/centers/{center_id}/forms/templates/
- /api/v1/centers/{center_id}/message-templates/
- /api/v1/centers/{center_id}/programs/{program_id}/members/

### `{items,page,size,total}`  (9개) — 수렴대상  누락:['pages']
- /api/v1/admin/ai-lab/feature-test/{center_id}/field-notes
- /api/v1/admin/subscriptions
- /api/v1/admin/subscriptions/payment-failures
- /api/v1/admin/subscriptions/{center_id}/payments
- /api/v1/centers/{center_id}/field-notes
- /api/v1/centers/{center_id}/forms/instances
- /api/v1/internal/ai-lab/experiment-groups
- /api/v1/internal/ai-lab/experiments
- /api/v1/internal/ai-lab/samples

### `{items,page,pages,size,summary,total}`  (1개) — 수렴대상  추가:['summary']
- /api/v1/centers/{center_id}/counseling/me

### `{items,page,pages,size,total,total_counts}`  (1개) — 수렴대상  추가:['total_counts']
- /api/v1/centers/{center_id}/billables/billable-targets/by-client/{client_id}

### `{items,page,pages,size,stats,total}`  (1개) — 수렴대상  추가:['stats']
- /api/v1/admin/centers/{center_id}/clients

### `{items,limit,page,total}`  (1개) — 수렴대상(필드차)  누락:['pages', 'size'] 추가:['limit']
- /api/v1/admin/credentials/
