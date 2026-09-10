# 계층 13 — core 커널 (`app/core/**`)

> 정본 rule: (신설 예정) `core.md`. 조사: 예외 sweep top-down 감사에서 "완전 미소유" 발견 → 사용자 편입 결정(2026-07-05).
> **상태: `[설계완료 — 재설계본]`** — 적대적 검토(2026-07-05)로 초기 결정 정정 후 재설계 확정. 핵심: role은 core 아닌 3축 각 모듈 소유. 라이브 버그 1개 수정 완료.
> 성격: 모든 모듈이 의존하는 순수 커널(permission·exception·type·config·datetime·AI-tool RAG). **방향 = core는 어디도 역-import 안 함**(현 0건). 이 규율이 계층 13의 대전제.

---

## 13-1. 인가 3축 — 축마다 소유가 다르다 `[재설계 확정 2026-07-05]`

**핵심 재설계 통찰**: 인가는 하나가 아니다. **permission만 core catalog**(평면·가로지름). **role은 3개 도메인 축**이라 각 모듈 소유(core 아님). **feature는 DB 동적**이라 core는 오타가드만. 초기 "3축 전부 core SSOT"는 role을 뭉개고 feature를 얼리는 오설계였다.

### permission = core catalog (keeper)
`class Permission` `{action}:{resource}` — 가로지르는 평면 카탈로그라 core가 맞다. tool_loader.validate() 빌드타임 오타 대조. `read:client` vs `client:read` 스테일 예시만 정정.

### role = 3축, 각 모듈 SSOT (core 아님)

