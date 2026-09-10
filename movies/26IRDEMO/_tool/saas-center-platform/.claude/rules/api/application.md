---
paths:
  - "apps/api/app/application/**"
---

# Application Handler — 크로스모듈 조율

`application/handlers/`는 **여러 모듈에 걸친 워크플로를 조율하는 유일 주체**다. owning 모듈의 루트 facade들을 한 UoW 트랜잭션에 엮어 하나의 use-case를 완성한다. 모듈은 서로를 모르므로(모듈 비노출), 모듈을 가로지르는 조립은 전부 여기로 모인다.

루트: 모듈 경계 [package-init.md](package-init.md) · 크로스모듈 쓰기 소유 [cross-module-write.md](cross-module-write.md) · 모듈 표면 [facade.md](facade.md) · 읽기 JOIN 정책 [persistence-repository.md](persistence-repository.md) §6. 레퍼런스 [application/handlers/center_application](../../../apps/api/app/application/handlers/center_application/).

---

## 이 문서

| 섹션 | 핵심 규칙 |
|------|----------|
| 위치·형태 | `application/handlers/{domain}/{verb}_{noun}.py`. **함수** `{...}_handler(*, uow, ...)` |
| tx 경계 | `behavior.request`가 소유 — handler는 받은 `uow`로 facade 호출만(`async with uow`·`commit` 없음). 같은 세션 = atomic |
| 조율 규약 | owning 모듈 **루트 facade 메서드만** 호출. 타 모듈 service/repository/model 직접 접근 금지 |
| side-effect | 통지 = emit→reaction / 발송이 목적 = 동기 carve-out(§3). `BackgroundTasks` 폐지 |
| read 조율 | 각 모듈 id 조회 후 Python 조립. repo JOIN 금지(admin read-model은 예외) |

---

## 1. 위치 · 형태

`application/handlers/{domain}/{verb}_{noun}.py`. 클래스가 아니라 **함수**다 — `uow`와 primitive를 받아 facade들을 순서대로 호출한다.

```python
# good: 여러 모듈 facade를 한 트랜잭션에 엮음
async def approve_center_application_handler(
    *,
    application_id: str,
    reviewer_person_id: str,
    uow: UnitOfWork,
) -> CenterApplicationResponse:
    # approve (Center 생성)
    application = await CenterApplicationFacade(uow).approve_application(
        application_id=application_id,
        reviewer_person_id=reviewer_person_id,
    )
    center_id = application.center_id

    # initialize (검사·역할·운영시간 — 같은 uow)
    await AssessmentFacade(uow).initialize_center_assessments(center_id=center_id)
    await RoleFacade(uow).initialize_center_roles_and_permissions(center_id=center_id)
    await OperatingTimeFacade(uow).initialize_default_operating_times(center_id=center_id)

    # return
    return CenterApplicationResponse.model_validate(application)
```

- 함수명 `{verb}_{noun}_handler`(앱 레이어는 모듈 handler와 구분 위해 `_app_handler`도 쓴다). `application/handlers/{domain}/__init__.py`가 re-export.
- 각 facade에 **같은 `uow`** 를 넘긴다 — 같은 세션 공유라 모든 write가 한 트랜잭션(atomic).
- **직렬화는 application handler가** — owning facade들은 entity/Model을 반환하고([facade.md](facade.md) §2), application handler가 조립 후 `Response.model_validate`로 변환한다(직렬화의 세 번째 경로: 자기모듈 facade `*_with_response` / facade 없는 단순모듈 handler / **크로스모듈 application handler**). `expire_on_commit=False`라 commit 전후 무관하게 안전([persistence-repository.md](persistence-repository.md) §8).
- 단계는 phase 마커(소문자 한 단어)로([service.md](service.md) §3). 나레이션·docstring 금지([apps/api/CLAUDE.md](../../../apps/api/CLAUDE.md)).

## 1-1. 파일 문법 — 공유 파일 금지 (2026-07-14 사용자 결정)

