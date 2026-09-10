# 내담자-바우처 연동 설계 (Client ↔ Voucher) — 부분 superseded

> ⚠️ **2026-05-18 부분 superseded** — 본 문서의 Q1·Q2 결정(신규 등록 진입점·발급 모달 필드)은 현재도 유효하며 [`voucher-implementation-plan-v2.md`](./voucher-implementation-plan-v2.md) §4 S1로 흡수되었다.
>
> Q3~Q9 (차년도 갱신·used_sessions 수동 조정·차감 이력 있는 취소·expired 전이·중복 발급 unique 등)는 V2의 가계부 모델로의 단순화로 대부분 자동 해소되거나 P1 범위에서 빠졌다. 추가 토론이 필요하면 별도 문서에서 재론한다.
>
> 현재 P1 정답 문서: [`voucher-implementation-plan-v2.md`](./voucher-implementation-plan-v2.md)

---

> **목적** (원안): [`voucher-implementation-plan.md`](./voucher-implementation-plan.md) §3-2 (`client_vouchers`)·§5-3·§7-3을 운영 시나리오 관점에서 깊이 파고, 발급·조회·수정·만료의 실제 흐름을 확정한다.
>
> **상위 문서**:
> - 구현 설계 본문: [`voucher-implementation-plan.md`](./voucher-implementation-plan.md)
> - 사업 기획: [`docs/voucher/voucher-plan.md`](../voucher/voucher-plan.md)
>
> **본 문서의 결정사항은 voucher-implementation-plan §3-2·§5-3·§7-3으로 회류된다.**

---

## 0. 한 줄 요약

> 내담자에게 바우처가 발급되는 흐름은 **외부 확인 결과의 캡처(수동 입력)**. 발급 시점에 "지금까지 외부에서 얼마나 썼는지(initial_used_sessions)"를 같이 받아 정합성 감사를 깨지 않고 유지한다.

---

## 1. 컨텍스트와 가정

### 1-1. 본 문서가 다루는 범위

- ClientVoucher의 **발급 / 조회 / 수정 / 취소 / 만료 처리**
- 신규 내담자 등록 흐름과 바우처 등록의 접점
- 외부 시스템(복지로·국민행복카드 등)과 동기화하지 않는 전제 하의 운영 룰

### 1-2. 본 문서가 다루지 않는 범위

- 차감(consume) 로직 — voucher-implementation-plan §5-6
- 케이스에 바우처 연결 — voucher-implementation-plan §5-4 (CaseVoucher)
- 자격 판별·추천 — voucher-plan §5 Phase 2B

### 1-3. 핵심 전제

- 잔여 회기·만료일은 **플랫폼 내부 기록값**. 외부와 실시간 동기화 안 함
- 발급은 항상 **외부 확인 후의 입력**. 시스템은 검증 주체가 아님
- 한 내담자가 여러 바우처를 동시 보유 가능 (사업이 다를 때)
- 한 사업은 보통 연 1회 발급. 차년도 갱신은 별도 row

---

## 2. 운영 시나리오 (Use Cases)

> 각 시나리오는 "누가 / 언제 / 어떤 화면에서 / 무엇을 하는가" 로 그린다. 결정이 필요한 부분은 ❓로 표시.

### 시나리오 S1 — 신규 내담자 + 바우처 동시 등록

**전제**: 접수 담당자가 전화로 신규 내담자 접수. 내담자가 "전국민 마음투자 바우처를 받았다"고 알림. 담당자가 외부 확인서로 검증 완료.

#### 진입 ✅ (Q1 확정)

**결정**: (B) 내담자 저장 후 상세 페이지의 "바우처" 탭에서 별도 등록.

**근거**:
- 모듈 격리: Client 인테이크 폼을 voucher 작업이 침범하지 않음. Phase B PR이 voucher 모듈에 닫힘
- 모든 내담자가 바우처를 갖는 게 아니므로 인테이크 폼이 무거워지는 걸 회피
- 추후 운영 피드백에 따라 "저장 직후 안내" 옵션은 점진적 보강 가능

**구현 흐름**:
1. 접수 담당자 `/clients/new` 진입 → 내담자 기본정보만 입력 (바우처 무관)
2. 저장 → `/clients/{id}` 상세 페이지로 이동
3. "바우처" 탭 클릭 → 비어있는 카드 목록 + "바우처 발급" 버튼
4. 버튼 클릭 → 발급 모달 (Q2에서 필드 결정)