| 축 | 값·SSOT (실재) | 재설계 |
|----|---------|------|
| **센터 RBAC** | `ADMIN/MANAGER/COUNSELOR`(대문자). SSOT = [role/role/schemas.py `RoleCode`](../../../apps/api/app/modules/role/role/schemas.py#L6) **이미 존재** | keeper. 흩어진 대문자 raw(member 스키마·`llm/router _ADMIN_ROLES`)만 `RoleCode` 참조로 |
| **상담 참여자 type** | `client/counselor`(소문자 DB값). SSOT = counseling `ParticipantRole` enum(session·case 2벌) | **authz 아님 — 도메인 관계.** repo raw `== "counselor"` → enum `.value` 참조. session·case enum 통합 검토. counseling 소유(core 아님) |
| **플랫폼 admin** | `super_admin/admin/customer_service` + `system_admin`(legacy). [AdminRole](../../../apps/api/app/modules/platform_admin/admin_account/models.py#L9)(enum, system_admin 제외) vs [authz 튜플](../../../apps/api/app/modules/platform_admin/auth/dependencies.py#L13)(system_admin 포함) | 아래 참조 |

- **`class Role` core 신설 = 철회.** role은 도메인별 3축이라 core에 두면 대문자/소문자 casing을 뭉개고 authz축·관계축을 섞는다. **각 축은 자기 모듈 SSOT.**

### 플랫폼 admin 3중정의 = 단일 SSOT + legacy 명시 (행위보존)
`system_admin`이 authz 튜플에만 있고 enum/스키마엔 없는 **의도적 비대칭**(staging 하위호환: 통과는 허용, 신규 할당은 금지).
- **재설계**: `AdminRole`(platform_admin)을 **단일 SSOT**로 — `system_admin`을 `LEGACY`(authz-only, 할당 불가)로 **명시 포함**. authz 튜플(`SUPER_PLUS` 등)은 이 SSOT에서 **파생**. invite/update 스키마는 non-legacy만. → **현 행위 그대로**(system_admin 통과 O·할당 X)면서 3중 드리프트 제거. **비파괴**(값 동일, 단일화만).
- 부수: `ALL_ROLES`·`customer_service`는 `require_role` 소비 0 → dead 정리(별건).
- (미래 옵션: staging system_admin 행 마이그 후 legacy 제거 — ops 결정, 재설계 필수 아님)

### feature = DB 동적, core는 오타가드만
게이팅이 완전 동적: `RequireFeature.act`가 `plan_configs.features` DB JSON(TTL 60s) 조회, admin 런타임 수정, `api_access`는 코드 게이트 없이 DB에만.
- **feature 존재의 SSOT = `plan_configs` DB.** 정적화 금지(admin이 새 feature 못 켜게 됨).
- **선택적**: core `class Feature` = **코드 게이트된 feature 문자열만**(require_feature 인자 오타가드, permission 동형). "feature 존재 SSOT 아님" 명시. 저우선. 부수: `plan_config.py` 2벌(subscription·llm/credit_balance) 별도 확인.

## 13-2. 예외 명명·계층·매핑 `[정정 — 라이브 버그 수정 완료 2026-07-05]`

- **구조 keeper**: `DomainException`(`.message`) 기저 + 7종 `{Concept}Exception`. HTTP 매핑은 [server/exception.py](../../../apps/api/app/server/exception.py) `_DOMAIN_STATUS`(예외클래스→status). 정의=core, 매핑=server 분리 유지.
- **적대적 검토서 발굴한 라이브 버그(수정됨)**: assessment `EngineNotFoundError`·`EngineValidationError`·`WorkflowNotFoundError`·`WorkflowValidationError` 4종이 **bare `DomainException` 직접 상속** → `_DOMAIN_STATUS`가 7종만 등록·`DomainException` 자체 미등록 → Starlette MRO 매칭이 `Exception` fallback으로 → **404/400여야 할 게 500 반환 중이었다.**
  - **수정 적용**: 4종을 매핑된 7종 상속으로 재부모화(NotFound→`EntityNotFoundException`=404, Validation→`InvalidOperationException`=400) + **`DomainException` 자체를 400 안전망 핸들러 등록**(미래 bare 상속 재발 방지). 검증 완료(500→404/400).
- **정정된 규칙(초기 "DomainException 상속" 규약이 이 버그를 낳음)**:
  - 신규 도메인 예외 = **매핑된 7종 중 하나를 상속**(직접 raise도 무방). **bare `DomainException` 상속 금지**(= 500 함정). 실측: 다른 모듈은 전부 7종 직접 사용, 자기 예외 만든 건 assessment뿐인데 그게 이 버그였다.
  - 안전망(`DomainException`→400)이 있어 재발해도 500은 아니나, **구체 status를 위해 7종 상속이 정본**.
- 접미사 관례(`*Exception` 도메인 / `*Error` 개발버그)는 **실코드가 이미 위반**(위 4종이 `*Error`인데 DomainException 상속) — 접미사로 축을 가르는 "규칙"은 **강제 불가**라 폐기, **상속 클래스가 축을 정한다**(7종 상속=4xx / DevelopError=5xx).

## 13-3. 타입 유틸 규약 `[설계완료]`

- **keeper**: `uuid_str = str`·`utc_dt = datetime`(plain alias — NewType/PEP695 **금지**, isinstance 호환 목적). `unset = object()`(부분 업데이트 omit vs None-clear 센티넬). `@typecheck`(kwargs 런타임 검사 → `DevelopError`).
- **결정: 사용 의무 지점 명문화**(암묵 규약 → 명시):
  - repo 부분업데이트 파라미터 기본값 = `unset`([persistence-repository](../../rules/api/persistence-repository.md) `update_in_place` 연계).
  - 시간값 생산 = `datetime_utils.utc_now()` 등 **경유 의무, 직접 `datetime.now()` 금지**(UTC-naive 규약 = datetime_utils가 유일 집행처).
  - status 등 폐집합 파라미터 = Enum 타이핑 + `@typecheck`([00 §2-A](00-field-archetypes.md) 연계 — 2-A의 런타임 강제 수단이 여기).
- `@typecheck`가 kwargs 전용(positional 미검사)인 점 = 명시(호출은 kwarg로, X1/X2 인자 규약과 자연 정합).

## 13-4. config · logger · datetime `[정합 — 소수 note]`

- **config.py**: `Settings(BaseSettings)` 단일 + `@lru_cache get_settings()` + 전역 `settings`. LLM = 5쌍(`AGENT`·`SMALL`·`REFLEX`·`CHECKPOINT`·`EMBEDDING`의 `{X}_PROVIDER`+`{X}_MODEL`) + 단독 `MODEL` 2(`NEW_AGENT`·`PROFILE` — factory dispatch). → keeper. note: 그룹핑이 주석 배너뿐 — 신규 설정은 도메인 배너 아래 쌍 관례 유지.
- **logger.py**: `JSONFormatter`(prod/Loki)·평문(dev) `DEBUG` 분기 + `get_logger(__name__)` + extra 화이트리스트 7키(trace_id·method·path·status_code·duration_ms·client_ip·error_id). → keeper.
- **datetime_utils.py**: **UTC-naive 규약 집행처**(utc_now·to_utc_naive·kst_to_utc_naive·parse_datetime·parse_date·coerce_date, `KST=+9`). 13-3의 "utc_now 경유 의무"가 이걸 강제. → keeper.
- **schemas.py**: 공통 응답 DTO(`MessageResponse`·`DetailResponse`·`OkResponse`·`StatusMessageResponse`) — 모듈 공유 최소 응답 스키마. → keeper.

## 13-5. AI 도구 RAG 커널 `[설계완료 — 계층 11과 경계]`

tool_loader·tool_registry·tool_embedding = AI 도구 RAG 인프라. **계층 11(AI 호출)이 `TOOL` dict 계약을 소유, core는 loader/registry 인프라만 소유** — 경계 명시.

- **keeper**: `validate()` 빌드타임 가드(`_REQUIRED_FIELDS` 누락·`INJECTED_ARGS`(uow·audit) 노출·required 불일치·**permission 카탈로그 오타** 차단). registry `iter_tool_modules()` fs-walk 수집 + read(always)/write·delete(`defer_loading`) prefix 분기.
- **철회: FIND 포맷터 단일화** — 적대적 검토: 두 함수는 **다른 계약**이다. `to_search_text`(입력=`dict`+input_schema, 출력=`[반환]` 有·name 無) vs `format_tool_for_embedding`(입력=kwargs, 출력=name 有·`[반환]` 無·param 설명 멀티라인). 소비처도 다름(tool_loader RAG dict / conversation 핸들러 8곳 `TOOL="..."` 문자열). **합치면 임베딩 텍스트 변경 → 저장된 도구 벡터 드리프트 → 전체 재임베딩.** "거의 같은 중복"은 오판 → **단일화 안 함(keeper)**.
- **결정: validate() feature 대조 추가** — 현재 permission만 카탈로그 대조. 13-1 `Feature` SSOT 신설 후 `require_feature`/`TOOL` feature 필드도 동일 빌드타임 대조.
- TOOL dict 스키마 자체의 필드 규약(purpose·keywords·boundaries…)은 **계층 11 소관**(11이 TOOL 계약 문서화). 여기선 loader가 그걸 어떻게 소비하는지 인프라만.

## 방향 규율 `[정합 — 무변경]`
- `core → modules/application/behavior/infrastructure` 역-import **0건**. `__init__.py`에 "core→infra 역참조 금지" 명시. keeper — 계층 13 대전제.
- core 내부 `tool_loader.validate()` → `permissions.Permission` 지연 import는 core→core라 정상.

---

## 실행 워크리스트 (계층 13) — 재설계 확정본

| 작업 | 대상 | 파괴성 |
|------|------|:-----:|
| ✅ **완료** assessment 예외 500 버그 수정 | 4종 재부모화(7종 상속) + DomainException 400 안전망. 검증됨 | behavioral(적용됨) |
| 센터 RBAC = `RoleCode` 참조 | 흩어진 대문자 raw(member 스키마·llm/router `_ADMIN_ROLES`) → `RoleCode`(SSOT 이미 존재) | 비파괴(값 동일) |
| 참여자 type = enum 참조 | counseling repo raw `== "counselor"/"client"` → `ParticipantRole.value`. session·case enum 통합 검토. **counseling 소유** | 비파괴 |
| admin 단일 SSOT + legacy 명시 | `AdminRole`에 system_admin=LEGACY(authz-only) 포함 → authz 튜플 파생·스키마 non-legacy. 3중 드리프트 제거 | 비파괴(행위보존) |
| dead 정리 | `ALL_ROLES`·`customer_service`(require_role 소비 0) | 비파괴 |
| feature 오타가드(선택) | core `class Feature`=코드게이트 문자열만. **plan_configs DB가 존재 SSOT**. 저우선 | 비파괴 |
| permission 스테일 정정 | role_permission/schemas.py `client:read`→`read:client` | 문서 |
| 타입 의무 + datetime.now 교정 | unset/utc_now/@typecheck 규약 + `datetime.now()` 직접 3건 | 문서+소량 |
| ~~role class core 신설~~ · ~~FIND 포맷터 단일화~~ | **철회**(3축 뭉갬 / 다른 계약·벡터드리프트) | — |
| rule 신설 | `core.md` — permission SSOT·**7종 상속 예외규칙**·role=3축 각모듈·feature=오타가드·타입 의무·RAG 경계 | 문서 |

**성격 요약(재설계 확정)**: permission만 core SSOT. **role은 3축(RBAC 대문자·참여자 소문자·admin) 각 모듈 소유 — core에 안 둔다**(뭉갬 방지). admin은 단일 SSOT+legacy 명시로 행위보존 통합. feature는 DB 동적(core는 오타가드만). 재설계 후 대부분 **비파괴로 강등**(초기 "행위변경" 우려는 축 분리로 해소). 최대 산출=예외 500 라이브버그 수정.
