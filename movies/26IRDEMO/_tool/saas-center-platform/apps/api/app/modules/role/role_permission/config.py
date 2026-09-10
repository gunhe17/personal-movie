"""역할-권한 매핑 기본 설정 (Default Role-Permission Mapping)

센터 생성 시 기본 역할-권한 매핑을 초기화하는데 사용됩니다.
seed_roles.py 스크립트에서도 동일한 설정을 참조합니다.

권한 체계:
    - read/write/delete: 엔드포인트 진입 권한 (없으면 403)
    - 데이터 범위: Role.access_level로 결정 (all: 센터 전체, own: 본인만)

공통 조회 (권한 불필요, 센터 멤버십만 필요):
    - 운영시간
"""

DEFAULT_ROLE_PERMISSIONS: dict[str, dict] = {
    "ADMIN": {
        "access_level": "all",
        "permissions": [
            # read — 관리 기능 (7개)
            "read:center", "read:program", "read:room",
            "read:member", "read:role",
            "read:center_assessment", "read:form_template",
            # write — 관리 기능 (8개)
            "write:center", "write:program", "write:room",
            "write:member", "write:member_invitation",
            "write:center_assessment", "write:form_template",
            "write:role",
            # read — 업무 기능 (10개)
            "read:member_invitation",
            "read:schedule", "read:client",
            "read:counseling", "read:counseling_note",
            "read:assessment_case", "read:send_link",
            "read:document", "read:form_instance", "read:notice",
            # write — 업무 기능 (9개)
            "write:schedule", "write:client",
            "write:counseling", "write:counseling_note",
            "write:assessment_case", "write:send_link",
            "write:document", "write:form_instance", "write:notice",
            # delete (7개)
            "delete:member", "delete:schedule", "delete:client",
            "delete:counseling", "delete:assessment_case",
            "delete:document", "delete:form_instance",
            # billing (3개)
            "read:billing", "write:billing", "delete:billing",
            # voucher (3개)
            "read:voucher", "write:voucher", "delete:voucher",
            # 특수
            "read:activity_log",
        ],
    },
    "MANAGER": {
        "access_level": "all",
        "permissions": [
            # ADMIN과 동일하되 write:role 제외
            # read — 관리 기능 (7개)
            "read:center", "read:program", "read:room",
            "read:member", "read:role",
            "read:center_assessment", "read:form_template",
            # write — 관리 기능 (7개)
            "write:center", "write:program", "write:room",
            "write:member", "write:member_invitation",
            "write:center_assessment", "write:form_template",
            # read — 업무 기능 (10개)
            "read:member_invitation",
            "read:schedule", "read:client",
            "read:counseling", "read:counseling_note",
            "read:assessment_case", "read:send_link",
            "read:document", "read:form_instance", "read:notice",
            # write — 업무 기능 (9개)
            "write:schedule", "write:client",
            "write:counseling", "write:counseling_note",
            "write:assessment_case", "write:send_link",
            "write:document", "write:form_instance", "write:notice",
            # delete (7개)
            "delete:member", "delete:schedule", "delete:client",
            "delete:counseling", "delete:assessment_case",
            "delete:document", "delete:form_instance",
            # billing (3개)
            "read:billing", "write:billing", "delete:billing",
            # voucher (3개)
            "read:voucher", "write:voucher", "delete:voucher",
        ],
    },
    "STAFF": {
        # 접수/행정 — 일정·내담자·수납 중심. 상담 기록(counseling_note)·상담 write는 제외
        "access_level": "all",
        "permissions": [
            # read — 관리 기능 (조회만)
            "read:center", "read:program", "read:room",
            "read:member", "read:role",
            "read:center_assessment", "read:form_template",
            # read — 업무 기능 (상담 기록 제외)
            "read:schedule", "read:client", "read:counseling",
            "read:assessment_case", "read:send_link",
            "read:document", "read:form_instance", "read:notice",
            # write — 접수 업무
            "write:member",  # 본인 프로필 수정 (/me/member)
            "write:schedule", "write:client",
            "write:assessment_case", "write:send_link",
            "write:document", "write:form_instance",
            # delete — 일정만
            "delete:schedule",
            # billing — 수납 (접수 핵심 업무, 삭제 없음)
            "read:billing", "write:billing",
            # voucher (조회만)
            "read:voucher",
        ],
    },
    "COUNSELOR": {
        "access_level": "own",
        "permissions": [
            # read — 관리 기능 (7개, 조회만 허용)
            "read:center", "read:program", "read:room",
            "read:member", "read:role",
            "read:center_assessment", "read:form_template",
            # read — 업무 기능 (9개, 본인 것만 — access_level=own)
            "read:schedule", "read:client",
            "read:counseling", "read:counseling_note",
            "read:assessment_case", "read:send_link",
            "read:document", "read:form_instance",
            "read:notice",
            # write (9개, 본인 것만)
            "write:member",  # 본인 프로필 수정 (/me/member)
            "write:schedule", "write:client",
            "write:counseling", "write:counseling_note",
            "write:assessment_case", "write:send_link",
            "write:document", "write:form_instance",
            # delete (4개, 본인 것만)
            "delete:schedule", "delete:counseling",
            "delete:assessment_case", "delete:document",
            # billing (2개, 본인 것만 — 삭제 권한 없음)
            "read:billing", "write:billing",
            # voucher (1개, 조회만)
            "read:voucher",
        ],
    },
}
