---
paths:
  - "apps/api/app/modules/**/router.py"
---

# Router — 데코레이터 메타 위생

모듈 `router.py`는 얇은 HTTP 마운트다 — handler를 호출하고 의존성(인증·prefix)을 꽂는다. 라우트 데코레이터의 `summary`/`description`은 OpenAPI 문서용 산문이라 **코드 주석과 같은 규율**을 받는다: 경로·메서드·핸들러명이 이미 말하는 동어반복은 제거하고, 소비자가 추론할 수 없는 계약만 남긴다.

루트: 주석 규약 [apps/api/CLAUDE.md](../../../apps/api/CLAUDE.md) "주석·docstring" · 조립층 [server.md](server.md) · 흐름 [service.md](service.md) §7 · 인증·tx·event 의존성 [behavior.md](behavior.md)(`Depends(behavior.request(authenticate(), ...))`로 `Context`(`ctx`) 주입, `ctx.uow`·`ctx.center_id`·`ctx.event_group_id`를 handler에 전달).

---

## 이 문서

| 섹션 | 핵심 규칙 |
|------|----------|
| summary | 핸들러명/한국어 글로스 재진술이면 제거(거의 항상) |
| description | 동어반복·동작 나레이션 제거. 비자명한 소비자 계약만 한 줄 유지 |
| param description | `Query`/`Field`의 enum·format은 유지, 파라미터명 재진술은 제거 |
| 건드리지 않는 것 | `tags`·`status_code`·`response_model`·`Depends`는 기능 메타 — 보존 |

이 규칙은 **summary/description만** 손대는 surgical 수정이다 — 라우트 구조·핸들러·의존성은 그대로 둔다. 제거는 런타임 무영향(OpenAPI 메타뿐).

---

## 1. summary — 재진술이면 제거

`summary`는 거의 항상 핸들러명/경로의 한국어 재진술이라 동어반복이다. 제거한다.

## 2. description — 비자명한 계약만

- 제거: summary/핸들러명 재진술, 동작 나레이션(cascade·단계·"N+1 최적화" 같은 구현 메모) — 동작은 handler/service 계약이지 라우트의 일이 아니다.
- 유지(예외): 경로·메서드·핸들러로 **알 수 없는 소비자 계약**일 때만, 한 줄. 예: "충돌 시 차단하지 않고 경고만"(비자명한 의미), 다른 데 안 드러나는 권한 스코프.

```python
# bad: summary 가 핸들러명 재진술, description 이 동작 나레이션(cascade)
@router.delete(
    "/me",
    status_code=204,
    summary="회원 탈퇴",
    description="회원 탈퇴 (Soft Delete). 모든 센터 멤버십, Person, Account가 비활성화됩니다.",
)
async def delete_me(...): ...

# good: 기능 메타(status_code)만 — 동작 계약은 handler/service 가 진다
@router.delete("/me", status_code=204)
async def delete_me(...): ...
```

## 3. 파라미터 description — enum/format은 유지

`Query`/`Field`의 `description`은 소비자 입력 계약이라 기준이 다르다.

```python
# good: 허용값(enum)·format 은 추론 불가 → 유지
status: str | None = Query(None, description="상태 필터 (draft | submitted)")

# bad: 파라미터명 재진술 → 제거 (description= 만 떼고 Query 는 유지)
template_id: str | None = Query(None, description="템플릿 ID 필터")
page: int = Query(1, ge=1, description="페이지 번호")
```

- `Field(description=...)`가 스키마 필드명을 옮긴 것도 제거([apps/api/CLAUDE.md](../../../apps/api/CLAUDE.md)). 제약은 `ge`/`le`/`min_length` 등 타입·validator로 이미 드러난다.

## 4. 건드리지 않는 것

`tags`(OpenAPI 그룹핑)·`status_code`(HTTP)·`response_model`(직렬화)·`Depends`(인증·UoW)는 기능이다 — 제거 대상 아님. 이 규칙은 산문 메타(`summary`/`description`)에만 적용된다.

---

## 안티패턴

- `summary="회원 탈퇴"`처럼 핸들러명 재진술 → 제거
- `description`에 cascade·단계·최적화 메모(동작 나레이션) → 제거(handler 계약)
- `Query(description="템플릿 ID 필터")`처럼 파라미터명 재진술 → `description=`만 제거
- summary/description 정리하면서 `tags`/`status_code`/`response_model` 같이 손댐 → summary/description만(surgical)
- 라우트에 비즈니스·검증 인라인 → handler/service로([service.md](service.md))
