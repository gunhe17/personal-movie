# 모듈 아키텍처 — 정답 구조 + 인정된 구조적 예외

이 문서는 `apps/api/app/modules`의 정답(canonical) 구조와, 정답을 따르지 않는 것이 **의도된 설계**인 예외를 명문화한다. 규칙 본문은 [.claude/rules/api/package-init.md](../../../../.claude/rules/api/package-init.md)에 있고(always-on), 이 문서는 그 규칙이 인용하는 예외 카탈로그다.

레퍼런스: [activity_log](activity_log/)(풀 데이터 슬라이스).

## 정답 구조

```
{module}/
├── __init__.py        # 공개 표면 (service re-export)
├── router.py          # HTTP 마운트 지점 (main.py가 import)
├── facade/            # application handler 전용 표면 (타 도메인 모듈 비노출)
└── {submodule}/       # 엔티티 1개 = 수직 슬라이스
    ├── models.py · repository.py · schemas.py
    ├── services/      # use-case 1개 = 파일 1개
    └── handlers/
```

레이어: Router → Handler → (Facade) → Service → Repository → DB. tx 경계는 Handler(UnitOfWork).

불변식:
1. 엔티티 1개 = 서브모듈 1개
2. `router`·`facade`는 모듈 루트에만
3. `model`·`repository`·`service`는 서브모듈 안에만
4. cross-module 조율은 `app/application/handlers/`만 — facade→facade·service→service 금지
5. 같은 모듈 형제 서브모듈끼리 cross-import·JOIN 허용(한 aggregate)
6. 모델 등록은 [models.py](models.py)가 트리에서 수집 — 손 목록은 `infra/dev/init-schema.py`만 남음

---

## 인정된 구조적 예외 (기능적 필연)

각 예외는 "정답을 따르지 않는 이유"와 "따르면 안 되는 이유"를 함께 명시한다. 신규 코드는 정답 구조를 기본으로 하고, 아래 패턴에 정확히 해당할 때만 예외를 쓴다.

### EX-1. 서브모듈 `router.py` — URL prefix 그룹 분해
조건 → 결과: 한 모듈이 엔티티별로 독립 URL prefix(`/rooms`, `/members`, …)를 가질 때 → 각 서브모듈이 자체 `router.py`를 두고, 모듈 루트 `router.py`가 `include_router`로 합성하며 prefix를 루트에서 주입한다.

- 이유: 하나의 거대 router 파일 대신 슬라이스별로 엔드포인트를 응집. 루트가 prefix를 주입하면 그 지식이 한 곳에 모인다.
- 라우터가 **대상별로 갈리면 파일도 가른다** — 같은 엔티티라도 센터용/운영자용/웹훅/내부는 서브모듈 안에서 `router.py`·`admin_router.py`·`webhook_router.py`·`internal_router.py`로 분리한다(messaging 선례, 2026-08-14 subscription 683줄·schedule 397줄 분할). 한 파일에 라우터 객체가 여럿이면 분할 신호다.
- **루트가 더할 게 없으면 루트를 두지 않는다** — `APIRouter()`에 `include_router`만 있는 통과 파일은 간접층일 뿐이라 제거하고 `modules/routers.py`가 서브를 직접 들인다(assistant·billing·form·messaging·voucher). 서브가 자기 prefix를 이미 들고 있으니 잃는 정보가 없다.
- **소유자는 URL 경로 그룹이다** — `/cases/…`는 counseling_case, `/sessions/…`는 counseling_session이 갖는다. 호출 대상(module handler냐 application handler냐)은 기준이 **아니다**: 서브모듈 라우터 49개가 이미 application handler를 부른다(2026-08-14 실측). 같은 URL 그룹의 GET은 서브모듈, PATCH는 루트 같은 분산이 생기면 그건 규칙이 아니라 잔재다.
- 정답과의 차이: 정답은 router를 루트에만 둔다. 하지만 엔티티가 많은 도메인(center 13, platform_admin 19)에서 단일 router는 수백 줄로 비대해진다.

