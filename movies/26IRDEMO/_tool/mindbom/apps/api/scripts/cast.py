"""촬영용 공통 배역 — saas-center-platform의 develop 시드와 같은 사람들.

한 영상에서 두 제품을 오간다(마인드스코프에서 접수한 아이가 마인드봄에서 검사받는다).
기관·계정·내담자가 이름·생년월일·비밀번호까지 같아야 컷이 이어진다.

정본은 저쪽이다: `saas-center-platform/apps/api/scripts/seed/develop/{center,account,client}.py`.
저쪽이 바뀌면 여기를 따라 고친다 — 반대 방향은 없다.

역할 매핑 — 마인드스코프는 4역할(ADMIN·MANAGER·STAFF·COUNSELOR),
마인드봄은 3역할(admin·clinician·researcher)이라 그대로 옮길 수 없다:
    ADMIN 김원장 · MANAGER 이사무  → admin
    STAFF 박접수                   → researcher (마인드봄에서 보고서는 읽기 전용)
    COUNSELOR 정상담 · 최치료      → clinician (검사 실시·채점·확정)
"""
from datetime import date

INSTITUTION = {
    "name": "마인드스코프 아동심리상담센터",
    "institution_type": "counseling_center",
    "address": "서울특별시 강남구 테헤란로 123 4층 마인드스코프센터",
    "phone": "02-1234-5678",
    "representative": "김원장",
    "business_number": "123-45-67890",
}
INSTITUTION_NAME = INSTITUTION["name"]

PASSWORD = "test1234"

# (key, email, name, mindbom role, license_number)
ACCOUNTS = [
    {"key": "admin", "email": "admin@mindscope.com", "name": "김원장", "role": "admin", "license_number": None},
    {"key": "manager", "email": "manager@mindscope.com", "name": "이사무", "role": "admin", "license_number": None},
    {"key": "staff", "email": "staff@mindscope.com", "name": "박접수", "role": "researcher", "license_number": None},
    {"key": "counselor1", "email": "counselor1@mindscope.com", "name": "정상담", "role": "clinician", "license_number": "임상심리사 1급 2018-0412"},
    {"key": "counselor2", "email": "counselor2@mindscope.com", "name": "최치료", "role": "clinician", "license_number": "임상심리사 2급 2020-1130"},
]

# 검사를 맡는 기본 임상심리사. clinician은 본인이 examiner인 검사만 보므로
# (examination_facade), 촬영 로그인 계정과 검사 담당자가 어긋나면 화면이 빈다.
CLINICIAN_KEY = "counselor1"
ASSISTANT_KEY = "counselor2"


def account(key: str) -> dict:
    """배역표에서 계정 하나. 키가 틀리면 StopIteration으로 바로 터진다."""
    return next(a for a in ACCOUNTS if a["key"] == key)


CLINICIAN = account(CLINICIAN_KEY)

# 보호자(김철수·이수진)는 마인드봄에 오지 않는다 — 검사받는 사람만 옮긴다.
CLIENTS = [
    {"name": "김민준", "birth_date": date(2019, 3, 10), "gender": "male",
     "note": "ADHD 의심, 집중력 문제로 내원", "occupation": None, "referral_source": "self"},
    {"name": "김서연", "birth_date": date(2021, 6, 15), "gender": "female",
     "note": "언어발달 지연 평가 의뢰", "occupation": None, "referral_source": "self"},
    {"name": "김영희", "birth_date": date(1990, 8, 25), "gender": "female",
     "note": "김민준·김서연의 어머니. 본인도 양육 스트레스 상담 중", "occupation": "회사원", "referral_source": "self"},
    {"name": "이하준", "birth_date": date(2016, 9, 22), "gender": "male",
     "note": "학교 적응 문제, 또래관계 어려움", "occupation": None, "referral_source": "school"},
    {"name": "박지우", "birth_date": date(1991, 2, 14), "gender": "female",
     "note": "우울감, 직장 스트레스 상담", "occupation": "사무직", "referral_source": "self"},
    # 아래 셋은 saas develop 시드에 없다 — s01(접수)이 촬영 중에 만드는 인물이고,
    # 그 명단의 정본은 movies/26IRDEMO/_mocks/s01-intake.json 이다. check-cast.py가 그쪽과 대조한다.
    {"name": "윤도현", "birth_date": date(2014, 5, 8), "gender": "male",
     "note": "햇살지역아동센터 단체 검사 — 마인드스코프에서 접수되어 넘어왔다", "occupation": None, "referral_source": "institution"},
    {"name": "장서아", "birth_date": date(2015, 11, 21), "gender": "female",
     "note": "햇살지역아동센터 단체 검사 — 마인드스코프에서 접수되어 넘어왔다", "occupation": None, "referral_source": "institution"},
    {"name": "홍시우", "birth_date": date(2016, 2, 13), "gender": "male",
     "note": "햇살지역아동센터 단체 검사 — 마인드스코프에서 접수되어 넘어왔다", "occupation": None, "referral_source": "institution"},
]

# ⚠️ 이제 종합보고서의 주인공이 아니다 (2026-09-10).
# 배터리·종합보고서는 **윤도현**으로 옮겼다(seed.py의 BATTERY = battery-yundohyun) —
# 마인드봄 SCT가 아동·청소년용 문항이라 만 35세 대상이 애초에 어긋나 있었고,
# 영상의 검사 축을 s01→s02→s03→s04 한 사람으로 잇기 위해서다.
# 박지우는 시드 인물로 남는다(마인드스코프 상담 케이스 C00001).
#
# 이 상수를 읽는 곳은 폐기 도구 `seed_rorschach_full.py` 하나뿐이고,
# 그것은 촬영 흐름에서 돌리지 않는다(STATUS.md — 박지우에게 note 없는 로샤를 하나 더 만든다).
REPORT_CLIENT = "박지우"
