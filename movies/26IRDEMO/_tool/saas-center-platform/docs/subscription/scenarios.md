# Subscription 도메인 주요 시나리오

> Subscription 도메인의 실제 사용 시나리오 및 플로우

---

## 목차

1. [시나리오 1: 센터 생성 시 Free 플랜 할당](#시나리오-1-센터-생성-시-free-플랜-할당)
2. [시나리오 2: Pro 플랜 업그레이드](#시나리오-2-pro-플랜-업그레이드)
3. [시나리오 3: AI 보고서 생성 (플랜 검증)](#시나리오-3-ai-보고서-생성-플랜-검증)
4. [시나리오 4: 내담자 생성 (Quota 검증)](#시나리오-4-내담자-생성-quota-검증)
5. [시나리오 5: 구독 조회](#시나리오-5-구독-조회)
6. [시나리오 6: 결제 내역 조회](#시나리오-6-결제-내역-조회)

---

## 시나리오 1: 센터 생성 시 Free 플랜 할당

### 개요
센터 관리자가 센터를 생성하면 자동으로 Free 플랜 구독이 생성됨

### 액터
- 센터 관리자

### 전제 조건
- 센터 관리자가 로그인되어 있음
- Account, Person 생성 완료

---

### 플로우

#### [1단계] 센터 관리자: 센터 생성 요청

**요청**:
```http
POST /centers
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "행복상담센터",
  "address": "서울시 강남구...",
  "phone": "02-1234-5678"
}
```

---

#### [2단계] Application Handler: Center + Subscription 동시 생성

**동작** (트랜잭션):
```python
async with uow:
    # 1. Center 생성
    center = await center_service.execute(data)

    # 2. Subscription 생성 (Free 플랜)
    subscription = await subscription_service.execute({
        "center_id": center.id,
        "plan": "free",
        "status": "active",
        "started_at": datetime.now(timezone.utc),
        "expires_at": None,  # 무제한
        "is_trial": False,
    })

    await uow.commit()
```

---

#### [3단계] 응답

**응답**:
```json
{
  "center": {
    "id": 1,
    "name": "행복상담센터",
    "address": "서울시 강남구...",
    "phone": "02-1234-5678",
    "created_at": "2026-01-14T10:00:00Z"
  },
  "subscription": {
    "id": 1,
    "center_id": 1,
    "plan": "free",
    "status": "active",
    "started_at": "2026-01-14T10:00:00Z",
    "expires_at": null,
    "is_trial": false,
    "created_at": "2026-01-14T10:00:00Z"
  }
}
```

---

### 최종 상태

```
Center(id=1, name="행복상담센터")
  ↓ 1:1
Subscription(id=1, center_id=1, plan="free", status="active")
```

**제공 기능**:
- 내담자 10명까지 등록 가능
- 기본 예약 관리
- AI 기능 불가
- 통합 청구 불가

---

## 시나리오 2: Pro 플랜 업그레이드

### 개요
센터 관리자가 Pro 플랜으로 업그레이드하여 AI 기능 사용

### 액터
- 센터 관리자

### 전제 조건
- Center(id=1) 존재
- Subscription(center_id=1, plan="free") 존재
- 센터 관리자 로그인 (center_id=1)

---

### 플로우

#### [1단계] 센터: 업그레이드 요청

**요청**:
```http
POST /subscription/upgrade
Authorization: Bearer {token}
Content-Type: application/json

{
  "plan": "pro",
  "payment_method": "card"
}
```

---

#### [2단계] Handler: 플랜 업그레이드 + 결제 처리

**동작** (트랜잭션):
```python
async with uow:
    # 1. 플랜 업그레이드
    subscription = await upgrade_service.execute(
        center_id=auth.center_id,
        new_plan="pro"
    )

    # 2. 결제 내역 생성
    payment = await payment_repo.create({
        "subscription_id": subscription.id,
        "amount": 99000,
        "plan": "pro",
        "payment_method": "card",
        "status": "completed",
        "paid_at": datetime.now(timezone.utc),
    })

    await uow.commit()

# 3. JWT 재발급 (새 plan 포함)
new_token = await create_access_token_for_center(
    auth.account_id,
    auth.center_id,
    session
)
```

---

#### [3단계] 응답

**응답**:
```json
{
  "subscription": {
    "id": 1,
    "center_id": 1,
    "plan": "pro",
    "status": "active",
    "started_at": "2026-01-14T10:00:00Z",
    "expires_at": "2026-02-14T10:00:00Z",
    "is_trial": false,
    "created_at": "2026-01-14T10:00:00Z"
  },
  "payment": {
    "id": 1,
    "subscription_id": 1,
    "amount": 99000,
    "plan": "pro",
    "payment_method": "card",
    "status": "completed",
    "paid_at": "2026-01-14T11:00:00Z",
    "created_at": "2026-01-14T11:00:00Z"
  },
  "access_token": "eyJ...",
  "message": "Upgraded to 프로 plan"
}
```

---

### 최종 상태

```
Subscription(id=1, plan="pro", expires_at="2026-02-14")
SubscriptionPayment(id=1, amount=99000, status="completed")
```

**제공 기능**:
- 내담자 무제한
- AI 보고서 생성 가능
- 투사검사 AI 가능
- 통합 청구 가능

**JWT Payload 변경**:
```json
{
  "account_id": 1,
  "center_id": 1,
  "plan": "pro"  // "free" → "pro"
}
```

---

## 시나리오 3: AI 보고서 생성 (플랜 검증)

### 개요
Pro 플랜 사용자가 AI 보고서 생성 요청

### 액터
- 상담사 (Pro 플랜 센터)

### 전제 조건
- Subscription(center_id=1, plan="pro")
- JWT에 plan="pro" 포함

---

### 플로우

#### [1단계] 상담사: AI 보고서 생성 요청

**요청**:
```http
POST /assessment/ai-report
Authorization: Bearer {token_with_plan_pro}
Content-Type: application/json

{
  "assessment_id": 10,
  "report_type": "comprehensive"
}
```

---

#### [2단계] Core Middleware: 플랜 검증

**데코레이터 검증**:
```python
@router.post("/ai-report")
@require_plan(["pro", "enterprise"])
async def generate_ai_report(...):
    pass
```

**검증 로직**:
```python
# JWT에서 plan 추출
auth.plan = "pro"

# 허용 플랜 확인
if auth.plan not in ["pro", "enterprise"]:
    raise HTTPException(status_code=402, detail="...")

# 통과 → 비즈니스 로직 실행
```

---

#### [3단계] 응답

**응답** (200 OK):
```json
{
  "report_id": 100,
  "assessment_id": 10,
  "content": "AI가 생성한 보고서 내용...",
  "generated_at": "2026-01-14T12:00:00Z"
}
```

---

### 대조: Free 플랜 사용자가 요청한 경우

**요청**:
```http
POST /assessment/ai-report
Authorization: Bearer {token_with_plan_free}
```

**응답** (402 Payment Required):
```json
{
  "detail": {
    "message": "This feature requires a higher plan",
    "current_plan": "free",
    "required_plans": ["pro", "enterprise"],
    "upgrade_url": "/subscription/upgrade"
  }
}
```

---

## 시나리오 4: 내담자 생성 (Quota 검증)

### 개요
Starter 플랜 사용자가 내담자를 생성하려고 하나, 50명 제한에 도달

### 액터
- 센터 관리자 (Starter 플랜)

### 전제 조건
- Subscription(center_id=1, plan="starter") → 내담자 50명 제한
- 현재 내담자 수: 50명

---

### 플로우

#### [1단계] 센터: 내담자 생성 요청

**요청**:
```http
POST /clients
Authorization: Bearer {token_with_plan_starter}
Content-Type: application/json

{
  "name": "김신규",
  "contact_phone": "010-1234-5678"
}
```

---

#### [2단계] Application Handler: Quota 검증

**동작**:
```python
async with uow:
    # 1. 현재 내담자 수 확인
    current_count = await client_repo.count_by_center(auth.center_id)
    # current_count = 50

    # 2. 플랜 제한 조회
    limit = get_plan_limit(auth.plan, "clients")
    # limit = 50 (Starter 플랜)

    # 3. Quota 검증
    if limit and current_count >= limit:
        raise HTTPException(
            status_code=402,
            detail=f"Client limit reached ({current_count}/{limit}). "
                   f"Upgrade to Pro for unlimited clients."
        )
```

---

#### [3단계] 응답

**응답** (402 Payment Required):
```json
{
  "detail": "Client limit reached (50/50). Upgrade to Pro for unlimited clients."
}
```

---

### 대조: Pro 플랜 사용자가 요청한 경우

**전제 조건**:
- Subscription(plan="pro") → 내담자 무제한

**요청**:
```http
POST /clients
Authorization: Bearer {token_with_plan_pro}
Content-Type: application/json

{
  "name": "김신규",
  "contact_phone": "010-1234-5678"
}
```

**동작**:
```python
# Quota 검증
limit = get_plan_limit("pro", "clients")
# limit = None (무제한)

if limit and current_count >= limit:
    # 통과 (limit=None)
```

**응답** (201 Created):
```json
{
  "id": 51,
  "name": "김신규",
  "contact_phone": "010-1234-5678",
  "created_at": "2026-01-14T13:00:00Z"
}
```

---

## 시나리오 5: 구독 조회

### 개요
센터 관리자가 현재 구독 정보를 조회

### 액터
- 센터 관리자

### 전제 조건
- 센터 관리자 로그인 (center_id=1)
- Subscription(center_id=1) 존재

---

### 플로우

#### [1단계] 센터: 구독 조회

**요청**:
```http
GET /subscription
Authorization: Bearer {token}
```

---

#### [2단계] Handler: 구독 정보 조회

**동작**:
```python
subscription = await subscription_repo.get_by_center(auth.center_id)
```

---

#### [3단계] 응답

**응답** (200 OK):
```json
{
  "id": 1,
  "center_id": 1,
  "plan": "pro",
  "status": "active",
  "started_at": "2026-01-14T10:00:00Z",
  "expires_at": "2026-02-14T10:00:00Z",
  "is_trial": false,
  "trial_expires_at": null,
  "created_at": "2026-01-14T10:00:00Z",
  "limits": {
    "clients": null,
    "therapists": null,
    "storage_gb": 50
  }
}
```

---

## 시나리오 6: 결제 내역 조회

### 개요
센터 관리자가 구독 결제 내역을 조회

### 액터
- 센터 관리자

### 전제 조건
- Subscription(id=1) 존재
- SubscriptionPayment 여러 건 존재

---

### 플로우

#### [1단계] 센터: 결제 내역 조회

**요청**:
```http
GET /subscription/payments?limit=10
Authorization: Bearer {token}
```

---

#### [2단계] Handler: 결제 내역 조회

**동작**:
```python
subscription = await subscription_repo.get_by_center(auth.center_id)
payments = await payment_repo.get_by_subscription(
    subscription.id,
    limit=10
)
```

---

#### [3단계] 응답

**응답** (200 OK):
```json
{
  "items": [
    {
      "id": 10,
      "subscription_id": 1,
      "amount": 99000,
      "plan": "pro",
      "payment_method": "card",
      "status": "completed",
      "paid_at": "2026-01-14T11:00:00Z",
      "created_at": "2026-01-14T11:00:00Z"
    },
    {
      "id": 9,
      "subscription_id": 1,
      "amount": 99000,
      "plan": "pro",
      "payment_method": "card",
      "status": "completed",
      "paid_at": "2025-12-14T11:00:00Z",
      "created_at": "2025-12-14T11:00:00Z"
    }
  ],
  "total": 2
}
```

---

## 시나리오 요약

| 시나리오 | 주요 액터 | 핵심 기능 | 연관 엔티티 |
|---------|----------|----------|------------|
| 1. 센터 생성 | 센터 관리자 | Free 플랜 자동 할당 | Center, Subscription |
| 2. 업그레이드 | 센터 관리자 | Pro 플랜 업그레이드, 결제 | Subscription, SubscriptionPayment |
| 3. AI 보고서 | 상담사 | 플랜 기반 기능 제어 | JWT, Core Middleware |
| 4. 내담자 생성 | 센터 관리자 | Quota 검증, 제한 초과 | Subscription, Client |
| 5. 구독 조회 | 센터 관리자 | 현재 구독 정보 확인 | Subscription |
| 6. 결제 내역 | 센터 관리자 | 결제 이력 조회 | SubscriptionPayment |

---

## 참고 문서

- **Subscription 도메인**: `/docs/subscription/domain.md`
- **Subscription 엣지 케이스**: `/docs/subscription/edge-cases.md`
- **Auth 도메인**: `/docs/auth/domain.md`
