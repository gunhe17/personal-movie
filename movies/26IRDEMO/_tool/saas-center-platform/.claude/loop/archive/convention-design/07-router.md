# 계층 7 — Router 설계 `[설계완료]`

정본 rule: [router.md](../../rules/api/router.md) (summary/description 산문 위생 + 기능메타 보존). 상위: [convention-design.md](../convention-design.md).

survey: **110 router 파일**. router.md 주 타깃(summary/description)은 **이미 정합** — `summary=` 0건, route description 소수(전부 비자명 계약). 잔재는 대부분 계층 10(behavior)·agent rebuild 결합. grep 검증으로 survey 수치 2건 정정.

## 7-1. summary/description `[정합 — 무변경]`
- **`summary=` 0건**(전부 제거됨). rule §1 완료.
- route-decorator `description` ~16건 = 전부 **비자명 소비자 계약** → keep. 예: `voucher/center_voucher/router.py:247`(잔여회기>0만), `client/profile/router.py:88`(best-effort 부분실패), `client/profile/router.py:403`(상태전이 머신). rule §2 준수.
- param `description`(Query/Field) 242건: enum/format 유지, 파라미터명 재진술만 trim = 기계적(rule §3). 예: `assessment/assessment_case/router.py:70`(상태 enum, keep).

## 7-2. behavior 의존성 선언 `[dominant 확정]`
지배형(그대로 canonical):
- **center-scoped**: `behavior.request(start_event_group()?, authenticate(), require_membership(), require_permission(Permission.*), require_feature(...)?, dispatch_events()?)` — 순서 고정(~550 라우트). 예: `billing/router.py:62`(mutating 전체), `center/center/router.py:48`(read=event 없음).
- **unscoped**: `behavior.request_unscoped(authenticate())`(account, ~208) / `gate(verify)`(machine).
- **admin**: `behavior.request_admin(...)`(신규).
- → rule에 순서 canonical 한 줄 추가(짧게). 대부분 준수라 코드 변경 없음.

## 7-3. platform_admin 레거시 admin auth `[keeper-until-behavior — 계층 10]`
- **~23 라우트가 `Depends(get_current_admin)`** 사용(behavior.request_admin 미전환). **grep 검증 23**(survey "1" 오판 정정 — `current_admin: dict = Depends(get_current_admin)` 23건).
- behavior.md는 admin flow=`request_admin`. → **계층 10 behavior 롤아웃에 결합, 여기서 안 함**(6-1 tx래퍼와 동류). 지금 무해.

## 7-4. status_code / response_model DELETE 분기 `[범위 밖 — 파괴적]`
- DELETE **204(no body) 3** vs **200+response_model 8**(MessageResponse·엔티티·삭제요약). 예: `auth/router.py:190`(204), `client/profile/router.py:432`(200+ClientResponse), `schedule/router.py:188`(200+MessageResponse).
- router.md §4: status_code·response_model = **기능메타**, 산문위생 규칙 대상 아님. 변경은 **프론트 계약 파괴적**(§설계원칙 "순수 표현 통일 아니면 범위 밖").
- → **이 loop 범위 밖 후보.** 표준화 원하면 별도 API-contract 결정(프론트 동반 슬라이스). 지금 무변경.

## 7-5. tags 네이밍 `[optional — 비파괴, 저가치]`
- English/Korean·단수/복수 혼재. `person/router.py:29`(`"person"`) vs `center/center/router.py:25`(`"Centers"`) vs `notice/router.py:11`(`"공지사항"`). OpenAPI 그룹핑 cosmetic, 런타임 무영향.
- 소프트 canonical 제안: **English Title Case 계층형**(`"Centers - Members"`). 신규 권고, 일괄 변경은 저가치 → optional(사용자 veto 가능).

## 7-6. 파일구조 / 인라인 가드 `[정합 — 소수 note]`
- aggregator + entity별 sub-router, **전 라우터 handler-only**(인라인 비즈니스 0).
- 인라인 가드 3: `llm/router.py`(RBAC `role_code not in _ADMIN_ROLES`)·`person/router.py:83`(IDOR `person_id != ctx.person_id`)·`schedule`(member_ids 해소) → handler/behavior action 이동 가능(기계적), 저우선.

## 7-7. agent router 변형 `[keeper — rebuild]`
- `agent/conversation/`: `router.py` + `router_behavior.py` + `router_legacy.py` + `router_v5.py` = new-agent-rebuild 진행 중(메모리 [new-agent-rebuild]). 컷오버 후 정리. 여기 손 안 댐.

