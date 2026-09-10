# 바우처 구현 설계서 (실무용 통합본) — superseded

> ⚠️ **2026-05-18 superseded** — 본 문서는 자동 차감·자동 청구·환불 rollback 등 무거운 자동화를 포함한 **원안**이다.
>
> 실무자 인터뷰 결과 "바우처 정보 제공 + billing이 가계부 역할" 만으로 충분하다는 피드백을 받아, 현재 P1 정답 문서는 [`voucher-implementation-plan-v2.md`](./voucher-implementation-plan-v2.md) 로 이관되었다.
>
> 본 문서는 P3 이후 운영형 자동화를 검토할 때의 참고 자료로 보존된다. **현재 구현 기준은 본 문서가 아니다.**

---

> **목적** (원안 기준): 어드민에 이미 구현된 **바우처 카탈로그(`vouchers`, `voucher_documents`)** 를 토대로, 내담자 개인에게 바우처를 발급·차감·청구하는 흐름을 끝까지 그린 **실무 설계서**.
>
> **상위 문서**
> - 사업 기획(Why·정책): [`docs/voucher/voucher-plan.md`](../voucher/voucher-plan.md), [요약본](../voucher/voucher-plan-essentials.md)
> - 빌링 연동 메모(원안): [`docs/billing/voucher-integration-plan.md`](./voucher-integration-plan.md)
>
> 이 문서는 위 두 문서를 대체하지 않는다. 위 문서들이 "**무엇을 왜**"라면 이 문서는 "**무엇을 어디에 어떻게**"다.

---

## 0. 한 줄 요약

> **어드민 카탈로그 = 사업 메타데이터(이미 있음)**
> **+ CenterVoucher = 센터별 단가·회기 정책 (P1 신규)**
> **+ ClientVoucher = 내담자 개인 인스턴스 (P1 신규)**
> **+ CaseVoucher = 케이스 ↔ 바우처 매핑 (P2 신규, 교체 가능)**
> **+ VoucherUsage = 세션·케이스 차감 로그 (P3 신규)**
> 의 5단 모델로, 어드민 → 센터 관리자 → 상담사 → (미래) 내담자 앱까지 한 줄기로 연결한다.

### 바우처 두 종류 (2026-05 (C2) 확정)

한국 정부·지자체 바우처 31종을 조사한 결과 ([`../voucher/voucher_usage_report.html`](../voucher/voucher_usage_report.html)), **상담센터 SaaS의 본업과 결제 모델이 일치하는 사업은 소수**다. 대부분은 외부 시스템(국민행복카드 단말기·복지로 등)에서 차감되고, 상담센터가 청구 주체가 아니다. 따라서 본 기획은 모든 바우처를 동일하게 다루지 않고 **두 종류로 분리**한다.

| 종류 | 비고 |
|---|---|
| **안내형 (informational)** — 다수 | 보유 정보·만료 알림만. 차감·청구·정산 X. 운영자가 외부 시스템 확인 결과를 수동 기록 |
| **운영형 (operational)** — 소수 (정신건강 심리상담 바우처, 아동·청소년 심리지원서비스 등) | 우리 센터가 직접 제공기관으로 참여하는 사업. 케이스 연결·회기 차감·자동 청구 작동 |

**구분 위치**: 카탈로그(`vouchers`) 레벨에 `voucher_type` 컬럼. super_admin이 사업 등록 시 결정. CenterVoucher / ClientVoucher / CaseVoucher / VoucherUsage 의 동작이 이 type에 따라 분기한다.

**범위 정책**: 모든 31종이 super_admin 카탈로그에 등록될 수 있지만, **센터가 CenterVoucher로 취급 선언한 사업만** 그 센터 화면에 노출된다. 안내형도 동일하게 CenterVoucher 매핑을 거친다 (모델 일관성).

### 핵심 운영 원칙 (2026-05 토론에서 확정)

| 항목 | 결정 |
|---|---|
| **결제 의도 표현** | 케이스에 바우처가 연결되어 있으면 그 케이스의 default 결제 = 바우처. 별도 플래그 없음. |
| **케이스 ↔ 바우처 관계** | 1 케이스에 동시에 1개 바우처 활성. 교체(만료·소진·수동)는 매핑 row 단위로 unlink + relink. |
| **차감 단위** | 상담은 **(세션, 참가자)** 단위 1회기씩. 검사는 **케이스 완료 시점에 환산 회기 일괄**. |
| **차감 시점** | 상담: 세션 완료 처리 시점. 검사: 케이스 `completed` 전환 시점. 진행 중에는 "예상 차감액" 미리보기만. |
| **자동 청구** | 세션·케이스 완료 시 Billable(`draft`)이 자동 생성됨. 사용자 검토 후 issued 전환. 수동 청구 추가도 계속 허용. |
| **본인부담금** | 자동 생성된 Billable의 `unpaid_amount`에 남고, 별도 Payment(card 등)로 받음. Billable status는 `issued` 유지. |
| **환불·rollback** | billing-improvement-plan §7-5 D-3 결정에 따라 **음수 Payment** 방식. `VoucherUsage.status='reversed'` + `refund_payment_id`로 양방 연결. |
| **그룹 잔액 부족 처리** | 하이브리드 모드 — 기본은 엄격(전체 거부), 사용자 명시 시 잔액 부족자만 자비 fallback. 자동 fallback 없음. |
| **자동 Billable 삭제** | 자동 생성된 Billable은 단독 삭제 금지. `VoucherUsage.reverse` API 경유 시에만 정리. 권한 `manage:billing`. |

---

## 1. 현재 상태 진단 (2026-05 기준)

### 1-1. 구현된 부분

| 영역 | 구현 위치 | 비고 |
|---|---|---|
| 바우처 카탈로그 CRUD | [`apps/api/app/modules/platform_admin/voucher/`](../../apps/api/app/modules/platform_admin/voucher/) | `vouchers`, `voucher_documents`, `voucher_document_links` |
| 어드민 카탈로그 UI | [`apps/admin/src/routes/(protected)/vouchers/`](../../apps/admin/src/routes/(protected)/vouchers/) | 등록/목록/상세/자료 연결 모두 동작 |
| 빌링 (`Billable`, `BillableItem`, `Payment`) | [`apps/api/app/modules/billing/`](../../apps/api/app/modules/billing/) | Phase 1~3.5 완료, 바우처 미연동 |
| 마이그레이션 | `1a0dd3a01b98_add_voucher_tables.py` | 카탈로그 3종 테이블만 |

### 1-2. 어드민 카탈로그 필드 (현재 모델)

`AdminVoucherCreateRequest` ([schemas.py:45](../../apps/api/app/modules/platform_admin/voucher/schemas.py)):
- `name, program_name, program_organization, program_year` (필수)
- `usage_start_date / usage_end_date` (사업 기간)
- `application_method, application_start_date, application_end_date`
- `support_amount, support_scope, support_target, contact` (모두 **텍스트** — 사람이 읽는 안내문)
- `document_links` (관련 자료 첨부)

> **핵심 관찰 1**: 현재 카탈로그는 **"사업 안내 카드"** 수준이다. 차감에 필요한 정량 필드(회기당 단가·총 회기·지원율 등)가 **없다**. 이 차이를 어떻게 메울지가 본 문서의 첫 번째 결정이다 — 운영형 바우처는 `CenterVoucher`로 정량 정보를 받는다 (§3-1).
>
> **핵심 관찰 2**: 카탈로그에 `voucher_type` 컬럼이 **없다**. (C2) 결정에 따라 안내형/운영형 분기를 도입하려면 카탈로그에 컬럼 추가가 필요하다 (§3-0).

### 1-3. 구현 안 된 부분

- 센터가 "어떤 바우처를 취급한다"고 등록하는 레이어
- 내담자에게 바우처를 발급하고 잔여 회기·금액을 추적하는 레이어
- 세션 완료 시 회기·금액을 차감하는 로직 (운영형 바우처만 해당)
- billing `Payment.payment_method`에 `voucher` 값 + `payment_category`(과세/면세/지원금)
- 환불·롤백, 월별 청구 집계, 감사 로그

### 1-4. 안내형 vs 운영형 — 정의와 판별 기준

**안내형 (informational)**
- 정부·지자체가 정한 결제·정산 흐름이 우리 시스템 밖에서 일어남
- 우리 역할: 내담자가 보유한 바우처를 "기록"하고 상담사·접수에게 "보임"
- 차감은 외부 시스템에서 일어나고, 운영자가 필요 시 우리 시스템에 수동 반영 (의무 아님)
- 예시:
  - 장애아가족 양육지원 (시행기관 계좌 선납)
  - 발달재활서비스 (국민행복카드 단말기 결제 → 정보원이 청구·정산)
  - 발달장애인 주간/방과후활동 (단말기 결제)
  - 자립수당 (현금 이체)
  - 디딤씨앗통장 (금융 통장)
  - 꿈이든카드 (교육청 전자카드)

