"""문서 양식(FormTemplate) 시드 — canonical 스키마(pages/fields/elements).

스키마 계약: app/modules/form/template/form_schema.py (validate_form_schema)
- fields:   DATA 평면 — {type, label, required, options:[{value,label}]}
- elements: PRESENTATION 평면 — {id, page, rect:[x,y,w,h](0~1), z(int), widget, field_refs[]}
  · 위치(x,y)·크기(w,h)·정수 z-index 를 element 가 보유
  · field_refs 로 fields 와 0~n:n (날짜 3슬롯 = 1필드:3요소, heading 등 장식 = 0필드)

시스템 양식 "서비스 이용 계약서"는 lab-voucher GT(p-121)에서 추출한 실제 좌표를
이 파일에 인라인된 SERVICE_CONTRACT_SCHEMA 로 고정해 사용한다(요소 rect = GT inputs.rect).
센터 데모 13건은 좌표 합성기(_flow)로 페이지 정규화 좌표를 생성한다.
"""
import asyncio

from sqlalchemy import select

from app.infrastructure.persistence.database import AsyncSessionLocal
from app.modules.center.center.models import Center
from app.modules.form.template.form_schema import validate_form_schema
from app.modules.form.template.models import FormTemplate

# ==================== 시스템 양식 (GT p-121 기반) ====================
# 좌표는 lab-voucher GT(p-121) inputs.rect 에서 추출해 인라인 고정.