## 7-8. field_note 예외 (예외 sweep 2026-07-04) `[설계완료]`
- **이중 `behavior.request` 3곳** ([pipeline/router.py:95,127,160](../../../apps/api/app/modules/field_note/pipeline/router.py#L95) diarize·generate_summary·generate_counseling_note): `ctx` 옆 `_plan` Depends가 **`require_feature("ai_field_note")`만 추가 + 핸들러에서 미사용**(unused). → **병합**: 메인 `behavior.request`에 `require_feature` action 추가, `_plan` 제거(7-2 합성 원칙). 비파괴.
- **ws 수동 인증** ([streaming/ws_handler.py:206](../../../apps/api/app/modules/field_note/streaming/ws_handler.py#L206)): WebSocket이 `Depends` 미지원이라 `behavior.request` 우회 + 수동 토큰검증 + 직접 repo → **streaming carve-out**(계층 11 streaming 갭 동일 표면). behavior에 WS flow 없으면 keeper, 있으면 이행.

---

## 실행 워크리스트 (계층 7)

| 작업 | 대상 | 파괴성 |
|------|------|:-----:|
| param description 재진술 trim | 일부 Query/Field(파라미터명 재진술) | 비파괴(문서) |
| behavior 선언 순서 canonical 명시 | router.md rule | 문서 |
| 인라인 가드 → handler/action | 3 라우트(llm·person·schedule) | 비파괴 |
| platform_admin `get_current_admin` → `request_admin` | 23 | **계층 10 결합(deferred)** |
| DELETE status/response_model 표준화 | 8 | **범위 밖(파괴적, 별도 슬라이스)** |
| tags English 계층형 통일 | cosmetic | optional(veto 가능) |

## 예시 코드 (canonical)

### A. mutating (POST create) — `billing/router.py:55`
```python
# 산문메타 0. 기능메타(response_model·status_code)만. behavior 순서 고정.
@router.post(
    "/",
    response_model=PaymentRecordDetailResponse,
    status_code=201,
)
async def create_payment(
    data: PaymentRecordCreate,
    ctx: ServerContext = Depends(
        behavior.request(
            start_event_group(),        # ┐ mutating만
            authenticate(),
            require_membership(),
            require_permission(Permission.WRITE_BILLING),
            dispatch_events(),          # ┘ mutating만 (커밋 후 NOTIFY)
        )
    ),
):
    return await create_payment_handler(
        event_group_id=ctx.event_group_id, center_id=ctx.center_id, uow=ctx.uow, ...
    )
```

### B. center-scoped read (GET) — `center/center/router.py:38`
```python
# read = start_event_group/dispatch_events 없음
@router.get("/{center_id}", response_model=CenterResponse)
async def get_center(
    center_id: str,
    ctx: ServerContext = Depends(
        behavior.request(
            authenticate(),
            require_membership(),
            require_permission(Permission.READ_CENTER),
        )
    ),
):
    ...
```

### C. unscoped read — `center/center/router.py:30`
```python
@router.get("/", response_model=CenterListResponse)
async def list_centers(
    skip: int = 0,
    limit: int = 100,
    ctx: UnscopedContext = Depends(behavior.request_unscoped(authenticate())),
):
    ...
```

## before → after (계층 7 실 변경분)

### 인라인 가드 → handler (7-6) — `person/router.py:83`
```python
# bad: 라우터에 IDOR 검증 인라인
async def update_person(person_id, data, ctx=...):
    if person_id != ctx.person_id:                 # ← 검증이 라우터에
        raise ForbiddenError("본인 프로필만 수정할 수 있습니다.")
    return await update_person_handler(person_id, data, ctx.uow)

# good: thin mount — 검증은 handler/service
async def update_person(person_id, data, ctx=...):
    return await update_person_handler(
        person_id=person_id, data=data, actor_person_id=ctx.person_id, uow=ctx.uow,
    )
# handler 내부: if person_id != actor_person_id: raise ForbiddenError(...)
```

### param description 재진술 trim (7-1)
```python
# bad: 파라미터명 재진술
template_id: str | None = Query(None, description="템플릿 ID 필터")
# good: description= 만 제거 (Query 유지)
template_id: str | None = Query(None)

# keep: enum/format 은 추론 불가 → 유지
status: str | None = Query(None, description="상태 필터 (pending|processing|completed|cancelled)")
```

## rule 갱신 (router.md)
- §behavior 의존성 선언 **순서 canonical** 한 줄 추가.
- status_code/response_model DELETE·tags는 **범위 밖/optional 명시**(산문위생 규칙에 안 섞음).