application 레이어에 **`_`-prefix 공유 헬퍼/레지스트리 파일을 신설하지 않는다** —
[service.md](service.md) §7의 `_`-prefix 관례는 모듈 내부 한정이며 application에는 적용하지 않는다.
크로스모듈 해소 연쇄는 각 handler **본문에 인라인**하고(같은 연쇄가 여러 handler에 반복돼도 감수 —
명시성이 간접성보다 우선, `_projection.py` 인라인 회귀가 선례), 기계 감사용 계약은 handler 파일 내
**데이터 상수**(예: query handler의 `PROJECTION` — [agent-query.md](agent-query.md))로 둔다.
진짜 공유가 필요한 로직은 파일 추출이 아니라 **owning 모듈 facade로 하강**이 정본.

| 슬롯 | 소유 규칙 |
|---|---|
| `handlers/{domain}/{verb}_{noun}.py` | 본 문서 — 한 파일 = 한 핸들러(+TOOL) |
| `jobs/` (dispatch·JOB_HANDLERS) | [worker.md](worker.md)·[eventing.md](eventing.md) |
| `events/`·`reactions/` | [eventing.md](eventing.md) — EVENT_REACTIONS·반응 |
| 루트 어댑터 `subscription_period_roller.py` | [ai-calling.md](ai-calling.md) 기간 정산 시임 — 자가 tx 커밋이라 handler 문법 밖(§2 예외) |
| `handlers/{domain}/schemas.py` | 도메인 조립 DTO **데이터 전용**(BaseModel·Enum·dataclass) — 로직·해소 연쇄 금지(로직이 생기면 §1-1 위반). 현행 5곳(home·person_profile·role·activity·counseling), 2026-07-28 소급 등재 |
| `handlers/activity/labels.py` | [eventing.md](eventing.md) §10 표현 맵 — 규칙 지정 슬롯 |
| (잔존 `_` 파일 없음) | 전량 인라인 회귀 완료(2026-07-14) — `_projection`·`_query_vocab`·`_track_b`·`_member_persons`·`_center_summaries`·`_billable_enrich`·`_member`·`_anchors`·`_defaults`·`_refine`·`_compose` 소멸 |

## 2. tx 경계 — behavior가 소유

크로스모듈 write의 원자성은 **단일 UoW**가 보장한다. 그 UoW의 트랜잭션 경계(commit/rollback)는 **`behavior.request`(또는 `stream`)가 소유**한다([behavior.md](behavior.md) §4) — handler는 받은 `uow`로 facade들을 순서대로 호출만 하고 `async with uow`·`commit()`을 두지 않는다.

- 모든 facade에 **같은 `uow`**(= `ctx.uow`)를 넘긴다 — 같은 세션 공유라 모든 write가 한 트랜잭션(atomic). 커밋은 behavior가 clean-exit 시 1회(`transactional_uow`).
- audit도 같은 tx에 든다 — `audit()` action이 `ctx.uow`를 공유([behavior.md](behavior.md) §4). 별도 세션 fire-and-forget 감사를 만들지 않는다([eventing.md](eventing.md) §10).
- application handler 안에서 새 세션·새 UoW를 만들지 않는다 — 받은 `uow`만 쓴다(두 세션 혼용 = 부분 커밋 위험). 유일 예외는 기간 정산 사전 체크(`period_roller.ensure_current_period` — 자체 세션 원자 커밋·멱등·실패 삼킴) — 게이트웨이 쿼터 확인(독립 세션)이 커밋된 balance를 봐야 하는 구조 필수([ai-calling.md](ai-calling.md) 기간 정산 시임).
- DB 밖 side-effect는 reaction으로(§3 — send carve-out만 tx 안 동기).
- **레거시 이행**: 라우터가 behavior로 전환되기 전 handler는 스스로 `async with uow:` + `commit()`을 잡았다. 다수 핸들러에 이 래퍼가 남아 있으나(behavior tx 안에서 무해 — `UnitOfWork.__aenter__`는 self 반환, `__aexit__`는 예외 시에만 rollback이라 재진입 안전), **신규 handler는 tx-free로 작성**하고 손대는 김에 래퍼를 제거한다.

