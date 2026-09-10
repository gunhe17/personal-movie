


class BuildCaseDataService:
    def execute(
        self,
        *,
        sessions: list,
        notes: list,
    ) -> dict:
        notes_by_session: dict[str, list] = {}
        for note in notes:
            sid = note.counseling_session_id
            notes_by_session.setdefault(sid, []).append(note)

        return {
            "sessions": sessions,
            "notes_by_session": notes_by_session,
            "schedule_ids": [s.schedule_id for s in sessions if s.schedule_id],
            "session_count": len(sessions),
            "note_count": len(notes),
        }
