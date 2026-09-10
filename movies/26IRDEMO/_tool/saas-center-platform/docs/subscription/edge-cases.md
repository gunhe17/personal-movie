# Subscription 도메인 엣지 케이스

> Subscription 도메인의 복잡한 엣지 케이스 및 해결 전략

---

## 목차

1. [플랜 다운그레이드 시 초과 데이터 처리](#플랜-다운그레이드-시-초과-데이터-처리)
2. [Quota 초과 상태 관리](#quota-초과-상태-관리)
3. [결제 실패 및 롤백](#결제-실패-및-롤백)
4. [구독 만료 처리](#구독-만료-처리)
5. [JWT-DB 동기화 이슈](#jwt-db-동기화-이슈)
6. [Race Condition 시나리오](#race-condition-시나리오)
7. [센터 삭제 시 구독 처리](#센터-삭제-시-구독-처리)
8. [플랜 변경 중 기능 사용](#플랜-변경-중-기능-사용)

---

## 플랜 다운그레이드 시 초과 데이터 처리

### 시나리오

**상황**: Starter 플랜(내담자 50명 제한)에서 Free 플랜(내담자 10명 제한)으로 다운그레이드하려는데, 이미 내담자가 50명 등록되어 있음

**핵심 질문**:
- 다운그레이드를 허용해야 하는가?
- 허용한다면 기존 50명의 데이터를 어떻게 처리하는가?
- 사용자가 어떤 경험을 하게 되는가?

---

### 전략 A: 다운그레이드 차단 (Strict Enforcement)

**정책**: Quota 초과 상태에서는 다운그레이드 불가

**구현**:
```python
# app/modules/subscription/services/downgrade_service.py
async def execute(self, center_id: int, new_plan: str):
    # 1. 현재 플랜 확인
    subscription = await self.repo.get_by_center(center_id)

    # 2. 다운그레이드 가능 여부 검증
    if not self._is_downgrade_allowed(subscription.plan, new_plan):
        raise HTTPException(
            status_code=400,
            detail="Downgrade not allowed in current phase"
        )

    # 3. 초과 데이터 검증 (Application Handler에서 처리)
    await self._validate_no_quota_exceeded(center_id, new_plan)

    # 4. 다운그레이드 실행
    return await self.repo.update(subscription.id, {"plan": new_plan})

async def _validate_no_quota_exceeded(self, center_id: int, new_plan: str):
    """새 플랜의 Quota를 초과하는지 검증"""
    # Application Handler가 여러 모듈의 Repository 조회
    # - Client 모듈: 현재 내담자 수
    # - Therapist 모듈: 현재 상담사 수
    # - 등등...

    # 예시: 내담자 수 확인
    client_count = await client_repo.count_by_center(center_id)
    new_limit = PLAN_CONFIGS[new_plan]["limits"]["clients"]

    if new_limit and client_count > new_limit:
        raise HTTPException(
            status_code=400,
            detail={
                "message": f"Cannot downgrade to {new_plan}. You have {client_count} clients, but the limit is {new_limit}.",
                "exceeded_resources": {
                    "clients": {
                        "current": client_count,
                        "limit": new_limit,
                        "excess": client_count - new_limit
                    }
                },
                "actions_required": [
                    f"Delete {client_count - new_limit} clients before downgrading",
                    "Or upgrade to a higher plan"
                ]
            }
        )
```

**사용자 경험**:
```
[다운그레이드 시도]
→ 오류 메시지:
  "Free 플랜으로 다운그레이드할 수 없습니다.
   현재 내담자 50명이 등록되어 있지만, Free 플랜은 10명으로 제한됩니다.

   다운그레이드하려면:
   1. 40명의 내담자를 삭제하거나
   2. 더 높은 플랜을 선택하세요."

[사용자 액션]
→ 내담자 삭제 (50명 → 10명 이하)
→ 다시 다운그레이드 시도
→ 성공
```

**장점**:
- ✅ 명확한 정책: Quota 내에서만 운영
- ✅ 데이터 무결성: 플랜 제한과 실제 데이터 일치
- ✅ 구현 단순: 검증 로직만 추가

**단점**:
- ❌ 사용자 불편: 데이터 정리 작업 강제
- ❌ 이탈 위험: 다운그레이드 장벽이 높음
- ❌ 데이터 손실: 사용자가 의도치 않게 데이터 삭제 가능

---

### 전략 B: 읽기 전용 모드 (Read-Only Access)

**정책**: 다운그레이드 허용, 초과 데이터는 읽기만 가능

**구현**:
```python
# app/modules/subscription/models.py
class Subscription(Base):
    __tablename__ = "subscriptions"

    plan = Column(String(20), nullable=False)
    is_quota_exceeded = Column(Boolean, default=False)  # 추가 필드

# app/application/handlers/client_create.py
async def create_client_handler(data, uow, auth):
    async with uow:
        subscription = await subscription_repo.get_by_center(auth.center_id)

        # 1. Quota 초과 상태 확인
        if subscription.is_quota_exceeded:
            raise HTTPException(
                status_code=402,
                detail={
                    "message": "Your plan quota is exceeded. Upgrade to add more clients.",
                    "current_plan": subscription.plan,
                    "upgrade_url": "/subscription/upgrade"
                }
            )

        # 2. Quota 검증
        current_count = await client_repo.count_by_center(auth.center_id)
        limit = get_plan_limit(subscription.plan, "clients")

        if limit and current_count >= limit:
            raise HTTPException(status_code=402, detail="Client limit reached")

        # 3. 생성
        client = await client_service.execute(data)
        await uow.commit()
        return client

# app/modules/subscription/services/downgrade_service.py
async def execute(self, center_id: int, new_plan: str):
    # 1. 다운그레이드 실행
    subscription = await self.repo.get_by_center(center_id)
    await self.repo.update(subscription.id, {"plan": new_plan})

    # 2. 초과 여부 확인 및 플래그 설정
    is_exceeded = await self._check_quota_exceeded(center_id, new_plan)
    if is_exceeded:
        await self.repo.update(subscription.id, {
            "is_quota_exceeded": True
        })

    await uow.commit()
    return subscription

async def _check_quota_exceeded(self, center_id: int, new_plan: str) -> bool:
    """새 플랜의 Quota를 초과하는지 확인"""
    client_count = await client_repo.count_by_center(center_id)
    limit = PLAN_CONFIGS[new_plan]["limits"]["clients"]
    return limit and client_count > limit
```

**사용자 경험**:
```
[다운그레이드 성공]
→ 확인 메시지:
  "Free 플랜으로 다운그레이드되었습니다.
   현재 내담자 50명이 등록되어 있어 제한(10명)을 초과합니다.

   제한사항:
   - 기존 내담자: 조회 및 수정 가능
   - 새 내담자 추가: 불가능 (10명으로 줄일 때까지)

   내담자를 10명 이하로 줄이면 정상적으로 추가할 수 있습니다."

[대시보드 표시]
→ 경고 배너:
  "⚠️ 내담자 제한 초과 (50/10)
   새 내담자를 추가하려면 40명을 삭제하거나 플랜을 업그레이드하세요."
```

**장점**:
- ✅ 사용자 편의: 다운그레이드 즉시 가능
- ✅ 데이터 보존: 기존 데이터 유지
- ✅ 점진적 정리: 사용자가 천천히 데이터 정리 가능

**단점**:
- ❌ 구현 복잡도: `is_quota_exceeded` 플래그 관리 필요
- ❌ 비즈니스 로직 증가: 생성/수정 시마다 초과 상태 확인
- ❌ 악용 가능성: 무료 플랜으로 많은 데이터 유지

---

### 전략 C: 유예 기간 부여 (Grace Period)

**정책**: 다운그레이드 허용, 30일 유예 기간 내에 데이터 정리 필요

**구현**:
```python
# app/modules/subscription/models.py
class Subscription(Base):
    __tablename__ = "subscriptions"

    plan = Column(String(20), nullable=False)
    quota_exceeded_at = Column(DateTime, nullable=True)  # 초과 시작 시점
    grace_period_days = Column(Integer, default=30)      # 유예 일수

# app/modules/subscription/services/downgrade_service.py
async def execute(self, center_id: int, new_plan: str):
    subscription = await self.repo.get_by_center(center_id)

    # 1. 다운그레이드 실행
    await self.repo.update(subscription.id, {"plan": new_plan})

    # 2. 초과 여부 확인
    is_exceeded = await self._check_quota_exceeded(center_id, new_plan)
    if is_exceeded:
        await self.repo.update(subscription.id, {
            "quota_exceeded_at": datetime.now(timezone.utc)
        })

        # 3. 알림 전송 (Application Handler)
        await notification_service.send({
            "center_id": center_id,
            "type": "quota_exceeded_warning",
            "message": f"You have 30 days to reduce your data to match {new_plan} plan limits."
        })

    await uow.commit()
    return subscription

# app/application/handlers/client_create.py
async def create_client_handler(data, uow, auth):
    async with uow:
        subscription = await subscription_repo.get_by_center(auth.center_id)

        # 1. 유예 기간 확인
        if subscription.quota_exceeded_at:
            grace_end = subscription.quota_exceeded_at + timedelta(
                days=subscription.grace_period_days
            )
            now = datetime.now(timezone.utc)

            if now > grace_end:
                # 유예 기간 종료 → 생성 차단
                raise HTTPException(
                    status_code=402,
                    detail={
                        "message": "Grace period expired. Upgrade to add more clients.",
                        "grace_period_ended_at": grace_end.isoformat()
                    }
                )
            else:
                # 유예 기간 내 → 경고와 함께 허용
                days_left = (grace_end - now).days
                # 경고 로그 또는 응답에 포함
                pass

        # 2. 정상 생성 로직
        client = await client_service.execute(data)
        await uow.commit()
        return client
```

**사용자 경험**:
```
[다운그레이드 성공]
→ 확인 메시지:
  "Free 플랜으로 다운그레이드되었습니다.

   ⚠️ 현재 내담자 50명 (제한: 10명)
   30일 이내에 40명을 삭제해주세요.

   유예 기간 내:
   - 모든 기능 정상 사용 가능
   - 새 내담자 추가 가능 (경고와 함께)

   유예 기간 종료 후:
   - 새 내담자 추가 불가
   - 기존 내담자 조회/수정만 가능"

[대시보드 - D-Day 카운트다운]
→ "⚠️ Free 플랜 제한 준수까지 27일 남음 (50/10 내담자)"
```

**장점**:
- ✅ 사용자 친화적: 즉시 차단하지 않음
- ✅ 전환 유도: 유예 기간 내 업그레이드 기회 제공
- ✅ 데이터 정리 시간: 사용자가 계획적으로 정리 가능

**단점**:
- ❌ 구현 복잡도: 유예 기간 로직, 알림 시스템 필요
- ❌ 관리 부담: 유예 기간 종료 후 처리 필요
- ❌ 수익 손실: 30일간 무료로 초과 사용

---

### 전략 비교표

| 전략 | 다운그레이드 | 기존 데이터 | 새 데이터 추가 | 구현 난이도 | 사용자 경험 | 수익 영향 |
|------|------------|-----------|-------------|-----------|-----------|----------|
| **A. 차단** | 조건부 허용 | 삭제 강제 | 즉시 가능 | 낮음 | 불편 | 없음 |
| **B. 읽기 전용** | 즉시 허용 | 조회만 가능 | 불가 | 중간 | 보통 | 낮음 |
| **C. 유예 기간** | 즉시 허용 | 전체 가능 | 유예 기간 내 가능 | 높음 | 좋음 | 중간 |

---

### 권장 전략 (Phase별)

**Phase 1 (MVP)**:
- **전략 A (차단)** 채택
- 이유: 구현 단순, 명확한 정책, 데이터 무결성 보장
- 다운그레이드 자체를 지원하지 않으므로 문제 없음

**Phase 2 (다운그레이드 지원)**:
- **전략 C (유예 기간)** 채택
- 이유: 사용자 경험 중시, 전환 유도, 경쟁력 확보
- 유예 기간: 30일 (업계 표준)

**Phase 3 (고급 기능)**:
- **전략 C + 자동 아카이브** 조합
- 유예 기간 종료 시 초과 데이터 자동 아카이브
- 업그레이드 시 복원 가능

---

## Quota 초과 상태 관리

### 시나리오 1: 플랜 변경 없이 Quota 초과

**상황**: Starter 플랜(내담자 50명)에서 정상적으로 50명 등록 → 관리자가 실수로 플랜 설정을 변경 → 갑자기 Free 플랜(10명)으로 변경됨

**문제점**:
- 플랜 변경은 관리자 실수 또는 시스템 오류
- 사용자는 아무 액션 취하지 않았는데 제한 초과 상태

**해결 전략**:

```python
# app/modules/subscription/models.py
class SubscriptionHistory(Base):
    """구독 변경 이력 추적"""
    __tablename__ = "subscription_histories"

    id = Column(Integer, primary_key=True)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"))
    from_plan = Column(String(20), nullable=False)
    to_plan = Column(String(20), nullable=False)
    changed_by = Column(String(50), nullable=False)  # "user" | "admin" | "system"
    changed_at = Column(DateTime, nullable=False)
    reason = Column(Text, nullable=True)

# 정책: 사용자 의도 기반 처리
# - 사용자가 직접 다운그레이드 → 유예 기간 부여
# - 관리자/시스템 오류 → 즉시 복구 지원
```

---

### 시나리오 2: 결제 실패로 인한 자동 다운그레이드

**상황**: Pro 플랜 정기 결제 실패 → 3회 재시도 실패 → 자동으로 Free 플랜으로 다운그레이드 → 내담자 100명이 10명 제한 초과

**단계별 정책**:

**Day 0-3 (경고 단계)**:
- ✅ 모든 기능 사용 가능
- 🚨 강한 경고 배너 표시
- 📧 이메일/알림 매일 전송

**Day 4-7 (제한 단계)**:
- ✅ 기존 데이터: 읽기/수정 가능
- ⚠️ 신규 추가: Free Quota 내에서만 (내담자 10명 미만이면 추가 가능)
- 🚨 경고 배너 지속

**Day 8+ (차단 단계)**:
- ✅ 기존 데이터: 읽기만 가능
- ❌ 신규 추가/수정: 모두 차단
- 🔒 결제 수단 업데이트 시 즉시 복구

**구현**:

```python
# app/modules/subscription/services/auto_downgrade_service.py
async def execute(self, subscription_id: int):
    """결제 실패 시 자동 다운그레이드"""
    subscription = await self.repo.get(subscription_id)

    # 1. Free 플랜으로 다운그레이드
    await self.repo.update(subscription_id, {
        "plan": "free",
        "status": "payment_failed",  # 상태 추가
        "quota_exceeded_at": datetime.now(timezone.utc),
        "grace_period_days": 7  # 결제 실패 시 짧은 유예 기간
    })

    # 2. 긴급 알림 전송
    await notification_service.send({
        "center_id": subscription.center_id,
        "type": "payment_failed_urgent",
        "message": "결제 실패로 Free 플랜으로 전환되었습니다. 7일 내 결제 수단을 업데이트하지 않으면 기능이 제한됩니다.",
        "actions": [
            {"label": "결제 수단 업데이트", "url": "/billing/payment-methods"},
            {"label": "플랜 변경", "url": "/subscription/upgrade"}
        ]
    })

    # 3. 이력 기록
    await history_repo.create({
        "subscription_id": subscription_id,
        "from_plan": subscription.plan,
        "to_plan": "free",
        "changed_by": "system",
        "reason": "payment_failed_after_3_retries"
    })

# app/application/handlers/client_create.py
async def create_client_handler(data, uow, auth):
    async with uow:
        subscription = await subscription_repo.get_by_center(auth.center_id)

        # 1. 유예 기간 확인 (결제 실패 케이스)
        if subscription.status == "payment_failed" and subscription.quota_exceeded_at:
            grace_end = subscription.quota_exceeded_at + timedelta(
                days=subscription.grace_period_days
            )
            now = datetime.now(timezone.utc)
            days_since_failure = (now - subscription.quota_exceeded_at).days

            if days_since_failure < 3:
                # Day 0-3: 모든 기능 가능, 경고만
                logger.warning(f"Payment failed {days_since_failure} days ago")
                pass  # 정상 진행

            elif days_since_failure < 7:
                # Day 4-7: Free Quota 내에서만 허용
                current_count = await client_repo.count_by_center(auth.center_id)
                free_limit = get_plan_limit("free", "clients")

                if current_count >= free_limit:
                    raise HTTPException(
                        status_code=402,
                        detail={
                            "message": f"Payment failed. Only {free_limit} clients allowed during grace period.",
                            "days_left": 7 - days_since_failure,
                            "action": "Update payment method to restore full access"
                        }
                    )

            else:
                # Day 8+: 완전 차단
                raise HTTPException(
                    status_code=402,
                    detail={
                        "message": "Grace period expired. Update payment method to add clients.",
                        "grace_period_ended_at": grace_end.isoformat()
                    }
                )

        # 2. 정상 생성 로직
        client = await client_service.execute(data)
        await uow.commit()
        return client
```

**복구 시나리오**:

```python
# app/modules/subscription/handlers/update_payment_method.py
async def update_payment_method_handler(data, uow, auth):
    """결제 수단 업데이트 + 즉시 복구"""
    async with uow:
        subscription = await subscription_repo.get_by_center(auth.center_id)

        if subscription.status == "payment_failed":
            # 1. 결제 재시도
            payment_result = await payment_gateway.charge({
                "amount": get_plan_config(subscription.plan)["price"],
                "payment_method": data.payment_method
            })

            # 2. 성공 시 즉시 복구
            await subscription_repo.update(subscription.id, {
                "status": "active",
                "quota_exceeded_at": None,  # 초과 상태 해제
                "is_quota_exceeded": False
            })

            await uow.commit()

            return {
                "message": "Payment method updated. Full access restored.",
                "subscription": subscription
            }
```

---

### 시나리오 3: Soft Limit vs Hard Limit

**전략**: 리소스별로 다른 제한 정책 적용

```python
RESOURCE_LIMITS = {
    "clients": {
        "type": "hard",  # 정확히 제한
        "enforcement": "block_creation"
    },
    "therapists": {
        "type": "hard",
        "enforcement": "block_creation"
    },
    "storage_gb": {
        "type": "soft",  # 약간 초과 허용
        "overage_allowed": 1.1,  # 10% 초과 허용
        "enforcement": "warning_only"
    },
    "ai_reports_per_month": {
        "type": "hard",
        "enforcement": "block_usage",
        "reset_cycle": "monthly"
    }
}

# 구현 예시
async def check_storage_quota(center_id: int, new_file_size_mb: int):
    current_usage = await storage_service.get_usage(center_id)
    limit = get_plan_limit(plan, "storage_gb") * 1024  # GB → MB
    soft_limit = limit * 1.1  # 10% 초과 허용

    if current_usage + new_file_size_mb > soft_limit:
        raise HTTPException(status_code=402, detail="Storage limit exceeded")
    elif current_usage + new_file_size_mb > limit:
        # 경고만 표시, 업로드는 허용
        logger.warning(f"Center {center_id} exceeded storage quota")
```

---

## 결제 실패 및 롤백

### 시나리오 1: 플랜 업그레이드 중 결제 실패

**상황**: Free → Pro 업그레이드 시도 → 결제 실패 → DB는 이미 Pro로 업데이트됨

**문제점**:
- Subscription은 Pro로 업데이트
- 결제는 실패
- JWT는 아직 Free (재로그인 전까지)

**해결 전략 A: Two-Phase Commit Pattern**

```python
# app/modules/subscription/handlers/upgrade_handler.py
async def upgrade_handler(data: UpgradeRequest, uow, auth):
    async with uow:
        subscription = await subscription_repo.get_by_center(auth.center_id)

        # 1. 플랜 업그레이드 (pending 상태)
        await subscription_repo.update(subscription.id, {
            "plan": data.new_plan,
            "status": "pending_payment"  # 결제 대기 상태
        })
        await uow.commit()

    # 2. 결제 시도 (UoW 외부)
    try:
        payment_result = await payment_gateway.charge({
            "amount": PLAN_CONFIGS[data.new_plan]["price"],
            "payment_method": data.payment_method
        })
    except PaymentException as e:
        # 3. 결제 실패 → 롤백
        async with uow:
            await subscription_repo.update(subscription.id, {
                "plan": subscription.plan,  # 원래 플랜으로 복구
                "status": "active"
            })
            await uow.commit()

        raise HTTPException(
            status_code=402,
            detail={
                "message": "Payment failed. Your plan was not changed.",
                "error": str(e)
            }
        )

    # 4. 결제 성공 → 확정
    async with uow:
        await subscription_repo.update(subscription.id, {
            "status": "active",
            "started_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=30)
        })

        await payment_repo.create({
            "subscription_id": subscription.id,
            "amount": payment_result.amount,
            "status": "completed",
            "transaction_id": payment_result.transaction_id
        })

        await uow.commit()

    # 5. JWT 재발급
    new_token = await create_access_token_for_center(...)
    return {"access_token": new_token, "subscription": subscription}
```

**해결 전략 B: Idempotent Retry Pattern**

```python
# 결제 재시도 가능하도록 idempotency key 사용
payment_result = await payment_gateway.charge({
    "amount": PLAN_CONFIGS[data.new_plan]["price"],
    "idempotency_key": f"subscription_{subscription.id}_{datetime.now().date()}"
})

# 같은 날 같은 구독에 대한 중복 결제 방지
```

---

### 시나리오 2: 결제 성공 후 DB 업데이트 실패

**상황**: 결제는 성공 → DB 업데이트 중 서버 장애 → 결제는 완료되었으나 플랜은 변경 안됨

**해결 전략: 결제 내역 기반 복구**

```python
# app/modules/subscription/services/reconciliation_service.py
class ReconciliationService:
    """결제-구독 불일치 탐지 및 복구"""

    async def reconcile_subscription(self, subscription_id: int):
        """결제 내역과 구독 상태 일치 확인"""
        subscription = await subscription_repo.get(subscription_id)

        # 1. 최근 결제 내역 조회
        recent_payment = await payment_repo.get_latest_by_subscription(subscription_id)

        if not recent_payment:
            return

        # 2. 결제는 완료되었으나 구독 상태가 반영 안된 경우
        if (recent_payment.status == "completed" and
            subscription.plan != recent_payment.plan):

            logger.warning(
                f"Subscription {subscription_id} mismatch detected. "
                f"Payment plan: {recent_payment.plan}, "
                f"Subscription plan: {subscription.plan}"
            )

            # 3. 자동 복구
            await subscription_repo.update(subscription_id, {
                "plan": recent_payment.plan,
                "status": "active",
                "started_at": recent_payment.paid_at,
                "expires_at": recent_payment.paid_at + timedelta(days=30)
            })

            # 4. 관리자 알림
            await admin_notification_service.send({
                "type": "reconciliation_completed",
                "subscription_id": subscription_id,
                "details": "Subscription plan auto-recovered based on payment record"
            })

# Cron Job으로 주기적 실행
# 매일 03:00에 전체 구독 정합성 체크
```

---

## 구독 만료 처리

### 시나리오: Pro 플랜 만료 후 Free 플랜 전환

**상황**: Pro 플랜 만료일 도래 → 자동 갱신 실패 → Free 플랜으로 전환

**정책**:

| 시점 | 상태 | 사용자 액션 가능 여부 |
|------|------|---------------------|
| D-7 | active | 모든 기능 사용 가능, 만료 경고 표시 |
| D-3 | active | 모든 기능 사용 가능, 강한 경고 표시 |
| D-Day | expired | 읽기 전용 모드 (24시간 유예) |
| D+1 | expired | Free 플랜으로 자동 전환 |

**구현**:

```python
# app/modules/subscription/services/expiration_service.py
async def process_expired_subscriptions():
    """만료된 구독 처리 (매일 자정 실행)"""
    now = datetime.now(timezone.utc)

    # 1. 오늘 만료되는 구독 조회
    expiring_today = await subscription_repo.get_expiring_on(now.date())

    for subscription in expiring_today:
        # 2. 자동 갱신 시도
        if subscription.auto_renew:
            try:
                await auto_renew_service.execute(subscription.id)
                continue  # 성공 시 다음으로
            except PaymentException:
                pass  # 실패 시 만료 처리 진행

        # 3. 만료 상태로 변경
        await subscription_repo.update(subscription.id, {
            "status": "expired",
            "expired_at": now
        })

        # 4. 알림 전송
        await notification_service.send({
            "center_id": subscription.center_id,
            "type": "subscription_expired",
            "message": "구독이 만료되었습니다. 24시간 내 갱신하지 않으면 Free 플랜으로 전환됩니다."
        })

    # 5. 만료 24시간 경과 → Free 플랜 전환
    expired_over_24h = await subscription_repo.get_expired_over_hours(24)

    for subscription in expired_over_24h:
        await auto_downgrade_service.execute(
            subscription.id,
            target_plan="free",
            reason="expired_grace_period_ended"
        )
```

---

## JWT-DB 동기화 이슈

### 시나리오 1: JWT의 plan과 DB의 plan 불일치

**상황**:
1. 사용자가 로그인 → JWT에 `plan: "free"` 포함
2. 다른 기기에서 Pro 플랜 업그레이드
3. 첫 번째 기기는 여전히 `plan: "free"`인 JWT 사용

**문제점**:
- 실제로는 Pro 플랜이지만 JWT는 Free
- API 요청 시 `@require_plan(["pro"])` 데코레이터가 차단

**해결 전략 A: 짧은 Token 만료 시간**

```python
# app/core/config.py
ACCESS_TOKEN_EXPIRE_MINUTES = 15  # 15분마다 갱신 강제

# Frontend에서 자동 갱신
setInterval(async () => {
  const newToken = await refreshAccessToken();
  setAuthToken(newToken);
}, 14 * 60 * 1000);  // 14분마다
```

**해결 전략 B: DB 조회 캐싱 + 주기적 검증**

```python
# app/core/middleware.py
from functools import lru_cache

@lru_cache(maxsize=1000, ttl=60)  # 60초 캐시
async def get_center_plan(center_id: int) -> str:
    """센터의 현재 플랜 조회 (캐시됨)"""
    subscription = await subscription_repo.get_by_center(center_id)
    return subscription.plan

# 데코레이터에서 JWT + DB 병행 검증
def require_plan(allowed_plans: list[str]):
    async def decorator(func):
        async def wrapper(*args, **kwargs):
            auth = kwargs.get("auth")

            # 1. JWT 플랜 확인
            jwt_plan = auth.plan

            # 2. 중요 기능은 DB 플랜도 확인
            if is_critical_feature(func):
                db_plan = await get_center_plan(auth.center_id)
                if db_plan != jwt_plan:
                    # 불일치 감지 → JWT 무효화 강제
                    raise HTTPException(
                        status_code=401,
                        detail="Token expired. Please login again."
                    )
                current_plan = db_plan
            else:
                current_plan = jwt_plan

            # 3. 플랜 검증
            if current_plan not in allowed_plans:
                raise HTTPException(status_code=402, detail="...")

            return await func(*args, **kwargs)
        return wrapper
    return decorator
```

**해결 전략 C: WebSocket 또는 Server-Sent Events로 실시간 동기화**

```python
# Frontend에서 SSE 연결
const eventSource = new EventSource('/api/subscription/events');

eventSource.addEventListener('plan_changed', (event) => {
  const newPlan = JSON.parse(event.data).plan;
  // JWT 즉시 갱신 요청
  refreshAccessToken();
});

# Backend에서 플랜 변경 시 이벤트 발행
async def upgrade_handler(...):
    # ... 플랜 업그레이드 로직

    # SSE 이벤트 발행
    await sse_service.publish({
        "center_id": auth.center_id,
        "event": "plan_changed",
        "data": {"plan": new_plan}
    })
```

---

### 시나리오 2: 로그아웃 없이 플랜 변경 반영

**상황**: 관리자가 플랜 업그레이드 → 새로고침 없이 즉시 Pro 기능 사용하고 싶음

**해결 전략: Optimistic UI Update + Background Token Refresh**

```typescript
// Frontend: 플랜 업그레이드 후
async function upgradeSubscription(newPlan: string) {
  // 1. API 호출
  const response = await api.post('/subscription/upgrade', { plan: newPlan });

  // 2. 새 토큰 저장
  setAuthToken(response.access_token);

  // 3. 즉시 UI 업데이트 (새로고침 불필요)
  queryClient.invalidateQueries(['subscription']);
  queryClient.setQueryData(['auth'], (old) => ({
    ...old,
    plan: newPlan
  }));

  // 4. 성공 메시지
  toast.success('플랜이 업그레이드되었습니다. 모든 기능을 사용할 수 있습니다.');
}
```

---

## Race Condition 시나리오

### 시나리오 1: 동시 내담자 생성 요청

**상황**: Starter 플랜(50명 제한)에서 현재 49명 등록 → 2개의 API 요청이 동시에 들어옴

```
Request A: POST /clients → count = 49 → 49 < 50 → 생성 허용
Request B: POST /clients → count = 49 → 49 < 50 → 생성 허용
→ 결과: 51명 등록됨 (제한 초과!)
```

**해결 전략 A: DB Row Lock**

```python
# app/modules/subscription/repository.py
async def get_by_center_for_update(self, center_id: int):
    """SELECT FOR UPDATE로 행 잠금"""
    result = await self._session.execute(
        select(Subscription)
        .where(Subscription.center_id == center_id)
        .with_for_update()  # 행 잠금
    )
    return result.scalar_one_or_none()

# Handler
async def create_client_handler(data, uow, auth):
    async with uow:
        # 1. Subscription 잠금
        subscription = await subscription_repo.get_by_center_for_update(auth.center_id)

        # 2. Quota 검증 (잠금 상태에서 안전하게 확인)
        current_count = await client_repo.count_by_center(auth.center_id)
        limit = get_plan_limit(subscription.plan, "clients")

        if limit and current_count >= limit:
            raise HTTPException(status_code=402, detail="Client limit reached")

        # 3. 생성
        client = await client_service.execute(data)
        await uow.commit()  # 잠금 해제
        return client
```

**해결 전략 B: Optimistic Locking**

```python
# app/modules/subscription/models.py
class Subscription(Base):
    __tablename__ = "subscriptions"

    version = Column(Integer, default=1, nullable=False)  # 버전 필드 추가

# Repository
async def update_with_version_check(self, subscription_id: int, data: dict, expected_version: int):
    """낙관적 잠금으로 업데이트"""
    result = await self._session.execute(
        update(Subscription)
        .where(
            Subscription.id == subscription_id,
            Subscription.version == expected_version
        )
        .values(**data, version=expected_version + 1)
    )

    if result.rowcount == 0:
        raise HTTPException(
            status_code=409,
            detail="Subscription was modified by another request. Please retry."
        )
```

**해결 전략 C: Redis Distributed Lock**

```python
from redis import asyncio as aioredis

async def create_client_handler(data, uow, auth):
    # 1. Redis Lock 획득
    lock_key = f"center:{auth.center_id}:client_creation"
    async with redis_lock(lock_key, timeout=5):
        async with uow:
            # 2. Quota 검증
            current_count = await client_repo.count_by_center(auth.center_id)
            limit = get_plan_limit(auth.plan, "clients")

            if limit and current_count >= limit:
                raise HTTPException(status_code=402, detail="Client limit reached")

            # 3. 생성
            client = await client_service.execute(data)
            await uow.commit()
            return client
```

**성능 비교**:

| 전략 | 동시성 | 성능 | 확장성 | 구현 난이도 |
|------|-------|------|--------|-----------|
| **DB Row Lock** | 순차 처리 | 중간 | 중간 | 낮음 |
| **Optimistic Lock** | 동시 처리 | 높음 | 높음 | 중간 |
| **Redis Lock** | 순차 처리 | 높음 | 매우 높음 | 높음 |

**권장**: Phase 1은 DB Row Lock, Phase 2는 Redis Lock

---

### 시나리오 2: 플랜 업그레이드 중 기능 사용

**상황**:
1. 사용자가 Pro 플랜 업그레이드 시작
2. DB는 `plan: "pro"`, `status: "pending_payment"`
3. 다른 탭에서 AI 보고서 생성 시도

**문제점**:
- DB plan은 "pro"이지만 아직 결제 미완료
- `@require_plan(["pro"])` 통과 → AI 기능 사용 가능
- 결제 실패 시 롤백 → 무료 사용

**해결 전략: status 필드 활용**

```python
def require_plan(allowed_plans: list[str]):
    async def decorator(func):
        async def wrapper(*args, **kwargs):
            auth = kwargs.get("auth")

            # 1. DB에서 구독 상태 확인 (캐시됨)
            subscription = await get_subscription_cached(auth.center_id)

            # 2. status 검증
            if subscription.status != "active":
                raise HTTPException(
                    status_code=402,
                    detail={
                        "message": "Subscription is not active",
                        "status": subscription.status,
                        "action": "Please complete payment or contact support"
                    }
                )

            # 3. 플랜 검증
            if subscription.plan not in allowed_plans:
                raise HTTPException(status_code=402, detail="...")

            return await func(*args, **kwargs)
        return wrapper
    return decorator
```

---

## 센터 삭제 시 구독 처리

### 시나리오: 활성 구독이 있는 센터 삭제 요청

**상황**: Pro 플랜 구독 중인 센터 → 센터 관리자가 센터 삭제 요청

**비즈니스 정책**:
1. **즉시 삭제 차단**: 활성 구독이 있으면 삭제 불가
2. **구독 취소 후 삭제**: 구독 먼저 취소 → 환불 처리 → 센터 삭제

**구현**:

```python
# app/application/handlers/delete_center.py
async def delete_center_handler(center_id: int, uow, auth):
    """센터 삭제 (구독 검증 포함)"""
    async with uow:
        # 1. 구독 확인
        subscription = await subscription_repo.get_by_center(center_id)

        if subscription and subscription.status == "active":
            # 2. 활성 구독 존재 → 삭제 차단
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "Cannot delete center with active subscription",
                    "subscription": {
                        "plan": subscription.plan,
                        "expires_at": subscription.expires_at
                    },
                    "actions_required": [
                        "Cancel subscription first",
                        "Or wait until subscription expires"
                    ],
                    "cancel_url": "/subscription/cancel"
                }
            )

        # 3. 구독 없음 or 만료됨 → 삭제 진행
        # ... 센터 삭제 로직
        await center_service.delete(center_id)
        await uow.commit()

# app/modules/subscription/handlers/cancel_subscription.py
async def cancel_subscription_handler(uow, auth):
    """구독 취소 + 환불"""
    async with uow:
        subscription = await subscription_repo.get_by_center(auth.center_id)

        # 1. 환불 계산
        remaining_days = (subscription.expires_at - datetime.now(timezone.utc)).days
        refund_amount = calculate_prorated_refund(
            subscription.plan,
            remaining_days,
            subscription.started_at
        )

        # 2. 환불 처리
        if refund_amount > 0:
            await payment_gateway.refund({
                "amount": refund_amount,
                "subscription_id": subscription.id
            })

        # 3. 구독 취소
        await subscription_repo.update(subscription.id, {
            "status": "cancelled",
            "cancelled_at": datetime.now(timezone.utc)
        })

        # 4. Free 플랜으로 전환 (즉시)
        await subscription_repo.update(subscription.id, {
            "plan": "free"
        })

        await uow.commit()

        return {
            "message": "Subscription cancelled successfully",
            "refund_amount": refund_amount,
            "new_plan": "free"
        }
```

---

## 플랜 변경 중 기능 사용

### 시나리오: 업그레이드 트랜잭션 중 API 요청

**상황**:
1. 관리자가 Free → Pro 업그레이드 시작
2. DB 트랜잭션 진행 중 (`plan: "pro"`, `status: "pending_payment"`)
3. 다른 사용자가 AI 보고서 생성 요청

**타임라인**:
```
T0: 업그레이드 시작 → DB plan = "pro", status = "pending_payment"
T1: 결제 처리 중 (외부 API 호출, 5초 소요)
T2: 다른 사용자가 AI 보고서 생성 요청 → plan = "pro" 확인 → 허용?
T3: 결제 실패 → 롤백 → plan = "free"
```

**문제점**:
- T2 시점에 Pro 기능 사용 허용하면 안 됨
- 하지만 DB에는 `plan: "pro"`로 저장되어 있음

**해결 전략: status 기반 기능 제어**

```python
# app/core/middleware.py
ALLOWED_STATUSES_FOR_FEATURES = ["active"]

def require_plan(allowed_plans: list[str]):
    async def decorator(func):
        async def wrapper(*args, **kwargs):
            auth = kwargs.get("auth")

            # 1. DB 조회 (캐시 활용)
            subscription = await get_subscription_cached(auth.center_id)

            # 2. status 우선 검증
            if subscription.status not in ALLOWED_STATUSES_FOR_FEATURES:
                raise HTTPException(
                    status_code=402,
                    detail={
                        "message": "Feature temporarily unavailable",
                        "reason": f"Subscription status is {subscription.status}",
                        "allowed_statuses": ALLOWED_STATUSES_FOR_FEATURES
                    }
                )

            # 3. plan 검증
            if subscription.plan not in allowed_plans:
                raise HTTPException(status_code=402, detail="Plan upgrade required")

            return await func(*args, **kwargs)
        return wrapper
    return decorator
```

**Subscription Status 상태도**:
```
┌─────────────────────────────────────────────────────────┐
│                  Subscription Status                    │
├─────────────────────────────────────────────────────────┤
│ active            → 모든 기능 사용 가능                    │
│ pending_payment   → 결제 대기, 기능 사용 불가               │
│ payment_failed    → 결제 실패, 읽기 전용                   │
│ expired           → 만료, 유예 기간 (읽기 전용)             │
│ cancelled         → 취소됨, Free 플랜 전환                 │
└─────────────────────────────────────────────────────────┘
```

---

## 종합 정리

### 엣지 케이스 우선순위

| 우선순위 | 엣지 케이스 | Phase 1 | Phase 2 | Phase 3 |
|---------|-----------|---------|---------|---------|
| **P0 (Critical)** | Race Condition (동시 생성) | ✅ DB Lock | ✅ Redis Lock | - |
| **P0** | 결제 실패 롤백 | ✅ Two-Phase Commit | - | - |
| **P0** | JWT-DB 불일치 | ✅ 짧은 만료 시간 | ✅ DB 검증 | ✅ SSE 동기화 |
| **P1 (High)** | 구독 만료 처리 | ✅ 기본 정책 | ✅ 유예 기간 | - |
| **P1** | 센터 삭제 시 구독 | ✅ 차단 정책 | ✅ 환불 처리 | - |
| **P2 (Medium)** | 플랜 다운그레이드 | ❌ 미지원 | ✅ 유예 기간 | ✅ 자동 아카이브 |
| **P2** | Quota 초과 관리 | - | ✅ Soft Limit | ✅ 자동 정리 |
| **P3 (Low)** | 정합성 체크 | - | ✅ 일일 배치 | ✅ 실시간 모니터링 |

### Phase별 구현 전략

**Phase 1 (MVP)**:
- 다운그레이드 미지원 (업그레이드만)
- DB Row Lock으로 Race Condition 방지
- Two-Phase Commit으로 결제 실패 처리
- 짧은 JWT 만료 시간 (15분)

**Phase 2 (확장)**:
- 다운그레이드 지원 (유예 기간 30일)
- Redis Lock으로 성능 개선
- DB 검증 + 캐싱으로 JWT 동기화
- Soft Limit 정책 적용

**Phase 3 (고급)**:
- 자동 아카이브/복구 시스템
- SSE로 실시간 동기화
- ML 기반 Quota 예측 및 경고
- 실시간 정합성 모니터링
