from __future__ import annotations

from datetime import date, datetime, time

from app.core.datetime_utils import utc_now
from app.infrastructure.persistence.agent_query import merge_fields, to_dicts
from app.infrastructure.persistence.unit_of_work import UnitOfWork


# Weekday 정규화: LLM은 카탈로그 enum(Monday~Sunday)을 사용하지만
# DB는 MON~SUN로 저장됨. facade 진입부에서 단방향 매핑.
_WEEKDAY_MAP = {
    "monday": "MON", "tuesday": "TUE", "wednesday": "WED",
    "thursday": "THU", "friday": "FRI", "saturday": "SAT", "sunday": "SUN",
    "mon": "MON", "tue": "TUE", "wed": "WED", "thu": "THU",
    "fri": "FRI", "sat": "SAT", "sun": "SUN",
    "월요일": "MON", "화요일": "TUE", "수요일": "WED",
    "목요일": "THU", "금요일": "FRI", "토요일": "SAT", "일요일": "SUN",
    "월": "MON", "화": "TUE", "수": "WED",
    "목": "THU", "금": "FRI", "토": "SAT", "일": "SUN",
}

_VALID_WEEKDAY_CODES = {"MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"}

# 크로스모듈 이름(member의 person 필드·role_code·role_name, invitation의 role_name·
# invited_by_name, program의 counselor_names)은 query handler 본문이 인라인 조립.
MEMBER_IDENTITY_FIELDS = ["id", "person_id", "role_id"]
MEMBER_DEFAULT_FIELDS = [
    "id", "person_id", "role_id",
    "memo", "status", "employment_type", "hire_date",
]
MEMBER_AVAILABLE_FIELDS = {
    "id", "status", "employment_type", "memo",
    "hire_date", "color", "profile_image_url",
    "person_id", "role_id",
}

PROGRAM_DEFAULT_FIELDS = ["id", "name", "program_type", "price", "duration_minutes", "is_active"]

INVITATION_IDENTITY_FIELDS = ["id", "name"]
INVITATION_DEFAULT_FIELDS = [
    "id", "name",
    "role_id",
    "invited_by",
    "email", "employment_type", "expires_at", "accepted_at",
]
INVITATION_AVAILABLE_FIELDS = {
    "name", "email", "status", "employment_type",
    "role_id", "expires_at", "accepted_at",
    "id", "member_id", "invited_by",
}


def _normalize_weekday(v: str | None) -> str | None:
    if not v:
        return None
    key = v.strip().lower()
    if key in _WEEKDAY_MAP:
        return _WEEKDAY_MAP[key]
    upper = v.strip().upper()[:3]
    if upper in _VALID_WEEKDAY_CODES:
        return upper
    return None