#### 입력 ✅ (Q2 확정)

**모달 필드 구성**:

| 필드 | 필수 | 디폴트 / 자동 채움 | 비고 |
|---|---|---|---|
| `center_voucher_id` | ✅ | — | 드롭다운, 우리 센터 취급 활성만 |
| `total_sessions` | ✅ | `CenterVoucher.default_total_sessions` (있으면) | 외부 확인서 기준 |
| `started_at` | ✅ | `today` | |
| `expires_at` | ✅ | **비움** — 담당자가 외부 확인서 보고 직접 입력 | 자동 계산 안 함 (사업마다 다름) |
| `initial_used_sessions` | 선택 | `0` | 타 센터 이용 이관 케이스 대응 (Q2-A 확정) |
| `external_source_note` | 선택 | — | 자유 텍스트. "복지로 확인서 5/14 수령" 같은 운영 메모 |
| `consent_version` | 선택 | — | Phase B에서는 자유 텍스트만. 동의서 본문 관리는 Phase F |
| **증빙 파일 첨부** | 선택 | — | 다중 파일 가능. 기존 storage 인프라 활용 (Q2-B 확정) |

**제외 필드** (`notes`): `external_source_note` 와 의미 중복으로 한 필드로 통합 (Q2-D 확정).

**증빙 파일 인프라**:
- `apps/api/app/infrastructure/storage/` 기존 S3/로컬 클라이언트 재사용
- 경로 전략: `voucher-proofs/{client_voucher_id}/{uuid}.{ext}`
- 별도 테이블 `client_voucher_proofs` (file_path, file_name, file_size, mime_type, uploaded_at, uploaded_by)
- API: `POST /centers/{cid}/client-vouchers/{id}/proofs` (multipart/form-data, image/* + application/pdf 허용)
- 발급 모달에서 미리 업로드 후 client_voucher 생성 시 일괄 연결 — 또는 발급 후 별도 업로드 둘 다 허용

**프론트 자동 채움 동작**:
- CenterVoucher 선택 시 → 카탈로그 안내 정보(사업명·기관·기간·지원금 안내문)를 모달 안에 read-only로 노출 (담당자가 "이 바우처 맞나" 확인용)
- `total_sessions` 자동 채움 (default_total_sessions 있으면)
- `started_at`은 today로 자동, 변경 가능
- `expires_at`은 비워두고 외부 확인서 기준으로 입력 강제

#### 처리

1. ClientVoucher row 생성
2. 내담자 상세 페이지의 바우처 탭에 카드 노출

---

### 시나리오 S2 — 기존 내담자에 바우처 추가 발급

**전제**: 기존 내담자가 새로운 바우처를 받았다고 알림. 또는 차년도 갱신.

#### 진입

내담자 상세 → 바우처 탭 → "바우처 발급" 버튼

#### 입력

S1과 동일

#### 처리

S1과 동일 + **차년도 갱신 케이스**:

> ❓ Q3: 같은 사업의 차년도 갱신은 어떻게 처리?

후보:
- (A) 무조건 새 row insert. 기존 row는 자연 만료 (별도 처리 없음)
- (B) 기존 row의 status를 expired로 명시 전이 + 새 row insert
- (C) "갱신" 버튼이 있어서 기존 row를 종료 처리 + 새 row를 자동 연결 (renewed_from FK)

---

### 시나리오 S3 — 바우처 정보 수정

**전제**: 외부 확인 결과가 바뀌었거나 입력 오류 발견.

#### 수정 가능 범위

> ❓ Q4: 발급 후 수정 가능한 필드는?

| 필드 | 수정 허용? | 비고 |
|---|---|---|
| `total_sessions` | TBD | 외부에서 추가 갱신 시? |
| `expires_at` | TBD | 외부 연장 시? |
| `started_at` | TBD | 입력 오류 정정? |
| `used_sessions` | TBD | VoucherUsage 정합성과 충돌 — 수동 조정 정책 필요 |
| `center_voucher_id` | NO | 다른 단가로 바꾸려면 새 발급이 맞음 |
| `client_id` | NO | 다른 내담자로 이관 시 별도 정책 (P1 범위 외) |

#### 수동 조정 (used_sessions)

> ❓ Q5: `used_sessions` 수동 조정 시 VoucherUsage는?

후보:
- (A) used_sessions만 변경, VoucherUsage 손대지 않음 → 정합성 감사가 보정값을 인지하도록 별도 컬럼(`manual_adjustment`) 필요
- (B) 수동 조정 시 "adjustment" 유형의 VoucherUsage row 생성 (status='manual_adjustment')
- (C) 수동 조정 자체를 금지, 실제 차감/환불 API만 허용

---

### 시나리오 S4 — 바우처 취소 / 해지

**전제**: 내담자가 중도 해지 요청, 또는 잘못 발급된 바우처.

#### 진입

바우처 카드 → "취소" 버튼 (소프트 삭제)

#### 처리

> ❓ Q6: 이미 차감 이력이 있는 바우처를 취소하면?

후보:
- (A) 차감 이력이 있으면 취소 불가 → 환불 API(rollback)로 차감 되돌린 후에만 취소 가능
- (B) 취소 시 자동으로 모든 차감 rollback (음수 Payment 일괄 생성)
- (C) 차감 이력은 그대로 두고 status만 'cancelled'. 회계 이력 보존

---

### 시나리오 S5 — 만료 처리

**전제**: 바우처가 `expires_at`을 넘김.

#### 상태 전이 주체

> ❓ Q7: ClientVoucher.status='expired' 로 전이시키는 주체는?

후보:
- (A) 배치 잡 (매일 새벽, BackgroundTasks 또는 cron)
- (B) 조회 시점 lazy 계산 (DB에는 active로 남고 service가 동적 판단)
- (C) 차감 시점 검증만 (status 컬럼 안 씀, expires_at만 비교)

#### 만료된 바우처가 케이스에 활성 연결 중이면?

§6-1에서 차감 시 ConflictException. 그 외 추가 처리:

> ❓ Q8: 만료 자동 감지 시 CaseVoucher도 자동 unlink?

---

### 시나리오 S6 — 한 내담자가 여러 바우처

**전제**: 전국민 마음투자 + 청년마음건강을 동시 보유.

#### 표시

내담자 상세 바우처 탭에 카드 N개 노출.

#### 케이스 연결 시 선택

§7-4 케이스 상세 바우처 카드에서 보유 바우처 중 선택. (voucher-implementation-plan §9-3 Open Question 1번 — 추천 우선순위)

---

## 3. 데이터 모델 보강

> voucher-implementation-plan §3-2의 `client_vouchers` 스키마에 본 토론으로 추가/변경되는 항목을 정리한다.

### 3-1. 추가 검토 컬럼

| 컬럼 | 용도 | 결정 |
|---|---|---|
| `initial_used_sessions` | 발급 시점의 외부 이력 회기 (정합성 감사 보정) | ✅ 추가 (Q2-A) |
| `external_source_note` | 외부 확인 출처 메모 | ✅ 추가 (Q2-D) |
| `consent_version` | 동의서 버전 (이미 §3-2에 있음, 자유 텍스트로만) | 유지 |
| `renewed_from_id` | 차년도 갱신 시 이전 ClientVoucher 참조 | TBD (Q3) |
| `manual_adjustment` | 수동 조정 누적값 | TBD (Q5) |
| `cancellation_reason` | 취소 사유 | TBD (Q6) |
| `expired_at` | 실제 만료 처리 시각 (배치/lazy 결정에 따라) | TBD (Q7) |

**제외**: `notes` (`external_source_note`로 통합)

### 3-1-1. 신규 테이블: `client_voucher_proofs`

증빙 파일 메타데이터. ClientVoucher 1:N. (Q2-B 결정)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | UUID PK | |
| `client_voucher_id` | UUID | 부모 (앱레벨 FK) |
| `center_id` | UUID | RLS |
| `file_path` | varchar(500) | S3 경로 |
| `file_name` | varchar(255) | 원본 파일명 |
| `file_size` | int | 바이트 |
| `mime_type` | varchar(100) | image/jpeg, application/pdf 등 |
| `uploaded_by` | UUID | 업로드 직원 |
| `uploaded_at` | timestamp | |
| `created_at / updated_at / deleted_at` | timestamp | soft delete |

### 3-2. Unique 제약

> ❓ Q9: 같은 내담자가 같은 사업을 중복 발급 받는 사고를 막을 제약은?

후보:
- (A) `(client_id, center_voucher_id, started_at)` unique — 같은 시작일 발급 금지
- (B) `(client_id, center_voucher_id) WHERE status='active'` 부분 unique — 활성 상태에서 중복 금지
- (C) DB 제약 없이 서비스 레벨에서 경고만 (운영자가 차년도 갱신 시 새 발급 의도 명시)

### 3-3. 정합성 감사 쿼리 갱신

voucher-implementation-plan §6-5의 감사 쿼리가 외부 이력(initial_used_sessions)을 반영하도록 수정:

```sql
SELECT cv.id, cv.used_sessions, cv.initial_used_sessions,
       COALESCE(SUM(vu.sessions_consumed), 0) AS internal_consumed
  FROM client_vouchers cv
  LEFT JOIN voucher_usages vu
    ON vu.client_voucher_id = cv.id AND vu.status = 'consumed'
 GROUP BY cv.id
HAVING cv.used_sessions <> cv.initial_used_sessions + COALESCE(SUM(vu.sessions_consumed), 0);
```

---

## 4. API 영향

> 결정사항을 종합해 voucher-implementation-plan §5-3을 갱신할 사항을 정리.

### 4-1. POST `/centers/{center_id}/clients/{client_id}/vouchers` (발급)

Body 필드 확장 후보:
```json
{
  "center_voucher_id": "uuid",
  "total_sessions": 12,
  "initial_used_sessions": 0,       // 외부 이력 (Q에 따라)
  "started_at": "2026-05-15",
  "expires_at": "2026-12-31",
  "input_source": "staff",
  "consent_version": "v1.0",
  "external_source_note": "복지로 확인서 5/14 수령",
  "notes": "..."
}
```

### 4-2. PATCH `/centers/{center_id}/client-vouchers/{id}` (수정)

수정 가능 필드는 Q4 결과에 따라 결정. Body 후보:
```json
{
  "total_sessions": 16,             // 갱신 시
  "expires_at": "2027-06-30",       // 연장 시
  "used_sessions_adjustment": -1,   // 수동 조정 (delta) — Q5 (B)면 별도 endpoint
  "adjustment_reason": "외부 갱신 반영"
}
```

### 4-3. POST `/centers/{center_id}/client-vouchers/{id}/renew` (갱신 — Q3 (C)면 신설)

```json
{
  "new_total_sessions": 8,
  "new_started_at": "2027-01-01",
  "new_expires_at": "2027-12-31"
}
```
→ 기존 row status='expired' + 새 row insert + `renewed_from_id`로 연결

---

## 5. UI/UX 결정

### 5-1. 신규 내담자 등록 흐름의 바우처 진입점

Q1 결과에 따라 결정.

### 5-2. 내담자 상세 바우처 탭 레이아웃

카드 목록 + 발급 버튼. Q6 결과에 따라 "취소" 버튼 노출 조건.

### 5-3. 바우처 카드 컴포넌트

표시 정보:
- 사업명 (CenterVoucher → Catalog)
- 잔여 / 총 회기
- 만료일 + D-day 뱃지
- 상태 뱃지 (active / expired / exhausted / cancelled)
- 외부 출처 메모 (있으면)

---

## 6. 결정 사항 / Open Questions

본 문서가 확정해야 할 Open Questions 일람:

| ID | 질문 | 영향 | 상태 |
|---|---|---|---|
| Q1 | 신규 등록 시 바우처 진입점 (인테이크 폼 inline vs 분리) | UI 흐름 | ✅ (B) 별도 탭 |
| Q2 | 발급 모달 필수/선택 필드 | API·UI | ✅ §2 S1, §3-1, §3-1-1 |
| Q3 | 차년도 갱신 처리 방식 (새 row vs renew API) | 스키마·API | ⏳ |
| Q4 | 발급 후 수정 가능 필드 범위 | API | ⏳ |
| Q5 | used_sessions 수동 조정 시 VoucherUsage 처리 | 데이터 정합성 | ⏳ |
| Q6 | 차감 이력 있는 바우처 취소 정책 | API·운영 | ⏳ |
| Q7 | expired 상태 전이 주체 (배치 vs lazy) | 인프라 | ⏳ |
| Q8 | 만료 자동 감지 시 CaseVoucher 자동 unlink 여부 | Phase C 연동 | ⏳ |
| Q9 | 중복 발급 방지 unique 제약 | DB 제약 | ⏳ |

---

## 7. 다음 단계

1. Q1~Q9 순차 결정 (본 문서 §2~§5 채워가며)
2. 결정 사항을 voucher-implementation-plan §3-2·§5-3·§7-3에 회류
3. Phase B 마이그레이션·구현 착수
