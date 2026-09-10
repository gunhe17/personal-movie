# Counseling 도메인 엣지 케이스

> Counseling 도메인의 복잡한 엣지 케이스 및 해결 전략

---

## 목차

1. [참여자 최소 인원 미충족](#참여자-최소-인원-미충족)
2. [상담사 전원 이탈 시 케이스 처리](#상담사-전원-이탈-시-케이스-처리)
3. [동시 Session 생성 (Race Condition)](#동시-session-생성-race-condition)
4. [케이스 종결 후 Session 상태 불일치](#케이스-종결-후-session-상태-불일치)
5. [Schedule 삭제 시 Session 처리](#schedule-삭제-시-session-처리)
6. [집단상담 참여자 대량 변경](#집단상담-참여자-대량-변경)
7. [세션 출석과 케이스 참여 불일치](#세션-출석과-케이스-참여-불일치)
8. [상담사 센터 탈퇴 시 케이스 처리](#상담사-센터-탈퇴-시-케이스-처리)
9. [내담자 삭제 시 케이스 처리](#내담자-삭제-시-케이스-처리)
10. [종결된 케이스와 상담 이력 조회](#종결된-케이스와-상담-이력-조회)

---

## 참여자 최소 인원 미충족

### 시나리오

**상황**: 개인상담 케이스에서 유일한 상담사를 제거하려고 시도

**핵심 질문**:
- 상담사/내담자가 0명인 케이스를 허용해야 하는가?
- 최소 인원 검증은 어느 시점에 해야 하는가?

---

### 전략: 최소 인원 강제 (Strict Enforcement)

**정책**: 케이스는 항상 최소 1명의 상담사와 1명의 내담자를 유지해야 함

**구현**:
```python
# app/modules/counseling/case_participant/handlers/remove_participant.py
async def remove_participant_handler(
    center_id: str,
    case_id: str,
    participant_type: str,
    participant_id: str,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        participant_repo = uow.repo(CounselingCaseParticipantRepository)

        # 1. 현재 활성 참여자 수 확인
        active_count = await participant_repo.count_active_by_type(
            case_id, participant_type
        )

        # 2. 최소 인원 검증
        if active_count <= 1:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": f"최소 1명의 {participant_type}가 필요합니다",
                    "current_count": active_count,
                    "participant_type": participant_type,
                    "actions_required": [
                        f"새로운 {participant_type}를 먼저 추가하세요",
                        "또는 케이스를 종결/취소하세요"
                    ]
                }
            )

        # 3. unassigned_at 설정 (삭제 대신 이력 보존)
        await participant_repo.unassign(case_id, participant_type, participant_id)
        await uow.commit()
```

**사용자 경험**:
```
[상담사 제거 시도]
→ 오류 메시지:
  "상담사를 제거할 수 없습니다.
   케이스에는 최소 1명의 상담사가 필요합니다.

   다음 중 하나를 선택하세요:
   1. 새로운 상담사를 먼저 추가
   2. 케이스 종결 또는 취소"
```

---

### 케이스 생성 시 검증

```python
# app/modules/counseling/case/handlers/create_case.py
async def create_counseling_case_handler(
    center_id: str,
    data: CounselingCaseCreate,
    uow: UnitOfWork = Depends(get_uow),
):
    # 1. 최소 인원 검증
    if not data.client_ids or len(data.client_ids) == 0:
        raise HTTPException(
            status_code=400,
            detail="최소 1명의 내담자가 필요합니다"
        )

    if not data.counselor_ids or len(data.counselor_ids) == 0:
        raise HTTPException(
            status_code=400,
            detail="최소 1명의 상담사가 필요합니다"
        )

    # 2. 케이스 및 참여자 생성
    # ...
```

---

## 상담사 전원 이탈 시 케이스 처리

### 시나리오

**상황**: 2명의 상담사가 참여하는 케이스에서 1명 제거 후, 남은 1명도 센터를 퇴사

**문제점**:
- 상담사 제거 API는 최소 1명 검증으로 차단
- 하지만 센터 멤버 탈퇴 시 자동으로 상담사 0명 상태 가능

**해결 전략**:

```python
# app/application/handlers/remove_center_member.py
async def remove_center_member_handler(
    center_id: str,
    member_id: str,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        # 1. 해당 멤버가 참여 중인 케이스 조회
        participant_repo = uow.repo(CounselingCaseParticipantRepository)
        active_cases = await participant_repo.get_active_cases_by_counselor(member_id)

        cases_without_counselor = []

        for case in active_cases:
            # 2. 해당 케이스의 다른 활성 상담사 수 확인
            other_counselors = await participant_repo.count_active_by_type_excluding(
                case.id, "counselor", member_id
            )

            if other_counselors == 0:
                cases_without_counselor.append(case)

        # 3. 상담사 없는 케이스가 있으면 경고
        if cases_without_counselor:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "이 상담사가 유일한 담당자인 케이스가 있습니다",
                    "affected_cases": [
                        {
                            "case_id": c.id,
                            "client_count": c.client_count,
                            "session_count": c.session_count
                        }
                        for c in cases_without_counselor
                    ],
                    "actions_required": [
                        "영향받는 케이스에 새 상담사를 먼저 배정하세요",
                        "또는 케이스를 종결/취소하세요"
                    ]
                }
            )

        # 4. 멤버 탈퇴 처리
        # ...
```

---

## 동시 Session 생성 (Race Condition)

### 시나리오

**상황**: 같은 케이스에 대해 두 명의 상담사가 동시에 Session 생성 요청

```
Request A: POST /sessions → session_number = max(0) + 1 = 1
Request B: POST /sessions → session_number = max(0) + 1 = 1
→ 결과: session_number = 1이 2개 생성됨 (중복!)
```

---

### 해결 전략 A: DB Row Lock

```python
# app/modules/counseling/session/repository.py
async def get_max_session_number_for_update(self, case_id: str) -> int:
    """SELECT FOR UPDATE로 행 잠금"""
    result = await self._session.execute(
        select(func.max(CounselingSession.session_number))
        .where(CounselingSession.counseling_case_id == case_id)
        .with_for_update()  # 행 잠금
    )
    return result.scalar() or 0

# Handler
async def create_session_handler(data, uow, auth):
    async with uow:
        session_repo = uow.repo(CounselingSessionRepository)

        # 1. 잠금 상태에서 최대 번호 조회
        max_number = await session_repo.get_max_session_number_for_update(
            data.counseling_case_id
        )

        # 2. 번호 할당 (잠금 상태에서 안전)
        session_number = max_number + 1

        # 3. Session 생성
        session = await session_repo.create({
            "counseling_case_id": data.counseling_case_id,
            "session_number": session_number,
            # ...
        })

        await uow.commit()  # 잠금 해제
        return session
```

---

### 해결 전략 B: Unique Constraint + Retry

```python
# DB 스키마
# UNIQUE(counseling_case_id, session_number) 제약조건

# Handler
from sqlalchemy.exc import IntegrityError

async def create_session_handler(data, uow, auth):
    max_retries = 3

    for attempt in range(max_retries):
        try:
            async with uow:
                session_repo = uow.repo(CounselingSessionRepository)

                # 1. 최대 번호 조회
                max_number = await session_repo.get_max_session_number(
                    data.counseling_case_id
                )
                session_number = max_number + 1

                # 2. Session 생성 시도
                session = await session_repo.create({
                    "counseling_case_id": data.counseling_case_id,
                    "session_number": session_number,
                    # ...
                })

                await uow.commit()
                return session

        except IntegrityError:
            # 중복 발생 → 재시도
            if attempt == max_retries - 1:
                raise HTTPException(
                    status_code=409,
                    detail="세션 생성 충돌. 잠시 후 다시 시도해주세요."
                )
            await asyncio.sleep(0.1 * (attempt + 1))  # 백오프
```

---

### 성능 비교

| 전략 | 동시성 | 성능 | 구현 난이도 | 권장 상황 |
|------|-------|------|-----------|----------|
| **DB Row Lock** | 순차 처리 | 중간 | 낮음 | 일반적 케이스 |
| **Unique + Retry** | 동시 처리 | 높음 | 중간 | 고부하 환경 |

**권장**: Phase 1은 DB Row Lock, Phase 2는 Unique + Retry

---

## 케이스 종결 후 Session 상태 불일치

### 시나리오

**상황**:
1. 케이스에 Session 3개 존재 (COMPLETED, COMPLETED, SCHEDULED)
2. 관리자가 케이스 종결 (ACTIVE → COMPLETED)
3. Session 3은 여전히 SCHEDULED 상태

**문제점**:
- 종결된 케이스에 예약된 Session 존재
- 사용자 혼란 및 데이터 불일치

---

### 해결 전략 A: 종결 시 경고 (Soft Block)

```python
# app/modules/counseling/case/handlers/complete_case.py
async def complete_counseling_case_handler(
    case_id: str,
    data: CounselingCaseCompleteRequest,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        # 1. 예약된 Session 확인
        session_repo = uow.repo(CounselingSessionRepository)
        scheduled_sessions = await session_repo.get_by_status(
            case_id, status="SCHEDULED"
        )

        if scheduled_sessions:
            # 2. 경고와 함께 처리 옵션 제공
            return {
                "warning": True,
                "message": f"{len(scheduled_sessions)}개의 예약된 세션이 있습니다",
                "scheduled_sessions": [
                    {
                        "id": s.id,
                        "session_number": s.session_number,
                        "scheduled_at": s.scheduled_at
                    }
                    for s in scheduled_sessions
                ],
                "options": [
                    {"action": "cancel_sessions", "label": "예약 세션 취소 후 종결"},
                    {"action": "force_complete", "label": "경고 무시하고 종결"},
                    {"action": "abort", "label": "종결 취소"}
                ]
            }

        # 3. 정상 종결
        case_repo = uow.repo(CounselingCaseRepository)
        await case_repo.update(case_id, {"status": "COMPLETED"})
        await uow.commit()
```

---

## Schedule 삭제 시 Session 처리

### 시나리오

**상황**: Schedule 도메인에서 일정 삭제 → 연결된 CounselingSession은?

**문제점**:
- ScheduledRelation 중간 테이블로 연결된 Session이 있을 때 Schedule 삭제 시 처리 방안
- CASCADE로 ScheduledRelation은 삭제되지만 Session은 유지됨
- 상담 기록 손실 없이 일정 정보만 해제

---

### 해결 전략: ScheduledRelation CASCADE 삭제 + Session 상태 변경

**정책**: Schedule 삭제 시 ScheduledRelation CASCADE 삭제, Session은 유지하되 상태 변경

```python
# app/modules/schedule/handlers/delete_schedule.py
async def delete_schedule_handler(
    schedule_id: str,
    uow: UnitOfWork = Depends(get_uow),
):
    """Schedule 삭제 - ScheduledRelation CASCADE 삭제, Session 상태 업데이트"""
    async with uow:
        schedule_repo = uow.repo(ScheduleRepository)
        relation_repo = uow.repo(ScheduledRelationRepository)

        # 1. Schedule 존재 확인
        schedule = await schedule_repo.get(schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")

        # 2. 연결된 Session 확인 (ScheduledRelation 조회)
        relations = await relation_repo.get_by_schedule_id(schedule_id)

        # 3. 연결된 Session들 상태 업데이트 (SCHEDULED → CANCELLED)
        if relations:
            session_repo = uow.repo(CounselingSessionRepository)
            for rel in relations:
                if rel.scheduled_resource_type == "counseling":
                    session = await session_repo.get(rel.scheduled_resource_id)
                    if session and session.status == "SCHEDULED":
                        await session_repo.update(session.id, {
                            "status": "CANCELLED"
                        })

        # 4. Schedule 삭제 (ScheduledRelation CASCADE 삭제됨)
        await schedule_repo.delete(schedule_id)
        await uow.commit()

        return {
            "message": "Schedule deleted successfully",
            "affected_sessions": len(relations)
        }
```

**대안 처리 - 삭제 차단 (Optional)**:
```python
# 연결된 Session이 있으면 삭제 차단하는 방식 (더 엄격한 정책)
async def delete_schedule_strict_handler(
    schedule_id: str,
    uow: UnitOfWork = Depends(get_uow),
):
    """Schedule 삭제 (엄격) - Session 연결 시 차단"""
    async with uow:
        schedule_repo = uow.repo(ScheduleRepository)
        relation_repo = uow.repo(ScheduledRelationRepository)

        # 1. Schedule 존재 확인
        schedule = await schedule_repo.get(schedule_id)
        if not schedule:
            raise HTTPException(status_code=404, detail="Schedule not found")

        # 2. 연결된 Session 확인
        relations = await relation_repo.get_by_schedule_id(schedule_id)

        if relations:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "세션이 연결된 일정은 삭제할 수 없습니다",
                    "linked_sessions": [
                        {
                            "resource_type": rel.scheduled_resource_type,
                            "resource_id": rel.scheduled_resource_id
                        }
                        for rel in relations
                    ],
                    "actions_required": [
                        "세션을 먼저 취소하거나 삭제하세요",
                        "또는 일정을 '취소' 상태로 변경하세요 (상태가 있는 경우)"
                    ]
                }
            )

        # 3. Session 없으면 삭제 진행
        await schedule_repo.delete(schedule_id)
        await uow.commit()

        return {"message": "Schedule deleted successfully"}
```

**DB 스키마 (ScheduledRelation)**:
```sql
-- ScheduledRelation: Schedule 삭제 시 CASCADE
CREATE TABLE scheduled_relations (
    schedule_id VARCHAR(36) NOT NULL,
    scheduled_resource_type VARCHAR(20) NOT NULL,
    scheduled_resource_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (schedule_id, scheduled_resource_type, scheduled_resource_id),
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
);

-- Session 테이블에는 schedule_id FK 없음 (ScheduledRelation으로 연결)
```

### 정책 비교

| 정책 | 장점 | 단점 |
|------|------|------|
| **CASCADE + 상태변경 (채택)** | 데이터 유지, 일정만 해제 | Session 상태 업데이트 필요 |
| 삭제 차단 (Strict) | 완전한 무결성 보장 | 삭제 전 Session 처리 필요 |
| 연결 해제 (Soft Unlink) | 유연함 | Session이 일정 정보를 잃음 |

---

## 집단상담 참여자 대량 변경

### 시나리오

**상황**: 집단상담 케이스 (10명 참여) → 5명 추가 + 3명 제거 요청

**문제점**:
- 여러 참여자 변경이 트랜잭션 중 일부 실패
- 부분 성공 시 롤백 필요

---

### 해결 전략: Batch 처리 + All-or-Nothing

```python
# app/modules/counseling/case_participant/handlers/batch_update.py
async def batch_update_participants_handler(
    case_id: str,
    data: ParticipantBatchUpdate,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        participant_repo = uow.repo(CounselingCaseParticipantRepository)

        # 1. 사전 검증 (모든 변경 가능 여부 확인)
        validation_errors = []

        # 추가할 참여자 검증
        for add in data.add_participants:
            exists = await participant_repo.exists(
                case_id, add.participant_type, add.participant_id
            )
            if exists:
                validation_errors.append({
                    "action": "add",
                    "participant_id": add.participant_id,
                    "error": "이미 참여 중입니다"
                })

        # 제거할 참여자 검증
        for remove in data.remove_participants:
            # 최소 인원 검증
            remaining = await participant_repo.count_active_by_type(
                case_id, remove.participant_type
            )
            remove_count = len([
                r for r in data.remove_participants
                if r.participant_type == remove.participant_type
            ])

            if remaining - remove_count < 1:
                validation_errors.append({
                    "action": "remove",
                    "participant_type": remove.participant_type,
                    "error": f"최소 1명의 {remove.participant_type}가 필요합니다"
                })

        # 2. 검증 실패 시 전체 거부
        if validation_errors:
            raise HTTPException(
                status_code=400,
                detail={
                    "message": "일부 변경을 적용할 수 없습니다",
                    "errors": validation_errors
                }
            )

        # 3. 모든 변경 적용 (트랜잭션)
        added = []
        removed = []

        for add in data.add_participants:
            participant = await participant_repo.create({
                "counseling_case_id": case_id,
                "participant_type": add.participant_type,
                "participant_id": add.participant_id,
                "assigned_at": datetime.utcnow()
            })
            added.append(participant)

        for remove in data.remove_participants:
            await participant_repo.unassign(
                case_id, remove.participant_type, remove.participant_id
            )
            removed.append(remove)

        await uow.commit()

        return {
            "message": "참여자가 업데이트되었습니다",
            "added": len(added),
            "removed": len(removed)
        }
```
---

## 상담사 센터 탈퇴 시 케이스 처리

### 시나리오

**상황**: 센터 멤버(상담사)가 센터에서 탈퇴 → 진행 중인 케이스 처리

**비즈니스 정책**:

| 정책 | 설명 | 장단점 |
|------|------|--------|
| **A. 차단** | 활성 케이스 있으면 탈퇴 불가 | 데이터 정합성 ↑, 사용자 불편 |
| **B. 자동 이관** | 센터장에게 케이스 자동 이관 | 편리, 무책임 이관 가능 |
| **C. 명시적 인계** | 인계자 지정 후 탈퇴 가능 | 책임 명확, 프로세스 복잡 |

---

### 해결 전략: 명시적 인계 (권장)

```python
# app/application/handlers/leave_center.py
async def leave_center_handler(
    center_id: str,
    member_id: str,
    data: LeaveCenterRequest,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        participant_repo = uow.repo(CounselingCaseParticipantRepository)

        # 1. 담당 중인 활성 케이스 조회
        active_cases = await participant_repo.get_active_cases_by_counselor(member_id)

        if active_cases:
            # 2. 인계자 지정 필수
            if not data.handover_to:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "message": "담당 케이스가 있어 인계자를 지정해야 합니다",
                        "active_cases": [
                            {"id": c.id, "client_count": c.client_count}
                            for c in active_cases
                        ],
                        "required_field": "handover_to"
                    }
                )

            # 3. 인계자 검증
            member_repo = uow.repo(CenterMemberRepository)
            handover_member = await member_repo.get(data.handover_to)

            if not handover_member or handover_member.center_id != center_id:
                raise HTTPException(
                    status_code=404,
                    detail="인계자를 찾을 수 없습니다"
                )

            # 4. 케이스 인계 처리
            for case in active_cases:
                # 기존 상담사 unassign
                await participant_repo.unassign(
                    case.id, "counselor", member_id
                )

                # 새 상담사 assign
                await participant_repo.create({
                    "counseling_case_id": case.id,
                    "participant_type": "counselor",
                    "participant_id": data.handover_to,
                    "assigned_at": datetime.utcnow()
                })

            # 5. 인계 기록
            await handover_log_repo.create({
                "from_member_id": member_id,
                "to_member_id": data.handover_to,
                "case_ids": [c.id for c in active_cases],
                "reason": data.reason or "member_leave"
            })

        # 6. 센터 탈퇴 처리
        await member_repo.update(member_id, {
            "status": "LEFT",
            "left_at": datetime.utcnow()
        })

        await uow.commit()

        return {"message": "센터 탈퇴가 완료되었습니다"}
```

---

## 내담자 삭제 시 케이스 처리

### 시나리오

**상황**: 내담자(Client) 삭제 요청 → 진행 중인 케이스 존재

**비즈니스 정책**:
- 상담 기록 보존 의무 (법적 요구사항)
- 내담자 정보 삭제 권리 (개인정보보호법)

---

### 해결 전략: Soft Delete + 익명화

```python
# app/modules/client/handlers/delete_client.py
async def delete_client_handler(
    center_id: str,
    client_id: str,
    uow: UnitOfWork = Depends(get_uow),
):
    async with uow:
        # 1. 연관 케이스 확인
        participant_repo = uow.repo(CounselingCaseParticipantRepository)
        related_cases = await participant_repo.get_cases_by_client(client_id)

        if related_cases:
            # 2. 활성 케이스 있는지 확인
            active_cases = [c for c in related_cases if c.status == "ACTIVE"]

            if active_cases:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "message": "진행 중인 케이스가 있어 삭제할 수 없습니다",
                        "active_cases": [c.id for c in active_cases],
                        "actions_required": [
                            "진행 중인 케이스를 먼저 종결하세요"
                        ]
                    }
                )

            # 3. 종결된 케이스만 있는 경우 → 익명화
            client_repo = uow.repo(ClientRepository)
            await client_repo.anonymize(client_id, {
                "name": "삭제된 내담자",
                "contact_phone": None,
                "contact_email": None,
                "birth_date": None,
                "is_deleted": True,
                "deleted_at": datetime.utcnow()
            })

            # 4. 케이스 참여 정보는 유지 (기록 보존)
            # participant_id는 그대로 유지, Client.name만 익명화

        else:
            # 5. 연관 케이스 없음 → 실제 삭제 가능
            await client_repo.delete(client_id)

        await uow.commit()

        return {"message": "내담자 정보가 처리되었습니다"}
```

---

## 종결된 케이스와 상담 이력 조회

### 시나리오

**상황**:
1. 케이스 종결 (COMPLETED)
2. 6개월 후 동일 내담자가 상담 재개 요청

**핵심 정책**:
- **종결된 케이스는 재개 불가** (COMPLETED, CANCELLED는 최종 상태)
- 상담 재개가 필요하면 **새 케이스 생성**
- 내담자의 상담 이력은 **Client 기준으로 CounselingCaseParticipant를 JOIN하여 조회**

---

### 해결 전략: 재개 불가 + 새 케이스 생성 + Client 기반 이력 조회

**정책**: 종결된 케이스는 재개 불가. 새로운 케이스 생성으로 유도. 이력은 Client JOIN으로 조회.

```python
# app/modules/counseling/case/handlers/get_case.py
async def get_case_with_reopen_guidance_handler(
    case_id: str,
    uow: UnitOfWork = Depends(get_uow),
):
    """케이스 조회 시 종결 상태면 새 케이스 생성 안내"""
    async with uow:
        case_repo = uow.repo(CounselingCaseRepository)
        case = await case_repo.get(case_id)

        if not case:
            raise HTTPException(status_code=404, detail="케이스를 찾을 수 없습니다")

        # 종결된 케이스는 재개 불가 안내
        if case.status in ["COMPLETED", "CANCELLED"]:
            participant_repo = uow.repo(CounselingCaseParticipantRepository)

            # 참여자 정보 조회
            last_counselors = await participant_repo.get_by_case_and_type(
                case_id, "counselor"
            )
            last_clients = await participant_repo.get_by_case_and_type(
                case_id, "client"
            )

            return {
                "case": CounselingCaseResponse.model_validate(case),
                "reopen_guidance": {
                    "can_reopen": False,
                    "message": "종결된 케이스는 재개할 수 없습니다. 새 케이스를 생성하세요.",
                    "reason": "상담 여정의 명확한 구분 및 데이터 정합성 보장",
                    "suggested_action": {
                        "action": "create_new_case",
                        "label": "새 케이스 생성",
                        "endpoint": "POST /api/counseling/cases",
                        "prefill": {
                            "counseling_id": case.counseling_id,
                            "client_ids": [c.participant_id for c in last_clients],
                            "counselor_ids": [c.participant_id for c in last_counselors]
                        }
                    }
                }
            }

        # ACTIVE 케이스면 그대로 반환
        return {
            "case": CounselingCaseResponse.model_validate(case),
            "reopen_guidance": None
        }
```

### 내담자 상담 이력 조회 (Client JOIN 방식)

**스키마에 별도 필드 추가 없이** CounselingCaseParticipant를 통해 내담자의 모든 케이스를 조회합니다.

```python
# app/modules/counseling/case/repository.py
class CounselingCaseRepository:
    async def get_cases_by_client(self, client_id: str) -> list[CounselingCase]:
        """
        내담자의 모든 상담 케이스 조회
        - CounselingCaseParticipant를 통한 JOIN
        - created_at 기준 정렬로 시간순 이력 파악
        """
        query = (
            select(CounselingCase)
            .join(
                CounselingCaseParticipant,
                CounselingCase.id == CounselingCaseParticipant.counseling_case_id
            )
            .where(
                CounselingCaseParticipant.participant_type == "client",
                CounselingCaseParticipant.participant_id == client_id
            )
            .order_by(CounselingCase.created_at.desc())
        )
        result = await self._session.execute(query)
        return result.scalars().all()


# app/modules/counseling/case/handlers/get_client_history.py
async def get_client_counseling_history_handler(
    center_id: str,
    client_id: str,
    uow: UnitOfWork = Depends(get_uow),
):
    """
    내담자의 상담 이력 조회 (Client 기준 JOIN)
    - CounselingCaseParticipant를 통해 참여한 모든 케이스 조회
    - 별도 previous_case_id 필드 없이 시간순 정렬로 이력 파악
    """
    async with uow:
        case_repo = uow.repo(CounselingCaseRepository)

        # Client 기준으로 모든 케이스 조회 (시간순 정렬)
        cases = await case_repo.get_cases_by_client(client_id)

        # 센터별 필터링
        cases = [c for c in cases if c.center_id == center_id]

        return {
            "client_id": client_id,
            "total_cases": len(cases),
            "cases": [
                {
                    "case_id": c.id,
                    "counseling_id": c.counseling_id,
                    "status": c.status,
                    "session_count": await get_session_count(c.id),
                    "created_at": c.created_at.isoformat(),
                    "updated_at": c.updated_at.isoformat()
                }
                for c in cases
            ]
        }
```

### API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/centers/{center_id}/clients/{client_id}/counseling-history` | 내담자 상담 이력 조회 |

### 정책 비교

| 정책 | 장점 | 단점 |
|------|------|------|
| **재개 불가 + Client JOIN (채택)** | 상담 여정 명확 구분, 스키마 단순, 데이터 정합성 보장 | - |
| previous_case_id 체인 | 케이스 간 명시적 연결 | 스키마 복잡, 체인 관리 필요 |
| 재개 허용 | 연속성 유지 | 참여자 불일치, session_number 혼란, 상태 관리 복잡 |

> **결론**: 내담자의 상담 이력은 `CounselingCaseParticipant` 테이블을 통해 조회하면 됩니다. 별도의 `previous_case_id` 필드 없이도 `created_at` 기준 정렬로 시간순 이력을 파악할 수 있습니다.

---

## 종합 정리

### 엣지 케이스 우선순위

| 우선순위 | 엣지 케이스 | Phase 1 | Phase 2 |
|---------|------------|---------|---------|
| **P0 (Critical)** | 참여자 최소 인원 | ✅ 차단 | - |
| **P0** | 동시 Session 생성 | ✅ DB Lock | ✅ Unique + Retry |
| **P0** | 상담사 센터 탈퇴 | ✅ 차단 정책 | ✅ 명시적 인계 |
| **P1 (High)** | 케이스 종결 + SCHEDULED Session | ✅ 경고 | ✅ 자동 취소 옵션 |
| **P1** | Schedule 삭제 시 Session | ✅ 삭제 차단 | - |
| **P1** | 내담자 삭제 | ✅ 차단 | ✅ 익명화 |
| **P2 (Medium)** | 집단상담 대량 변경 | ✅ 개별 처리 | ✅ Batch 처리 |
| **P2** | 세션 출석 정합성 | ✅ 케이스 참여 검증 | - |
| **P2** | 종결된 케이스 상담 이력 | ✅ 재개 불가 + Client JOIN 이력 조회 | - |
| **P3 (Low)** | 상담사 전원 이탈 | ✅ 차단 (인계 필수) | - |

---

### Phase별 구현 전략

**Phase 1 (MVP)**:
- 최소 인원 강제 (상담사 1명, 내담자 1명)
- DB Row Lock으로 Race Condition 방지
- 활성 케이스 있으면 상담사 탈퇴/내담자 삭제 차단
- 케이스 종결 시 예약 Session 경고

**Phase 2 (확장)**:
- 명시적 인계 프로세스
- 내담자 익명화 (Soft Delete)
- 내담자 상담 이력 조회 API (Client JOIN)
- Batch 참여자 처리

---

## 참고 문서

- **Counseling 도메인 설계**: `/docs/counseling/domain.md`
- **Counseling 시나리오**: `/docs/counseling/scenarios.md`
- **Counseling 의사결정 기록**: `/docs/counseling/decision-log.md`
