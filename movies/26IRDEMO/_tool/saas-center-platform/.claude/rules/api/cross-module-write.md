---
paths:
  - "apps/api/app/application/handlers/**"
  - "apps/api/app/modules/**/facade/**"
  - "apps/api/app/modules/**/services/**"
  - "apps/api/app/modules/**/handlers/**"
---

# 크로스모듈 쓰기 — owning 모듈 소유 (신설·이동·재사용 규칙)

> **읽기**(조회/집계)는 admin/집계 표면(`platform_admin/*` 등)의 직접 JOIN을 [persistence-repository.md](persistence-repository.md) §6.3 · [ARCHITECTURE.md](../../../apps/api/app/modules/ARCHITECTURE.md) EX-2로 허용한다. 이 규칙은 **쓰기(생성·변경·삭제)** 에만 적용된다 — read-model 예외는 쓰기에 확장되지 않는다.

## 1. 원칙

한 엔티티의 **write는 그 엔티티를 소유한 모듈만** 한다. 타 도메인 모듈도, admin 표면(`platform_admin/*`)도, 공개 표면(`support` 등)도 직접 쓰지 않는다.

- cross-module write 조율의 **유일 주체는 `application/handlers/`** — owning 모듈의 루트 `facade` write 메서드를 호출해 조립한다([package-init.md](package-init.md) §1 모듈 비노출).
- `router`는 그대로 둔다(인증·prefix 경계). 호출 대상만 모듈 핸들러 → application handler로 바꾼다.
- owning 모듈의 표준 흐름으로 수렴: **application handler → owning `Facade.write_xxx()` → owning `Service` → owning `Repository` → owning `Entity`**.

## 2. 결정 — 신설 / 이동 / 재사용

owning 모듈에 해당 write use-case가 **있는지 먼저 확인하고** 분기한다 (추론 금지, 코드 확인).

| owning 모듈 상태 | 처리 |
|---|---|
| write Service·Facade 메서드가 **이미 있다** | **재사용.** 호출자(예: admin)에 중복 구현돼 있으면 **삭제**. 새로 만들지 않는다. |
| write 로직이 **호출자(잘못된 모듈)에만 있다** | **이동.** owning 모듈 `services/`로 옮기고 루트 `facade` 메서드로 노출. |
| write use-case가 **없다** | **신설.** owning 모듈 안에 `Service` + 루트 `facade` 메서드 (+필요 시 `repository` write 메서드)를 만든다. |

- Facade **파일**이 있어도 write **메서드**가 없으면 메서드만 신설.
- `repository`에 read 메서드만 있으면 `add`/`update`/`remove`도 신설 대상이다.

## 3. 금지 신호 (= 위반, 발견 시 §2로 수렴)

- `modules/A/**` 가 `from app.modules.B...models|repository|service import ...` (B≠A) — 모듈 간 import 0.
- handler·service에서 `session.get(ForeignModel)` / `ForeignModel(...)` 직접 생성·필드 변경 + `flush()` (레이어 우회).
- admin 표면이 자기 `Admin*Repository`를 **타 모듈 Model 타입**으로 선언해 write (병행 소유).
- owning 모듈의 진짜 `Repository`를 호출자가 직접 import해 사용 (read-model JOIN이 아닌 write).

## 4. 이식 함정 (repo 작업에서 학습 — 크로스모듈에서 재발)

"이동"(§2)·"신설"은 model 이동·repo 메서드 추가·커밋 후 직렬화를 동반해 [persistence-repository.md](persistence-repository.md) §8 함정을 다시 밟는다. 그 함정 목록은 repo/persistence 파일에만 트리거되므로 여기서 인용한다:

- **model 서브모듈 이동 → 등록은 자동.** [app/modules/models.py](../../../apps/api/app/modules/models.py)가 트리에서 수집한다(env.py·`init_db`는 그것만 import). dev [init-schema.py](../../../infra/dev/init-schema.py)만 손 목록이라 예외.
- **positional 호출 ↔ kwarg 관례 충돌.** owning 메서드를 새로 부르는 호출처는 이식 전 grep → kwarg 화([persistence-repository.md](persistence-repository.md) §2·§9, `@typecheck`는 kwargs만 검사).
- **commit 후 `model_validate` → MissingGreenlet.** application handler가 multi-facade 커밋 후 Response 직렬화 시 `expire_on_commit=False` 전제 — 직렬화는 `async with uow:` 밖에서([service.md](service.md) §7).
- **`@typecheck` forward-ref NameError.** 새 repo 메서드 어노테이션이 모듈 globals에서 resolve되게(지역 import·`from __future__` 주의).

## 5. 쓰기 소유가 운영자 쪽인 경우

write 소유가 본질적으로 운영자(admin)인데 엔티티만 도메인 모듈에 있는 경우(예: 공지 — 운영자가 작성, 센터가 열람), 두 배치 중 하나를 택한다 — ① 엔티티를 도메인 모듈에 두고 admin은 read-model로 JOIN, 또는 ② 엔티티 소유를 admin 모듈로 이관하고 도메인 모듈은 read-model로. 어느 쪽이든 "한 엔티티의 write는 한 모듈" 불변식은 유지한다.

- 공지(notice)는 **①로 해소됨** — `notice` 모듈이 Notice write를 소유하고 `platform_admin/notice`는 read-model로 JOIN([ARCHITECTURE.md](../../../apps/api/app/modules/ARCHITECTURE.md) EX-2). admin 모듈(`platform_admin`)이 자기 admin-native 엔티티(admin_account·faq·inquiry 등)를 소유하는 것과는 별개 — ②는 엔티티 성격이 admin 고유일 때만.

## 6. 읽기 표면 — `{Module}Client` DTO (2026-07-28 소급 성문화)

application·runtime·worker가 타 모듈을 읽기만 할 때 facade 대신 쓸 수 있는 경량 표면 — `modules/{m}/client.py`가 frozen dataclass DTO만 반환한다(entity 미노출, write 불가 — write는 §1 그대로). [runtime.md](runtime.md) §1 "read = `{Module}Client`(DTO)"와 같은 정본. 현행: center `MemberClient`·person `PersonClient`.

- 도메인 모듈이 타 모듈 `client.py`를 import하는 것은 여전히 금지(모듈 비노출) — 소비자는 application·runtime·worker 한정. 자기 모듈 client는 무관.
- 예외: 성문화된 발송 표면([eventing.md](eventing.md) §8 `notification.helpers`)의 구현부(`recipient_resolver`)는 Client 소비 가능 — 수신자 해소가 본질적으로 크로스모듈 read이고 Client가 그 목적의 표면.
