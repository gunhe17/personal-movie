"""review_flags — 빈 축 유사물 채움의 결정론 판정 (lab E37~E39, 정밀 8/8·오탐 0 실측 케이스)."""
from app.runtime.voucher_document.markdown_to_voucher.review_flags import flag_fields


def _axes(flags):
    return [f["축"] for f in flags]


def test_group_size_without_capacity_signal_flagged():
    # E37 실측: 한도·방식 서술("연 1회")이 집단규모 자리에 — 정원 신호 없음
    fields = {"집단규모": [{"조건": None, "값": "연 1회 재판정", "page": "p-1", "quote": "재판정"}]}
    assert _axes(flag_fields(fields)) == ["집단규모"]
    ok = {"집단규모": [{"조건": None, "값": "1:1-1:3", "page": "p-1", "quote": "1:1"}]}
    assert flag_fields(ok) == []
    ok2 = {"집단규모": [{"조건": None, "값": "제공인력 1명당 3인 이내"}]}
    assert flag_fields(ok2) == []


def test_staff_without_qualification_signal_flagged():
    fields = {"제공인력": {"자격": [{"value": "시군구청장", "page": "p-1", "quote": "시군구청장"}]}}
    assert _axes(flag_fields(fields)) == ["제공인력"]
    # 오탐 교정 실측: 직군 어미(재활사·요원 등)는 자격 신호
    ok = {"제공인력": {"자격": [{"value": "언어재활사", "page": "p-1", "quote": "언어재활사"}]}}
    assert flag_fields(ok) == []


def test_amount_with_sanction_vocab_flagged():
    fields = {"금액": [{"명칭": "주차표지", "금액": [{"값": "부정사용 시 과태료 200만원"}]}]}
    assert _axes(flag_fields(fields)) == ["금액"]
    ok = {"금액": [{"명칭": "지원금", "금액": [{"값": "180,000원"}]}]}
    assert flag_fields(ok) == []


def test_age_without_signal_flagged():
    assert _axes(flag_fields({"연령기준": {"value": "건강한 사람", "page": "p-1", "quote": "q"}})) == ["연령기준"]
    # 오탐 교정 실측: "없음"·"성인"은 연령 신호
    assert flag_fields({"연령기준": {"value": "없음", "page": "p-1", "quote": "q"}}) == []
    assert flag_fields({"연령기준": {"value": "만 65세 이상", "page": "p-1", "quote": "q"}}) == []
    assert flag_fields({"연령기준": {"value": None, "page": None, "quote": None}}) == []


def test_region_unbound_names_flagged_and_bound_pass():
    # E38 f6 변형 실측: 단가표 행정동 열을 격자로 오인 — region_master 미결속 다수
    fields = {"지역": {"지역들": [{"이름": "행복동", "mark": "○"}, {"이름": "사랑동", "mark": "○"}],
                     "page": "p-1", "quote": "q"}}
    assert _axes(flag_fields(fields)) == ["지역"]
    # 오탐 교정 실측: 무어미 시군명("수원")은 사전 결속으로 통과
    ok = {"지역": {"지역들": [{"이름": "수원", "mark": "○"}, {"이름": "가평군", "mark": "○"}],
                 "page": "p-1", "quote": "q"}}
    assert flag_fields(ok) == []


def test_finding_shape_and_value_preserved():
    fields = {"집단규모": [{"조건": None, "값": "연 1회"}]}
    f = flag_fields(fields)[0]
    assert f["유형"] == "검토플래그" and "요약" in f and f["값"] == "연 1회"
    assert fields["집단규모"][0]["값"] == "연 1회"          # 값 보존 — 경고만(정직)
    assert flag_fields({}) == []
