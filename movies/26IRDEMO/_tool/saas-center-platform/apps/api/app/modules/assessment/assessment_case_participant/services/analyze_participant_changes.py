from ..repository import AssessmentCaseParticipantRepository


class AnalyzeParticipantChangesService:
    def __init__(self, repo: AssessmentCaseParticipantRepository):
        self.repo = repo

    async def execute(
        self,
        *,
        case,
        client_ids: list[str] | None = None,
        assistant_ids: list[str] | None = None,
    ) -> tuple[list, dict]:
        warnings = []
        affected = {
            "participants_to_unassign": [],
            "participants_to_add": [],
        }

        # load
        current_participants = await self.repo.list_by_case(case_id=case.id)
        current_client_ids = [
            p.participant_id for p in current_participants
            if p.participant_type == "client" and p.unassigned_at is None
        ]
        current_assistant_ids = [
            p.participant_id for p in current_participants
            if p.participant_type == "assistant" and p.unassigned_at is None
        ]

        if client_ids is not None:
            removed_clients = set(current_client_ids) - set(client_ids)
            added_clients = set(client_ids) - set(current_client_ids)

            if removed_clients:
                affected["participants_to_unassign"].extend([
                    {"type": "client", "id": cid} for cid in removed_clients
                ])
                warnings.append({
                    "type": "participant_unassign",
                    "count": len(removed_clients),
                    "message": f"{len(removed_clients)}명의 내담자가 배정 해제됩니다"
                })

            if added_clients:
                affected["participants_to_add"].extend([
                    {"type": "client", "id": cid} for cid in added_clients
                ])
                warnings.append({
                    "type": "participant_add",
                    "count": len(added_clients),
                    "message": f"{len(added_clients)}명의 내담자가 추가됩니다"
                })

        if assistant_ids is not None:
            removed_assistants = set(current_assistant_ids) - set(assistant_ids)
            added_assistants = set(assistant_ids) - set(current_assistant_ids)

            if removed_assistants:
                affected["participants_to_unassign"].extend([
                    {"type": "assistant", "id": sid} for sid in removed_assistants
                ])
                warnings.append({
                    "type": "participant_unassign",
                    "count": len(removed_assistants),
                    "message": f"{len(removed_assistants)}명의 검사자가 배정 해제됩니다"
                })

            if added_assistants:
                affected["participants_to_add"].extend([
                    {"type": "assistant", "id": sid} for sid in added_assistants
                ])
                warnings.append({
                    "type": "participant_add",
                    "count": len(added_assistants),
                    "message": f"{len(added_assistants)}명의 검사자가 추가됩니다"
                })

        return warnings, affected
