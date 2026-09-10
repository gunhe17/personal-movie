
class Permission:
    """
    RBAC 권한 상수

    형식: "{action}:{resource}"

    Actions:
        - read: 조회
        - write: 생성/수정 (관리 기능 포함)
        - delete: 삭제

    데이터 범위:
        - Role.access_level로 결정 (all: 센터 전체, own: 본인만)
        - CenterContext.owner_scope에 미리 계산됨

    공통 조회 (권한 불필요, 센터 멤버십만 필요):
        - 운영시간

    Special:
        - WILDCARD (*): Superadmin, 모든 권한
    """

    # Center (센터)
    READ_CENTER = "read:center"              # 센터 정보 조회
    WRITE_CENTER = "write:center"            # 센터 정보/설정/운영시간 수정

    # Program (프로그램)
    READ_PROGRAM = "read:program"            # 프로그램 조회
    WRITE_PROGRAM = "write:program"          # 프로그램 생성/수정/삭제

    # Room (장소)
    READ_ROOM = "read:room"                  # 장소(상담실) 조회
    WRITE_ROOM = "write:room"                # 장소(상담실) 생성/수정/삭제

    # Member (구성원)
    READ_MEMBER = "read:member"              # 구성원 목록/상세 조회
    WRITE_MEMBER = "write:member"            # 구성원 수정
    DELETE_MEMBER = "delete:member"          # 구성원 삭제

    # Member Invitation (구성원 초대)
    READ_MEMBER_INVITATION = "read:member_invitation"    # 초대 목록 조회
    WRITE_MEMBER_INVITATION = "write:member_invitation"  # 초대 생성/취소

    # Schedule (일정)
    READ_SCHEDULE = "read:schedule"          # 일정 조회
    WRITE_SCHEDULE = "write:schedule"        # 일정 생성/수정
    DELETE_SCHEDULE = "delete:schedule"      # 일정 삭제

    # Client (내담자)
    READ_CLIENT = "read:client"              # 내담자 조회
    WRITE_CLIENT = "write:client"            # 내담자 생성/수정
    DELETE_CLIENT = "delete:client"          # 내담자 삭제

    # Counseling (상담)
    READ_COUNSELING = "read:counseling"      # 상담 조회
    WRITE_COUNSELING = "write:counseling"    # 상담 생성/수정
    DELETE_COUNSELING = "delete:counseling"  # 상담 삭제

    # Counseling Note (상담 노트)
    READ_COUNSELING_NOTE = "read:counseling_note"      # 상담 노트 조회
    WRITE_COUNSELING_NOTE = "write:counseling_note"    # 상담 노트 생성/수정

    # Assessment Case (검사 케이스)
    READ_ASSESSMENT_CASE = "read:assessment_case"      # 검사 조회
    WRITE_ASSESSMENT_CASE = "write:assessment_case"    # 검사 생성/수정
    DELETE_ASSESSMENT_CASE = "delete:assessment_case"  # 검사 삭제

    # Center Assessment (센터 검사 카탈로그)
    READ_CENTER_ASSESSMENT = "read:center_assessment"    # 센터 검사 카탈로그 조회
    WRITE_CENTER_ASSESSMENT = "write:center_assessment"  # 센터 검사 활성화/설정 변경

    # Send Link (바로링크)
    READ_SEND_LINK = "read:send_link"        # 바로링크 발송이력 조회
    WRITE_SEND_LINK = "write:send_link"      # 바로링크 발송/재전송

    # Document (문서)
    READ_DOCUMENT = "read:document"          # 문서 조회
    WRITE_DOCUMENT = "write:document"        # 문서 생성/수정
    DELETE_DOCUMENT = "delete:document"      # 문서 삭제

    # Form Template (양식 템플릿)
    READ_FORM_TEMPLATE = "read:form_template"    # 양식 템플릿 조회
    WRITE_FORM_TEMPLATE = "write:form_template"  # 양식 템플릿 생성/수정/삭제

    # Form Instance (양식 인스턴스)
    READ_FORM_INSTANCE = "read:form_instance"      # 양식 인스턴스 조회
    WRITE_FORM_INSTANCE = "write:form_instance"    # 양식 인스턴스 생성/수정
    DELETE_FORM_INSTANCE = "delete:form_instance"  # 양식 인스턴스 삭제

    # Role (역할 관리)
    READ_ROLE = "read:role"                  # 역할 목록/상세 조회
    WRITE_ROLE = "write:role"                # 역할/권한 관리

    # Activity Log (활동 로그)
    READ_ACTIVITY_LOG = "read:activity_log"  # 활동 로그 조회

    # Notice (공지)
    READ_NOTICE = "read:notice"              # 공지 조회
    WRITE_NOTICE = "write:notice"            # 공지 생성/수정

    # Billing (청구)
    READ_BILLING = "read:billing"            # 청구 조회
    WRITE_BILLING = "write:billing"          # 청구 생성/완료
    DELETE_BILLING = "delete:billing"        # 청구 삭제

    # Voucher (바우처)
    READ_VOUCHER = "read:voucher"            # 바우처 조회 (취급/내담자 보유)
    WRITE_VOUCHER = "write:voucher"          # 바우처 등록/수정
    DELETE_VOUCHER = "delete:voucher"        # 바우처 삭제·취소

    # Message Template (문자 양식)
    READ_MESSAGE_TEMPLATE = "read:message_template"    # 문자 양식 조회
    WRITE_MESSAGE_TEMPLATE = "write:message_template"  # 문자 양식 생성/수정/삭제

    # Special
    WILDCARD = "*"  # Superadmin - 모든 권한