**운영형 (operational)**
- 우리 센터가 제공기관으로 직접 참여하는 사업
- 우리 시스템이 회기·청구·정산 데이터의 1차 출처
- 결제 매체(국민행복카드 단말기)는 여전히 외부지만, 차감·청구는 우리가 기록 책임
- 예시:
  - 정신건강 심리상담 바우처 (1급 8만 / 2급 7만 × 8회, 본인부담 4구간)
  - 지역사회서비스 투자사업 - 아동·청소년 심리지원서비스 (월 18만, 본인부담 3구간)
  - 그 외 우리 센터가 등록한 심리지원·정서지원 사업

**판별**: 카탈로그(`vouchers`) 등록 시 super_admin이 `voucher_type: 'informational' | 'operational'` 결정. 변경 가능하나 이미 발급된 ClientVoucher 데이터가 있으면 마이그레이션 필요.

> 참고 자료: 31종 바우처의 결제·정산 흐름 비교 정리: [`../voucher/voucher_usage_report.html`](../voucher/voucher_usage_report.html)

---

## 2. 통합 데이터 모델 (5계층)

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: VoucherCatalog    (= 기존 vouchers, 이미 구현)      │
│   - 사업 안내 메타데이터 (이름·기관·연도·기간·안내문·자료)   │
│   - 신규: voucher_type ('informational' | 'operational')     │
│   - 소유자: super_admin                                      │
│   - 위치: apps/api/app/modules/platform_admin/voucher/       │
└─────────────────────────────────────────────────────────────┘
                          │ catalog_id (앱레벨 FK)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: CenterVoucher    (P1 신규)                          │
│   - "우리 센터가 이 바우처를 취급한다" (안내형/운영형 공통)  │
│   - 안내형: 카탈로그 매핑만 + 메모. 정량 필드는 옵션         │
│   - 운영형: unit_price, support_ratio, default_sessions,     │
│     max_sessions_per_month, provider_registration_no (필수)  │
│   - 소유자: center_admin                                     │
│   - 위치: apps/api/app/modules/voucher/center_voucher/       │
└─────────────────────────────────────────────────────────────┘
                          │ center_voucher_id (앱레벨 FK)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: ClientVoucher    (P1 신규)                          │
│   - 내담자 한 명의 발급 인스턴스                             │
│   - 안내형: 정보 기록 위주 (총회기·잔여·만료는 운영자 수동) │
│   - 운영형: total_sessions, used_sessions, expires_at 등     │
│     자동 차감으로 갱신                                       │
│   - 소유자: 접수 담당자 (수동 등록, P1)                      │
│   - 위치: apps/api/app/modules/voucher/client_voucher/       │
└─────────────────────────────────────────────────────────────┘
                          │ client_voucher_id (앱레벨 FK)
                          ▼
   ─── 여기부터는 운영형(operational) 카탈로그만 진입 ───
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: CaseVoucher       (P2 신규, 운영형만)               │
│   - 케이스 ↔ 바우처 매핑 (counseling/assessment 공용)        │
│   - case_type / case_id / client_id / client_voucher_id      │
│   - linked_at / unlinked_at / unlink_reason                  │
│   - "동시 활성 1개" 제약은 부분 unique index로 강제          │
│   - 안내형 ClientVoucher는 연결 불가 (서비스 레벨 검증)      │
│   - 위치: apps/api/app/modules/voucher/case_voucher/         │
└─────────────────────────────────────────────────────────────┘
                          │ case_voucher_id (앱레벨 FK, 참조용)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: VoucherUsage      (P3 신규, 운영형만)               │
