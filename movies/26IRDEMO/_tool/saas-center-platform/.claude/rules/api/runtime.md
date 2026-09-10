---
paths:
  - "apps/api/app/runtime/**"
---

# runtime — 실행 엔진 조립층

runtime(assistant·ai_lab·case_analysis·field_note·form_generation·form_template·voucher_document — 2026-07-29 실측, 구 agent는 assistant 컷오버로 소멸)은 도메인 로직을 소유하지 않는 **오케스트레이터**다 — application handler 동급 조립층. 여러 도메인을 가로지르되 각 도메인의 공개 표면만 쓴다.

## 0. 모듈 골격 — 파일 문법 (고정 어휘)

레퍼런스 [voucher_document](../../../apps/api/app/runtime/voucher_document/)·[field_note](../../../apps/api/app/runtime/field_note/). 루트 슬롯은 전부 optional — 있으면 반드시 이 이름:

| 파일 | 역할 | 언제 |
|------|------|------|
| `constants.py` | job_type 키 | 워커형만 |
| `executor.py` | 워커 진입점 `process_{job}()` — 자체 세션(§3 Track B keeper) | 워커형만 |
| `service.py` | 요청형 진입점 — tx/AI 주입, application handler만 호출 | 단일 엔진 모듈만 |
| `runner.py` | 다단계 상태 전이 러너 | 다단계 모듈만 |
| `prompts.py` | 공용 프롬프트 + 카탈로그 | 필요 시 |
| `{stage}/` | 실행 단계 = 항상 폴더 | 단계가 있는 모듈 |
| 명사 유틸 | 공용 순수 유틸(여러 단계가 소비할 때만 루트) | 최소화 |

단계 폴더 내부 — 진입은 반드시 `service.py`:

| 파일 | 역할 |
|------|------|
| `service.py` | 단계 진입, 유일 public — `{Verb}{Noun}Service.execute`([service.md](service.md)와 같은 꼴) |
| `schemas.py` | 단계 DTO |
| `prompt.py` | 단계 전용 프롬프트 |
| 명사 헬퍼 | 단계 내부 구현 — **단계 밖 import 금지** |

- 진입은 두 종뿐: 워커형(`executor.py`, JOB_HANDLERS 등록) / 요청형(엔진 함수·서비스, application handler 호출). 어느 쪽이든 호출자는 application 레이어 — 모듈이 runtime을 import하면 §4 위반.
- 엔진 시그니처 규약: DB=owning facade 주입, AI=`AIFacade`, 파일=storage — 예: `Service(facade, *, ai, storage).execute(id, center_id, *, member_id=None)`.

## 1. 접근 경계 (아래로만)

- **write = owning 모듈 루트 facade 메서드** — 타 모듈 repo/service/model 직접 접근 금지(R1, 예외 없음). 필요한 write use-case가 owning 모듈에 없으면 **거기 신설**(facade+service+repo primitive — voucher_extraction·form.extraction이 선례).
- **read = `{Module}Client`(DTO)** 또는 facade read([cross-module-write.md](cross-module-write.md) 9-4와 동일 정본).
- AI 호출 = [ai-calling.md](ai-calling.md) 경유(게이트웨이) — raw transport 직접 금지.
- ORM 필드 직접 대입·`flag_modified`·`repo._session` private 접근 = 전부 위반 신호.

## 2. 금지 (계층 역행·횡단)

- runtime → `app/application` import 금지(역행) — 공유 로직은 도메인 facade로 하강.
- runtime끼리는 in-scope 유틸 공유만(선례: form_template→voucher_document/pdf_to_markdown · ai_lab→field_note `get_production_prompts` 프롬프트 SSOT).

## 3. tx

- 요청-내 runtime은 **주입받은 uow/tx 핸들**로만 — `AsyncSessionLocal()` 직접 개방 금지.
- 예외(keeper): Track B leaf executor(`JOB_HANDLERS` 대상 — 워커가 uow 미주입 호출)는 자체 세션이 구조 필수([worker.md](worker.md)). `_mark_failed`(메인 tx 롤백 후 상태 마킹)도 새 세션 필수. 앱부트 factory 배선(`startup`)은 요청 흐름 아님.
- 요청-내 두 번째 tx는 `side_uow`(동시 커밋-스트림 분리) 단 하나가 정당(X3) — behavior에 안 담고 별도 `Depends`로 표면화(어색함=경고 신호).

## 4. public 표면

- runtime 패키지의 진입점은 명시적(엔진/executor 함수). 도메인 모듈이 runtime을 import하는 방향은 금지(module→runtime 역방향 — form/template handler의 transport 직접 사용이 반례였음, AI 이주로 해소).

## 안티패턴

- executor가 로드 Model 필드 대입 + `flag_modified` + flush → owning facade `mark_*`/`append_*` 메서드
- runtime이 `uow.repo(ForeignRepository)` → facade(write)/Client(read)
- runtime이 application handler import → 로직을 도메인 facade로 하강
- 요청-내 자체 `AsyncSessionLocal()` → 주입 uow (Track B executor·`_mark_failed`·startup만 예외)
