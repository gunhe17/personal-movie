# Billing × Voucher 연동 설계 메모

> 📌 **본 문서는 원안(billing 측 변경 근거 자료)으로 보존됩니다.**
>
> **2026-05-18 업데이트**: 현재 P1 정답 문서는 [`voucher-implementation-plan-v2.md`](./voucher-implementation-plan-v2.md). 자동 차감·자동 청구·환불 rollback이 모두 빠지고 **billing이 가계부 역할**을 하는 모델로 단순화되었다. 본 문서의 §9 (billing 컴럼 변경)는 V2에서 대부분 축소되어 `Payment.payment_method='voucher'` + `Payment.client_voucher_id` 두 개만 남는다.
>
> 본 문서는 자동화를 다시 검토할 때(P3 이후) 참고 자료로 보존된다. 원안 [`voucher-implementation-plan.md`](./voucher-implementation-plan.md) §3-5와 §9가 본 문서의 무거운 의존성에 대응한다.

> **목적**: [docs/voucher/voucher-plan.md](../voucher/voucher-plan.md)을 billing 모듈에 얹기 위한 연동 설계. **변경을 최소화하되, 데이터 정합성·감사 대응·회계 분리를 위해 필요한 최소 스키마 추가**까지 제안한다.
>
> **전제**:
> - `billing-improvement-plan.md` Phase 4에 있던 기존 "바우처 계획"은 임시안이었으므로 **무시**.
> - 기준은 voucher-plan.md (3-layer: Catalog / CenterVoucher / ClientVoucher, P1~P3 로드맵).
> - 기존 워크플로(청구서 생성 → 결제 등록 → 상태 전환)는 **그대로 유지**한다.
> - 바우처 복잡도(3-layer, 환산율, 우선순위, AI, 감사)는 **voucher 모듈이 전담**한다.

---

## 0. 현재 billing 구조 요약

| 엔티티 | 핵심 필드 | 바우처와의 연관성 |
|---|---|---|
| `Billable` | `center_id, client_id, total_amount, paid_amount, unpaid_amount, status, billable_date, due_date` | 지원금 + 본인부담금 **합산 청구서**로 그대로 사용 |
| `BillableItem` | `item_type(service/product/package), item_id, related_type, related_case_id, related_session_id, price_list_id, quantity, unit_price, amount, provided_at` | 연관 세션/케이스 참조가 이미 존재 → 바우처 차감 근거 특정 가능 |
| `Payment` | `billable_id, amount, payment_method(card/transfer), paid_at, receipt_number` | **한 billable에 N개 Payment** 구조 → "지원금 Payment + 본인부담금 Payment" 분리 가능 |
| `PriceList` | 센터별 서비스 단가표 | 기본 단가 산정, 바우처 지원율 계산은 voucher 모듈 |

> 핵심: 현재 billing엔 바우처 전용 컬럼이 없지만, **구조적 연동 여지는 이미 충분**하다.

---

## 1. 호환성 판정

### 1-1. ✅ 기존 구조로 그대로 해결되는 것

| voucher-plan 요구 | billing 기존 구조로 해결되는 방식 |
|---|---|
| 지원금 + 본인부담금 **분리 결제** | 같은 `Billable`에 `Payment` 2건 (card + voucher). `paid_amount` 자동 합산 |
| 상담/검사 세션과 **청구 연결** | `BillableItem.related_type / related_case_id / related_session_id` 이미 존재 |
| 회기 차감 **근거 데이터** | `BillableItem.provided_at + related_session_id`로 "언제 어느 세션에 썼는지" 추적 |
| 청구서 상태 관리 (draft/issued/paid) | `Billable.status` 그대로 |
| 환불 시 본인부담금 환불 | 음수 `Payment` 또는 별도 환불 Payment 수단 |

### 1-2. ⚠️ 연동을 위해 필요한 것

| 요구 | 필요한 변경 (최소) |
|---|---|
| Payment 수단에 `voucher` 추가 | `Payment.payment_method` enum 허용 값에 `'voucher'` 추가. **DB 스키마 변경 없음** (이미 `String(20)`, validator만 확장) |
| 어느 `ClientVoucher`를 얼마나 썼는지 추적 | voucher 모듈에 `VoucherUsage` 테이블 신설 (billing FK는 **soft reference**로 시작, §9에서 승격 제안) |
| 회기 환산·우선순위·AI 등 | 전부 voucher 모듈 책임. billing 변경 없음 |

### 1-3. 판정

> **billing은 최소 변경(enum 값 추가 + 프론트 옵션 1개)만으로 voucher-plan을 수용할 수 있다.**
> §9의 소폭 스키마 추가를 함께 적용하면 **데이터 정합성·감사 대응·회계 리포트 품질이 뚜렷이 개선**된다 — 이 작업은 마이그레이션 부담이 작아 **권장**한다.