class CenterAgentFacade:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    async def resolve_agent_ref(
        self, center_id: str, field: str, value: str
    ) -> list[dict]:
        # 라벨 조립은 resolver_registry 책임 — 여기선 raw prefixed dict만.
        # member_name은 person+role 크로스모듈 조합이라 runtime resolver_registry.MemberRefResolver 소관.
        if field == "room_name":
            rows, _ = await self.query_room(center_id, name=value)
            return rows
        if field == "program_name":
            rows, _ = await self.query_program(
                center_id, name=value, fields=["program_type"]
            )
            return rows
        return []

    async def query_room(
        self,
        center_id: str,
        *,
        name: str | None = None,
        is_active: bool | None = None,
        keyword: str | None = None,
        id: str | None = None,
        ids: list[str] | None = None,
        date_from: str | date | None = None,
        date_to: str | date | None = None,
        sort: str | None = None,
        limit: int | None = None,
        fields: list[str] | None = None,
        namespaced: bool = True,
    ) -> tuple[list[dict], int]:
        from ..room.repository import RoomRepository
        from ..room.services.list_rooms_by_agent_filters import (
            ListRoomsByAgentFiltersService,
        )
        from app.core.datetime_utils import coerce_date
        from app.infrastructure.persistence.agent_query import normalize_limit

        collected = list(ids or [])
        if id:
            collected.append(id)
        merged_ids = collected or None

        service = ListRoomsByAgentFiltersService(self._uow.repo(RoomRepository))
        rooms, total = await service.execute(
            center_id,
            sort=sort,
            limit=normalize_limit(limit),
            name=name,
            is_active=is_active,
            keyword=keyword,
            date_from=coerce_date(date_from, "date_from"),
            date_to=coerce_date(date_to, "date_to"),
            ids=merged_ids,
        )

        identity = ["id", "name"]
        default = ["id", "name"]
        available = {
            "name", "is_active", "description", "memo", "thumbnail_url",
            "inactive_reason", "id",
        }
        merged = merge_fields(fields, default, available, identity=identity)

        return to_dicts(rooms, merged, "room" if namespaced else ""), total

    async def query_program_member(
        self,
        center_id: str,
        *,
        program_id: str | None = None,
        member_id: str | None = None,
        program_ids: list[str] | None = None,
        member_ids: list[str] | None = None,
        fields: list[str] | None = None,
    ) -> list[dict]:
        from ..program_member.repository import ProgramMemberRepository
        from ..program_member.services import (
            ListByProgramIdsService,
            ListByMemberIdsService,
        )

        repo = self._uow.repo(ProgramMemberRepository)

        if program_id and not program_ids:
            program_ids = [program_id]
        elif program_id and program_ids:
            program_ids = [program_id, *program_ids]

        effective_member_ids = list(member_ids or [])
        if member_id:
            effective_member_ids.append(member_id)

        if program_ids:
            service = ListByProgramIdsService(repo)
            pm_map = await service.execute(program_ids)
            pm_list = [pm for pms in pm_map.values() for pm in pms]
            if effective_member_ids:
                mid_set = set(effective_member_ids)
                pm_list = [pm for pm in pm_list if pm.member_id in mid_set]
        elif effective_member_ids:
            reverse_service = ListByMemberIdsService(repo)
            pm_list = await reverse_service.execute(
                effective_member_ids, center_id
            )
        else:
            # Junction 규약: 앵커(program/member) 없이는 조회 금지
            pm_list = []

        pm_list = [pm for pm in pm_list if pm.center_id == center_id]

        # 크로스모듈 이름(member_name·role_code)은 query handler 본문이 인라인 조립
        identity = ["id", "member_id"]
        default = ["id", "member_id", "program_id"]
        available = {
            "id", "program_id", "member_id",
        }
        merged = merge_fields(fields, default, available, identity=identity)

        results: list[dict] = []
        ns = "program_member"
        for pm in pm_list:
            row: dict = {}
            for f in merged:
                key = f"{ns}.{f}"
                row[key] = getattr(pm, f, None)
            results.append(row)
        return results

    async def query_operating_time(
        self,
        center_id: str,
        *,
        day_of_week: str | None = None,
        is_operating: bool | None = None,
        fields: list[str] | None = None,
        namespaced: bool = True,
    ) -> list[dict]:
        from ..center_operating_time.repository import OperatingTimeRepository
        from ..center_operating_time.services import ListOperatingTimesService

        day_of_week = _normalize_weekday(day_of_week)

        repo = self._uow.repo(OperatingTimeRepository)
        service = ListOperatingTimesService(repo)
        items = await service.execute(
            center_id,
            day_of_week=day_of_week,
            is_operating=is_operating,
        )

        identity = ["id", "weekday"]
        default = ["id", "weekday", "open_time", "close_time"]
        available = {
            "weekday", "open_time", "close_time",
            "break_start_time", "break_end_time", "id",
        }
        merged = merge_fields(fields, default, available, identity=identity)

        return to_dicts(items, merged, "operating_time" if namespaced else "")

    async def query_operating_time_slots(
        self,
        center_id: str,
        *,
        target_date: date,
    ) -> list[dict]:
        from .operating_time_facade import OperatingTimeFacade

        facade = OperatingTimeFacade(self._uow)
        resp = await facade.list_available_slots_with_response(center_id, target_date)
        return [
            {
                "operating_time_slot.date": resp.date,
                "operating_time_slot.slots": resp.available_slots,
            }
        ]

    async def query_operating_time_check(
        self,
        center_id: str,
        *,
        target_date: date,
        slot: str,
    ) -> list[dict]:
        from .operating_time_facade import OperatingTimeFacade

        facade = OperatingTimeFacade(self._uow)
        resp = await facade.get_operating_status_with_response(center_id, target_date, slot)
        return [
            {
                "operating_time_check.date": resp.date,
                "operating_time_check.slot": resp.slot,
                "operating_time_check.is_operating": resp.is_operating,
                "operating_time_check.reason": resp.reason,
            }
        ]

    async def query_non_operating_time(
        self,
        center_id: str,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
        reason: str | None = None,
        fields: list[str] | None = None,
        namespaced: bool = True,
    ) -> list[dict]:
        from ..center_non_operating_time.repository import NonOperatingTimeRepository
        from ..center_non_operating_time.services import ListNonOperatingTimesService

        repo = self._uow.repo(NonOperatingTimeRepository)
        service = ListNonOperatingTimesService(repo)
        items = await service.execute(
            center_id,
            skip=0,
            limit=500,
            reason=reason,
        )

        if date_from:
            dt_from = datetime.combine(date_from, time.min)
            items = [
                i for i in items
                if i.effective_to is None or i.effective_to >= dt_from
            ]
        if date_to:
            dt_to = datetime.combine(date_to, time.max)
            items = [i for i in items if i.effective_from <= dt_to]

        identity = ["id", "reason"]
        default = ["id", "reason"]
        available = {
            "reason", "effective_from", "effective_to",
            "year", "month", "day", "weekday", "month_week",
            "start_time", "end_time", "id",
        }
        merged = merge_fields(fields, default, available, identity=identity)

        return to_dicts(items, merged, "non_operating_time" if namespaced else "")

    async def query_working_time(
        self,
        center_id: str,
        *,
        member_id: str | None = None,
        member_ids: list[str] | None = None,
        weekday: str | None = None,
        fields: list[str] | None = None,
        namespaced: bool = True,
    ) -> list[dict]:
        # member 지정 없이 전체 조회도 허용 — 센터 운영 설정이므로.
        from ..member_working_time.repository import MemberWorkingTimeRepository
        from ..member_working_time.services import (
            ListMemberWorkingTimesService,
            ListMemberWorkingTimesByCenterService,
        )

        weekday = _normalize_weekday(weekday)

        effective_member_ids: list[str] = []
        if member_id:
            effective_member_ids.append(member_id)
        if member_ids:
            effective_member_ids.extend(member_ids)

        repo = self._uow.repo(MemberWorkingTimeRepository)

        if effective_member_ids:
            service = ListMemberWorkingTimesService(repo)
            all_items = []
            seen_ids = set()
            for mid in effective_member_ids:
                if mid in seen_ids:
                    continue
                seen_ids.add(mid)
                items = await service.execute(mid, weekday=weekday)
                all_items.extend(items)
        else:
            center_service = ListMemberWorkingTimesByCenterService(repo)
            all_items = await center_service.execute(
                center_id=center_id, weekday=weekday
            )

        identity = ["id", "weekday"]
        default = ["id", "weekday", "start_time", "end_time"]
        available = {
            "weekday", "start_time", "end_time",
            "break_start_time", "break_end_time",
            "id", "member_id",
        }
        merged = merge_fields(fields, default, available, identity=identity)

        return to_dicts(all_items, merged, "working_time" if namespaced else "")

    async def query_working_time_slots(
        self,
        center_id: str,
        *,
        member_id: str | None = None,
        member_ids: list[str] | None = None,
        target_date: date,
    ) -> list[dict]:
        from .member_working_time_facade import MemberWorkingTimeFacade

        effective_member_ids: list[str] = []
        if member_id:
            effective_member_ids.append(member_id)
        if member_ids:
            effective_member_ids.extend(member_ids)

        if not effective_member_ids:
            return []

        facade = MemberWorkingTimeFacade(self._uow)
        results: list[dict] = []
        seen_ids = set()
        for mid in effective_member_ids:
            if mid in seen_ids:
                continue
            seen_ids.add(mid)
            resp = await facade.list_available_slots_with_response(
                center_id, mid, target_date
            )
            results.append(
                {
                    "working_time_slot.member_id": mid,
                    "working_time_slot.date": resp.date,
                    "working_time_slot.slots": resp.available_slots,
                }
            )
        return results

    async def query_working_time_check(
        self,
        center_id: str,
        *,
        member_id: str | None = None,
        member_ids: list[str] | None = None,
        target_date: date,
        slot: str,
    ) -> list[dict]:
        # Service 직접 호출 — Facade 간 호출 금지 원칙 준수.
        from ..member.repository import MemberRepository
        from ..member.services import GetMemberService
        from ..member_non_working_time.repository import MemberNonWorkingTimeRepository
        from ..member_non_working_time.services import ListMatchingByDateService
        from ..member_working_time.repository import MemberWorkingTimeRepository
        from ..member_working_time.services import GetWorkingStatusService

        effective: list[str] = []
        if member_id:
            effective.append(member_id)
        if member_ids:
            effective.extend(member_ids)
        if not effective:
            return []

        unique = list(dict.fromkeys(effective))
        if len(unique) > 1:
            return [
                {
                    "working_time_check.date": target_date.isoformat(),
                    "working_time_check.slot": slot,
                    "working_time_check.member_id": None,
                    "working_time_check.is_available": False,
                    "working_time_check.reason": "여러 상담사가 매칭됩니다. 정확한 이름을 알려주세요.",
                }
            ]
        mid = unique[0]

        member_repo = self._uow.repo(MemberRepository)
        await GetMemberService(member_repo).execute(mid, center_id)

        nwt_repo = self._uow.repo(MemberNonWorkingTimeRepository)
        non_working = await ListMatchingByDateService(nwt_repo).execute(mid, target_date)

        wt_repo = self._uow.repo(MemberWorkingTimeRepository)
        is_working, reason = await GetWorkingStatusService(wt_repo).execute(
            mid, target_date, slot, non_working
        )

        return [
            {
                "working_time_check.date": target_date.isoformat(),
                "working_time_check.slot": slot,
                "working_time_check.member_id": mid,
                "working_time_check.is_available": is_working,
                "working_time_check.reason": reason,
            }
        ]

    async def query_non_working_time(
        self,
        center_id: str,
        *,
        member_id: str | None = None,
        member_ids: list[str] | None = None,
        year: int | None = None,
        month: int | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        fields: list[str] | None = None,
        namespaced: bool = True,
    ) -> list[dict]:
        from ..member_non_working_time.repository import MemberNonWorkingTimeRepository
        from ..member_non_working_time.services import ListMemberNonWorkingTimesService

        effective_member_ids: list[str] = []
        if member_id:
            effective_member_ids.append(member_id)
        if member_ids:
            effective_member_ids.extend(member_ids)

        if not effective_member_ids:
            return []

        repo = self._uow.repo(MemberNonWorkingTimeRepository)
        service = ListMemberNonWorkingTimesService(repo)

        eff_from: datetime | None = None
        eff_to: datetime | None = None
        if year is None and month is None:
            if date_from:
                eff_from = datetime.combine(date_from, time.min)
            if date_to:
                eff_to = datetime.combine(date_to, time.max)

        all_items = []
        seen_ids = set()
        for mid in effective_member_ids:
            if mid in seen_ids:
                continue
            seen_ids.add(mid)
            items, _ = await service.execute(
                mid,
                year=year,
                month=month,
                effective_from=eff_from,
                effective_to=eff_to,
                skip=0,
                limit=500,
            )
            all_items.extend(items)

        identity = ["id", "reason"]
        default = ["id", "reason"]
        available = {
            "reason", "effective_from", "effective_to",
            "year", "month", "day", "weekday", "month_week",
            "start_time", "end_time", "description",
            "id", "member_id",
        }
        merged = merge_fields(fields, default, available, identity=identity)

        return to_dicts(all_items, merged, "non_working_time" if namespaced else "")

    async def query_center_application(
        self,
        center_id: str,
        *,
        name: str | None = None,
        phone: str | None = None,
        status: str | None = None,
        business_registration_number: str | None = None,
        representative_name: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        id: str | None = None,
        fields: list[str] | None = None,
        namespaced: bool = True,
    ) -> list[dict]:
        from ..center_application.repository import CenterApplicationRepository
        from ..center_application.services import ListApplicationsService

        repo = self._uow.repo(CenterApplicationRepository)
        service = ListApplicationsService(repo)
        applications, _ = await service.execute(
            status_filter=status,
            skip=0,
            limit=500,
        )

        if id:
            applications = [a for a in applications if a.id == id]

        if name:
            name_lower = name.lower()
            applications = [
                a for a in applications if name_lower in a.name.lower()
            ]
        if phone:
            applications = [
                a for a in applications if a.phone and phone in a.phone
            ]
        if business_registration_number:
            applications = [
                a for a in applications
                if a.business_registration_number
                and business_registration_number in a.business_registration_number
            ]
        if representative_name:
            rn_lower = representative_name.lower()
            applications = [
                a for a in applications
                if a.representative_name
                and rn_lower in a.representative_name.lower()
            ]
        if date_from:
            dt_from = datetime.combine(date_from, time.min)
            applications = [
                a for a in applications if a.created_at and a.created_at >= dt_from
            ]
        if date_to:
            dt_to = datetime.combine(date_to, time.max)
            applications = [
                a for a in applications if a.created_at and a.created_at <= dt_to
            ]

        identity = ["id", "name"]
        default = ["id", "name"]
        available = {
            "name", "status", "phone", "description",
            "business_registration_number", "representative_name",
            "reviewed_at", "reviewed_reason", "center_id",
            "id", "created_by",
        }
        merged = merge_fields(fields, default, available, identity=identity)

        return to_dicts(applications, merged, "center_application" if namespaced else "")






def _compute_invitation_status(invitation) -> str:
    if invitation.member_id:
        return "accepted"
    if invitation.deleted_at:
        return "cancelled"
    now = utc_now()
    if invitation.expires_at and invitation.expires_at < now:
        return "expired"
    return "pending"