루트 우회 5건(루트 합성이 아니라 직접/형제 마운트) — 각자 이유가 다르므로 개별 기록:

| 위치 | 마운트 방식 | 이유 |
|---|---|---|
| [assessment/send_result](assessment/send_result/router.py) `public_router` | main.py 직접 | 공개 무인증 제출 — 센터 인증 트리와 분리 |
| [notification/notification_setting](notification/notification_setting/router.py) | main.py 직접 | `/notification-settings` 독립 트리(루트 prefix 미적용) |
| [messaging/message_template](messaging/message_template/router.py) `admin_router` | main.py `/api/v1/admin` 직접 | 센터용/플랫폼 admin용 인증 경계 분리 |
| [center/member_invitation](center/member_invitation/router.py) | member router에 중첩 | `/members/invitations`를 `/{member_id}`보다 먼저 매칭 |
| [role/role_permission](role/role_permission/router.py) | main.py 직접 | 센터 컨텍스트(`/centers/{id}/roles`) 리소스 — 크로스모듈 마운트 제거(2026-07-28), main.py가 prefix 합성 |

### EX-2. BFF read-model 서브모듈 — `platform_admin/*` (혼합 모듈)
`platform_admin`은 **혼합 모듈**이다 — 정답 구조의 owner 서브모듈과 read-model 서브모듈이 공존한다. 이 예외는 후자(read-model 서브모듈)에만 적용된다.

| 종류 | 서브모듈 | 형태 |
|---|---|---|
| **owner** (admin 고유 엔티티 소유) | admin_account · admin_account_management · admin_refresh_token · audit_log · cs_memo · faq · inquiry · plan_config · platform_setting | 정답 구조(models·repository·service) — 일반 모듈과 동일 |
| **read-model** (자체 모델 없음 + repo) | center · center_application · center_assessment · ai_usage · subscription · notice · notice_read | 타 모듈 엔티티를 직접 JOIN하는 read 전용 |
| **기능 표면** (모델·repo 없음) | account · qna · voucher · form 등 | router+handler만 — owner 서브모듈 service나 application handler에 위임(EX-10 admin router 집계) |

조건 → 결과: 운영자 콘솔이 여러 비즈니스 모듈을 가로질러 집계 화면을 만들 때 → 그 **서브모듈만** 자체 엔티티 없이, 타 모듈 엔티티를 직접 JOIN하는 read 전용 `repository.py`를 두거나 handler가 타 모듈 repository/models를 직접 사용한다.

- 이유: admin 집계 화면은 본질적으로 cross-domain(center+member+subscription+credit…). application handler로만 조립하면 N facade 호출 + 재조합으로 read 성능·표현이 무너진다.
- 경계: read-model 서브모듈은 자기 엔티티가 없어 `models.py`를 안 둔다(없으므로 못 두는 게 아니라, owner가 아니므로 안 둔다). read-model JOIN은 불변식 4의 명시적 예외([persistence-repository.md](../../../../.claude/rules/api/persistence-repository.md) §6.3) — **read 전용**, 타 모듈 엔티티 write는 owning 모듈 facade 경유([cross-module-write.md](../../../../.claude/rules/api/cross-module-write.md)). 예: `platform_admin/notice`는 `notice` 모듈이 소유한 Notice를 read-model로 JOIN하고, write(생성·수정·삭제)는 `notice` 모듈이 한다.
- 비-read 2건: [platform_admin/pipeline](platform_admin/pipeline/)(runtime 운영 액션 표면), [platform_admin/upload](platform_admin/upload/)(upload.image 위임 프록시).

### EX-3. 게이트웨이/조립층 — UoW 밖 독립 세션
조건 → 결과: 모든 AI 호출처럼 "config 조회 + quota 체크 + 외부 호출 + 사용량 기록"을 한 단위로 묶되 요청 UoW와 독립된 트랜잭션 경계가 필요할 때 → 서브모듈에 게이트웨이/팩토리 파일을 둔다([llm/gateway](llm/gateway/): ai_gateway·factory·quota·credit_quota_checker).