│   - 세션·케이스 차감 로그 (감사 5년)                         │
│   - session_id (counseling) / case_id (assessment)           │
│   - client_id (그룹 세션에서 어느 참가자의 차감인지)         │
│   - sessions_consumed / amount                               │
│   - payment_id / billable_item_id                            │
│   - refund_payment_id (rollback 시 음수 Payment FK)          │
│   - actor_id / reversed_at / claim_id                        │
│   - 위치: apps/api/app/modules/voucher/usage/                │
└─────────────────────────────────────────────────────────────┘
```

> 안내형 ClientVoucher는 Layer 3에서 흐름이 끝난다. Layer 4·5는 운영형 진입점이 활성 매핑을 만들 때만 사용된다.

### 2-1. 왜 Layer 2(CenterVoucher)를 분리하나

어드민 카탈로그는 "전국민 마음투자 지원사업"이라는 **사업 그 자체**의 안내를 담는다. 그런데:

- **단가·회기수는 센터마다 다를 수 있다** (지자체 협약·소득분위별 차등)
- **제공기관 등록번호**는 센터마다 발급받음 → 카탈로그에 넣을 수 없음
- 센터가 "이 사업은 우리가 취급 안 함"으로 두는 것이 기본(Opt-in 원칙, voucher-plan §4.3)

이 셋이 모두 **"센터 ↔ 카탈로그 1:N 매핑 테이블"** 을 요구한다. 그게 `CenterVoucher`다.

### 2-2. 카탈로그를 그대로 두는 이유

기존 카탈로그는 손대지 않는다:
- 정량 필드는 카탈로그가 아닌 `CenterVoucher`에 둔다 (센터별 차등 가능)
- 카탈로그가 갖는 "사업 안내·자료" 역할은 그대로 유효
- 단, **Phase 2 이후 자격 요건이 정형화될 때** 카탈로그에 `eligibility_rule(JSON)` 필드를 추가할 예비 자리만 남긴다 (P1은 그대로)

### 2-3. 왜 `CaseVoucher`를 별도 레이어로 두나

`ClientVoucher`(내담자가 보유한 바우처)와 **케이스(상담·검사 진행 단위)** 의 관계는 다대다이면서 시간적 변경이 잦다:

- 한 내담자가 동시에 상담 케이스 + 검사 케이스를 진행 → 한 바우처를 두 케이스에 나눠 씀
- 케이스 진행 중 바우처가 만료/소진되어 다른 바우처로 교체
- 그룹 케이스에서는 참가자마다 자기 바우처가 다름 → `client_id`도 매핑에 들어가야 함

→ **`(case_id, client_id, client_voucher_id)`** 매핑 row를 별도 테이블로 분리한다. `unlinked_at`으로 시점 관리하면 "교체 이력"이 자연스럽게 보존된다.

> ⚠️ 차감 로그(`VoucherUsage`)는 이 매핑과 **느슨하게 결합**된다. 매핑이 끊어져도 과거 차감은 그대로 살아있어야 한다 (이력 보존). 매핑의 역할은 "지금부터 어느 바우처를 쓸지" 결정이고, 과거 차감은 매핑과 무관한 영구 기록.

---

## 3. 테이블 설계

### 3-0. `vouchers` (카탈로그) — 기존 테이블 컬럼 추가 (Phase A)

기존 `platform_admin.voucher` 모듈의 카탈로그 테이블에 다음 컬럼을 추가한다. 어드민 모듈 변경이므로 voucher 모듈과 별도 PR로 분리 가능.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `voucher_type` | varchar(20), NOT NULL, default `'informational'` | `'informational'` / `'operational'`. (C2) 분기 키 |

**마이그레이션 시 기존 row**: 모두 `'informational'`로 채움. 운영팀이 추후 개별적으로 `'operational'`로 전환.

**어드민 UI 변경**: 카탈로그 등록·수정 폼에 voucher_type 선택 (라디오 또는 Select). 운영형 선택 시 단가·회기 입력 가이드 노출 (CenterVoucher 등록 단계에서 필요한 정보).

### 3-1. `center_vouchers` (신규, P1)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | |
| `center_id` | UUID | 센터 (앱레벨 FK) |
| `catalog_id` | UUID | `vouchers.id` 참조 (앱레벨 FK) |
| `provider_registration_no` | varchar(50) nullable | 제공기관 등록번호 (P1 필수 입력 권장) |
| `unit_price` | int | 회기당 지원금액 (원) |
| `support_ratio` | float nullable | 지원율 (0.0~1.0). NULL이면 `unit_price` 전액 지원 |
| `default_total_sessions` | int nullable | 기본 총 회기 (내담자 발급 시 기본값) |
| `max_sessions_per_month` | int nullable | 월 한도 |
| `session_unit_rule` | varchar(20) | `'1_session_1_unit'`(기본) / `'90min_2_units'` 등 (P3 확장용 자리) |
| `assessment_unit_rule` | jsonb nullable | 검사 환산 규칙 (Phase C부터 사용, 아래 스키마 참조) |
| `is_active` | bool | 취급 여부 |
| `notes` | text nullable | 센터 내부 메모 |
| `created_at / updated_at / deleted_at` | timestamp | soft delete |

**unique**: `(center_id, catalog_id)` — 한 센터가 같은 사업을 두 번 등록하지 않게.

#### voucher_type 별 필드 사용 규칙

CenterVoucher 자체는 단일 테이블이지만 카탈로그의 `voucher_type`에 따라 필드 의미·필수 여부가 달라진다.

| 컬럼 | 안내형 (informational) | 운영형 (operational) |
|---|---|---|
| `provider_registration_no` | 선택 | 필수 권장 (청구 시 필요) |
| `unit_price` | 선택 (참고용·UI 표시) | 필수 (차감액 계산) |
| `support_ratio` | 무의미 | 사용 |
| `default_total_sessions` | 선택 (UI 자동 채움용 힌트) | 필수 |
| `max_sessions_per_month` | 선택 | 사용 |
| `session_unit_rule` | 무시 | 필수 |
| `assessment_unit_rule` | 무시 | 사용 (검사 케이스 환산) |
| `is_active` | 사용 | 사용 |
| `notes` | 사용 | 사용 |

**Service 레벨 검증**: `CreateCenterVoucherService`는 카탈로그 조회 후 voucher_type 보고 필수 필드 분기 검증.

#### `assessment_unit_rule` 스키마 (확정)

검사 종류별 차등을 처음부터 표현 가능한 **검사별 매트릭스** 형태:

```json
{
  "default": 1,
  "by_assessment_id": {
    "K-WAIS": 2,
    "MMPI-2": 1,
    "Rorschach": 2
  },
  "by_set_id": {
    "full_battery_set_uuid": 5
  },
  "max_per_case": null,
  "version": 1
}
```

| 필드 | 의미 |
|---|---|
| `default` | 매칭 룰이 없을 때 사용할 기본 회기 수 |
| `by_assessment_id` | 개별 검사 ID(또는 코드)별 회기 환산. AssessmentSession 단위로 적용 |
| `by_set_id` | 검사 세트 ID별 일괄 회기 (세트 적용 시 개별 합산 무시) |
| `max_per_case` | 한 케이스에서 최대 차감 회기. NULL이면 제한 없음 |
| `version` | 룰 변경 이력 추적용. 갱신 시 `+1` |

**환산 계산 흐름** (`preview_case_consumption` / `consume_for_case`):
1. 케이스 안의 검사 세트가 있고 `by_set_id`에 매칭되면 그 값만 사용 (개별 합산 skip)
2. 아니면 각 AssessmentSession에 대해 `by_assessment_id[assessment_id] ?? default`로 합산
3. `max_per_case`가 있으면 cap 적용
4. 결과를 `voucher_usages.sessions_consumed`에 기록

> Phase C에서는 `by_assessment_id` 일부만 채워도 동작. 매칭 못 한 검사는 `default` 사용. 운영자가 점진적으로 채워나가는 방식.

### 3-2. `client_vouchers` (신규, P1)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | |
| `center_id` | UUID | RLS용 |
| `client_id` | UUID | 내담자 |
| `center_voucher_id` | UUID | 어느 센터-바우처에서 발급 (catalog_id는 조인으로 도달) |
| `total_sessions` | int | 발급 시점 총 회기 |
| `used_sessions` | int | 계산값 (`VoucherUsage` 합과 일치해야) |
| `started_at` | date | 발급일/유효 시작 |
| `expires_at` | date | 만료일 |
| `status` | varchar(20) | `'active' / 'expired' / 'exhausted' / 'cancelled'` |
| `input_source` | varchar(20) | `'staff' / 'client'` (voucher-plan §4 — 내담자 앱 대비) |
| `consent_version` | varchar(20) nullable | 동의서 버전 |
| `notes` | text nullable | |
| `created_at / updated_at / deleted_at` | timestamp | |

> **계산 필드**: `remaining_sessions = total_sessions - used_sessions` — 별도 컬럼으로 두지 않고 service에서 계산. (정합성 위험을 줄임)
> **불변식**: `used_sessions <= total_sessions` (Service에서 검증, 동시성은 §6 참조)

#### voucher_type 별 동작 규칙 (ClientVoucher)

| 항목 | 안내형 | 운영형 |
|---|---|---|
| `total_sessions` | 운영자 자유 입력 (외부 확인서 기준) | 운영자 입력. 발급 후 차감 기준값 |
| `used_sessions` | 운영자 수동 입력·조정 가능. VoucherUsage 합과 일치 불요 | 자동 차감으로 갱신. VoucherUsage 합과 일치해야 (정합성 감사 §6-5) |
| `expires_at` | 운영자 입력 (외부 확인서 기준) | 운영자 입력. 차감 시점 검증 사용 |
| `status` | 운영자 수동 전이 또는 expires_at 기반 lazy | 자동 전이 (소진·만료·취소) |
| Case 연결 | **불가** — 안내형은 CaseVoucher에 들어가지 않음 | 가능 |
| 만료 임박 알림 | 표시 (Phase E) | 표시 (Phase E) |
| 정합성 감사 (§6-5) | 적용 안 함 | 적용 |

→ Service 레벨에서 발급 시점에 `CenterVoucher → catalog.voucher_type`을 조회해 ClientVoucher의 동작 모드를 결정. 별도 컬럼 추가는 불필요(카탈로그 type이 진실의 출처).

### 3-3. `case_vouchers` (신규, P2)

케이스 ↔ 바우처 매핑. counseling/assessment 공용 테이블. **케이스 단위로 "지금 어느 바우처를 쓸지"** 만 표현한다 — 과거 차감 이력은 `voucher_usages`가 별도로 가짐.

> ⚠️ **운영형 (operational) 카탈로그에서 발급된 ClientVoucher만 연결 가능**. 안내형 ClientVoucher가 들어오면 Service 레벨에서 `InvalidOperationException`. 부분 unique index만으로는 막을 수 없으므로 서비스 검증 필수.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | |
| `center_id` | UUID | RLS |
| `case_type` | varchar(20) | `'counseling'` / `'assessment'` |
| `case_id` | UUID | 케이스 ID (case_type에 따라 어느 테이블 가리키는지 결정. 앱레벨 FK) |
| `client_id` | UUID | 어느 참가자의 바우처인지 (그룹 케이스 대비) |
| `client_voucher_id` | UUID | 연결된 ClientVoucher |
| `linked_at` | timestamp | 연결 시각 |
| `unlinked_at` | timestamp nullable | 해제 시각. NULL이면 활성 |
| `unlink_reason` | varchar(20) nullable | `'expired' / 'exhausted' / 'switched' / 'manual' / 'case_closed'` |
| `linked_by` | UUID | 연결한 직원 |
| `unlinked_by` | UUID nullable | 해제한 직원 |
| `notes` | text nullable | |
| `created_at / updated_at` | timestamp | |

**부분 unique index** (동시 활성 바우처 1개 보장):
```sql
CREATE UNIQUE INDEX uniq_active_case_voucher
  ON case_vouchers (case_type, case_id, client_id)
  WHERE unlinked_at IS NULL;
```

**활성 매핑 조회**:
```sql
SELECT * FROM case_vouchers
 WHERE case_type = ? AND case_id = ? AND client_id = ?
   AND unlinked_at IS NULL;
```

**교체 흐름**:
1. 기존 row `unlinked_at`, `unlink_reason` 채우기
2. 새 row insert (linked_at = now)
3. 한 트랜잭션 안에서 처리 — 부분 unique index가 race를 막아줌

### 3-4. `voucher_usages` (신규, P3)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | |
| `center_id` | UUID | RLS |
| `client_voucher_id` | UUID | 어느 바우처에서 차감 |
| `client_id` | UUID | 그룹 세션 대비. "이 차감이 누구의 회기인가" |
| `case_voucher_id` | UUID nullable | 차감 시점의 매핑 row 참조 (이력성, FK 강제 X) |
| `session_id` | UUID nullable | 상담 세션 (counseling 차감) |
| `case_id` | UUID nullable | 검사 케이스 (assessment 차감) |
| `sessions_consumed` | int | 환산된 회기 수 (상담=1, 검사=N) |
| `amount` | int | 지원금액 (원) |
| `payment_id` | UUID nullable | billing Payment FK (앱레벨) |
| `billable_item_id` | UUID nullable | billing BillableItem FK |
| `refund_payment_id` | UUID nullable | rollback 시 생성된 **음수 Payment** FK |
| `actor_id` | UUID | 차감 주체 (상담사 등) |
| `actor_role` | varchar(20) | 감사용 |
| `occurred_at` | timestamp | 차감 시각 |
| `status` | varchar(20) | `'consumed' / 'pending' / 'reversed'` |
| `reversed_at / reversed_by / reversed_reason` | nullable | 롤백 이력 |
| `claim_id` | UUID nullable | 청구 번들 (P3 후반) |
| `created_at / updated_at` | timestamp | |

**unique** (중복 차감 방지, 그룹 세션 대응):
```sql
-- 상담: 같은 세션에서 같은 내담자에게 같은 바우처가 두 번 차감되지 않게
CREATE UNIQUE INDEX uniq_usage_session
  ON voucher_usages (session_id, client_id, client_voucher_id)
  WHERE session_id IS NOT NULL AND status != 'reversed';

