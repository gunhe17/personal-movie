# 계층 8 — Eventing 설계 `[설계완료]`

정본 rule: [eventing.md](../../rules/api/eventing.md). 상위: [convention-design.md](../convention-design.md).

survey(grep 검증): **emit 112 · 마커 40 · EVENT_REACTIONS 9(+ audit-only 89) · `*Event` 0 · `@audit_log` 0 · producer `pg_notify` 0.** architecture-refactor §4 정리로 **정합도 ~98%** — 위반 4건(기계적)만 대상.

## 8-1. 정합 (무변경)
- **producer 역할 분리**: service=atomic · handler=emit · facade=passthrough (110/112).
- **마커** `{Module}Atomic` 40/40, `events.py` 상주, `payload()`/`act`/`act_entity_name`/`act_entity_id` 구비. `*Event` 구식 0.
- **EVENT_REACTIONS** 9 등록, **89 audit-only**(반응 없음=succeed, 정상 §2), dead reaction 0.
- **bulk** = 1 event + N atomics. **RequireDispatch** = emit 라우터 전부 `dispatch_events()` 선언(stuck-pending 0).
- **reaction** = application handler, facade-only(크로스모듈 read enrichment repo는 §5 허용).
- `@audit_log` 0, `activity_log` 묘비(`legacy/model.py`만), **event_atomics = audit 정본**.

## 8-2. producer 위반 — admin atomic-in-handler (2) `[기계적]`
- `platform_admin/center_application/handlers/approve_application.py:36`·`reject_application.py:40`이 `atomics=[AdminAuditAtomic(...)]`를 **핸들러에서 직접 생성**(§4: service가 atomic 생성, handler는 emit).
- 수정: `platform_admin/center_application` service(approve/reject)가 `AdminAuditAtomic`를 만들어 `(atomic, model)` 반환, handler는 emit만. admin 감사는 emit(actor_type=admin)이 정본(§10). 비파괴.

## 8-3. emit 가드 (1 잔여) `[기계적]`
- `agent/conversation/handlers/delete_conversation.py:20` `atomics=[atomic] if atomic else []`. (center_assessment bulk은 가드 제거됨 — 해소.)
- emit이 **빈 list no-op을 소유**(§4 안티패턴: 호출처 `if atomics`/`if atomic` 금지). 가드 제거, 무조건 `emit(...)`. 비파괴.

## 8-4. Track B(AI 잡) enqueue `[부분 완료 2026-07-09]`
- 봉투 범용화 완료(JobMessage `target_id` — rule-closure H2) + counseling analysis reaction→enqueue 전환 완료(routes.py "counseling_case_analysis_created"→enqueue_case_analysis, executor `case_analysis` status-skip 멱등). application.md §3 BackgroundTasks carve-out 소진.
- 잔여: form/voucher 추출 등 요청 핸들러의 직접 dispatch → reaction 경유 이관(rule-closure H4 계열), agent Track B enqueue(rebuild 소관).

---

## 실행 워크리스트 (계층 8)

| 작업 | 대상 | 파괴성 |
|------|------|:-----:|
| admin atomic → service 이동 | approve/reject_application 2 | 비파괴 |
| emit 가드 제거 | delete_conversation · bulk_update_center_assessments 2 | 비파괴 |
| rule | eventing.md **무갱신**(이미 정합) | — |

**전부 비파괴·기계적.** 이 계층은 architecture-refactor §4에서 대거 정리돼 **잔재 4건**뿐. Track B enqueue는 별도 이니셔티브(keeper).

---

## 2차 수렴 — handler 단일 event `[완료: 2026-07-15]`

과거 저장소가 같은 `event_group_id`의 후속 insert를 무시해 다중 emit의 reaction을 유실하던 문제를 제거했다. 현재 저장소는 plain INSERT로 중복 그룹을 fail-fast하고, 모든 진입점은 사건 event 하나에 atomic 전량을 귀속한다.

확정 불변식:
- handler 실행 1회 = handler 사건 event 1개 + 그 실행의 atomic N개
- service=atomic 생성 · facade=pass-through · handler=atomic 전량 수집 후 emit 정확히 1회
- `EVENT_REACTIONS[event_name]`은 첫 atomic 이름이 아니라 handler 사건 이름이며, 부수 사실은 `Route(source="entity.act")`로 fan-out
- 저장소는 plain INSERT이며 같은 그룹의 두 번째 event를 허용하지 않음
- event 이름이 문서에 없거나 충돌하면 구현자가 결정하지 않고 loop에 미결 기록 후 사용자 확인

종결 결과:
1. service atomic 생성 → facade pass-through → handler 단일 emit 계약 수렴
2. worker/cron은 자기 event group, mutating reaction은 신규 child group 사용
3. 활동 로그는 event 목록 + atomics 상세로 전환
4. AI gateway 호출은 `llm_calls` 정본 read로 분리

### 이벤트명 결정

- 2026-07-15 사용자 원칙: 한 번 승인된 명명 판단은 동일한 형태의 handler에 반복 질문하지 않는다. `naming.md` 통제어휘와 아래 선례로 기계적으로 결정할 수 있으면 그대로 적용하고, 선례로 판정할 수 없는 새로운 의미 충돌만 질문한다.
- 2026-07-15 사용자 승인: `intake_case_handler` → `counseling_case_intaken`. `intake`는 UI·handler·service·event에 유지하고, 함께 생성되는 case/session/schedule/participant는 atomic source로 표현한다.
- 2026-07-15 사용자 승인: `apply_case_edits_handler` → `counseling_case_edits_applied`. 최종 편집본 적용 사건이 event이며, 생성·삭제·참여자 변경은 atomic source로 표현한다.
- 위 원칙의 기계 적용: `add_sessions_to_case_handler` → `counseling_sessions_added`(다건 연산=복수명사, add 동사 유지), `update_case_handler` → `counseling_case_updated`, `bulk_update_sessions_handler` → `counseling_sessions_updated`. delete handler는 기존 주 엔티티의 `*_deleted` 이름을 유지하고 cascade atomic을 같은 event에 합친다.