---

## 2. 연동 아키텍처

```
apps/api/app/modules/
├── billing/                    ← 최소 변경 (enum, 선택적으로 §9 컬럼)
│   ├── billable/
│   ├── payment/
│   ├── price_list/
│   └── facade/
│       ├── billable_facade.py
│       ├── payment_facade.py
│       └── price_list_facade.py
│
└── voucher/                    ← 신규 모듈
    ├── catalog/                # P1: VoucherCatalog (플랫폼 마스터)
    ├── center_voucher/         # P1: CenterVoucher (센터 취급 등록)
    ├── client_voucher/         # P1: ClientVoucher (내담자 발급 인스턴스)
    ├── usage/                  # P3: VoucherUsage (billing과 이어주는 매핑)
    └── facade/
        └── voucher_facade.py
```

### 2-1. 연동 규칙

1. **voucher → billing 방향만 호출** (CLAUDE.md 모듈 격리 원칙).
2. voucher 모듈이 `BillableFacade / PaymentFacade`를 호출해서 청구·결제 레코드를 생성.
3. billing은 voucher를 **모른다**. voucher 관련 모든 신규 테이블은 voucher 모듈이 소유.

### 2-2. 주요 플로우

**[회기 사용 + 결제 기록]** — voucher-plan Phase 3의 핵심 시나리오
```
세션 완료
  → VoucherFacade.consume_session(client_id, session_id, amount, actor_id)
      ├─ SELECT FOR UPDATE on ClientVoucher         # 동시성 제어
      ├─ 잔여 회기 / 유효기간 / 월 한도 검증        # 초과 시 ConflictException
      ├─ idempotency: (session_id, voucher_id) 중복 차감 차단
      ├─ ClientVoucher.used_sessions++
      ├─ BillableFacade.add_item(
      │       billable_id,
      │       voucher_amount=지원금             # §9-2
      │   )
      ├─ PaymentFacade.record_payment(
      │       billable_id,
      │       amount=지원금,
      │       payment_method='voucher',
      │       payment_category='subsidy'       # §9-3
      │   )
      └─ VoucherUsage 레코드 생성 (actor, session_id, payment_id, 회기 수)
```

> **차감 타이밍**: "상담사 완료 처리 시점"을 기본 정책으로 제안 (voucher-plan §12.1과 동일, Open Question).
> 시작 시점 차감은 no-show 복원 복잡도 때문에 지양. 관리자 승인 플로우가 필요한 바우처는 `VoucherUsage.status=pending`으로 시작하도록 확장 가능.

**[본인부담금 별도 결제]**
```
본인부담금 카드 결제
  → PaymentFacade.record_payment(
        billable_id,
        amount=본인부담금,
        payment_method='card',
        payment_category='taxable'            # §9-3
    )
  (voucher 모듈 관여 없음)
```

**[월별 집계·청구서 생성]** — voucher-plan Phase 3 "청구서 작성 지원"
```
VoucherReportService.monthly_summary(center_id, year, month, catalog_id)
  → VoucherUsage 기간·사업별 집계
      - 제공기관별 / 상담사별 / 서비스 유형별 회기·금액
  → billing Payment(method='voucher') 교차 검증 (정합성 감사)
  → 양식 자동 채우기
      - 사회서비스전자바우처 청구 양식 (Excel/PDF)
      - 증빙 번들 (상담일지 + 동의서 + 내역)
  → VoucherClaim 레코드 생성 (status=submitted)
```

**[청구 반려·재청구]**
```
VoucherClaimFacade.mark_rejected(claim_id, reason)
  → VoucherClaim.status='rejected' + rejection_reason 기록
  → 재청구 플로우
      ├─ 문제가 된 UsageItem 수정 (일지 보완 등)
      └─ 새 VoucherClaim(status=resubmitted, parent_claim_id=...) 발행
```

**[환불/롤백]** — voucher-plan Phase 3 "원자적 잔액 복구"
```
VoucherFacade.rollback_usage(voucher_usage_id, actor_id, reason)
  async with uow:
      ├─ ClientVoucher.used_sessions--            # 잔액 복구
      ├─ PaymentFacade.void_payment(payment_id)    # 음수 Payment 또는 삭제
      └─ VoucherUsage.reversed_at = now
                     .reversed_by = actor_id
                     .reversed_reason = reason
  # 세 작업이 한 트랜잭션 — 부분 실패 시 전체 롤백
```

### 2-3. `VoucherUsage` 필드 (감사·재청구용)

voucher 모듈이 소유. billing과는 `payment_id`, `billable_item_id`로만 연결.

