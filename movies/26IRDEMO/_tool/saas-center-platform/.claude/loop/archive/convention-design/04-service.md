# 계층 4 — Service 설계 `[설계완료]`

정본 rule: [service.md](../../rules/api/service.md). 상위 인덱스: [convention-design.md](../convention-design.md).

survey 진행 중(전 모듈 services). 아래 계약 축별로 divergence를 채운다. **선행 정리 반영**: S1(직렬화 위 레이어)·SC2(primitive-in)·repo단일·타모듈 import은 architecture-refactor에서 대거 정리됨 → 잔재만 대상.

## 검사 축 (rule 계약) — survey 592 파일

| 축 | 계약 | survey 결과 | 결정 |
|----|------|------------|------|
| S1 직렬화 | service 안 `model_validate`/`*Response` 0 | **0 위반** ✓ | 무변경 |
| repo 접근(타모듈·if None·_count) | self.repo 하나 | 잔재 미미(read-model import 허용) | 무변경 |
| `*` 배치 | (rule: 전부 kwarg-only) | 86 all-kwarg / 21 구분자 / **463 `*`없음** | **X2 구분자로 개정**(아래 4-A) |
| 클래스 docstring | 없음 | **193 존재**(대부분 재진술) | 제거(4-C) |
| phase 마커 | 본문 단계 라벨 | **223 부재** | **전면 강제**(4-B) |
| 한 파일 한 Service | 1 class | **8 다중**(manage_samples 5·list_for_lab 4 등) | 분리(4-D) |
| 메서드 = execute | 고정 | **13 이탈** | 케이스별(4-E) |
| commit | 없음 | 1(messaging, infra 함수) | keeper |

## 4-A. `*` 배치 = X2 구분자 (repo·service 통일) `[확정]`

survey: `*`없음 80%·all-kwarg 15%·구분자 4%. rule("전부 kwarg-only")은 소수, 사용자는 `*`를 **필수식별↔기능특화 시각 구분자**로 사용. → **X2로 확정**(cross-cutting, [convention-design.md](../convention-design.md) 참조): `*` 앞=필수 식별/스코프(id·center_id), 뒤=나머지(수정필드·필터·옵션·페이지네이션). repo §2도 이로 통일.
- 근거 예: deduct_credit(`center_id,tokens_used | rate`)·list_notices(`member_id | 필터+page`)·reject_plan_change(`center_id | reason`).
- 실행: `*`없는 463 execute + repo add/list에 split `*` 삽입. `create_run`의 잘못된 앞배치(sequence/parallel_group) 뒤로. 호출부 kwargs. 비파괴.

## 4-B. phase 마커 = 전면 강제 `[확정]`
223 부재. **trivial 한 줄 service에도 강제**(사용자 결정) — 단일 return도 `# return`. 완전 균일.

## 4-C. 클래스 docstring 제거 `[설계완료]`
193개 대부분 `"""일정 생성."""` 재진술 → 제거(CLAUDE.md 규약). 정보성(비자명 제약)만 keeper(M2 기준). 기계적.

## 4-D. 한 파일 다중 Service 분리 `[설계완료]`
8파일 → one-use-case=one-file로 분리. manage_samples.py(5클래스)→5파일, list_for_lab.py(4)→4파일, run_batch_experiment(3), 그 외 2클래스 5파일. 기계적(import 갱신 동반).

## 4-E. 메서드 ≠ execute (~20, 예외 sweep 2026-07-04로 확대) — 케이스별 `[설계완료]`
- **keeper(변형)**: pipeline `*_execution`·`pipeline_infra`(infra util, execute 아님)·`render_template`(pure-logic staticmethod §5). 변형 정당. pipeline `load_*`/`save_*` 내부 헬퍼도 keeper(execution 내부).
- **rename→execute**: `copy_from_global`·`check_status`·`update_attachment`·`notify_unread_members`·`send_batch`·`set_attachment`/`clear_attachment`·`validate_and_count`·`upload_file`·`get_available_slots`/`check_slot`(working/operating_time) 등 표준 service인데 메서드명 이탈 → `execute`로.
- **`execute_{변형}` = 한 파일 다중 use-case → 4-D 분할 (결정)**: `execute_trial`+`execute_free`([create_subscription.py:5,43](../../../apps/api/app/modules/subscription/subscription/services/create_subscription.py#L5) 별개 흐름: trial=만료일, free=무기한) → `create_trial_subscription.py`+`create_free_subscription.py` 각 `execute`. `execute_system`/`execute_center_only`(list_message_templates)·`execute_accessible`/`find_default`(get_message_template) 동일 결. `execute_or_none`은 repo `find_` 결(부재=None)로 강등 검토.

## 연계 (앞 계층 결정이 service에 닿는 것)

- **Enum 파라미터(2-A/A안)**: service `execute` 파라미터도 status 등 `FieldNoteStatus` 타이핑 대상 — repo와 동일 계약. 호출처 멤버화에 service 포함.
- **repo `_get`/get_ 사용**: service must-exist는 repo `get_*` 호출(§4) — repo `_get` 헬퍼 신설과 정합.
- **X1 파라미터 폭발**: service `execute` 시그니처도 대상(service.md §2에 이미 초기형 "2개 이상 폭발" — X1의 self-only-inline과 **재조정 필요**).

## 실행 워크리스트 (계층 4)

| 작업 | 대상 | 파괴성 |
|------|------|:-----:|
| 4-A `*` X2 배치 | `*`없는 execute 463 + repo add/list, split `*` 삽입 + 호출부 kwargs | 비파괴(시그니처·호출) |
| 4-B phase 마커 | 223 부재 service에 라벨 부착(한 줄도 `# return`) | 비파괴(주석) |
| 4-C docstring 제거 | 193 클래스 docstring(정보성만 keeper) | 비파괴 |
| 4-D 파일 분리 | 8 다중-Service 파일 → 파일당 1 class + import 갱신 | 비파괴 |
| 4-E execute rename | ~7 표준 service 메서드명 → execute(pipeline/render는 keeper) | 소비처만 |
| rule | service.md §2 "전부 kwarg-only"→X2 · repo §2 X2 통일 | 문서 |

**전부 비파괴**(테이블 무관). Enum 파라미터(2-A)·repo `_get` 사용은 계층 2·3 연계. 실행 순서: docstring/phase(주석) → 파일분리 → execute rename → X2 `*`(호출부 동반) → rule.

## 연계 재확인
- **X1(파라미터 폭발) + X2(`*` 배치)**: execute 시그니처가 둘 다 대상 — X2로 `*` 위치 정하고 X1로 한 줄씩. service.md §2 기존 문구는 X1+X2로 대체.
- **Enum 파라미터**: execute의 status 등 → Enum 타이핑(2-A/A), 호출처 멤버화에 service 포함.