SERVICE_CONTRACT_SCHEMA = {   'pages': [],
    'fields': {   'user_name': {'type': 'text', 'label': '서비스 이용자 성명', 'required': True},
                  'user_signature': {   'type': 'signature',
                                        'label': '서비스 이용자 서명 또는 인',
                                        'required': False},
                  'user_birthdate': {'type': 'date', 'label': '서비스 이용자 생년월일', 'required': False},
                  'user_address': {'type': 'text', 'label': '서비스 이용자 주소', 'required': False},
                  'user_contact': {'type': 'phone', 'label': '서비스 이용자 연락처', 'required': False},
                  'agent_name': {'type': 'text', 'label': '대리인 성명', 'required': False},
                  'agent_signature': {   'type': 'signature',
                                         'label': '대리인 서명 또는 인',
                                         'required': False},
                  'agent_relation': {'type': 'text', 'label': '이용자와의 관계', 'required': False},
                  'agent_address': {'type': 'text', 'label': '대리인 주소', 'required': False},
                  'agent_contact': {'type': 'phone', 'label': '대리인 연락처', 'required': False},
                  'provider_name': {'type': 'text', 'label': '서비스 제공기관명', 'required': True},
                  'provider_rep_name': {'type': 'text', 'label': '대표자 성명', 'required': True},
                  'provider_rep_signature': {   'type': 'signature',
                                                'label': '대표자 서명 또는 인',
                                                'required': False},
                  'provider_address': {'type': 'text', 'label': '서비스 제공기관 주소', 'required': False},
                  'agent_email': {'type': 'email', 'label': 'E-mail', 'required': False},
                  'contract_start_date': {'type': 'date', 'label': '계약기간 시작', 'required': False},
                  'contract_end_date': {'type': 'date', 'label': '계약기간 종료', 'required': False}},
    'elements': [   {   'id': 'user_name',
                        'page': 1,
                        'rect': [0.2009, 0.2149, 0.1637, 0.0152],
                        'z': 1,
                        'widget': 'text',
                        'field_refs': ['user_name']},
                    {   'id': 'user_signature',
                        'page': 1,
                        'rect': [0.3629, 0.2126, 0.0429, 0.0199],
                        'z': 2,
                        'widget': 'signature',
                        'field_refs': ['user_signature']},
                    {   'id': 'user_birthdate',
                        'page': 1,
                        'rect': [0.5281, 0.2149, 0.3886, 0.0152],
                        'z': 3,
                        'widget': 'date',
                        'field_refs': ['user_birthdate']},
                    {   'id': 'user_address',
                        'page': 1,
                        'rect': [0.2009, 0.2342, 0.7159, 0.0152],
                        'z': 4,
                        'widget': 'text',
                        'field_refs': ['user_address']},
                    {   'id': 'user_contact',
                        'page': 1,
                        'rect': [0.1999, 0.2535, 0.7169, 0.0152],
                        'z': 5,
                        'widget': 'phone',
                        'field_refs': ['user_contact']},
                    {   'id': 'agent_name',
                        'page': 1,
                        'rect': [0.2009, 0.3113, 0.1637, 0.0152],
                        'z': 6,
                        'widget': 'text',
                        'field_refs': ['agent_name']},
                    {   'id': 'agent_signature',
                        'page': 1,
                        'rect': [0.3629, 0.309, 0.0374, 0.0199],
                        'z': 7,
                        'widget': 'signature',
                        'field_refs': ['agent_signature']},
                    {   'id': 'agent_relation',
                        'page': 1,
                        'rect': [0.6007, 0.3101, 0.0908, 0.0175],
                        'z': 8,
                        'widget': 'text',
                        'field_refs': ['agent_relation']},
                    {   'id': 'agent_address',
                        'page': 1,
                        'rect': [0.2009, 0.3304, 0.7159, 0.0152],
                        'z': 9,
                        'widget': 'text',
                        'field_refs': ['agent_address']},
                    {   'id': 'agent_contact',
                        'page': 1,
                        'rect': [0.1999, 0.3497, 0.2349, 0.0152],
                        'z': 10,
                        'widget': 'phone',
                        'field_refs': ['agent_contact']},
                    {   'id': 'provider_name',
                        'page': 1,
                        'rect': [0.1999, 0.4075, 0.2086, 0.0152],
                        'z': 11,
                        'widget': 'text',
                        'field_refs': ['provider_name']},
                    {   'id': 'provider_rep_name',
                        'page': 1,
                        'rect': [0.4842, 0.4075, 0.1878, 0.0152],
                        'z': 12,
                        'widget': 'text',
                        'field_refs': ['provider_rep_name']},
                    {   'id': 'provider_rep_signature',
                        'page': 1,
                        'rect': [0.6704, 0.4052, 0.0319, 0.0199],
                        'z': 13,
                        'widget': 'signature',
                        'field_refs': ['provider_rep_signature']},
                    {   'id': 'provider_address',
                        'page': 1,
                        'rect': [0.2009, 0.4268, 0.7159, 0.0152],
                        'z': 14,
                        'widget': 'text',
                        'field_refs': ['provider_address']},
                    {   'id': 'agent_email',
                        'page': 1,
                        'rect': [0.5151, 0.3509, 0.1781, 0.0129],
                        'z': 15,
                        'widget': 'email',
                        'field_refs': ['agent_email']},
                    {   'id': 'contract_start_date#0',
                        'page': 1,
                        'rect': [0.2147, 0.4664, 0.0491, 0.0129],
                        'z': 16,
                        'widget': 'date',
                        'field_refs': ['contract_start_date'],
                        'slot': 0},
                    {   'id': 'contract_start_date#1',
                        'page': 1,
                        'rect': [0.284, 0.4664, 0.0226, 0.0129],
                        'z': 17,
                        'widget': 'date',
                        'field_refs': ['contract_start_date'],
                        'slot': 1},
                    {   'id': 'contract_start_date#2',
                        'page': 1,
                        'rect': [0.3268, 0.4664, 0.0226, 0.0129],
                        'z': 18,
                        'widget': 'date',
                        'field_refs': ['contract_start_date'],
                        'slot': 2},
                    {   'id': 'contract_end_date#0',
                        'page': 1,
                        'rect': [0.3896, 0.4664, 0.049, 0.0129],
                        'z': 19,
                        'widget': 'date',
                        'field_refs': ['contract_end_date'],
                        'slot': 0},
                    {   'id': 'contract_end_date#1',
                        'page': 1,
                        'rect': [0.4587, 0.4664, 0.0226, 0.0129],
                        'z': 20,
                        'widget': 'date',
                        'field_refs': ['contract_end_date'],
                        'slot': 1},
                    {   'id': 'contract_end_date#2',
                        'page': 1,
                        'rect': [0.5015, 0.4664, 0.0226, 0.0129],
                        'z': 21,
                        'widget': 'date',
                        'field_refs': ['contract_end_date'],
                        'slot': 2}]}

