# 전 모듈 전 레이어 검수·수정 loop (2회차 전수 — 검수+수정 일체형)

모든 모듈을 **모듈 단위(module-major)**로 하나씩, 전 레이어(models→repository→services→facade→handlers→router→events)를 정본 rule과 대조해 위반을 찾고 **그 자리에서 수정**한다. 1회차 검수(convention-design, 2026-07-06 ~420건)와 달리 기록-후-일괄이 아니라 **모듈당 검수→수정→검증→커밋 1사이클**. 무중단 — 세션이 끊겨도 이 문서의 진행표로 이어간다.

> ## ⚑ 새 세션 이어받기
> - 진행률 = §진행표(상태 열이 SSOT). `[대기]`인 다음 모듈부터 §사이클대로.
> - baseline: boot 577 · **334 passed/59 skipped**. 커밋 규약·git 제약 = [runtime-restructure.md](archive/runtime-restructure.md) 동일.
> - 판정 필요(설계 결정·파괴적)한 발견은 고치지 말고 §판정 대장에 기록 후 계속.
> - 기왕 판정 준용(재작업 금지): keeper/carve-out/묘비/이월(X1·X2·2-A) 전부 [convention-design.md](archive/convention-design.md) §확정 의사결정·[billing-ailab.md](billing-ailab.md) §실측 요약 준거. tx 래퍼 언랩=보류(전역 판정). agent 모듈=rebuild 소관 제외.

## 사이클 (모듈당 1커밋)

1. **읽기**: 모듈 파일을 레이어 순으로 정독(작은 모듈=전부, 큰 모듈=서브모듈 배치). grep만으로 정합 판정 금지.
2. **대조 기준**: [rules/api/](../rules/api/) 정본 — persistence-model·persistence-repository·service·facade·application·router·eventing·package-init·cross-module-write·behavior·ai-calling·runtime. 각 파일 열면 paths-앵커로 자동 로드됨.
3. **수정**: 비파괴·국소 위반은 즉시 수정. 마이그/프론트 계약/설계 결정이 필요하면 §판정 대장 기록만.
4. **검증**: boot 577 + 전 스위트 green → `refactor(api): {module} 검수 위반 수정 (full-inspection)` 커밋 → 진행표 갱신.
5. 위반 0이면 코드 커밋 없이 진행표만 `[깨끗]` 부기(진행표 갱신은 여러 모듈 묶어 docs 커밋 가능).

**주의 레이어별 단골 위반**(1·2회차 실증): repo 이름-계약 불일치(get_/find_/list_ 반환)·센터 스코프 미강제·service의 find+인라인 raise·Model mutate+flush·facade 비즈니스 인라인·크로스모듈 직접 import·S1 직렬화 위치·emit 없는 producer·account_id/person_id 혼동·이름-파라미터 거짓말(center_id 미사용).

## 진행표 (파일 수 내림차순 — 큰 모듈 먼저)

| 모듈 | py | 상태 | 발견/수정 |
|------|---:|:----:|-----------|
| assessment | 245 | `[완료]` | 수정 4(upsert_active·unassign 재발명 mutate 근본수정·flush 3·find_by_code 타입)+KEEP 1. AST 트리아지→정독 방식 검증됨 |
| center | 227 | `[완료]` | 수정 1(upsert_template_in_center 통합)+KEEP 2. handlers/router/events 트리아지 clean |
| platform_admin | 182 | `[완료]` | 수정 4(last_login repo화·reorder_faqs raw session 제거·update_token·update_accepted)+KEEP 7 |
| counseling | 133 | `[깨끗]` | create_analysis=carve-out 준용 |
| client | 113 | `[깨끗]` | delete_relation=carve-out 준용 |
| form | 85 | `[깨끗]` | |
| ai_lab | 78 | `[깨끗]` | find+raise=영문 모델명 KEEP류 |
| field_note | 75 | `[깨끗]` | handler commit=레거시 tx |
| billing | 72 | `[깨끗]` | keeper·묘비 준용 |
| voucher | 66 | `[깨끗]` | 스코프는 kwarg-비교 방식으로 실존(트리아지 오탐) |
| document | 65 | `[완료]` | read 4 이름-계약 정정(base 위임·including_deleted 정명). 스코프 403은 판정 대장 |
| auth | 57 | `[깨끗]` | find+raise 3=KEEP(한글·token 비노출) |
| person | 50 | `[완료]` | recompute repo 흡수(repo._session 관통 6 해소) |
| notification | 50 | `[깨끗]` | create_notification begin_nested=KEEP 기판정 |
| subscription | 49 | `[깨끗]` | kwarg-스코프 실존(오탐) |
| role | 46 | `[깨끗]` | version-guard UPDATE=§10 정당 |
| messaging | 38 | `[완료]` | send mutate 2=판정 대장(T1). 나머지 keeper/레거시 tx |
| llm | 38 | `[완료]` | deduct_credit mutate→update_in_place(0545e253f). add_llm_call=판정 대장 |
| schedule | 30 | `[깨끗]` | |
| institution | 19 | `[깨끗]` | |
| notice | 14 | `[완료]` | _get_siblings raw select→repo find_siblings(0545e253f) |
| event | 13 | `[깨끗]` | T2 |
| upload | 7 | `[깨끗]` | |
| person_profile | 7 | `[깨끗]` | |
| support | 3 | `[깨끗]` | |
| activity_log | 3 | `[깨끗]` | 레퍼런스 |
| activity | 2 | `[깨끗]` | |
| ~~agent~~ | 49 | `[제외]` | rebuild 이니셔티브 소관 |
| application/handlers | ~250 | `[완료]` | subscription CreditBalance mutate 3 해소. AsyncSessionLocal=BG carve-out 준용 |

## 판정 대장 (수정 보류 — 사용자/설계 결정 대기)

| 모듈 | file:line | 위반 | 필요한 결정 |
|------|-----------|------|------------|
| ~~document~~ | get/update/delete/restore | ~~인라인 403~~ **집행 완료(사용자 승인 2026-07-08)** — repo 스코프드 404 수렴, 프론트 의존 0 실측 | 해소 |
| ~~messaging~~ | send_message | ~~발송 전이 mutate~~ **집행 완료(사용자 승인 2026-07-08)** — characterization 4 선행 후 repo update_in_place 전환 | 해소 |
| ~~llm~~ | add_llm_call | ~~repo._session 조율~~ **집행 완료(사용자 승인 2026-07-08)** — LlmCallFacade.add_llm_call 재배치 + agent 호출부 error= 잠복 TypeError 수정 | 해소 |

## 커서

> **2026-07-08 — 전 표면 27/27 완료(1일 소진).** 방식: AST 트리아지(repo_audit·svc_audit)→히트만 정독→수정. 수정 커밋 7(assessment·center·platform_admin·document·person·notice/llm·application-subscription), 깨끗/keeper 판정 19표면. **판정 대장 전건 해소(①②③, 2026-07-08 사용자 승인) — loop 종결.** baseline 339 passed/59 skipped. baseline 334 passed/59 skipped·boot 577 유지.
>
> (방식 메모)  직전에 billing-ailab A2 분해 완료(1abc6cdf7)로 분리4 잔여=agent rebuild뿐.