- 이유: runtime·여러 handler가 직접 잡아 쓰는 진입점이며, 자체 세션을 연다.
- 따르면 안 되는 이유: `services/`로 흡수하면 "service = UoW 안에서 1 repo" 규약과 정면 충돌. 게이트웨이는 의도적으로 그 규약 밖이다.

### EX-4. 플러그인 SPI — 도메인 로직 레지스트리
조건 → 결과: 검사 채점·진행방식처럼 종류별 구현을 자동 등록·교체하는 확장점이 필요할 때 → `protocol.py`(Protocol/ABC) + `registry.py`(싱글톤) + `plugins/`(구현체) 구조를 둔다.

- 해당: [assessment/engine](assessment/engine/)(채점/해석), [assessment/assessment_task/workflows](assessment/assessment_task/workflows/)(self_report/external_service).
- 이유: stateless 순수 로직(DB import 0). 표준 5종(models/repository/…)을 적용할 데이터가 없다.

### EX-5. 스트리밍 I/O 인프라
조건 → 결과: WebSocket 장기 연결·바이너리(PCM→WAV) 처리가 필요할 때 → 서브모듈에 세션 레지스트리·바이너리 유틸·WS 핸들러를 둔다([field_note/streaming](field_note/streaming/)).

- 이유: 영속 데이터는 형제 슬라이스(field_note_audio)에 위임, 자체는 인메모리 세션 상태. REST(Router→Handler→Service) 패턴 밖의 인프라 어댑터.

### EX-6. 복합 facade 기능 서브모듈
조건 → 결과: 2+ 엔티티를 하나의 기능 표면으로 묶어 노출할 때 → 데이터는 엔티티별 형제 슬라이스로 가르고, `router`·`handler`·`schema`만 가진 기능 서브모듈을 둔다.

- 해당: [client/relation](client/relation/)(client_relation+sibling_relation), [client/link](client/link/)(link_request+unlink_log), [field_note/pipeline](field_note/pipeline/)(STT 오케스트레이션).
- 이유: 기능 서브모듈의 handler/service가 같은 모듈 형제 데이터 슬라이스를 cross-import(불변식 5, 한 aggregate).

### EX-7. 순수 로직층 / 컨텍스트 집계 (models 없는 서브모듈)
조건 → 결과: 영속 데이터 없이 계산·조립만 하는 표면 → models 없이 service/handler만 둔다.

- 해당: [auth/suspicious_activity](auth/suspicious_activity/)(위험점수 계산), [center/me](center/me/)(요청 컨텍스트에서 내 정보 조립), [ai_lab/feature_test](ai_lab/feature_test/)(여러 모듈 핸들러 묶은 QA 표면), [upload/image](upload/image/)(object storage 게이트웨이, DB 없음).

### EX-8. 리소스 디렉토리
조건 → 결과: 코드가 아니라 정적 리소스(렌더링 템플릿·에셋)일 때 → 서브모듈에 리소스 디렉토리를 둔다([assessment/assessment_task/templates](assessment/assessment_task/templates/): PDF 리포트 HTML+이미지).

### EX-9. 모듈 전역 SSOT 상수/메타
조건 → 결과: 플랜 한도·권한 매핑·모델 카탈로그처럼 여러 서브모듈/모듈/seed가 공유하는 상수·어휘가 있을 때 → 모듈 루트 또는 서브모듈에 상수/schemas 파일을 둔다.