SYSTEM_FORM_TEMPLATES = [
    {
        "name": "서비스 이용 계약서",
        "schema": SERVICE_CONTRACT_SCHEMA,
        "status": "published",
    },
]


# ==================== 센터 데모 양식 (좌표 합성) ====================

# 센터명은 앱에서 수정 가능 — 조회는 시드 소유 자연키(사업자번호)로 한다.
# 이름을 복제해 두면 센터를 rename 하는 순간 이 시드가 조용히 건너뛴다.
from scripts.seed.develop.center import CENTER_DATA as _CENTER_DATA

CENTER_NAME = _CENTER_DATA["name"]
CENTER_BRN = _CENTER_DATA["business_registration_number"]
_SCALE = ["전혀 아니다", "아니다", "보통", "그렇다", "매우 그렇다"]


def _height(ftype: str, n_options: int) -> float:
    """필드 타입별 기본 높이 (페이지 너비 정규화 비율)."""
    if ftype in ("radio", "checkbox_group"):
        return round(0.035 + 0.022 * max(n_options, 2), 4)
    return {
        "textarea": 0.09,
        "signature": 0.07,
        "file": 0.07,
        "image": 0.07,
    }.get(ftype, 0.05)


def _flow(specs: list[dict]) -> dict:
    """필드 스펙 목록을 canonical 스키마로 변환 (위→아래 1필드:1요소 자동 배치).

    spec = {key, type, label, required?, options?(list[str])}
    """
    fields: dict = {}
    elements: list = []
    y, z = 0.04, 0
    for sp in specs:
        ftype = sp["type"]
        fd = {"type": ftype, "label": sp.get("label", ""), "required": bool(sp.get("required"))}
        opts = sp.get("options")
        if opts:
            fd["options"] = [{"value": o, "label": o} for o in opts]
        fields[sp["key"]] = fd

        h = _height(ftype, len(opts) if opts else 0)
        z += 1
        elements.append(
            {
                "id": sp["key"],
                "page": 1,
                "rect": [0.08, round(y, 4), 0.84, h],
                "z": z,
                "widget": ftype,
                "field_refs": [sp["key"]],
            }
        )
        y += h + 0.015
    if y > 1.0:
        raise ValueError(f"flow layout overflows page (y={y:.3f}) — 필드 수/높이 조정 필요")
    return {"pages": [], "fields": fields, "elements": elements}