-- 검사: 같은 케이스에서 같은 바우처가 두 번 일괄 차감되지 않게
CREATE UNIQUE INDEX uniq_usage_case
  ON voucher_usages (case_id, client_id, client_voucher_id)
  WHERE case_id IS NOT NULL AND status != 'reversed';
```

> `status != 'reversed'` 조건: rollback 후 같은 키로 재차감(수정 후 재처리)이 가능해야 함. reversed는 unique 검사에서 제외.

### 3-5. billing 측 변경

billing은 voucher를 모른다 (단방향 호출 원칙). 다음을 추가/의존한다:

**voucher 모듈이 요구하는 변경 (필수)**:
1. **`Payment.payment_method`** 허용값에 `'voucher'` 추가 (Alembic 불필요, validator만)
2. **`Payment.payment_category`** 신규 컬럼 nullable: `'taxable' / 'tax_exempt' / 'subsidy'`
3. **`BillableItem.voucher_amount`** nullable int — Item 단위 지원금/본인부담금 분리 표현

**voucher 모듈이 의존하는 변경 (billing-improvement-plan Phase 4 작업)**:
4. **환불(음수 Payment) 인프라** — `PaymentFacade.create_refund()` API + RefundModal
   - billing-improvement-plan §7-5 D-3 결정: "음수 Payment + 환불 전용 모달, 권한 `manage:billing`, 사유 필수"
   - voucher rollback(§5-7)이 이 API를 호출

**자동 청구 트리거 (voucher 모듈이 만드는 흐름)**:
5. **세션·케이스 완료 시 Billable(`draft`) 자동 생성** — counseling/assessment 완료 핸들러가 `BillableFacade.create_draft_from_session()` 호출
   - 바우처 결제든 자비든 동일하게 draft 생성
   - 바우처면 Payment(method='voucher') + ClientVoucher 차감까지 한 트랜잭션
   - 자비면 Billable + Item만 생성, Payment는 운영자가 별도 등록

> 1·2·3은 voucher 모듈 작업 안에 포함된다. 4는 billing-improvement-plan Phase 4와 동시 작업해야 한다 (§8 Phase 순서 참조). 5는 counseling/assessment 모듈 핸들러 패치가 필요하다.

---

## 4. 모듈 구조 (백엔드)

```
apps/api/app/modules/
├── platform_admin/
│   └── voucher/                  ← 기존, 그대로 (카탈로그)
│
├── voucher/                      ← 신규 도메인 모듈 (복잡 모듈 → Facade 패턴)
│   ├── center_voucher/           # Phase A
│   │   ├── models.py
│   │   ├── repository.py
│   │   ├── schemas.py
│   │   ├── services/
│   │   │   ├── create_center_voucher.py
│   │   │   ├── update_center_voucher.py
│   │   │   ├── list_center_vouchers.py
│   │   │   └── deactivate_center_voucher.py
│   │   └── handlers/
│   │
│   ├── client_voucher/           # Phase B
│   │   ├── models.py
│   │   ├── repository.py
│   │   ├── schemas.py
│   │   ├── services/
│   │   │   ├── issue_client_voucher.py
│   │   │   ├── list_client_vouchers.py
│   │   │   ├── adjust_remaining.py     # 수동 조정
│   │   │   └── cancel_client_voucher.py
│   │   └── handlers/
│   │
│   ├── case_voucher/             # Phase C (신설)
│   │   ├── models.py             # CaseVoucher (counseling/assessment 공용)
│   │   ├── repository.py
│   │   ├── schemas.py
│   │   ├── services/
│   │   │   ├── link_voucher_to_case.py
│   │   │   ├── unlink_voucher_from_case.py
│   │   │   ├── switch_active_voucher.py
│   │   │   └── get_active_voucher.py
│   │   └── handlers/
│   │
│   ├── usage/                    # Phase D
│   │   ├── models.py
│   │   ├── repository.py
│   │   ├── services/
│   │   │   ├── consume_session.py        # 상담: (세션, 참가자) 단위
│   │   │   ├── consume_case.py           # 검사: 케이스 완료 시 일괄
│   │   │   ├── preview_case_consumption.py  # 검사 진행 중 예상 차감액
│   │   │   ├── rollback_usage.py
│   │   │   └── monthly_summary.py
│   │   └── handlers/
│   │
│   └── facade/
│       ├── voucher_facade.py             # 외부 모듈 통합 입구
│       ├── center_voucher_facade.py
│       ├── client_voucher_facade.py
│       ├── case_voucher_facade.py
│       └── usage_facade.py
│
├── counseling/
│   └── (세션 완료 핸들러 패치 — voucher_facade.consume_session 호출)
│
├── assessment/
│   └── (케이스 완료 핸들러 패치 — voucher_facade.consume_case 호출)
│
└── billing/
    ├── payment/                  # payment_method validator 확장 + payment_category 컬럼
    ├── billable/                 # voucher_amount 컬럼 + create_draft_from_session API
    └── (Phase 4 — 환불 인프라; billing-improvement-plan 작업)
```

**규칙 (CLAUDE.md 준수)**:
- voucher 모듈 → billing 모듈의 **Facade**만 호출 (`BillableFacade`, `PaymentFacade`)
- billing 모듈은 voucher를 **모른다**
- counseling/assessment 완료 핸들러는 `VoucherFacade`(통합 입구)만 호출. case_voucher/usage facade에 직접 접근하지 않음
- voucher 내부에서는 Facade 간 호출 금지 (CLAUDE.md). 협력은 Service 직접 호출 또는 Application Handler에서 조합

---

## 5. API 설계

> 표기: 모두 인증 필요. 경로의 `{center_id}`는 RLS 강제용.

### 5-1. 어드민 — 카탈로그 (이미 존재, Phase A에서 voucher_type 추가)

```
GET    /admin/vouchers
POST   /admin/vouchers              # body에 voucher_type 추가
GET    /admin/vouchers/{id}
PATCH  /admin/vouchers/{id}         # voucher_type 변경 허용 (단 운영형↔안내형 전환 시 발급된 ClientVoucher 영향 경고)
DELETE /admin/vouchers/{id}
GET    /admin/voucher-documents/...
```

POST body에 추가되는 필드:
```json
{
  "voucher_type": "operational"   // 또는 "informational" (default)
}
```

### 5-2. 센터 관리자 — 취급 바우처 (P1 신규)

```
GET    /centers/{center_id}/voucher-catalog        # 어드민 카탈로그를 센터 시점에서 조회 (취급중 여부 표시)
GET    /centers/{center_id}/center-vouchers        # 우리 센터 취급 목록
POST   /centers/{center_id}/center-vouchers        # 카탈로그에서 선택해서 취급 등록
PATCH  /centers/{center_id}/center-vouchers/{id}   # 단가·회기·등록번호 수정
DELETE /centers/{center_id}/center-vouchers/{id}   # 취급 해제 (soft delete)
```

**POST 예시** (운영형):
```json
{
  "catalog_id": "uuid-of-catalog",
  "provider_registration_no": "2026-12345",
  "unit_price": 60000,
  "support_ratio": 0.9,
  "default_total_sessions": 12,
  "max_sessions_per_month": 4,
  "session_unit_rule": "1_session_1_unit"
}
```

**POST 예시** (안내형 — 단가·회기 필드 생략 가능):
```json
{
  "catalog_id": "uuid-of-catalog",
  "notes": "장애아가족 양육지원 안내용. 단가·회기는 외부 시스템에서 관리."
}
```

**Service 검증**: `catalog.voucher_type`을 조회해 필수 필드 분기. 운영형인데 `unit_price`/`default_total_sessions` 누락이면 `InvalidOperationException`.

### 5-3. 접수 담당자/상담사 — 내담자 바우처 (P1 신규)

CLAUDE.md의 **Client-Centric API** 원칙에 따라 client 하위 리소스로:

```
GET    /centers/{center_id}/clients/{client_id}/vouchers   # 내담자 보유 바우처
POST   /centers/{center_id}/clients/{client_id}/vouchers   # 발급 (수동 등록)
GET    /centers/{center_id}/client-vouchers/{id}           # 상세
PATCH  /centers/{center_id}/client-vouchers/{id}           # 잔여 회기 수동 조정 (P1)
DELETE /centers/{center_id}/client-vouchers/{id}           # 취소
```

**POST 발급 예시**:
```json
{
  "center_voucher_id": "uuid",
  "total_sessions": 12,
  "started_at": "2026-05-15",
  "expires_at": "2026-12-31",
  "input_source": "staff",
  "consent_version": "v1.0",
  "notes": "복지로 확인서 5/14 수령"
}
```

### 5-4. 케이스-바우처 연결 (Phase C 신규, 운영형만)

> ⚠️ 본 섹션 이하 (§5-4 ~ §5-8)는 **운영형 (operational) 카탈로그에서 발급된 ClientVoucher에만 적용**된다. 안내형은 케이스에 연결할 수 없고, 차감·청구 흐름도 작동하지 않는다.

CLAUDE.md Client-Centric 원칙처럼 **케이스의 하위 리소스**로 다룬다. counseling/assessment 라우터가 case_type을 알고 있으므로 URL에서 분리:

```
GET    /centers/{center_id}/counseling-cases/{case_id}/vouchers
POST   /centers/{center_id}/counseling-cases/{case_id}/vouchers        # 활성 바우처 연결
DELETE /centers/{center_id}/counseling-cases/{case_id}/vouchers/{id}   # 해제
PATCH  /centers/{center_id}/counseling-cases/{case_id}/vouchers/{id}/switch  # 교체 (한 번에 unlink+link)