## 3. side-effect — 발송 성격이 경로를 가른다 (2026-07-28 통일)

부수효과 경로는 둘뿐 — `BackgroundTasks` 레인은 폐지됐다(2026-07-28 사용자 결정, 이행 완료).
폐지 사유: 커밋 전 발송 = 롤백 시 거짓 알림, 본문 독립 세션 = dual-write(옛 carve-out, 2026-07-09 소진).
유일 잔존 = platform_admin `admin_login` 2FA 메일(모듈 레이어, 세션 0) — OTP 지연 민감 + 로그인-워커 결합 금지 사유가 코드 주석에 명기된 keeper.

| 발송 성격 | 경로 |
|---|---|
| DB 변경의 통지 (푸시·인앱·안내 SMS) | emit→reaction([eventing.md](eventing.md)) — 커밋된 이벤트만 워커가 집어 거짓 알림이 구조적으로 불가 |
| 발송이 목적 (링크·코드가 문자에 담김) | tx 안 동기 직접 호출 — 아래 carve-out 등재 후에만 |

- infra 어댑터는 `factory.get_X()`로 취득([infrastructure.md](infrastructure.md)) — application handler가 직접 클래스 생성 안 함.
- **carve-out — send 계열 동기 발송**(제품 요구 2026-07-06, [behavior.md](behavior.md) INV-tx 티어3): assessment `create/resend_send_link`·`create/resend_send_result`·`bulk_create_send_link` + form `create/resend_form_send` + client_app `send_app_invitation_sms`(2026-07-28 편입). 수신자별 성공/실패를 응답에 동기 반환(`delivery_results`)하거나 문자 자체가 산출물인 계약이 우선. 커밋은 요청 끝 1회 그대로 — 발송 후 롤백 시 유령 발송은 감수. behavior 2-phase 요청(커밋 후·응답 전 단계)이 생기면 이행 대상. 이 8곳 외 적용 금지 — 확장은 이 목록 갱신으로.

## 3-1. 부분 성공 batch — 롤백 가능성이 tx 전략을 가른다

일부 실패를 허용하는 batch의 tx 전략은 [behavior.md](behavior.md) INV-tx의 사례다 — **실패 항목의 부작용이 롤백되는가** 하나로 갈린다. "부분 성공"이 곧 per-item 커밋을 뜻하지 않는다.

| 부작용 | 전략 |
|---|---|
| DB 쓰기뿐(롤백 가능) | **단일 tx** — 검증 실패는 결과 error, 통과분 원자 누적 → behavior 끝 커밋 1회. event 1개 + atomic N개([eventing.md](eventing.md) §4). 예: `bulk_create_member_invitations`·`bulk_update_sessions` |
| 외부 발송 섞임(롤백 불가) | **tx 안 동기 발송** — §3 send carve-out, 커밋은 요청 끝 1회(유령 발송 감수). 예: `bulk_create_send_link` |

- 검증은 쓰기 전 판정이라 단일 tx로도 항목별 error를 준다 — **검증을 루프 앞단에서** 하고 통과분만 write. broad `try/except`로 write 실패를 삼키면 공유 세션이 오염되니(다음 항목 연쇄 실패) 쓰기는 감싸지 않는다.
- 단일 tx batch가 per-item 커밋·건별 dispatch를 두면 [eventing.md](eventing.md) §4 위반(bulk를 atomic당 event N개로).

## 4. 조율 규약 — facade만

