# subscription — 플랜·상태·크레딧 정책

센터 구독의 플랜·라이프사이클·크레딧 한도를 소유한다. 크레딧 **잔량/차감**은 `llm/credit_balance`가 소유하고, 둘을 엮는 쓰기는 `application/handlers/subscription/`(크로스모듈 조율)이 한다.

기간 경계 정산의 설계 권위(단일): [../../../docs/subscription-period-roll.md](../../../docs/subscription-period-roll.md). AI purpose·과금 레지스트리: `llm/credit_balance/plan_config.py`.

## 플랜

| plan | 월 가격 | 크레딧/월 | 기능 |
|---|---|---|---|
| free | 0 | 없음(미터링 안 함) | — |
| starter | 29,000 | 600 | ai_field_note |
| pro | 59,000 | 2,500 | +ai_agent, ai_case_analysis |
| enterprise | 커스텀 | 8,000 | +api_access |

## 상태

현재 운영: `trial` `active` `pending`. 결제 연동 후 확장: `pending_payment` `payment_failed` `expired` `cancelled`.
전이는 `VALID_TRANSITIONS` 상태머신이 강제 — 단 `force=true`는 우회(관리자 override, 사유·감사 남김).

## 특이 구현 (틀리기 쉬운 지점)

| 사실 | why / 주의 |
|---|---|
| **`PLAN_CREDIT_LIMITS`는 free 제외** (starter/pro/enterprise만) | free = 미터링 없음. `init_credit("free")`는 `Unknown plan type`으로 raise — Free 전환은 `clear_credit`(지갑 삭제)로 처리 |
| 런타임 플랜값 = DB `plan_configs` | `plan_config.py`의 하드코딩 `_DEFAULT_*`는 seed/fallback. `_PlanConfigCache`(TTL 60s)가 DB를 덮어씀. 관리자가 `platform-settings/plans`로 편집 |
| 크레딧이 없으면 유료 AI **차단**(fail-closed) | 모든 센터는 프로비저닝 시 balance를 받음 → 없음 = Free/만료 전환분. `CheckQuotaService`가 `row is None`이면 raise |
| 사후 차감은 한도 초과해도 **막지 않음**(soft-cap) | 사전 게이트가 다음 호출을 막아 초과는 한 호출분으로 유계. `deduct_credit.py` `# ponytail` 참조 |
| tokens→credits는 **flat rate** | 입/출력·모델 구분 없음. 기본 2,000 tokens/credit, 센터별 override(시간버전드). STT/화자분리는 오디오 분 → 합성 토큰 |
| FK 제약 없음 (`center_id`는 plain str) | subscription↔credit_balance 정합은 애플리케이션이 보장. 테스트는 합성 center_id로 상태 주입 가능 |

## 기간 경계 정산 (period roll)

기간 만료 시 "요금제 전환 + 크레딧 리셋"은 **단일 권위** `application/handlers/subscription/roll_center_period.py`가 한다. 상세·근거는 위 설계 문서(SSOT).

| 트리거 | 설명 |
|---|---|
| 활성 센터 | `CreditOps.check`에 주입된 `PeriodRoller` 포트가 쿼터 확인 **직전** 호출 — 모든 유료 소비의 단일 길목(sync·백그라운드·워커 커버) |
| 유휴 센터 | 크론 `apply_expired_downgrades_handler`(매시 :30)가 후보마다 같은 함수 호출, 센터당 SAVEPOINT 격리 |

- roll: 미터링 플랜 → `init_credit`(새 한도), Free/미지 → `clear_credit`.
- `find_active_in_center_for_update`로 행 락 → 크론·요청 동시 정산 직렬화.

## 안티패턴

- `init_credit("free")`로 Free 지갑 생성 → free는 `PLAN_CREDIT_LIMITS` 밖. `clear_credit`(지갑 삭제)로.
- 하드코딩 `_DEFAULT_PLAN_CONFIGS`를 런타임 정본으로 읽음 → DB `plan_configs`가 정본, 하드코딩은 fallback.
- 엔드포인트마다 정산 트리거를 선언 → 워커/백그라운드가 누락됨. 단일 길목(`CreditOps.check`)에서.
- roll을 요청 tx에 묶음 → 게이트웨이는 별도 세션이라 못 봄. 자체 tx로 선(先)커밋.
