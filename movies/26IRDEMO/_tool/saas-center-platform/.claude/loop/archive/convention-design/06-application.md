# 계층 6 — Application Handler 설계 `[설계완료]`

정본 rule: [application.md](../../rules/api/application.md). 상위 인덱스: [convention-design.md](../convention-design.md).

survey: **162/200 구조 정합**. §2(cross-module write)·§4(emit)·bg_uow는 architecture-refactor에서 결정됨. 잔재만 대상.

## 6-1. tx 래퍼 (163 파일) `[keeper-until-behavior]`

레거시 `async with uow: ... await uow.commit()` 래퍼가 163 핸들러에 잔존. behavior가 tx 소유하면 제거되나 **behavior 마이그(계층 10) 전엔 제거 불가**(제거 시 커밋 사라짐 — behavior.request가 아직 커밋 안 함). rule도 "신규 tx-free, 레거시는 손대는 김에"(ratchet). → **계층 10 behavior 롤아웃에 결합. 지금 일괄 제거 금지.** 무해(UoW 재진입 안전).

## 6-2. 크로스도메인 read → facade 강화 (D1 뒤집기) `[확정: 사용자 2026-07-02]`

survey가 찾은 20 "타모듈 import"는 세 부류:
- **크로스도메인 read-enrichment (repo)**: approve_credential이 `PersonRepository`·`MemberRepository` `find/list`로 알림 조회 등 ~8건.
- **같은 도메인 service/repo**: subscription handler→subscription `SetQuotaExceeded`·`ApplyPlanChange` = **D2 keeper**(한 도메인 orchestration).
- **admin read-model repo**: `AdminCenterRepository`·`AdminAuditLogRepository` = **§6.3/EX-2 keeper**.

**결정(사용자): 크로스도메인 read도 owning facade read 메서드 경유 — D1(§2 read-enrichment repo 허용)을 뒤집음.**
- foreign repo 직접 import(`uow.repo(PersonRepository)`) 0 → `PersonFacade(uow).get_by_ids(...)` 등 owning facade read.
- owning facade에 read 메서드 없으면 신설(+5-6대로 그 메서드도 Service 경유).
- **이 컨벤션 loop이 architecture-refactor D1("코드 변경 없음")을 상회** — [todo/architecture-refactor §2 D1](../../todo/api/architecture-refactor.md) supersede.
- **⚠️ 9-4가 6-2를 다시 상회**: 계층 9-4([09-cross-module.md](09-cross-module.md))가 "facade read(entity 반환)"를 **`{Module}Client`(DTO 반환)로 대체** 확정. 즉 여기 "owning facade read"는 최종형이 아니라 **9-4 client가 정본** — cross-domain read 실행은 `PersonClient(uow).get_by_ids(...)`(DTO). 이 섹션은 방향(foreign repo 금지)만 유효, 표면은 client.
- 유지: D2(같은 도메인)·admin read-model(§6.3).
- 파괴성: 비파괴(repo→facade read 라우팅, 반환 동일).

## 6-3. side-effect tx 안 (2) `[설계완료]`
credential approve/reject가 `NotificationFacade.notify()`를 `async with uow:` 안에서 호출 → 외부 I/O는 tx 밖(§3). **BackgroundTasks 적재** 또는 event emit(eventing 반응). rule-확정.

## 6-4. 새 세션 생성 (2) `[설계완료]`
counseling `fetch_program_name`·`fetch_field_note_summaries`가 `AsyncSessionLocal()+UnitOfWork()` 생성 → **받은 uow 사용**(§2). BackgroundTasks 본문 아니므로 carve-out 아님. rule-확정.

## 6-5. DTO mutate (1) `[설계완료]`
`create_form_send`가 `recipient.instance_id`·`status` mutate → 새 객체 구성. 기계적.

## 6-6. class handler (1) `[설계완료]`
`activity/agent_facade.py` `ActivityLogAgentFacade` 클래스 → 함수 핸들러/service로. activity_log teardown 잔재, 기계적.

## 준수 (무변경)
직렬화 위치(commit 후)·`session.get(ForeignModel)`/`Model(...)` 0·phase 마커(대부분 생략, 8핸들러 있음=acceptable).

---

## 실행 워크리스트 (계층 6)

| 작업 | 대상 | 파괴성 |
|------|------|:-----:|
| 6-2 크로스도메인 read → facade | ~8 foreign repo import → owning facade read(+Service). D2·admin read-model keeper | 비파괴 |
| 6-3 side-effect → BG/event | credential approve·reject notify | 비파괴(이동) |
| 6-4 새 세션 → uow | counseling fetch ×2 | 비파괴 |
| 6-5 DTO mutate → 새 객체 | create_form_send | 비파괴 |
| 6-6 class → function | activity/agent_facade | 비파괴 |
| 6-1 tx 래퍼 제거 | 163 — **계층 10 behavior에 결합, 여기서 안 함** | (deferred) |
| rule | application.md §4/§5 read=facade-only 재확인, D1 supersede 명시 | 문서 |