CENTER_FORM_TEMPLATES = [
    {
        "name": "개인정보 수집·이용 동의서",
        "status": "published",
        "schema": _flow([
            {"key": "agree_items", "type": "checkbox_group", "label": "아래 항목에 동의합니다.", "required": True,
             "options": ["개인정보 수집·이용 동의", "민감정보(심리상태 등) 처리 동의", "제3자 제공 동의"]},
            {"key": "guardian_name", "type": "text", "label": "보호자 성명", "required": True},
            {"key": "signature", "type": "signature", "label": "보호자 서명", "required": True},
            {"key": "signed_date", "type": "date", "label": "작성일", "required": True},
        ]),
    },
    {
        "name": "상담 신청서",
        "status": "published",
        "schema": _flow([
            {"key": "name", "type": "text", "label": "이름", "required": True},
            {"key": "phone", "type": "phone", "label": "연락처", "required": True},
            {"key": "email", "type": "email", "label": "이메일"},
            {"key": "concern_areas", "type": "checkbox_group", "label": "상담 희망 분야",
             "options": ["정서/불안", "행동", "또래관계", "학습", "발달", "기타"]},
            {"key": "prev_counseling", "type": "radio", "label": "이전 상담 경험", "options": ["있음", "없음"]},
            {"key": "reason", "type": "textarea", "label": "신청 사유"},
        ]),
    },
    {
        "name": "초기 면담 기록지",
        "status": "published",
        "schema": _flow([
            {"key": "main_concern", "type": "textarea", "label": "주호소 문제", "required": True},
            {"key": "history", "type": "textarea", "label": "발달력 / 병력"},
            {"key": "family", "type": "text", "label": "가족 관계"},
            {"key": "goal", "type": "textarea", "label": "상담 목표"},
        ]),
    },
    {
        "name": "부모 양육태도 설문",
        "status": "published",
        "schema": _flow([
            {"key": "q1", "type": "radio", "label": "자녀의 의견을 존중하는 편이다.", "options": _SCALE},
            {"key": "q2", "type": "radio", "label": "일관된 양육 태도를 유지한다.", "options": _SCALE},
            {"key": "q3", "type": "radio", "label": "자녀와 충분한 시간을 보낸다.", "options": _SCALE},
            {"key": "note", "type": "textarea", "label": "기타 의견"},
        ]),
    },
    {
        "name": "아동 행동 평가 체크리스트",
        "status": "published",
        "schema": _flow([
            {"key": "observed", "type": "checkbox_group", "label": "최근 관찰된 행동",
             "options": ["과잉행동", "주의산만", "불안/위축", "공격성", "충동성", "또래갈등"]},
            {"key": "frequency", "type": "radio", "label": "빈도", "options": ["드물게", "가끔", "자주", "매우 자주"]},
            {"key": "detail", "type": "textarea", "label": "구체적 상황"},
        ]),
    },
    {
        "name": "회기 기록지",
        "status": "published",
        "schema": _flow([
            {"key": "session_date", "type": "date", "label": "회기 일자", "required": True},
            {"key": "session_no", "type": "number", "label": "회기 차수", "required": True},
            {"key": "content", "type": "textarea", "label": "회기 내용", "required": True},
            {"key": "remark", "type": "textarea", "label": "특이사항"},
            {"key": "next_plan", "type": "select", "label": "다음 회기 계획",
             "options": ["놀이치료 지속", "부모상담 병행", "검사 실시", "종결 준비"]},
        ]),
    },
    {
        "name": "심리검사 실시 동의서",
        "status": "published",
        "schema": _flow([
            {"key": "agree_items", "type": "checkbox_group", "label": "동의 항목", "required": True,
             "options": ["검사 실시 동의", "결과의 상담 활용 동의", "결과 보관 동의"]},
            {"key": "signature", "type": "signature", "label": "보호자 서명", "required": True},
            {"key": "signed_date", "type": "date", "label": "작성일", "required": True},
        ]),
    },
    {
        "name": "놀이치료 관찰 기록지",
        "status": "draft",
        "schema": _flow([
            {"key": "obs_date", "type": "date", "label": "관찰 일자", "required": True},
            {"key": "play_theme", "type": "textarea", "label": "놀이 주제 / 내용"},
            {"key": "mood", "type": "radio", "label": "정서 상태", "options": ["안정", "보통", "불안정"]},
            {"key": "interpretation", "type": "textarea", "label": "해석 및 소견"},
        ]),
    },
    {
        "name": "부모 상담 기록지",
        "status": "published",
        "schema": _flow([
            {"key": "counsel_date", "type": "date", "label": "상담 일자", "required": True},
            {"key": "attendee", "type": "text", "label": "참석자"},
            {"key": "summary", "type": "textarea", "label": "상담 요약", "required": True},
            {"key": "homework", "type": "textarea", "label": "가정 내 권고"},
        ]),
    },
    {
        "name": "종결 보고서",
        "status": "published",
        "schema": _flow([
            {"key": "client_name", "type": "text", "label": "내담자명", "required": True},
            {"key": "closing_date", "type": "date", "label": "종결 일자", "required": True},
            {"key": "summary", "type": "textarea", "label": "상담 경과 요약", "required": True},
            {"key": "recommendation", "type": "textarea", "label": "사후 권고"},
            {"key": "closing_type", "type": "select", "label": "종결 유형",
             "options": ["목표 달성", "중도 종결", "기관 의뢰", "기타"]},
        ]),
    },
    {
        "name": "위기개입 평가지",
        "status": "draft",
        "schema": _flow([
            {"key": "risk_level", "type": "radio", "label": "위험 수준", "required": True,
             "options": ["낮음", "보통", "높음", "긴급"]},
            {"key": "signs", "type": "checkbox_group", "label": "관찰된 위기 징후",
             "options": ["자해 언급", "공격 행동", "급격한 위축", "수면/식이 문제", "기타"]},
            {"key": "action", "type": "textarea", "label": "개입 내용"},
            {"key": "emergency_contact", "type": "phone", "label": "비상 연락처"},
        ]),
    },
    {
        "name": "서비스 만족도 설문",
        "status": "published",
        "schema": _flow([
            {"key": "overall", "type": "radio", "label": "전반적 만족도", "options": _SCALE},
            {"key": "recommend", "type": "radio", "label": "주변에 추천하고 싶다.", "options": _SCALE},
            {"key": "improvement", "type": "textarea", "label": "개선 의견"},
        ]),
    },
    {
        "name": "재방문 예약 신청서",
        "status": "draft",
        "schema": _flow([
            {"key": "name", "type": "text", "label": "이름", "required": True},
            {"key": "phone", "type": "phone", "label": "연락처", "required": True},
            {"key": "preferred_date", "type": "date", "label": "희망 날짜"},
            {"key": "preferred_time", "type": "select", "label": "희망 시간대", "options": ["오전", "오후", "저녁"]},
            {"key": "memo", "type": "textarea", "label": "요청 사항"},
        ]),
    },
]