- 해당(이동 시 광범위 팬아웃): [subscription/subscription/plan_config.py](subscription/subscription/plan_config.py), [llm/credit_balance/plan_config.py](llm/credit_balance/plan_config.py), [ai_lab/metadata.py](ai_lab/metadata.py), [notification/helpers.py](notification/helpers.py), [messaging/templates.py](messaging/templates.py)(발송 문구 SSOT — send carve-out handler들이 소비), [client/profile/default_avatars.py](client/profile/default_avatars.py)(기본 아바타 풀 — center/member가 재사용, 단일 소스 유지).
- 루트 DTO 어휘: [auth/schemas.py](auth/schemas.py)·[llm/schemas.py](llm/schemas.py) — 서브모듈 여럿에 걸치는 모듈 표면 워크플로 DTO(signup=account+person·login=account+token / credit=balance·rate·usage). 소비처가 루트 router·application handler뿐이라 특정 서브모듈 소속이 없다(2026-07-28 실측).
- 이유: Enum/dict/frozenset이라 Pydantic 전용 `schemas.py`나 상태 없는 `services/`에 자연스럽게 안 들어간다. SSOT 단일 위치 유지가 결합보다 낫다.

### EX-10. facade 없는 모듈
조건 → 결과: cross-module 오케스트레이션이 없는 모듈은 facade를 두지 않는다.

| 모듈 | 이유 |
|---|---|
| [platform_admin](platform_admin/) | 루트 router가 서브모듈 router를 admin 인증+prefix로 집계, 각 서브모듈 router→handler 직결. cross-module은 application handler가 담당 |
| [support](support/) | 무인증 공개 고객센터. 자체 도메인 없이 platform_admin의 FAQ/Inquiry를 직접 read/접수 |
| [upload](upload/) | 단일 image 서브모듈 집계, handler 직결 |

### EX-11. agent 조회 SQL 슬라이스 — `app/query/` (레이어 면제 구역)
조건 → 결과: agent 노출 조회(`query_*`)가 여러 모듈의 표시명·필터를 한 행에 실어야 할 때 → 모듈 레이어를 거치지 않고 `app/query/{entity}.py`가 타 모듈 model을 직접 조인해 SQL 한 방으로 봉투를 만든다. 규칙 정본 [.claude/rules/api/query.md](../../../../.claude/rules/api/query.md).

- 이유: 읽기엔 트랜잭션 불변식이 없다(롤백할 것도, 지킬 도메인 규칙도 없음). 레이어는 쓰기의 안전장치이며, 조회에 강제하면 `WHERE` 한 절이 facade·service·repo 세 곳에 손으로 배선되고 표시명은 왕복 N번 + 파이썬 조립이 된다. 실측(2026-08-20, 6종 이관): 체인 1,764줄 → 1,235줄, 왕복 4→2, 구 구현의 절삭-선행 오답 1건 자동 수정.
- 정답과의 차이: 불변식 4(모듈 비노출)·§6.2(크로스모듈 repo JOIN 금지)·agent-query.md §G-impl(SQL GROUP BY 금지)의 명시적 예외. **읽기 전용**이며 쓰기는 여전히 owning 모듈 facade 경유.
- 경계(가드): ① 실행기 `agent_query.fetch`가 `Select`만 수용해 write가 물리적으로 불가 ② 모든 파일에 `center_id ==` 필수(CI grep) ③ 조인 근거는 `relations.py` 마커에 선언된 관계뿐 ④ 표면 계약(TOOL·봉투·필터/투영/정렬 완결)은 agent-query.md 그대로.
- 감사: `audit_query_filters.py` 10축 중 `layering_gaps`·`facade_boundary_gaps`·`facade_repo_delegation_gaps` 3축만 면제, 나머지 7축은 그대로 적용.

### EX-12. cross-cutting 알림 수신자 해석 — `notification` (facade→facade 허용)
조건 → 결과: 알림을 보내려면 수신자(멤버·인물)의 연락처를 cross-domain으로 조회해야 할 때 → notification의 공용 발송 진입점이 **타 모듈의 루트 facade를 직접 호출**해 수신자를 해석한다(불변식 4 `facade→facade 금지`의 명시적 예외).