GET    /centers/{center_id}/assessment-cases/{case_id}/vouchers
POST   /centers/{center_id}/assessment-cases/{case_id}/vouchers
DELETE /centers/{center_id}/assessment-cases/{case_id}/vouchers/{id}
PATCH  /centers/{center_id}/assessment-cases/{case_id}/vouchers/{id}/switch
```

**POST 예시** (단일 케이스에 활성 바우처 연결):
```json
{
  "client_id": "uuid",                    // 그룹 케이스에서 참가자 식별
  "client_voucher_id": "uuid",
  "notes": "전국민 마음투자 8회기로 진행"
}
```

**409 응답**: 이미 활성 매핑이 있으면 거부 (교체는 `/switch` 사용).

**`/switch` Body**:
```json
{
  "new_client_voucher_id": "uuid",
  "unlink_reason": "exhausted",
  "notes": "기존 바우처 소진, 새 바우처로 교체"
}
```

→ 한 트랜잭션 내에서 기존 row `unlinked_at` 설정 + 새 row insert.

### 5-5. 검사 케이스 차감 미리보기 (Phase C 신규)

검사는 케이스 완료 시점에 일괄 차감하므로, **진행 중에는 "얼마나 차감될지" 미리 보여줘야** 함:

```
GET /centers/{center_id}/assessment-cases/{case_id}/voucher-preview
```

응답:
```json
{
  "active_voucher": {
    "client_voucher_id": "uuid",
    "name": "전국민 마음투자",
    "remaining_sessions": 8,
    "expires_at": "2026-12-31"
  },
  "estimated_consumption": {
    "sessions_consumed": 3,       // 환산 규칙에 따라 계산
    "amount": 180000,
    "rule_applied": "1_session_per_assessment_session + 1_per_task"
  },
  "warnings": [
    "잔여 회기로 충분히 충당 가능"
    // 또는 "잔여 회기 부족 (3 > 2)", "바우처 만료 임박" 등
  ]
}
```

DB 변경 없음. 케이스 진행 상황 + 활성 매핑 + 환산 규칙으로 계산.

### 5-6. 세션·케이스 완료 시 자동 차감 (Phase D 신규)

**별도 API가 아니라 counseling/assessment의 완료 핸들러 내부에서 자동 호출**된다.

**상담 세션 완료 흐름** (`PATCH /counseling-sessions/{id}` status=completed):
```
counseling.update_session_handler:
  async with uow:
    1. CounselingSession.status = 'completed'
    2. SessionParticipant 루프:
       for participant in session.participants where attendance_status='attended':
         active = case_voucher_facade.get_active(case_id, participant.client_id)
         if active:
           # 바우처 결제
           voucher_facade.consume_for_session(
             session_id, participant.client_id, active.client_voucher_id, ...
           )
         # else: 자비 결제 (Billable만 자동 생성, Payment는 운영자가 등록)
    3. billable_facade.create_draft_from_session(session_id, items)
       └ BillableItem 생성, 바우처 차감분 Payment 자동, 본인부담금은 unpaid_amount에 남김
    await uow.commit()
```

**검사 케이스 완료 흐름** (`PATCH /assessment-cases/{id}` status=completed):
```
assessment.update_case_handler:
  async with uow:
    1. AssessmentCase.status = 'completed'
    2. 참가자 루프 (보통 1명):
       active = case_voucher_facade.get_active(case_id, client_id)
       if active:
         voucher_facade.consume_for_case(case_id, client_id, ..., sessions=환산N)
    3. billable_facade.create_draft_from_case(case_id, items)
    await uow.commit()
```

**`voucher_facade.consume_for_session()` 내부**:
1. `ClientVoucher` SELECT FOR UPDATE
2. 잔여 회기·만료 검증 → 부족 시 `ConflictException`
3. `used_sessions += sessions_consumed`
4. `BillableFacade.add_item(billable_id, voucher_amount=...)`
5. `PaymentFacade.record_payment(method='voucher', category='subsidy', amount=...)`
6. `VoucherUsage` insert (status='consumed', `case_voucher_id` 채움)
7. `SessionParticipant.is_consumed = true` (counseling)

모두 한 트랜잭션. 부분 실패 시 전체 롤백.

### 5-7. 환불·롤백 (Phase D)

```
POST /centers/{center_id}/voucher-usages/{id}/reverse
```

```json
{
  "reason": "내담자 환불 요청 (1회기)",
  "billable_action": "soft_delete"  // "soft_delete" | "keep_as_self_pay"
}
```

**내부 흐름**:
1. `VoucherUsage` 조회 및 `status='consumed'` 검증
2. `ClientVoucher.used_sessions -= usage.sessions_consumed`
3. **`PaymentFacade.create_refund()`** 호출 — 음수 Payment 생성 (billing-improvement-plan §7-5 D-3)
   - `amount = -usage.amount`
   - `payment_method = 'voucher'`
   - `refund_for_payment_id = usage.payment_id`
   - `reason = 본 요청의 reason`
4. **연관 Billable 처리** (`billable_action`):
   - `"soft_delete"` (기본): 자동 생성된 Billable을 soft delete (`deleted_at` 채움)
   - `"keep_as_self_pay"`: Billable은 유지하되 voucher Payment만 무효화. 본인부담금 자비로 받는 시나리오
5. `VoucherUsage.status='reversed'`, `reversed_at/by/reason` 채움, `refund_payment_id` 연결
6. 한 트랜잭션

**권한**: `manage:billing` (billing 환불 권한 따라감)

> ⚠️ 본 API는 **billing-improvement-plan Phase 4 환불 인프라 완성이 선결조건**. 그 전에는 voucher rollback이 불가능.

### 5-7-1. 자동 생성 Billable의 삭제 금지 (확정)

**자동 생성된 Billable은 단독 삭제 불가.** 다음 경로로만 정리 가능:

| 시나리오 | 정리 방법 |
|---|---|
| 차감 자체를 되돌리고 싶음 | `POST /voucher-usages/{id}/reverse` (위 §5-7) — Billable도 함께 처리 |
| 청구서 내용만 수정하고 싶음 | Billable 수정 API (`PATCH /billables/{id}`)로 항목·메모 변경. 차감은 유지 |
| 자비로 전환 | rollback 후 `billable_action="keep_as_self_pay"`로 Billable 유지, 운영자가 카드 Payment 등록 |

**구현 방법**:
- `Billable`에 `auto_generated` 플래그 + `voucher_usage_id` 참조 (또는 BillableItem ↔ VoucherUsage 역참조)
- `DELETE /billables/{id}` 핸들러에서 `auto_generated=true`이면 거부 (HTTP 409 + "VoucherUsage rollback을 통해서만 정리 가능" 안내)
- billing-improvement-plan §7-5 D-4("draft도 hard delete 안 함, soft delete만") 결정과 정합

### 5-8. 월별 청구 (Phase E)

```
GET  /centers/{center_id}/voucher-claims?year=2026&month=5
POST /centers/{center_id}/voucher-claims          # 청구 번들 생성 (status='draft')
POST /centers/{center_id}/voucher-claims/{id}/submit
POST /centers/{center_id}/voucher-claims/{id}/reject   # 반려 처리
```

> Phase E. Phase A~D에서는 미구현.

---

## 6. 동시성·정합성 핵심

차감 로직은 **동시 요청에서 음수 잔액 / 중복 차감 / Billable 불일치**가 가장 큰 사고다. 다음을 지킨다:

### 6-1. ClientVoucher 잠금

`consume_for_session` / `consume_for_case` 시작점에서:
```python
client_voucher = await repo.get_for_update(voucher_id)  # SELECT ... FOR UPDATE
if client_voucher.used_sessions + sessions_consumed > client_voucher.total_sessions:
    raise ConflictException("잔여 회기 부족")
