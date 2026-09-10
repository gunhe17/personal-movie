from datetime import datetime

from .models import Schedule


def format_conflict_warning(
    conflicts: list[Schedule],
    check_room_id: str | None,
    check_member_id: str | None,
    session_number: int | None = None,
    session_start: datetime | None = None,
) -> str | None:
    # reason(room/member/both)별 그룹핑으로 경고 폭발 방지 — "3회기 (10:00) - 겹치는 일정: ..."
    if not conflicts:
        return None

    titles_by_reason: dict[str, list[str]] = {"both": [], "member": [], "room": []}
    for s in conflicts:
        room_match = bool(check_room_id and s.room_id == check_room_id)
        member_match = bool(check_member_id and s.member_id == check_member_id)
        title = s.title or "일정"
        if room_match and member_match:
            titles_by_reason["both"].append(title)
        elif member_match:
            titles_by_reason["member"].append(title)
        else:
            titles_by_reason["room"].append(title)

    segments: list[str] = []
    if titles_by_reason["both"]:
        segments.append(f"동일 장소·담당자 일정({', '.join(titles_by_reason['both'])})")
    if titles_by_reason["member"]:
        segments.append(f"동일 담당자 일정({', '.join(titles_by_reason['member'])})")
    if titles_by_reason["room"]:
        segments.append(f"동일 장소 일정({', '.join(titles_by_reason['room'])})")
    detail = ", ".join(segments)

    prefix_parts: list[str] = []
    if session_number is not None:
        prefix_parts.append(f"{session_number}회기")
    if session_start is not None:
        prefix_parts.append(f"({session_start.strftime('%Y-%m-%d %H:%M')})")
    prefix = " ".join(prefix_parts)

    return f"{prefix} - 겹치는 일정: {detail}" if prefix else f"겹치는 일정: {detail}"