- 해당: [recipient_resolver.py](notification/recipient_resolver.py)(→center MemberFacade·person PersonFacade + 보호자 해소 확장 →center_link·family facade, 2026-07-28 목록 갱신), [helpers.py](notification/helpers.py)(`notify_members` 공용 진입점, →client).
- 이유: 알림 발송은 여러 모듈이 공유하는 cross-cutting 디스패치. 수신자 해석은 read 전용 cross-domain 집계(EX-2 read-model과 동형)이고, facade로만 접근한다(repository 직접 import 금지). 특정 REST 엔드포인트가 아니라 `notify_members` 뒤에서 호출된다.
- 경계: **read 전용 + facade 경유.** 타 모듈 write·repository 직접 접근은 이 예외 밖.

### EX-13. 모듈 read 표면 display enrichment — `task_facade` 등 (application handler 조립)
조건 → 결과: 모듈 read 메서드가 자기 엔티티를 화면 표시용으로 타 도메인 데이터(방 이름·일정·내담자명)로 보강해야 할 때 → **facade는 자기 모듈 범위의 primitive·ID만 반환**하고, 크로스모듈 enrichment(Schedule·Room·Client 이름 등)는 **application handler**가 루트 facade를 조립한다.

- 해당: [task_facade.py](assessment/facade/task_facade.py) `get_tasks_display_info_by_ids` — `schedule_ids`·`client_id`만 반환; [list_field_notes_with_brief.py](../application/handlers/field_note/list_field_notes_with_brief.py)가 `ScheduleFacade`·`RoomFacade`·`ClientFacade`로 room/name 보강.
- 이유: EX-12(알림 수신자)와 동형 — read 전용 cross-domain 집계. facade→facade 직접 호출은 피하고 handler가 조립 경계를 소유한다(불변식 4 정합).
- 경계: **read 집계 전용 + handler 경유 cross-module.** 타 모듈 write·repository/service 직접 import는 금지. mutation 오케스트레이션(예: submit/scoring/PDF)은 owning service(`SubmitTaskPipelineService` 등)로, HTTP 직렬화는 module handler의 `*_with_response` 또는 application handler의 `Response.model_validate`.

### EX-14. document upload/storage orchestration — `document_facade` (F8, facade 유지)
조건 → 결과: HTTP `UploadFile` 언패킹·checksum·S3 temp→final 이동이 필요할 때 → orchestration은 [document_facade.py](document/facade/document_facade.py)에 유지한다(service로 내리면 primitive-in 위반).

- atomic은 `UploadDocumentService`/`UpdateDocumentService`가 생성하고 facade는 pass-through; access log는 `CreateAccessLogService`(event atomic 아님).
- cross-module Document 등록(검사 PDF)은 application handler가 `register_existing_document` tuple을 emit에 합류.

### EX-15. 서브모듈 없는 표면 모듈의 루트 `schemas.py`
조건 → 결과: 자체 데이터 슬라이스(서브모듈) 없이 router+DTO만으로 타 모듈을 투영·접수하는 표면 모듈 → DTO를 모듈 루트 `schemas.py` 하나에 둔다.

- 해당: [client_app/schemas.py](client_app/schemas.py)(내담자 앱 읽기 전용 투영 `App*` DTO — 핸들러는 application 소유), [support/schemas.py](support/schemas.py)(공개 고객센터 — platform_admin FAQ/Inquiry 투영, EX-10과 같은 모듈).
- 이유: 서브모듈이 없어 "서브모듈 `schemas.py`" 자리가 존재하지 않는다 — 루트 schemas가 구조의 귀결이지 일탈이 아니다.

---

## 비-예외 (정리 대상 — 정답으로 수렴시킬 일탈)

아래는 기능적 필연이 아니라 단순 일탈이다. 발견 시 정답 구조로 정리한다.

- 서브모듈 `dtos/` 디렉토리: service 전용 Command dataclass는 같은 서브모듈 `schemas.py`로 흡수(별도 디렉토리 불필요).
- 모듈 루트 `handlers.py` 단일파일: `handlers/` 디렉토리로 분해(파일당 1 use-case).
- 중복/dead code: 발견 즉시 제거.
