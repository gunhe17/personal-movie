---
paths:
  - "apps/api/app/core/**"
---

# core — 커널 (permission·exception·type·config·datetime·AI-tool RAG)

모든 모듈이 의존하는 순수 커널. **대전제: core는 어디도 역-import 하지 않는다**(modules/application/behavior/infrastructure 금지). 구 query_limits/projection/sort는 persistence `agent_query.py`로 이전(2026-07-29 — 소비자가 모듈 facade뿐이라 repo 경계가 정위치).

## 인가 3축 — 소유가 다르다

| 축 | SSOT | 규칙 |
|---|---|---|
| 권한(permission) | `core/permissions.py` `class Permission` | `{action}:{resource}` str 상수. 신규는 카탈로그에만 추가 — raw 문자열 하드코딩 금지. tool_loader.validate()가 빌드타임 오타 대조 |
| 역할(role) | **core 아님 — 3축 각 모듈** | 센터 RBAC=`role/role/schemas.py RoleCode`(대문자) · 상담 참여자=counseling `ParticipantRole/Type`(소문자, authz 아닌 관계) · 플랫폼=`admin_account/models.py AdminRole`(+`LEGACY_SYSTEM_ADMIN`=authz-only, 할당 금지). 한 클래스로 뭉치지 않는다(casing·축 상이) |
| 기능(feature) | `plan_configs` DB(동적 — admin 런타임 수정) | 정적 카탈로그로 얼리지 않는다. 코드 게이트 문자열 오타가드만 core 소관(선택) |

## 예외 — 7종 상속 규칙

- 도메인 예외 정의는 `core/exceptions.py`, HTTP 매핑은 `server/exception.py _DOMAIN_STATUS`(SSOT).
- **신규 도메인 예외 = 매핑된 7종(EntityNotFound·PermissionDenied·InvalidOperation·Conflict·Unauthorized·RateLimit·QuotaExceeded) 중 하나를 상속**. bare `DomainException` 직접 상속 금지 — 7종에 안 걸려 500이 난다(assessment 4종 실사고, 수정됨). 안전망(`DomainException`→400)이 있지만 구체 status는 7종 상속으로.
- `*Error`(`DevelopError` 등) = 개발자 계약 위반(5xx 신호) — 도메인 예외와 축이 다르다. 축은 접미사가 아니라 **상속 클래스**가 정한다.

## 타입 유틸 (`core/type.py`) — 사용 의무 지점

- id=`uuid_str`, 타임스탬프=`utc_dt`(naive UTC) — plain alias 유지(NewType 금지, isinstance 호환).
- repo 부분 업데이트 기본값 = `unset`(omit vs None-clear 구분).
- 시간값 생산 = `datetime_utils.utc_now()` 등 경유 — bare `datetime.now()` 금지(서버 tz 종속).
- 폐집합 파라미터 = Enum 타이핑 + `@typecheck`(kwargs 전용 — 호출은 kwarg 관례).

## AI-tool RAG (tool_loader·tool_registry·tool_embedding)

- core는 **loader/registry 인프라만** 소유 — `TOOL` dict 계약(필드 규약)은 AI 호출 계층([ai-calling.md](ai-calling.md)) 소관.
- `validate()` = 빌드타임 가드(필수 필드·INJECTED_ARGS 노출·permission 오타). 신규 검사는 여기 추가.
- `to_search_text`(dict 계약용)와 `format_tool_for_embedding`(문자열 TOOL용)은 **다른 계약** — 통합 금지(임베딩 텍스트 변경 = 저장 벡터 드리프트).

## 안티패턴

- core가 modules/application/behavior/infra import → 역참조 금지(현 0 유지)
- 역할 코드 raw 문자열(`"ADMIN"`·`"counselor"`) 하드코딩 → 각 축 SSOT 참조
- 신규 예외가 bare DomainException 상속 → 7종 중 하나 상속
- bare `datetime.now()` → `utc_now()`(또는 의도적 KST면 `datetime.now(KST)` 명시)