if client_voucher.status != 'active':
    raise ConflictException(f"바우처가 활성 상태가 아님: {client_voucher.status}")
if client_voucher.expires_at < date.today():
    raise ConflictException("바우처 만료")
```

### 6-2. CaseVoucher의 "동시 활성 1개" 잠금

연결/교체 시점에 race condition 가능:
```python
# 부분 unique index가 일차 방어. 추가로 서비스 레벨에서:
async with uow:
    existing = await repo.find_active(case_id, client_id)  # FOR UPDATE
    if existing:
        existing.unlinked_at = now
        existing.unlink_reason = reason
    await repo.insert(new_mapping)
    # 한 트랜잭션 내에서 unlink+link 보장
```

부분 unique index가 race를 막아주므로 두 번째 요청은 IntegrityError로 떨어짐. 서비스에서 잡아 409 응답.

### 6-3. Idempotency (그룹 세션 대응)

같은 **`(session_id, client_id, client_voucher_id)`** 조합으로 두 번 들어오면 두 번째는 즉시 기존 결과 반환.
- `voucher_usages`의 부분 unique index가 일차 방어 (§3-4)
- 서비스 레벨에서 "이미 차감됨" 분기 후 기존 record 반환
- 그룹 세션에서 한 참가자가 두 번 처리되어도 차감은 1회만 일어남

검사 케이스도 동일하게 `(case_id, client_id, client_voucher_id)` 단위.

### 6-4. Billable 자동 생성과의 정합성

세션 완료 시 Billable이 자동 생성되면서 Payment·VoucherUsage가 동시에 만들어진다. **billing의 기존 그룹 청구 패턴**(참가자별 Billable 1개씩)을 따라 트랜잭션 경계를 잡는다:

```python
async with uow:
    # 1. 세션 상태 전환
    session.status = 'completed'

    # 2. 참가자별 루프 (그룹 세션 대응)
    for participant in attended_participants:
        # 2-1. 참가자별 Billable(draft) 자동 생성
        billable = await billable_facade.create_draft_from_session(
            session_id=session_id,
            client_id=participant.client_id,
            items=[...]  # 같은 items 구조, client_id만 다름
        )

        # 2-2. 활성 바우처 조회 후 차감
        active = await case_voucher_facade.get_active(case_id, participant.client_id)
        if active:
            # ClientVoucher 잠금 + Payment + VoucherUsage 모두 같은 트랜잭션
            await voucher_facade.consume_for_session(
                session_id=session_id,
                client_id=participant.client_id,
                client_voucher_id=active.client_voucher_id,
                billable_id=billable.id,
                ...
            )
        # else: Billable은 만들어졌지만 Payment는 없음 (운영자가 별도 등록)

        participant.is_consumed = (active is not None)

    await uow.commit()
```

→ 그룹 세션 처리는 **하나의 트랜잭션 안에서 참가자 N명에 대해 Billable N개**가 만들어진다.

#### 6-4-1. 잔액 부족 처리 — 하이브리드 모드 (확정)

**기본은 엄격**: 사전 검증에서 참가자 중 한 명이라도 잔액 부족·바우처 만료·환산 회기 초과면 세션 완료 API가 **drystrun 모드로 거부**(HTTP 409 + 부족자 목록 반환).

**명시적 fallback 허용**: 프론트엔드는 거부 응답을 받으면 모달로 보여준다:
```
다음 참가자는 바우처 잔액이 부족합니다:
  - 홍길동: 잔여 0 / 필요 1 (전국민 마음투자)
  - 김참가: 잔여 0 / 필요 1 (만 18세 청년정신건강)

[취소]  [잔액 부족자만 자비로 진행]
```

사용자가 "자비로 진행"을 선택하면 동일 API를 `fallback_clients=[...]` 파라미터와 함께 재호출:
- `fallback_clients`에 명시된 참가자는 바우처 차감 없이 자비 Billable만 생성 (Payment 미생성, unpaid_amount 그대로)
- 나머지는 정상 바우처 차감

```python
async with uow:
    for participant in attended_participants:
        billable = await billable_facade.create_draft_from_session(
            session_id=session_id, client_id=participant.client_id, ...
        )

        if participant.client_id in fallback_clients:
            # 자비 모드 — Billable만, 바우처 손대지 않음
            pass
        else:
            active = await case_voucher_facade.get_active(case_id, participant.client_id)
            if active:
                await voucher_facade.consume_for_session(
                    ...billable_id=billable.id...
                )  # 여기서 잔액 부족 시 ConflictException → 전체 롤백
            # 활성 바우처 없으면 자연스럽게 자비

        participant.is_consumed = (...)
    await uow.commit()
```

**원칙**: 자동 fallback 없음. 잔액 부족 알림은 무조건 명시적 사용자 선택을 거친다. 부주의한 통과 방지.

### 6-5. used_sessions 정합성 감사

`used_sessions`는 캐싱 필드. 주기적으로(또는 관리자 액션으로):
```sql
SELECT cv.id, cv.used_sessions, COALESCE(SUM(vu.sessions_consumed), 0) AS actual
  FROM client_vouchers cv
  LEFT JOIN voucher_usages vu
    ON vu.client_voucher_id = cv.id AND vu.status = 'consumed'
 GROUP BY cv.id
HAVING cv.used_sessions <> COALESCE(SUM(vu.sessions_consumed), 0);
```
드리프트가 있으면 알림.

### 6-6. CaseVoucher 활성 매핑 ↔ 실제 차감 정합성 감사

매핑이 unlink된 이후에 들어온 차감이 없는지 확인:
```sql
SELECT vu.*
  FROM voucher_usages vu
  LEFT JOIN case_vouchers cv ON cv.id = vu.case_voucher_id
 WHERE vu.status = 'consumed'
   AND cv.unlinked_at IS NOT NULL
   AND vu.occurred_at > cv.unlinked_at;
```
정상 운영에서는 0건이어야 함. 1건 이상 나오면 로직 결함 의심.

---

## 7. 프론트엔드 흐름

### 7-1. 어드민 (`apps/admin/`)
- 그대로 (카탈로그 등록·수정·자료 연결)
- **추가 없음**

### 7-2. 센터 SaaS — 설정 (`apps/web/src/routes/(protected)/settings/`)

새 페이지: **`/settings/vouchers`** (센터 관리자 전용)
- 좌: 어드민 카탈로그 목록 (검색·필터)
- 우: "우리 센터 취급 바우처" 목록
- 카탈로그에서 한 건 클릭 → 모달로 단가·회기·등록번호 입력 → 취급 등록

Feature 모듈: `apps/web/src/lib/features/settings/vouchers/`
- `constants.ts`, `query-builders.ts`, `view-model.ts`, `vouchers-service.ts`

### 7-3. 센터 SaaS — 내담자 상세 (`apps/web/src/routes/(protected)/clients/[id]/`)

기존 내담자 상세에 **"바우처" 탭** 추가:
- 보유 바우처 카드 목록 (총회기/잔여/만료일/상태 뱃지)
- "바우처 발급" 버튼 → 모달
  - 취급 바우처 선택 (CenterVoucher 목록)
  - 총회기·시작일·만료일 입력
- "회기 수동 조정" / "취소" (Phase B)

Feature 모듈: `apps/web/src/lib/features/clients/vouchers/`

### 7-4. 센터 SaaS — 케이스 상세에 바우처 카드 (Phase C)

상담 케이스 상세 페이지 (`/counseling-cases/[id]/`) 및 검사 케이스 상세 페이지에 **활성 바우처 카드** 추가:

```
┌──────────────────────────────────────────────────┐
│ 바우처                                           │
│ ─────────────────────────────────                │
│ [전국민 마음투자 ▾] 잔여 5/8  만료 D-45          │
│                                                  │
│ [바우처 교체]  [연결 해제]                       │
│                                                  │
│ (검사 케이스인 경우 추가)                        │
│ ⓘ 예상 차감: 3회기 / 180,000원                   │
│   (현재 등록된 검사 기준)                        │
└──────────────────────────────────────────────────┘
```

- 바우처 미연결 상태에서는 "**[바우처 연결]**" 버튼만 노출
- "교체" 클릭 시 보유 바우처 목록 모달 → 새 바우처 선택 → `PATCH /vouchers/{id}/switch`
- 검사 케이스는 `voucher-preview` API 응답을 카드 안에 같이 노출 (예상 차감액)
- 그룹 케이스(여러 참가자)에서는 참가자별로 바우처 카드가 분리 노출

Feature 모듈: `apps/web/src/lib/features/counseling/case-voucher/`, `apps/web/src/lib/features/assessment/case-voucher/`

### 7-5. 세션·케이스 완료 → 자동 청구 검토 (Phase D)

기존 워크플로 **변화 포인트**: "세션 완료" 버튼이 곧 "Billable + Payment + 차감"을 모두 일으킨다. 사용자에게 이를 명확히 보여줘야 함.

**상담 세션 완료 클릭 시 모달**:
```
세션 완료 처리

