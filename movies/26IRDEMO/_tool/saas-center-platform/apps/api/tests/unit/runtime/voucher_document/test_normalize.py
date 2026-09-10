"""normalize — 캡처→정규화 매퍼 테스트 (flat v2).

파서(연령·소득·금액·천원/만원)는 flat v2에서도 그대로 재사용 — 케이스 유지.
map_capture 는 flat v2 record(서비스[]·집단규모 조건부·절차·금액[]·운영규칙 + 팩 v4.1
신규 8축 passthrough)를 검증한다. 사업유형·항목 캡처 축은 v4.1 에서 소멸(P10). 금액[] 가 등급표(정부/본인 소득등급 요금표)+다중지원·단가를 통합하는지가 핵심.
"""

from app.runtime.voucher_document.markdown_to_voucher.normalize import (
    map_capture,
    parse_age,
    parse_amount_cell,
    parse_income,
    parse_won,
)


def _cell(
    value,
    page="p-044",
    quote=None,
):
    return {"value": value, "page": page, "quote": quote or value}


class TestParsers:
    def test_won_variants(self):
        assert parse_won("회당 32,500원") == 32500
        assert parse_won("월 180천원") == 180_000    # 천원 단위 — h03 함정
        assert parse_won("월 24만원") == 240_000
        assert parse_won("12,800원") == 12_800
        assert parse_won("무관") is None

    def test_age_boundaries(self):
        # "미만 → -1" 환산은 코드의 몫 (h04 E1: LLM 위임 시 12/-1/11 3해석)
        assert parse_age("만 24세 미만 지적·자폐성 장애인") == {"최대": 23}
        assert parse_age("12세 미만 비장애 아동") == {"최대": 11}
        assert parse_age("만 0세∼만 6세") == {"최소": 0, "최대": 6}
        assert parse_age("만 65세 이상 노인") == {"최소": 65}
        assert parse_age("만 18세 이하 아동·청소년, 단 고등학교 재학 중인 경우 인정") == {
            "최대": 18, "학적연장": {"학교": "고등학교"},
        }
        assert parse_age("연령 무관") == {"없음": True}
        assert parse_age("건강한 성인") is None

    def test_income_variants(self):
        assert parse_income("기준중위소득 140% 이하") == {"최대": 140}
        assert parse_income("소득기준 없음(별도 설정가능)") == {"없음": True}
        r = parse_income("기준중위소득 140% 이하 또는 기초연금수급자")
        assert r["최대"] == 140 and r["자격"] == ["기초연금수급자"]
        assert parse_income("기준중위 소득 140% 이하(지역 여건에 따라 변경 가능)") == {
            "최대": 140, "지역위임": True,
        }
        assert parse_income("소득 판정은 건강보험료 본인부담금으로 확인")["판정"] == "건강보험료"
        # 복수 상이 % 는 단일 상한이 아니다 — 파싱 실패(하강 대상)
        assert parse_income("65% 이하 가형, 120% 이하 나형") is None

    def test_amount_cell(self):
        assert parse_amount_cell("180,000원(90%)") == {"금액": 180_000, "비율": 90}
        assert parse_amount_cell("90%") == {"비율": 90}
        assert parse_amount_cell("면제") == {"금액": 0}
        assert parse_amount_cell("0원") == {"금액": 0}
        assert parse_amount_cell("해당없음") is None