# ==================== 시드 실행 ====================


def _validate_all() -> None:
    """삽입 전 모든 스키마를 백엔드 검증기로 검증 (실패 시 시드 중단)."""
    for t in SYSTEM_FORM_TEMPLATES + CENTER_FORM_TEMPLATES:
        validate_form_schema(t["schema"])


async def _upsert(session, center_id, name, schema, status):
    """(center_id, name) 활성 행이 있으면 schema 갱신, 없으면 생성."""
    result = await session.execute(
        select(FormTemplate).where(
            (FormTemplate.center_id == center_id) if center_id else FormTemplate.center_id.is_(None),
            FormTemplate.name == name,
            FormTemplate.deleted_at.is_(None),
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.schema = schema
        existing.status = status
        existing.is_active = True
        await session.flush()
        print(f"  🔄 '{name}' 갱신 (canonical, ID {existing.id})")
    else:
        session.add(
            FormTemplate(center_id=center_id, name=name, version=1, schema=schema, is_active=True, status=status)
        )
        print(f"  ✅ '{name}' 생성 (canonical)")


async def seed_form_templates(session):
    print("\n📋 시스템 양식 시드 (canonical)...")
    for t in SYSTEM_FORM_TEMPLATES:
        await _upsert(session, None, t["name"], t["schema"], t["status"])
    await session.commit()
    print("✅ 시스템 양식 완료")


async def seed_center_form_templates(session):
    print(f"\n📋 센터 데모 양식 시드 (canonical) — {CENTER_NAME}...")
    center = (
        await session.execute(
            select(Center).where(
                Center.business_registration_number == CENTER_BRN,
                Center.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if not center:
        print(f"  ⏭️  센터 '{CENTER_NAME}' 없음 — scripts.seed.develop 먼저 실행. (건너뜀)")
        return
    for t in CENTER_FORM_TEMPLATES:
        await _upsert(session, center.id, t["name"], t["schema"], t["status"])
    await session.commit()
    print("✅ 센터 데모 양식 완료")


async def main():
    print("=" * 70)
    print("문서 양식(FormTemplate) 시드 — canonical(pages/fields/elements)")
    print("=" * 70)
    _validate_all()
    print(f"✅ 사전 검증 통과 — 시스템 {len(SYSTEM_FORM_TEMPLATES)} + 센터 {len(CENTER_FORM_TEMPLATES)}")

    async with AsyncSessionLocal() as session:
        try:
            await seed_form_templates(session)
            await seed_center_form_templates(session)
            print("=" * 70)
            print("✅ 시드 완료!")
            print(f"  [시스템] {SYSTEM_FORM_TEMPLATES[0]['name']} "
                  f"(필드 {len(SERVICE_CONTRACT_SCHEMA['fields'])} · 요소 {len(SERVICE_CONTRACT_SCHEMA['elements'])})")
            print(f"  [센터] 데모 {len(CENTER_FORM_TEMPLATES)}건")
            print("=" * 70)
        except Exception as e:
            print(f"\n❌ 오류: {e}")
            import traceback
            traceback.print_exc()
            await session.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(main())
