from app.infrastructure.persistence.unit_of_work import UnitOfWork
from app.modules.center.program.schemas import (
    ProgramListResponse,
    ProgramMemberSummary,
    ProgramSummary,
)
from app.modules.center.facade import ProgramFacade, MemberFacade
from app.modules.person.facade import PersonFacade


async def list_programs_enriched_handler(
    center_id: str,
    page: int,
    size: int,
    uow: UnitOfWork,
) -> ProgramListResponse:
    skip = (page - 1) * size

    program_facade = ProgramFacade(uow)
    programs, total = await program_facade.list_programs(center_id, skip, size)

    if not programs:
        return ProgramListResponse(items=[], total=0, page=page, size=size, pages=0)

    program_ids = [p.id for p in programs]
    program_members_map = await program_facade.get_members_by_program_ids(program_ids)

    all_member_ids = list(
        {pm.member_id for pms in program_members_map.values() for pm in pms}
    )
    member_facade = MemberFacade(uow)
    member_map = await member_facade.get_members_by_ids(all_member_ids)

    person_ids = list({m.person_id for m in member_map.values() if m.person_id})
    person_facade = PersonFacade(uow)
    person_map = await person_facade.get_persons_by_ids(person_ids)

    # 세션 내에서 ORM 속성 접근 (lazy attr — async with 밖으로 빼지 말 것)
    pages = (total + size - 1) // size if total > 0 else 1
    items = []

    for program in programs:
        member_summaries = []
        for pm in program_members_map.get(program.id, []):
            member = member_map.get(pm.member_id)
            if member:
                person = person_map.get(member.person_id)
                member_summaries.append(
                    ProgramMemberSummary(
                        member_id=pm.member_id,
                        name=person.name if person else "Unknown",
                    )
                )

        items.append(
            ProgramSummary(
                id=program.id,
                name=program.name,
                program_type=program.program_type,
                price=program.price,
                duration_minutes=program.duration_minutes,
                is_active=program.is_active,
                members=member_summaries,
            )
        )

    return ProgramListResponse(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=pages,
    )


TOOL = {
    "name": "list_programs_enriched_handler",
    "permission": "read:program",
    "purpose": "센터의 상담·검사 프로그램 목록을 담당 멤버와 함께 페이지 단위로 조회한다.",
    "keywords": [
        "list programs",
        "프로그램 목록",
        "프로그램 조회",
        "프로그램 보기",
        "상담 프로그램 목록",
        "program 리스트",
        "프로그램 전체",
        "코스 목록",
        "개설 프로그램",
    ],
    "boundaries": "여러 프로그램을 목록으로 조회한다(각 프로그램의 담당 멤버 요약 포함, 읽기 전용). 새 프로그램 생성은 create_program_with_members_handler를 쓴다.",
    "output": "프로그램 목록 (ProgramListResponse).",
    "input_schema": {
        "type": "object",
        "properties": {
            "center_id": {
                "type": "string",
                "format": "uuid",
                "title": "대상 센터",
                "description": "프로그램을 조회할 센터의 UUID.",
            },
            "page": {
                "type": "integer",
                "title": "페이지",
                "minimum": 1,
                "description": "가져올 페이지 번호. 1부터 시작.",
            },
            "size": {
                "type": "integer",
                "title": "페이지 크기",
                "description": "한 페이지에 담을 프로그램 수.",
            },
        },
        "required": ["center_id", "page", "size"],
    },
}
