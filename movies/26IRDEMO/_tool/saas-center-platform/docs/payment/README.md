# Payment 도메인 문서

> B2C 회계 관리 시스템 설계 문서

---

## 📖 문서 읽는 순서

### 1️⃣ 처음 읽는 사람
```
summary.md (필수) → api-spec.md → events.md
```

### 2️⃣ 구현하는 개발자
```
summary.md → api-spec.md → domain.md → edge-cases.md
```

### 3️⃣ 정책 결정자
```
summary.md → decision-log.md → competitor-analysis.md
```

### 4️⃣ QA/테스터
```
summary.md → scenarios.md → edge-cases.md
```

---

## 📁 문서 목록

### 🌟 핵심 문서 (반드시 읽을 것)

| 문서 | 페이지 | 설명 | 대상 |
|------|--------|------|------|
| **summary.md** | 2쪽 | **핵심 개념 + 정책 결정 필요 사항** | 전체 |
| **api-spec.md** | 10쪽 | REST API 엔드포인트 상세 | 개발자 |
| **events.md** | 8쪽 | 도메인 이벤트 정의 및 처리 | 개발자 |

### 📚 상세 문서 (필요시 참고)

| 문서 | 페이지 | 설명 | 대상 |
|------|--------|------|------|
| domain.md | 15쪽 | 전체 설계 (엔티티, 모듈 구조) | 개발자 |
| scenarios.md | 20쪽 | 10개 상세 시나리오 | 개발자, QA |
| edge-cases.md | 15쪽 | 18개 예외 상황 처리 | 개발자, QA |
| decision-log.md | 15쪽 | 6개 주요 의사결정 기록 | 전체 |
| competitor-analysis.md | 30쪽 | 경쟁사 분석 (에피, 마음주의 등) | PM, 기획 |

---

## 🎯 빠른 참조

### 엔티티 요약
```
PriceList (단가표)
  ↓ 참조
Billable (청구서) ← 자동 생성 (서비스 완료 시)
  ↓ 1:N
BillableItem (청구 항목)

Payment (수납 기록) → Billable

VoucherPolicy (센터 관리)
  ↓ 1:N
ClientVoucher (내담자)
  ↓ 사용
BillableItem
```

### 주요 API
- `POST /billables` - 청구서 생성
- `POST /billables/batch` - 일괄 청구 (월말)
- `POST /payments` - 수납 처리
- `GET /billables/unpaid` - 미수금 목록
- `GET /price-lists` - 단가표 조회
- `GET /vouchers/clients/{id}` - 바우처 조회

### 핵심 정책
- ✅ 과납부 허용
- ✅ draft 수납 시 자동 발행
- ✅ 서비스 완료 → 청구 자동 생성
- ❌ cancelled 상태 없음 (음수 청구서)
- ❌ 항목 수정 불가 (삭제 후 재생성)
- ❌ 영수증 번호 자동 생성 없음 (Phase 1)

---

## ⚠️ 정책 결정 필요 (8개)

**반드시 `summary.md` 참고**:
1. 과납부 금액 상계 방법?
2. 영수증 번호 형식 확정?
3. 바우처 정책 업데이트 프로세스?
4. 연체 후 조치?
5. 미수금 독촉 정책?
6. 환불 프로세스?
7. 청구서 삭제 정책?
8. 바우처 동시성 제어 방법?

---

## 🔍 특정 주제 찾기

### 단가표 관련
- 개념: `summary.md` → "PriceList"
- API: `api-spec.md` → "PriceList"
- 도메인: `domain.md` → "6. PriceList (단가표)"

### 자동 청구
- 개념: `summary.md` → "자동 청구 생성 흐름"
- 워크플로우: `domain.md` → "자동 청구 워크플로우"
- API: `api-spec.md` → "일괄 청구 생성"

### 바우처 관련
- 개념: `summary.md` → "바우처 검증"
- API: `api-spec.md` → "Voucher"
- 시나리오: `scenarios.md` → "시나리오 3, 8, 9"
- 예외: `edge-cases.md` → "케이스 1-5"

### 수납 처리
- 개념: `summary.md` → "수납 처리"
- API: `api-spec.md` → "Payment"
- 시나리오: `scenarios.md` → "시나리오 4"
- 예외: `edge-cases.md` → "케이스 10-12"

### 환불/음수 금액
- 개념: `summary.md` → "음수 금액"
- 시나리오: `scenarios.md` → "시나리오 2 끝부분"
- 결정: `decision-log.md` → "5. 음수 금액으로 환불 표현"
- 예외: `edge-cases.md` → "케이스 7"

---

## 📊 Phase별 기능

### Phase 1 (현재)
- 청구/수납 기본 기능
- 바우처 자동 계산
- 미수금 추적
- 기본 리포트

### Phase 2 (예정)
- 이용권/패키지
- 상담사 정산
- 환불 처리
- 알림 시스템

### Phase 3 (예정)
- 위약금 관리
- 외부 회계 연동
- 예측 분석

---

## 🚀 구현 시작하기

1. **`summary.md` 읽기** (필수)
2. **`api-spec.md` 읽기** (엔드포인트 파악)
3. **정책 결정 사항 논의** (팀 미팅)
4. **`domain.md` 참고** (엔티티 구조)
5. **구현 시작**
6. **`edge-cases.md` 참고** (예외 처리)
7. **`scenarios.md` 참고** (테스트 케이스)

---

## ❓ FAQ

### Q1. 어떤 문서를 먼저 봐야 하나요?
→ **`summary.md`** (2페이지, 핵심 개념 + 정책)

### Q2. API 스펙은 어디에?
→ **`api-spec.md`** (엔드포인트별 상세)

### Q3. 바우처는 센터가 관리하나요?
→ 예. **각 센터가 자체 바우처 정책 생성/수정**. SaaS 팀은 템플릿만 제공.

### Q4. 청구서 발행 후 수정 가능한가요?
→ **불가능**. 음수 청구서로 상계하거나, 삭제 후 재생성.

### Q5. POS 연동은?
→ **없음**. 경쟁사 분석 결과 불필요. 수동 입력 + 자동화.

---

## 📞 문의

- 설계 문의: `domain.md`, `decision-log.md` 참고
- 구현 문의: `api-spec.md`, `events.md` 참고
- 정책 문의: `summary.md` 정책 결정 필요 사항 참고

---

**Last Updated**: 2026-01-15
**Version**: 1.0 (Phase 1)