이 세션을 완료하면 다음이 자동으로 일어납니다:
  ✓ 세션 상태 → completed
  ✓ 청구서(draft) 자동 생성
  ✓ 참가자별 바우처 차감 (해당되는 경우):
     - 홍길동: 전국민 마음투자 1회기 차감 (54,000원)
     - 김보호자: 바우처 미연결 (자비)

본인부담금이 있으면 청구서에서 별도 결제 등록이 필요합니다.

[취소]  [완료 처리]
```

**검사 케이스 완료도 동일 패턴**, 단 "환산 N회기 일괄 차감"이 명시됨.

→ 완료 후 사용자는 자동으로 청구 상세 모달로 이동. draft 상태에서 검토 → issued 전환. 본인부담금은 거기서 카드 Payment 등록.

### 7-6. 수동 청구 추가 (그대로 유지)

`/billing` 페이지의 "청구 추가" 버튼은 변경 없음. 시나리오:
- 자동 생성 누락 보정
- 케이스 묶음 청구 (3회분 한 번에)
- 자비 세션 (바우처 미연결)에 대한 운영자 청구

수동 청구 생성 시에도 케이스에 활성 바우처가 있으면 모달에 "바우처 적용" 옵션 노출 (Phase D 후반 — 우선순위 낮음).

---

## 8. Phase별 구현 순서 (실제 작업 단위)

> 각 Phase는 **독립적으로 머지/배포 가능**한 단위. 다음 Phase 코드 없이도 이전 Phase가 동작.

```
Phase 0: 카탈로그에 voucher_type 컴럼 + 어드민 UI (platform_admin 모듈 패치)
   ↓                                                    ┐ 안내형 + 운영형
Phase A: 센터 취급 바우처            (CenterVoucher CRUD) ┤  공통
   ↓                                                    │
Phase B: 내담자 바우처 발급·조회     (ClientVoucher CRUD) ┘
   ↓                                                    ┐
Phase C: 케이스-바우처 연결          (CaseVoucher 매핑)   │  운영형만
   ↓                                                    │
Phase D: 차감 + 자동 청구 + 환불     (VoucherUsage)        ┘
   ↑
   └── 동시 작업 필수: billing Phase 4 (환불 인프라)
   ↓
Phase E: 운영 보조 (알림·대시보드)                          ← 공통
   ↓