class TestMapCapture:
    def test_kept_axes_still_parse(self):
        # 유지 축(지역·소득·연령·욕구·우선순위·제외·중복금지·제공인력)
        capture = {
            "소득기준": _cell("기준중위소득 140% 이하"),
            "연령기준": _cell("만 0세∼만 6세"),
            "욕구기준": {"지표": [
                {"내용": "발달 평가 추후검사 등급", "증빙": ["검사 결과", "추천서"],
                 "page": "p-078", "quote": "추후 검사 필요 등급"},
            ], "재량": None},
            "우선순위": [],
            "제외": [],
            "중복금지": {"불가": ["발달재활서비스"], "허용": None,
                     "page": "p-078", "quote": "중복지원 불가"},
            "제공인력": {"자격": [{"내용": "언어재활사", "page": "p-078", "quote": "언어재활사"}],
                     "결격": None},
        }
        record, findings = map_capture(capture)

        assert "대상유형" not in record and "사업유형" not in record
        assert record["소득기준"]["최대"] == 140
        assert record["연령기준"] == {
            "최소": 0, "최대": 6, "ref": {"page": "p-044", "quote": "만 0세∼만 6세"},
        }
        assert record["욕구기준"]["지표"][0]["증빙"] == ["검사 결과", "추천서"]
        assert record["중복금지"]["불가"] == ["발달재활서비스"]
        assert record["제공인력"]["자격경로"][0]["내용"] == "언어재활사"
        assert record["지역"] is None
        assert findings == []

    def test_benefit_grade_table_absorbed(self):
        # 등급표(정부/본인 소득등급 요금표) → 금액 1묶음 + 조건부 N (핵심)
        capture = {"금액": [{
            "명칭": "바우처 지원금", "주기": "월정액", "적용대상": "만 7~18세",
            "금액": [
                {"조건": {"등급": "가형"}, "정부지원": "200,000원", "본인부담": "0원",
                 "값": None, "page": "p-078", "quote": "200,000원"},
                {"조건": {"등급": "나형"}, "정부지원": "190,000원", "본인부담": "10,000원",
                 "값": None, "page": "p-078", "quote": "190,000원"},
                {"조건": {"등급": "다형"}, "정부지원": "180,000원", "본인부담": "20,000원",
                 "값": None, "page": "p-078", "quote": "180,000원"},
            ],
            "page": "p-078", "quote": "바우처 지원금",
        }]}
        record, findings = map_capture(capture)

        benefits = record["금액"]
        assert len(benefits) == 1
        assert benefits[0]["명칭"] == "바우처 지원금"
        assert benefits[0]["주기"] == "월정액"
        amounts = benefits[0]["금액"]
        assert len(amounts) == 3
        assert amounts[0] == {
            "조건": {"등급": "가형"}, "정부지원금": 200_000, "본인부담금": 0,
            "ref": {"page": "p-078", "quote": "200,000원"},
        }
        assert amounts[2]["정부지원금"] == 180_000 and amounts[2]["본인부담금"] == 20_000
        assert findings == []

    def test_benefit_pct_amount(self):
        # %-등급표도 금액 내부 조건부로 (비율 키)
        capture = {"금액": [{"명칭": "정부지원", "금액": [
            {"조건": {"등급": "1등급"}, "정부지원": "90%", "본인부담": "10%",
             "page": "p-096", "quote": "90%"},
        ], "page": "p-096", "quote": "지원"}]}
        record, _ = map_capture(capture)
        amt = record["금액"][0]["금액"][0]
        assert amt["정부지원비율"] == 90 and amt["본인부담비율"] == 10
        assert "정부지원금" not in amt

    def test_legacy_급여_key_still_maps(self):
        # D18 읽기 호환: 구 캡처 키 "급여" → record "금액"
        capture = {"급여": [{"명칭": "구키", "금액": [
            {"값": "1만원", "page": "p-1", "quote": "1만원"},
        ], "page": "p-1", "quote": "구키"}]}
        record, _ = map_capture(capture)
        assert record["금액"][0]["명칭"] == "구키"
        assert record["금액"][0]["금액"][0]["금액"] == 10_000
        assert "급여" not in record

    def test_multi_benefit_no_loss(self):
        # 다중 병렬 지원(가정위탁류) — 전부 담기고 하나도 유실 없음
        capture = {"금액": [
            {"명칭": "양육보조금", "주기": "월정액", "적용대상": "위탁아동",
             "금액": [{"조건": {"연령": "만7세 미만"}, "값": "월 340천원",
                     "page": "p-1", "quote": "340천원"}], "page": "p-1", "quote": "양육보조금"},
            {"명칭": "전문아동보호비", "주기": "월정액", "적용대상": "전문위탁부모",
             "금액": [{"값": "월 100만원", "page": "p-1", "quote": "100만원"}],
             "page": "p-1", "quote": "전문아동보호비"},
            {"명칭": "일시위탁보호비", "주기": "일당", "적용대상": "일시위탁부모",
             "금액": [{"값": "일 3만원", "page": "p-1", "quote": "3만원"}],
             "page": "p-1", "quote": "일시위탁보호비"},
        ]}
        record, findings = map_capture(capture)

        names = [b["명칭"] for b in record["금액"]]
        assert names == ["양육보조금", "전문아동보호비", "일시위탁보호비"]
        assert record["금액"][0]["금액"][0]["금액"] == 340_000  # 340천원 환산
        assert record["금액"][0]["금액"][0]["조건"] == {"연령": "만7세 미만"}
        assert record["금액"][1]["금액"][0]["금액"] == 1_000_000
        assert findings == []

    def test_group_size_conditional_and_present_only(self):
        # 집단규모 조건부 passthrough + 값 없는 빈 항목은 버림(fabrication 방어)
        capture = {"집단규모": [
            {"조건": {"서비스유형": "기본유형", "지역": "농어촌·도서"}, "값": "1:1-1:3",
             "page": "p-1", "quote": "1:1-1:3"},
            {"조건": {"서비스유형": "기본유형", "지역": "기타"}, "값": "1:1-1:12",
             "page": "p-1", "quote": "1:1-1:12"},
            {"조건": {"서비스유형": "학습모듈", "지역": None}, "값": None,  # 빈 항목 — 버림
             "page": "p-1", "quote": None},
        ]}
        record, _ = map_capture(capture)
        gs = record["집단규모"]
        assert len(gs) == 2  # 빈 값 항목 제외
        assert gs[0] == {
            "값": "1:1-1:3", "ref": {"page": "p-1", "quote": "1:1-1:3"},
            "조건": {"서비스유형": "기본유형", "지역": "농어촌·도서"},
        }

    def test_group_size_scalar_no_condition(self):
        # 단일 집단규모(조건 없음)
        capture = {"집단규모": [{"조건": None, "값": "제공인력 1명당 3인 이내",
                             "page": "p-1", "quote": "3인 이내"}]}
        record, _ = map_capture(capture)
        assert record["집단규모"] == [
            {"값": "제공인력 1명당 3인 이내", "ref": {"page": "p-1", "quote": "3인 이내"}},
        ]

    def test_stages_flat(self):
        capture = {"절차": [
            {"내용": "1단계 등록·상담", "page": "p-1", "quote": "등록·상담"},
            {"내용": "2단계 계획 수립", "page": "p-1", "quote": "계획 수립"},
        ]}
        record, _ = map_capture(capture)
        assert record["절차"] == [
            {"내용": "1단계 등록·상담", "ref": {"page": "p-1", "quote": "등록·상담"}},
            {"내용": "2단계 계획 수립", "ref": {"page": "p-1", "quote": "계획 수립"}},
        ]

    def test_services_list(self):
        capture = {"서비스": [
            {"유형명": "기본유형", "내용": [
                {"설명": "정서순화 프로그램", "page": "p-1", "quote": "정서순화"}]},
            {"유형명": None, "내용": [
                {"설명": "클래식 프로그램", "page": "p-1", "quote": "클래식"}]},
        ]}
        record, _ = map_capture(capture)
        svc = record["서비스"]
        assert svc[0]["유형명"] == "기본유형"
        assert svc[0]["내용"][0]["설명"] == "정서순화 프로그램"
        assert "유형명" not in svc[1]  # 유형명 없으면 생략

    def test_op_rules_open_and_months(self):
        capture = {"운영규칙": [
            {"종류": "지원기간", "내용": "12개월, 재판정 1회", "page": "p-1", "quote": "12개월"},
            {"종류": "이월", "내용": "미사용 금액 다음년도 2월까지 이월",
             "page": "p-1", "quote": "이월"},
        ]}
        record, _ = map_capture(capture)
        rules = record["운영규칙"]
        assert rules[0] == {
            "종류": "지원기간", "내용": "12개월, 재판정 1회", "개월": 12,
            "ref": {"page": "p-1", "quote": "12개월"},
        }
        assert rules[1]["종류"] == "이월" and "개월" not in rules[1]

    def test_region_nationwide_expansion(self):
        record, _ = map_capture({"지역": {"전국": True, "지역들": [], "page": "p-003", "quote": "전국"}})
        pairs = record["지역"]["추진지역"]
        assert {"시도": "세종특별자치시", "시군구": None} in pairs
        assert {"시도": "경기도", "시군구": "수원시"} in pairs
        assert len(pairs) > 200

    def test_region_binding_and_x_mark(self):
        capture = {"지역": {"전국": None, "지역들": [
            {"이름": "수원시", "mark": "○"},
            {"이름": "가평군", "mark": "X"},      # X 는 미추진 — 제외
            {"이름": "없는시", "mark": "○"},      # 마스터 밖 — 결속 실패
        ], "page": "p-010", "quote": "시군별 추진현황"}}
        record, findings = map_capture(capture)
        assert record["지역"]["추진지역"] == [{"시도": "경기도", "시군구": "수원시"}]
        assert any(f["유형"] == "지역결속실패" for f in findings)
        assert any(i["라벨"] == "지역(미결속)" for i in record["항목"])

    def test_unparseable_values_descend_to_items(self):
        # "조용히 틀리는" → "시끄럽게 남는": 비정형 값은 record 에 안 싣고 항목+소견
        capture = {
            "소득기준": _cell("65% 이하 가형, 120% 이하 나형"),
            "연령기준": _cell("성장기 아동"),
        }
        record, findings = map_capture(capture)
        assert record["소득기준"] is None and record["연령기준"] is None
        assert {f["축"] for f in findings} == {"소득기준", "연령기준"}
        assert len(record["항목"]) == 2

    def test_empty_capture_shape(self):
        # 빈 캡처 — 배열 축은 [], 나머지 null (record shape 계약)
        record, findings = map_capture({})
        assert "대상유형" not in record and "사업유형" not in record and "급여" not in record
        assert record["서비스"] == [] and record["집단규모"] == []
        assert record["절차"] == [] and record["금액"] == [] and record["운영규칙"] == []
        assert record["목적"] is None and record["신청"] is None
        assert record["법적근거"] == [] and record["신고의무"] == [] and record["중지상실"] == []
        assert record["처리통지"] is None and record["이의신청"] is None and record["환수"] is None
        assert record["항목"] == []
        assert findings == []

    def test_new_axes_passthrough(self):
        # 팩 v4.1 신규 8축 — 서술형 passthrough (값 + 원문 앵커 ref)
        capture = {
            "목적": _cell("정신건강 증진을 위한 심리상담 지원"),
            "법적근거": [{"조문": "제12조", "내용": "정신건강복지법", "page": "p-002", "quote": "정신건강복지법"}],
            "신청": {"신청권자": ["본인", "대리인"], "경로": ["읍·면·동 행정복지센터"],
                   "서류": [{"이름": "지원 신청서", "서식번호": "서식1호", "page": "p-005", "quote": "서식1호"}],
                   "page": "p-005", "quote": "신청"},
            "처리통지": _cell("14일 이내 서면 통지"),
            "이의신청": _cell("90일 이내 이의신청 가능"),
            "신고의무": [{"내용": "거주지 변경 시 신고", "page": "p-007", "quote": "변경 시 신고"}],
            "중지상실": [{"사유": "사망 또는 자격 상실", "시점": "즉시", "조치": "지원 중단",
                      "page": "p-007", "quote": "자격 상실"}],
            "환수": _cell("부정수급액 전액 환수"),
        }
        record, findings = map_capture(capture)
        assert record["목적"] == {"내용": "정신건강 증진을 위한 심리상담 지원",
                               "ref": {"page": "p-044", "quote": "정신건강 증진을 위한 심리상담 지원"}}
        assert record["법적근거"] == [{"내용": "정신건강복지법", "조문": "제12조",
                                  "ref": {"page": "p-002", "quote": "정신건강복지법"}}]
        assert record["신청"]["신청권자"] == ["본인", "대리인"]
        assert record["신청"]["서류"][0]["서식번호"] == "서식1호"
        assert record["처리통지"]["내용"] == "14일 이내 서면 통지"
        assert record["신고의무"][0]["내용"] == "거주지 변경 시 신고"
        assert record["중지상실"][0] == {"사유": "사망 또는 자격 상실", "시점": "즉시", "조치": "지원 중단",
                                     "ref": {"page": "p-007", "quote": "자격 상실"}}
        assert record["환수"]["내용"] == "부정수급액 전액 환수"
        assert findings == []