- owning 모듈의 **루트 facade 메서드만** 호출한다([cross-module-write.md](cross-module-write.md) §1). 타 모듈 `service`/`repository`/`model` 직접 import·`session.get(ForeignModel)`·`ForeignModel(...)` 생성은 위반(레이어 우회 — [cross-module-write.md](cross-module-write.md) §3 금지 신호).
- 성문화된 비-facade 표면(2026-07-28 소급 등재 — 이 넷 외 발명 금지): `modules/event`의 `emit`·audit 조회([eventing.md](eventing.md)) · event 마커 클래스(`AdminAuditAtomic` 등 — [eventing.md](eventing.md) §4 예외) · `{Module}Client` READ DTO([cross-module-write.md](cross-module-write.md) §6) · `notification.helpers` 알림·발송 함수(워커 경유 handler 한정 — reaction·cron job, [eventing.md](eventing.md) §8).
- "model 직접 import 금지"의 범위 밖 두 가지(위반 아님): ① models.py의 `str, Enum` 값집합 import — enum의 정본 위치가 models.py 공존([persistence-model.md](persistence-model.md) §4)이라 어휘 참조이지 entity 접근이 아니다 ② facade Entity-return의 **타입 힌트 전용** Model import — 반환 entity에 이름을 붙이는 주석일 뿐. 조회·생성·필드 변경이 붙는 순간 위반.
- facade 없는 단순 모듈(지속층 없음 — upload 등)은 **모듈 handler가 공개 표면** — application이 그 handler를 직접 호출한다(§1의 "facade 없는 단순모듈 handler" 직렬화 경로와 동일 근거). facade 있는 모듈의 handler 호출은 여전히 우회 위반(delete_schedule 선례 — 라우터 직결로 해소).
- write use-case가 owning 모듈에 **없으면** 거기 신설(Service + 루트 facade 메서드), 호출자에 중복 구현돼 있으면 이동·삭제 — application handler에 비즈니스를 들이지 않는다([cross-module-write.md](cross-module-write.md) §2).
- application handler는 **조립만** — 검증·도메인 변경은 facade 너머 service가.

## 5. read 조율 — id 조회 후 Python 조립

크로스모듈 read enrichment(여러 모듈 데이터를 한 응답으로)도 application handler가 한다.

- 각 모듈 facade로 id/데이터를 따로 조회한 뒤 Python에서 조립 — repository JOIN으로 모듈을 가로지르지 않는다([persistence-repository.md](persistence-repository.md) §6, 모듈 간 model import 0).
- 예외: admin/집계 read 표면(`platform_admin/*`)은 직접 JOIN read-model 허용([persistence-repository.md](persistence-repository.md) §6.3, [ARCHITECTURE.md](../../../apps/api/app/modules/ARCHITECTURE.md) EX-2) — 단 read 전용, write로 확장 금지.

---

## 안티패턴

- application handler가 타 모듈 `repository`/`service`/`model` 직접 import → owning facade 메서드 호출([cross-module-write.md](cross-module-write.md) §3)
- `session.get(ForeignModel)`/`ForeignModel(...)` 직접 생성·변경 → owning facade write
- handler 안에서 새 `UnitOfWork`/세션 생성 → 받은 `uow` 하나로(부분 커밋 방지). 예외: 기간 정산 사전 체크(`period_roller`, §2)
- 통지 발송을 handler가 직접(동기·`BackgroundTasks`) → emit→reaction(§3). 동기는 send carve-out 등재분만
- 비즈니스 로직(검증·도메인 조작)을 application handler에 인라인 → owning service로
- 크로스모듈 read를 repo JOIN으로 → 각 모듈 조회 후 Python 조립(admin read-model만 예외)
- handler가 `async with uow:`/`commit()`으로 tx를 잡음 → tx는 behavior.request 소유, handler는 받은 `uow`로 호출만(§2)
- 부분 성공 batch를 무조건 per-item 커밋으로 → **부작용 롤백 가능성**으로 판정(§3-1, [behavior.md](behavior.md) INV-tx). DB만이면 단일 tx + 1 event/N atomics
- handler를 클래스로 → 함수 `{verb}_{noun}_handler`
- 한 파일에 `*_handler` 둘 이상 → 한 파일=한 핸들러. 공유 로직은 `_` 파일 추출이 아니라 인라인 또는 owning facade 하강(§1-1)
- handler들이 공유하는 로직/레지스트리를 `_`-prefix 파일로 추출 → §1-1 금지 — 각 handler 본문 인라인(중복 감수)