Phase F: 월별 청구·재청구 (별도 기획)                       ← 운영형만
```

> **Phase A·B는 안내형/운영형 공통**으로 동작한다. type별로 입력 폼·검증 분기만 다르고, 데이터 모델은 같은 테이블 공유. **Phase C·D는 운영형만 작동**한다 — 안내형 ClientVoucher가 들어오면 Service 레벨에서 거부.

### Phase 0 — 카탈로그 voucher_type 도입 (반나절)

**골인선**: super_admin이 카탈로그 등록 시 안내형/운영형 선택 가능.

- [ ] Alembic: `vouchers.voucher_type` 컬럼 추가 (default `'informational'`)
- [ ] `platform_admin/voucher` 스키마·service 패치
- [ ] 어드민 UI: 카탈로그 폼에 type 선택 라디오 + 가이드 텍스트
- [ ] 기존 데이터 마이그레이션: 전부 informational. 운영팀이 추후 개별 전환

### Phase A — 센터 취급 바우처 (1주)

**골인선**: 센터 관리자가 어드민 카탈로그를 보고 "우리 센터 취급" 등록 가능. type에 따라 입력 폼 분기.

- [ ] Alembic 마이그레이션: `center_vouchers` 테이블
- [ ] 모델·Repository·Service·Handler (CRUD)
- [ ] Service 검증: 카탈로그 type 조회 후 운영형 필수 필드 검증
- [ ] API 5-2 5개 엔드포인트
- [ ] 프론트 7-2 페이지 — type에 따라 모달 필드 분기 (운영형은 단가·회기 필수, 안내형은 메모 위주)
- [ ] E2E 테스트: 등록(안내형/운영형 각각) → 수정 → 비활성화

### Phase B — 내담자 바우처 발급·조회 (1주)

**골인선**: 접수 담당자가 내담자에게 바우처를 수동 발급하고, 상담사가 내담자 상세에서 잔여 회기 확인 가능. 안내형/운영형 모두 동일 모달 흐름이되 자동 채움·검증이 type별로 분기.

- [ ] Alembic 마이그레이션: `client_vouchers` 테이블
- [ ] 모델·Repository·Service·Handler
- [ ] Service 검증: 운영형 발급 시 정량 필드 필수, 안내형은 자유 입력
- [ ] API 5-3 5개 엔드포인트
- [ ] 프론트 7-3 내담자 탭 — 카드 표시는 통일, 발급 모달은 type별 분기
- [ ] 만료 임박 표시(읽기 전용 — 알림은 Phase E)
- [ ] E2E: 발급(두 type) → 잔여 조회 → 수동 조정 → 취소

> **여기까지가 voucher-plan.md의 "P1 MVP"**. (C2) 결정에 따라 P1 가치는 "안내형 31종 + 운영형 일부의 통합 관리". 케이스 연결·차감·청구는 운영형 카탈로그에 한해 Phase C 이후 가능.

### Phase C — 케이스-바우처 연결 (1주, 신설, 운영형만)

**골인선**: 상담/검사 케이스에 **운영형 바우처**를 연결·교체할 수 있고, 검사 케이스에서 "예상 차감액"이 보임. 실제 차감은 아직 없음. 안내형 ClientVoucher는 케이스 연결 모달에서 노출 안 됨.

- [ ] Alembic: `case_vouchers` 테이블 + 부분 unique index
- [ ] `CaseVoucherFacade` (link / unlink / switch / get_active)
- [ ] API 5-4 (케이스 하위 리소스), 5-5 (검사 preview)
- [ ] 프론트 7-4 케이스 상세 바우처 카드
- [ ] 그룹 케이스(참가자별) UX 검증
- [ ] E2E: 연결 → 교체 → 해제 + 그룹 케이스 시나리오
- [ ] 검사 환산 규칙 1차 (`1_session_per_assessment_session` 같은 기본 룰만)

### Phase D — 차감 + 자동 청구 + 환불 (2주, 운영형만)

**골인선**: 세션·케이스 완료 시 **운영형 활성 매핑**이 있으면 자동으로 Billable 생성 + 바우처 차감 + Payment 생성. 환불 시 원자적 롤백. 안내형은 평소처럼 수동 청구 흐름.

**선결조건**: billing-improvement-plan Phase 4 환불 인프라가 같이 진행되어야 함 (PaymentFacade.create_refund). 두 작업을 **하나의 작업군**으로 묶어 배포.

- [ ] Alembic: `voucher_usages` 테이블 + `payments.payment_category` + `billable_items.voucher_amount`
- [ ] `Payment.payment_method` validator에 `'voucher'`
- [ ] `BillableFacade.create_draft_from_session()` / `create_draft_from_case()` 신규
- [ ] `VoucherFacade.consume_for_session / consume_for_case / rollback_usage`
- [ ] counseling.update_session_handler 패치 — 자동 청구·차감 트리거
- [ ] assessment.update_case_handler 패치 — 자동 청구·차감 트리거
- [ ] API 5-6 (자동 — 별도 API 없음, 완료 핸들러 내부), 5-7 (환불)
- [ ] 프론트 7-5 자동 청구 검토 모달
- [ ] **동시 작업**: billing 환불 인프라 (음수 Payment + RefundModal, billing-improvement-plan §7-5 D-3)
- [ ] 동시성 테스트 (§6)
- [ ] 정합성 감사 쿼리·스크립트 (§6-5, §6-6)

### Phase E — 운영 보조 (선택, 1주)

- [ ] 만료 D-30 / D-7 알림 (BackgroundTasks)
- [ ] 센터 관리자 "바우처 현황 대시보드" (소진율·발급 수)
- [ ] CSV/Excel 내보내기 (수기 청구 보조)
- [ ] 만료·소진 시 자동 unlink 배치 (CaseVoucher 정리)

### Phase F — 월별 청구·재청구 (별도 기획)

- 사업별 청구 양식 자동 채우기
- `voucher_claims` 테이블, 반려·재청구 플로우
- 본 문서 범위 밖. 별도 후속 기획 필요.

### Phase G — AI·자격 판별 (voucher-plan §5 Phase 2)

- AI 일지 양식 변환 (2A)
- 자격 판별 (2B)
- 본 문서 범위 밖. voucher-plan.md §5 Phase 2 참조.

---

## 9. 결정 사항 / Open Questions

### 9-1. 본 문서에서 결정 (2026-05 토론 반영)

| 결정 | 내용 |
|---|---|
| **바우처 두 종류 분리 (C2)** | 안내형(informational) — 정보 기록만 / 운영형(operational) — 차감·청구 작동. 카탈로그 `voucher_type` 컴럼으로 분기. 31종 바우처 조사 결과 ([voucher_usage_report.html](../voucher/voucher_usage_report.html))를 반영 |
| **안내형도 동일 모델 경유** | 모든 바우처가 `CenterVoucher → ClientVoucher` 흐름. 운영형만 `CaseVoucher → VoucherUsage` 추가 사용 |
| **카탈로그에 voucher_type 컴럼 추가 (Phase 0)** | 어드민 카탈로그 한 컴럼 신설. 기존 row는 모두 informational로 마이그레이션. Phase A 진입 전 완료 |
| 카탈로그 정량 필드는 손대지 않음 | 정량 필드는 모두 `CenterVoucher`로 (운영형에 필수) |
| `CenterVoucher` 신규 도입 | 센터별 단가·회기·등록번호 차등 수용 (운영형) / 단순 취급 매핑·메모 (안내형) |
| `remaining_sessions` 별도 컬럼 미생성 | 계산식 사용, 캐시 컬럼은 `used_sessions`만 |
| **케이스 ↔ 바우처 = 1:1 활성, 교체 가능** | `case_vouchers` 매핑 테이블 (부분 unique index) |
| **결제 의도는 케이스의 활성 바우처가 표현** | 별도 `payment_default` 필드 불필요 |
| **그룹 세션 차감 단위 = (세션, 참가자)** | `voucher_usages.client_id` 필수. unique key 복합화 |
| **검사 차감 = 케이스 완료 시 일괄** | 진행 중에는 preview API만, 실제 차감은 status 전이 시 |
| **자동 청구 = Billable(`draft`) + Payment(voucher)** | 사용자 검토 후 issued 전환. 수동 청구도 유지 |
| **그룹 세션 자동 청구 = 참가자별 Billable N개** | billing이 이미 "N명 = N개 Billable" 패턴으로 구현됨 (같은 session_id 다중 참조 허용). voucher Phase D는 이 패턴 그대로 활용 |
| **본인부담금** | `unpaid_amount`에 남음, 별도 Payment(card)로 받음. status 변경 없음 |
| **환불·rollback = 음수 Payment** | billing-improvement-plan §7-5 D-3과 동일 패턴. `refund_payment_id`로 양방 연결 |
| Phase 순서 | A → B → C(case_voucher) → D(차감+환불) — 각자 독립 배포 가능 |

### 9-2. billing-improvement-plan과의 의존성

본 기획서는 [`billing-improvement-plan.md`](./billing-improvement-plan.md)의 다음 작업에 **의존**한다:

| 본 기획의 작업 | 의존하는 billing 작업 | 필요 시점 |
|---|---|---|
| Phase D 자동 청구 | billing의 `BillableFacade.create_draft_from_session()` 신규 (현 billing에 없음) | Phase D 진입 전 |
| Phase D 차감 시 Payment 생성 | `Payment.payment_method = 'voucher'` validator 확장 (작은 변경) | Phase D |
| Phase D 차감 분류 | `Payment.payment_category` 컬럼 신설 | Phase D |
| Phase D Item별 지원금 표현 | `BillableItem.voucher_amount` 컬럼 신설 | Phase D |
| Phase D 자동 생성 Billable 식별 | `Billable.auto_generated` boolean + `Billable.source_voucher_usage_id` nullable FK. DELETE 핸들러에 `auto_generated=true` 거부 로직 추가 | Phase D |
| Phase D 환불 (rollback) | **billing Phase 4의 환불 인프라** (음수 Payment + `create_refund()` API + RefundModal) | Phase D와 **동시 배포** |

→ Phase D 작업군은 voucher 모듈 + billing 환불 인프라 + counseling/assessment 핸들러 패치를 **하나의 PR 시리즈**로 묶어 진행한다.

### 9-3. 착수 전 확정 필요 (Open Questions)

1. **복수 바우처 보유 시 우선순위 (어떤 바우처를 케이스에 연결할지 추천)** — Phase C UI에서:
   - (A) 만료 임박 우선
   - (B) 본인부담률 낮은 것 우선
   - (C) 사용자 수동 선택 (MVP 권장)
2. **상담사 자격증 만료 검증** — Phase D 차감 시 검증할지, 일단 로그만 남길지 (voucher-plan §9.2)
3. **`payment_category` 적용 범위** — 바우처 외 일반 결제도 채울지, 바우처 결제에만 채울지
4. **검사 케이스 환산 회기 부족 시** — preview에서 경고만 띄울지, 케이스 완료 자체를 막을지

#### 해소된 항목 (§9-1로 이관)
- ~~검사 환산 규칙 jsonb 스키마~~ → §3-1 `assessment_unit_rule` (검사별 매트릭스) 확정
- ~~자동 생성 Billable 삭제 정책~~ → §5-7-1 단독 삭제 금지, rollback API 경유만 허용
- ~~그룹 세션 참가자 잔액 부족 정책~~ → §6-4-1 하이브리드 모드 (기본 엄격, 명시적 fallback)
- ~~그룹 케이스 자동 청구 Billable 분리/통합~~ → billing이 이미 참가자별 N개 Billable 패턴으로 구현되어 있어 그대로 따름

---

## 10. 빠른 체크리스트 (개발 착수 전)

- [ ] 본 문서 이해관계자(센터 운영진·회계·법무) 리뷰
- [ ] §9-3 Open Question 1번 (Phase C 바우처 추천 우선순위) 결정 — MVP는 사용자 수동 선택으로 시작 가능
- [ ] **billing-improvement-plan 팀과 Phase 4 환불 작업 일정 동기화** (§9-2)
- [ ] Phase A 마이그레이션 초안 작성
- [ ] `apps/admin/docs/platform-admin.md`의 voucher 섹션을 본 문서로 링크
- [x] `voucher-integration-plan.md` 상단에 "본 문서가 superseded됨을 안내" + §3-5 매핑 명시
- [x] `voucher-plan.md` 상단에 "구현 설계는 본 문서로 이관" 한 줄

---

## 11. 참고 문서

- 사업 기획 (Why): [`voucher-plan.md`](../voucher/voucher-plan.md), [요약](../voucher/voucher-plan-essentials.md)
- **31종 바우처 결제·정산 흐름 비교**: [`voucher_usage_report.html`](../voucher/voucher_usage_report.html) — 안내형/운영형 분리 결정의 근거. 신규 바우처 카탈로그 등록 시 참고
- 내담자-바우처 운영 시나리오 (Phase B 상세): [`voucher-client-integration-plan.md`](./voucher-client-integration-plan.md)
- 빌링 연동 원안: [`voucher-integration-plan.md`](./voucher-integration-plan.md) — 본 문서 §3-5와 일치하는 더 상세한 billing 측 변경 근거
- 빌링 자체 개선: [`billing-improvement-plan.md`](./billing-improvement-plan.md) — 본 문서 Phase D가 의존하는 환불 인프라 (§7-5 D-3, Phase 4)
- 어드민 카탈로그 코드: [`apps/api/app/modules/platform_admin/voucher/`](../../apps/api/app/modules/platform_admin/voucher/)
- 현재 billing 모델: [`apps/api/app/modules/billing/billable/models.py`](../../apps/api/app/modules/billing/billable/models.py), [`payment/models.py`](../../apps/api/app/modules/billing/payment/models.py)
- counseling 케이스: [`apps/api/app/modules/counseling/counseling_case/models.py`](../../apps/api/app/modules/counseling/counseling_case/models.py) (`total_sessions`, 참가자 모델)
- assessment 케이스: [`apps/api/app/modules/assessment/assessment_case/models.py`](../../apps/api/app/modules/assessment/assessment_case/models.py) (`assessment_summary` jsonb)
- DB 스키마 메모: [`docs/schema.md`](../schema.md) (line 2064~2431) — 본 문서와 일부 다름. 본 문서가 우선.
