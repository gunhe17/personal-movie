"""
개발 서버 DB 초기화 스크립트

신규 DB: create_all로 전체 테이블 생성 후 alembic stamp head
기존 DB: alembic upgrade head (일반 마이그레이션)
"""
import asyncio
import os
import subprocess
import sys


async def main():
    from sqlalchemy.ext.asyncio import create_async_engine
    from sqlalchemy import text
    from app.infrastructure.persistence.models import BaseModel

    # 모든 모델 import (metadata 등록) — create_all 이 빠짐없이 테이블을 만들도록.
    # ⚠ 이 목록은 migrations/env.py 와 함께 전체 모델과 일치해야 한다 — 누락 시 create_all 이 그 테이블을 빠뜨린다.
    #   재생성: cd apps/api && uv run python -c "import importlib,pathlib; import app.modules as M; \
    #   from app.infrastructure.persistence.models import BaseModel; r=pathlib.Path(M.__file__).parent; \
    #   [importlib.import_module('.'.join(p.relative_to(r.parent.parent).with_suffix('').parts)) for n in ('models.py','model.py') for p in sorted(r.rglob(n))]; \
    #   import collections; g=collections.defaultdict(list); \
    #   [g[m.class_.__module__].append(m.class_.__name__) for m in BaseModel.registry.mappers if getattr(m.class_,'__tablename__',None)]; \
    #   [print(f'    from {k} import {chr(44).join(sorted(set(v)))}  # noqa') for k,v in sorted(g.items())]"
    from app.modules.activity_log.legacy.model import ActivityLog  # noqa
    from app.modules.agent.legacy.model import AgentConversation, AgentMessage, AgentPrompt, AgentRun  # noqa
    from app.modules.platform_admin.audit_log.legacy.model import AdminAuditLog  # noqa
    from app.modules.ai_lab.experiment_group.models import LabExperimentGroup  # noqa
    from app.modules.assistant.conversation.models import AssistantConversation, AssistantTurn  # noqa
    from app.modules.ai_lab.experiment_run.models import LabExperimentRun  # noqa
    from app.modules.ai_lab.production_config.models import ProductionAIConfig  # noqa
    from app.modules.ai_lab.prompt_version.models import LabPromptVersion  # noqa
    from app.modules.ai_lab.sample_dataset.models import LabSampleDataset  # noqa
    from app.modules.assessment.assessment.models import Assessment  # noqa
    from app.modules.assessment.assessment_case.models import AssessmentCase  # noqa
    from app.modules.assessment.assessment_case_participant.models import AssessmentCaseParticipant  # noqa
    from app.modules.assessment.assessment_package.models import AssessmentPackage  # noqa
    from app.modules.assessment.assessment_session.models import AssessmentSession  # noqa
    from app.modules.assessment.assessment_session_participant.models import AssessmentSessionParticipant  # noqa
    from app.modules.assessment.assessment_set.models import AssessmentSet  # noqa
    from app.modules.assessment.assessment_task.models import AssessmentTask  # noqa
    from app.modules.assessment.center_assessment.models import CenterAssessment  # noqa
    from app.modules.assessment.send_link.models import AssessmentSendLink  # noqa
    from app.modules.assessment.send_result.models import AssessmentSendResult  # noqa
    from app.modules.auth.account.models import Account  # noqa
    from app.modules.auth.login_notification.models import LoginNotification  # noqa
    from app.modules.auth.password_history.models import PasswordHistory  # noqa
    from app.modules.auth.token.models import RefreshToken  # noqa
    from app.modules.billing._legacy_payment.model import PaymentRecord  # noqa
    from app.modules.billing.billable.models import Billable  # noqa
    from app.modules.billing.billable_item.models import BillableItem  # noqa
    from app.modules.billing.payment.models import Payment  # noqa
    from app.modules.billing.price_list.models import PriceList  # noqa
    from app.modules.center.center.models import Center  # noqa
    from app.modules.center.center_application.models import CenterApplication  # noqa
    from app.modules.center.center_non_operating_time.models import NonOperatingTime  # noqa
    from app.modules.center.center_note_preference.models import CenterNotePreference  # noqa
    from app.modules.center.center_operating_time.models import OperatingTime  # noqa
    from app.modules.center.member.models import Member  # noqa
    from app.modules.center.member_invitation.models import MemberInvitation  # noqa
    from app.modules.center.member_non_working_time.models import MemberNonWorkingTime  # noqa
    from app.modules.center.member_working_time.models import MemberWorkingTime  # noqa
    from app.modules.center.program.models import Program  # noqa
    from app.modules.center.program_member.models import ProgramMember  # noqa
    from app.modules.center.room.models import Room  # noqa
    from app.modules.center_link.audit.models import CenterLinkAudit  # noqa
    from app.modules.center_link.invitation.models import CenterLinkInvitation  # noqa
    from app.modules.center_link.link.models import CenterLink  # noqa
    from app.modules.client.client_relation.models import ClientRelation  # noqa
    from app.modules.client.favorite.models import ClientFavorite  # noqa
    from app.modules.client.link_request.models import ClientLinkRequest  # noqa
    from app.modules.client.profile.models import Client  # noqa
    from app.modules.client.resource.models import ClientResource  # noqa
    from app.modules.client.sibling_relation.models import SiblingRelation  # noqa
    from app.modules.client.unlink_log.models import ClientUnlinkLog  # noqa
    from app.modules.counseling.counseling_case.models import CounselingCase  # noqa
    from app.modules.counseling.counseling_case_analysis.models import CounselingCaseAnalysis  # noqa
    from app.modules.counseling.counseling_case_participant.models import CounselingCaseParticipant  # noqa
    from app.modules.counseling.counseling_note.models import CounselingNote  # noqa
    from app.modules.counseling.counseling_note_ai_draft.models import CounselingNoteAiDraft  # noqa
    from app.modules.counseling.counseling_note_derivation.models import CounselingNoteDerivation  # noqa
    from app.modules.counseling.counseling_session.models import CounselingSession  # noqa
    from app.modules.counseling.counseling_session_participant.models import CounselingSessionParticipant  # noqa
    from app.modules.directory_center.directory_center.models import DirectoryCenter  # noqa
    from app.modules.document.document.models import Document  # noqa
    from app.modules.document.document_access.models import DocumentAccess  # noqa
    from app.modules.document.global_document.models import GlobalDocument  # noqa
    from app.modules.document.share_token.models import ShareToken  # noqa
    from app.modules.event.event.models import Event  # noqa
    from app.modules.event.event_atomic.models import EventAtomic  # noqa
    from app.modules.event.event_reaction.models import EventReaction  # noqa
    from app.modules.family.family.models import Family  # noqa
    from app.modules.family.family_member.models import FamilyMember  # noqa
    from app.modules.family.invitation.models import FamilyInvitation  # noqa
    from app.modules.family.profile.models import Profile  # noqa
    from app.modules.field_note.field_note.models import FieldNote  # noqa
    from app.modules.field_note.field_note_audio.models import FieldNoteAudio  # noqa
    from app.modules.field_note.field_note_entry.models import FieldNoteEntry  # noqa
    from app.modules.ledger.ledger_entry.models import LedgerEntry  # noqa
    from app.modules.ledger.ledger_media.models import LedgerMedia  # noqa
    from app.modules.form.extraction.models import FormExtraction  # noqa
    from app.modules.form.form.models import Form  # noqa
    from app.modules.form.send.models import FormSend  # noqa
    from app.modules.form.signature.models import FormSignature  # noqa
    from app.modules.form.template.models import FormTemplate  # noqa
    from app.modules.form.value.models import FormValue  # noqa
    from app.modules.institution.institution.models import Institution  # noqa
    from app.modules.llm.credit_balance.models import CreditBalance  # noqa
    from app.modules.llm.credit_rate_config.models import CreditRateConfig  # noqa
    from app.modules.llm.llm_call.models import LlmCall  # noqa
    from app.modules.messaging.message_template.models import MessageTemplate  # noqa
    from app.modules.messaging.messaging.models import MessageLog  # noqa
    from app.modules.notice.notice.models import Notice  # noqa
    from app.modules.notice.notice_read.models import NoticeRead  # noqa
    from app.modules.notification.notification.models import Notification  # noqa
    from app.modules.notification.notification_log.models import NotificationLog  # noqa
    from app.modules.notification.notification_setting.models import NotificationSetting  # noqa
    from app.modules.notification.push_token.models import PushToken  # noqa
    from app.modules.person.credential.models import PersonCredential  # noqa
    from app.modules.person.person.models import Person  # noqa
    from app.modules.person_profile.person_profile.models import PersonProfile  # noqa
    from app.modules.platform_admin.admin_account.models import AdminAccount  # noqa
    from app.modules.platform_admin.admin_account_management.models import AdminAccountInvitation  # noqa
    from app.modules.platform_admin.admin_refresh_token.models import AdminRefreshToken  # noqa
    from app.modules.platform_admin.cs_memo.models import CSMemo  # noqa
    from app.modules.platform_admin.faq.models import FAQ  # noqa
    from app.modules.platform_admin.inquiry.models import Inquiry  # noqa
    from app.modules.platform_admin.plan_config.models import PlanConfig  # noqa
    from app.modules.platform_admin.platform_setting.models import PlatformSetting  # noqa
    from app.modules.role.permission.models import Permission  # noqa
    from app.modules.role.role.models import Role  # noqa
    from app.modules.role.role_permission.models import RolePermission  # noqa
    from app.modules.schedule.schedule.models import Schedule  # noqa
    from app.modules.subscription.subscription.models import Subscription  # noqa
    from app.modules.subscription.subscription_history.models import SubscriptionHistory  # noqa
    from app.modules.subscription.subscription_payment.models import SubscriptionPayment  # noqa
    from app.modules.voucher.center_voucher.models import CenterVoucher  # noqa
    from app.modules.voucher.client_voucher.models import ClientVoucher  # noqa
    from app.modules.voucher.client_voucher_resource.models import ClientVoucherResource  # noqa
    from app.modules.voucher.voucher.models import Voucher  # noqa
    from app.modules.voucher.voucher_document.models import VoucherDocument  # noqa
    from app.modules.voucher.voucher_extraction.models import VoucherExtraction  # noqa

    url = os.environ["DATABASE_URL"]
    engine = create_async_engine(url)

    # alembic_version 테이블 존재 여부로 초기화/마이그레이션 판단
    async with engine.connect() as conn:
        result = await conn.execute(text(
            "SELECT EXISTS (SELECT FROM information_schema.tables "
            "WHERE table_name = 'alembic_version')"
        ))
        has_alembic = result.scalar()

    if not has_alembic:
        print("[MIGRATE] 신규 DB 감지 - create_all + stamp head")
        async with engine.begin() as conn:
            await conn.run_sync(BaseModel.metadata.create_all)
        subprocess.run(["alembic", "stamp", "head"], check=True)
        print("[MIGRATE] 초기화 완료")

        # 신규 DB: seed 데이터 적용
        print("[SEED] 시드 데이터 적용 중...")
        subprocess.run(
            ["python", "-m", "scripts.seed.develop"],
            check=True,
        )
        print("[SEED] 시드 데이터 적용 완료")
    else:
        # 현재 DB revision이 유효한지 검증
        check = subprocess.run(
            ["alembic", "current"],
            capture_output=True, text=True,
        )
        if check.returncode != 0 or "Can't locate" in check.stderr:
            # alembic이 인식 못하는 revision → SQL로 직접 head로 교정
            head_result = subprocess.run(
                ["alembic", "heads", "--resolve-dependencies"],
                capture_output=True, text=True,
            )
            head_rev = head_result.stdout.strip().split()[0] if head_result.stdout.strip() else None
            if head_rev:
                print(f"[MIGRATE] DB revision이 코드에 없음 - SQL로 {head_rev} 교정")
                async with engine.begin() as conn:
                    await conn.execute(text("DELETE FROM alembic_version"))
                    await conn.execute(
                        text("INSERT INTO alembic_version (version_num) VALUES (:rev)"),
                        {"rev": head_rev},
                    )
                print("[MIGRATE] 교정 완료")
            else:
                print("[MIGRATE] ERROR: head revision을 찾을 수 없음")
                sys.exit(1)
        else:
            print("[MIGRATE] 기존 DB - alembic upgrade head")
            subprocess.run(["alembic", "upgrade", "head"], check=True)
            print("[MIGRATE] 마이그레이션 완료")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
