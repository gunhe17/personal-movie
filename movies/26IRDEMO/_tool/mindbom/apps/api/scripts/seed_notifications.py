"""임상심리사 계정에 알림 6종을 1건씩 발생시키는 시드 스크립트

Usage: cd apps/api && uv run python -m scripts.seed_notifications

검사 담당 임상심리사(scripts/cast.py의 CLINICIAN_KEY)에게:
- examination.assigned (3분 전)
- examination.ai_draft_ready (10분 전)
- examination.confirmed (1시간 전)
- examination.report_ready (2시간 전)
- member.invited (1일 전, 읽음 처리)
- account.password_changed (3일 전, 읽음 처리)
"""
import asyncio
from datetime import datetime, timedelta

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.modules.auth.account.models import Account
from app.modules.examination.common.models import Examination
from app.modules.member.models import Member
from app.modules.notification.models import Notification

from scripts import cast

CLINICIAN = cast.CLINICIAN


async def seed_notifications():
    async with AsyncSessionLocal() as session:
        # 1. 임상심리사 계정/멤버 조회
        result = await session.execute(
            select(Account).where(Account.email == CLINICIAN["email"])
        )
        clinician_account = result.scalar_one_or_none()
        if not clinician_account:
            print(f"{CLINICIAN['email']} 계정이 없습니다. 먼저 `uv run python -m scripts.seed`를 실행하세요.")
            return

        result = await session.execute(
            select(Member).where(
                Member.account_id == clinician_account.id,
                Member.deleted_at.is_(None),
            )
        )
        member = result.scalar_one_or_none()
        if not member:
            print("clinician 멤버가 없습니다.")
            return

        # 2. 링크 대상으로 쓸 검사 1건 (없으면 ID는 placeholder로 둠)
        result = await session.execute(
            select(Examination).where(
                Examination.institution_id == member.institution_id,
                Examination.deleted_at.is_(None),
            ).limit(1)
        )
        sample_exam = result.scalar_one_or_none()
        exam_id = sample_exam.id if sample_exam else "00000000-0000-0000-0000-000000000000"
        exam_type = sample_exam.exam_type if sample_exam else "htp"

        # 3. 기존 알림 정리 (재실행 시 중복 방지)
        from sqlalchemy import delete
        await session.execute(
            delete(Notification).where(
                Notification.recipient_member_id == member.id
            )
        )

        now = datetime.now().replace(microsecond=0)

        notifications = [
            Notification(
                institution_id=member.institution_id,
                recipient_member_id=member.id,
                type="examination.assigned",
                title="새 검사가 할당되었습니다",
                entity_type="examination",
                entity_id=exam_id,
                link_path=f"/examinations/{exam_id}",
                actor_member_id=None,
                created_at=now - timedelta(minutes=3),
                updated_at=now - timedelta(minutes=3),
            ),
            Notification(
                institution_id=member.institution_id,
                recipient_member_id=member.id,
                type="examination.ai_draft_ready",
                title="AI 분석이 완료되었습니다",
                body="결과를 검토해주세요.",
                entity_type="examination",
                entity_id=exam_id,
                link_path=f"/examinations/{exam_id}/htp/results",
                actor_member_id=None,
                created_at=now - timedelta(minutes=10),
                updated_at=now - timedelta(minutes=10),
            ),
            Notification(
                institution_id=member.institution_id,
                recipient_member_id=member.id,
                type="examination.confirmed",
                title="검사 결과가 확정되었습니다",
                entity_type="examination",
                entity_id=exam_id,
                link_path=f"/examinations/{exam_id}/{exam_type}/results",
                actor_member_id=None,
                created_at=now - timedelta(hours=1),
                updated_at=now - timedelta(hours=1),
            ),
            Notification(
                institution_id=member.institution_id,
                recipient_member_id=member.id,
                type="examination.report_ready",
                title="검사 보고서가 생성되었습니다",
                entity_type="examination",
                entity_id=exam_id,
                link_path=f"/examinations/{exam_id}/htp/results",
                actor_member_id=None,
                created_at=now - timedelta(hours=2),
                updated_at=now - timedelta(hours=2),
            ),
            Notification(
                institution_id=member.institution_id,
                recipient_member_id=member.id,
                type="member.invited",
                title="기관에 초대되었습니다",
                body=f"역할: {member.role}",
                entity_type="member",
                entity_id=member.id,
                link_path="/settings",
                actor_member_id=None,
                read_at=now - timedelta(hours=23),
                created_at=now - timedelta(days=1),
                updated_at=now - timedelta(hours=23),
            ),
            Notification(
                institution_id=member.institution_id,
                recipient_member_id=member.id,
                type="account.password_changed",
                title="비밀번호가 변경되었습니다",
                body="본인이 변경하지 않았다면 즉시 관리자에게 문의해주세요.",
                entity_type="account",
                entity_id=clinician_account.id,
                link_path="/settings",
                actor_member_id=member.id,
                created_at=now - timedelta(minutes=30),
                updated_at=now - timedelta(minutes=30),
            ),
        ]
        session.add_all(notifications)
        await session.commit()

        unread = sum(1 for n in notifications if n.read_at is None)
        print("=== 알림 시드 완료 ===")
        print(f"수신자: {member.name} ({clinician_account.email})")
        print(f"총 {len(notifications)}건 발송 (미읽음 {unread}건, 읽음 {len(notifications) - unread}건)")
        print()
        for n in notifications:
            status = "🔵 미읽음" if n.read_at is None else "✓ 읽음"
            print(f"  {status}  {n.type:35}  → {n.link_path or '(no link)'}")


if __name__ == "__main__":
    asyncio.run(seed_notifications())