| 필드 | 용도 | 연결되는 Phase 3 요구 |
|---|---|---|
| `client_voucher_id` | 어느 바우처 | — |
| `session_id` / `case_id` | 어느 세션·케이스 | 중복 차감 방지 (idempotency key) |
| `sessions_consumed` | 환산된 회기 수 (1세션=1회기, 검사=N회기 등) | 환산 규칙 감사 |
| `amount` | 지원금액 | 월별 집계 |
| `payment_id` | billing Payment FK (§9-1) | 결제·환불 링크 |
| `billable_item_id` | billing BillableItem 참조 | 증빙 링크 |
| `actor_id` / `actor_role` | 누가 차감했나 | **5년 감사 대응**, "누가·언제·왜" |
| `occurred_at` | 차감 시각 | 월별 집계 기준 |
| `reversed_at` / `reversed_by` / `reversed_reason` | 롤백 이력 | 수정 이력 보존 |
| `claim_id` (nullable) | 포함된 청구 번들 | 청구 반려·재청구 추적 |
| `status` | consumed / pending / reversed | 관리자 승인형 바우처 대응 |

---

## 3. billing 변경 범위 (필수 최소)

| 항목 | 변경 | 파급 |
|---|---|---|
| `Payment.payment_method` | 허용 값에 `'voucher'` 추가 (DB 타입은 그대로 `String(20)`) | Alembic 불필요, API validator만 확장 |
| 프론트 `PaymentModal` | 수단 Select에 "바우처" 옵션 추가 + 선택 시 voucher 모듈 위젯 노출 | 모달 Select 옵션 1개 추가 |

> 여기까지는 **DB 마이그레이션 없음**. voucher 모듈 추가만으로 바우처 사용이 가능.

---

## 4. voucher 모듈이 책임지는 것 (billing 외부)

- `VoucherCatalog` CRUD (super_admin)
- `CenterVoucher` CRUD (센터 관리자 — 제공기관 번호, 취급 여부)
- `ClientVoucher` 발급/조회/만료/잔여 회기
- **회기 ↔ 금액 환산** (상담 세션 / 검사 케이스 / 집단상담)
- 복수 바우처 보유 시 **차감 우선순위**
- `VoucherUsage` 로그 (감사)
- 만료 임박 알림, 동의서 버전, 입력 주체(`staff/client`)
- P2 (AI 일지 변환 / 자격 판별)

billing은 위 어느 것도 몰라도 된다.

---

## 5. 한눈에 보는 호환성

| 질문 | 답 |
|---|---|
| 기존 billing 구조로 voucher-plan을 얹을 수 있는가? | **✅**. 필수 변경은 `payment_method` 값 추가 1건 |
| 마이그레이션 부담은? | 필수 범위만 하면 **없음**. §9 권장안 전부 적용해도 **nullable 컬럼 3개 추가**라 안전 |
| 바우처 핵심 복잡도는 어디? | **voucher 모듈 전담**. billing은 금액과 수단만 받음 |
| 권장 경로는? | §3 필수 + §9 권장안을 **함께** 적용. 작은 비용으로 감사·회계·정합성 품질이 크게 좋아짐 |

---

## 6. Open Questions

1. **지원금 + 본인부담금이 한 Billable에 묶이나, 분리되나?**
   - 권장: **한 Billable에 Payment 2건**. 환불·정산 단위를 따로 굴려야 하는 경우만 별도 Billable.
2. **voucher 모듈 Facade 경계**
   - voucher → `BillableFacade / PaymentFacade` 호출 허용 (CLAUDE.md "다른 모듈 Facade 사용" 조항).
   - 반대 방향 금지.
3. **세무 처리(면세/과세) 분리 필요 여부**
   - 회계 담당 확인 후 §9-3 채택 여부 결정.
4. **soft reference vs hard FK** → §9-1 참조.

---

## 7. 다음 액션

1. voucher-plan.md §4.5 Interface Map에 **billing 연동 지점** 명시 (본 문서 링크).
2. voucher 모듈 설계 문서 착수 (별도): `VoucherCatalog / CenterVoucher / ClientVoucher / VoucherUsage` 상세.
3. §3 + §9 권장안을 포함한 **Alembic 마이그레이션 초안** 작성.
4. 프론트 PaymentModal 확장 스펙.
5. billing-improvement-plan.md §5 Phase 4 섹션을 본 문서 링크로 대체.

---

## 8. 참고 문서

- [docs/voucher/voucher-plan.md](../voucher/voucher-plan.md) — 바우처 기획 (기준)
- [docs/billing/billing-improvement-plan.md](./billing-improvement-plan.md) — billing 마이그레이션 (Phase 1~3.5 완료)
- [apps/api/app/modules/billing/billable/models.py](../../apps/api/app/modules/billing/billable/models.py), [payment/models.py](../../apps/api/app/modules/billing/payment/models.py) — 현재 billing 엔티티

---

## 9. 권장 소폭 변경 (작은 비용, 큰 이득)

§3의 "enum 값 추가"만으로도 연동은 가능하지만, 다음 3개 컬럼을 추가하면 **데이터 정합성·감사 대응·회계 리포트 품질**이 뚜렷하게 좋아진다. 모두 **nullable 컬럼 추가**라 기존 데이터에 영향 없고 마이그레이션도 단순하다.

### 9-1. `Payment.voucher_usage_id` (nullable FK)

**현재 문제**
- 바우처 참조가 `Payment.notes` 문자열에 의존하거나, voucher 모듈의 `VoucherUsage.payment_id` soft reference.
- billing Payment가 수정/삭제될 때 orphan 감지가 voucher 모듈 책임 → 정합성 부담.

**변경안**
```python
class Payment(BaseModel):
    ...
    voucher_usage_id: Mapped[str | None] = mapped_column(
        String(36), nullable=True, comment="바우처 사용 레코드 ID (voucher 모듈 FK)"
    )
```

**이득**
- soft → hard reference 승격. Payment 단일 쿼리로 바우처 출처 확인.
- 감사 시 `Payment JOIN VoucherUsage`로 정합성 검증 한 번에.
- billing이 voucher 모듈을 "몰라도 된다" 원칙은 유지 (DB 제약은 없이, app level FK만 관리 — UUID PK + FK/Enum 제약 없음 정책).

**마이그레이션**
```
ALTER TABLE payments ADD COLUMN voucher_usage_id VARCHAR(36) NULL;
```
기존 레코드는 전부 NULL. 안전.

---

### 9-2. `BillableItem.voucher_amount` (nullable int)

**현재 문제**
- 한 세션 청구액이 `unit_price × quantity = amount` 단일 값.
- 지원금/본인부담금 비율을 Item 안에서 표현할 수 없어 **환불·세무 계산 시 Payment 쪽에서 역산** 필요.

**변경안**
```python
class BillableItem(BaseModel):
    ...
    voucher_amount: Mapped[int | None] = mapped_column(
        Integer, nullable=True, comment="바우처 지원금액 (없으면 일반 결제)"
    )
    # amount는 여전히 총액. 본인부담금 = amount - (voucher_amount or 0)
```

**이득**
- Item 단위로 "이 세션의 지원금이 얼마였는가" 기록 → 부분 환불·재계산이 Item 단위로 떨어짐.
- 회계 리포트가 `SUM(voucher_amount)` vs `SUM(amount - voucher_amount)`로 단순.
- voucher 모듈이 Payment 레코드까지 조인하지 않아도 Billable 레벨에서 지원·자비 비율 확인 가능.

**마이그레이션**
```
ALTER TABLE billable_items ADD COLUMN voucher_amount INTEGER NULL;
```
기존 Item은 전부 NULL (= 바우처 미적용).

---

### 9-3. `Payment.payment_category` (nullable str)

**현재 문제**
- 바우처 결제는 통상 **면세**, 일반 상담은 과세 — 세무 분리가 필요.
- 지금은 구분 필드가 없어 회계 담당이 수단별로 추정.

**변경안**
```python
class Payment(BaseModel):
    ...
    payment_category: Mapped[str | None] = mapped_column(
        String(20), nullable=True, comment="결제 분류: taxable(과세), tax_exempt(면세), subsidy(지원금)"
    )
```

**이득**
- 매출 리포트를 billing 단독으로 "과세 매출 / 면세 매출"로 분리 가능.
- 국세청 신고 자료·부가세 처리가 쿼리 한 방.
- 바우처가 아니더라도 향후 면세 항목(예: 특정 정부 지원 프로그램) 확장에 재사용.

**마이그레이션**
```
ALTER TABLE payments ADD COLUMN payment_category VARCHAR(20) NULL;
```
기존 레코드는 NULL (= 미분류). 신규 결제부터 값을 채우면 되고, 회계 담당이 필요 시 과거 레코드 일괄 업데이트.

---

### 9-4. 종합 평가

| 항목 | 컬럼 수 | 마이그레이션 리스크 | 기존 데이터 영향 | 얻는 이득 |
|---|---|---|---|---|
| 9-1 `voucher_usage_id` | 1 (nullable) | 낮음 | 없음 (NULL) | 정합성·감사 |
| 9-2 `voucher_amount` | 1 (nullable) | 낮음 | 없음 (NULL) | 환불·리포트 단순화 |
| 9-3 `payment_category` | 1 (nullable) | 낮음 | 없음 (NULL) | 세무 분리 |

**권장**: §3 필수 변경 + 9-1, 9-2는 **함께 적용**. 9-3은 회계 담당 확인 후 결정.

적용해도 기존 API 응답·쿼리에 깨지는 부분 없음 (모두 nullable). 기존 Phase 1~3.5 구현은 그대로 동작.
