# 투사 검사 — 로르샤흐 잉크반점 검사 (Rorschach)

> 검사 유형별 definition 확장 계획. 현재는 설계 단계이며, 실제 해당 검사 도입 시 구현 진행.

---

## 1. 검사 개요

| 항목 | 내용 |
|------|------|
| **분류** | 투사 검사 (Projective Test) |
| **자극** | 10장의 표준화된 잉크반점 카드 (Card I ~ X) |
| **응답 방식** | 자유 언어 반응 (반응 개수 제한 없음) |
| **진행 단계** | 자유반응(Free Association) → 질문(Inquiry) 2단계 |
| **채점** | 코딩 체계로 분류 (Exner 종합체계 기준) |
| **workflow_type** | 추후 정의 필요 (예: `projective` 또는 `manual_coding`) |

---

## 2. 핵심 특성

### 객관 검사와의 차이

| | 객관 검사 (self_report) | 로르샤흐 (투사) |
|---|---|---|
| **자극** | 텍스트 문항 (`questions`) | 이미지 카드 (`stimuli`) |
| **응답** | 고정 선택지 중 택1 | 자유 언어 반응 (개수 무제한) |
| **채점** | value 합산 (자동) | 코딩 체계로 분류 (수동/반자동) |
| **진행** | 순차 1회 | 2단계 (자유반응 → 질문) |
| **definition 역할** | 문항 + 선택지 정의 | 자극 카드 + 코딩 카테고리 정의 |

### 관리자 편집 필요 여부

**❌ 편집 UI 불필요**

- 카드 10장, 코딩 체계 모두 표준화되어 수정할 일이 없음
- definition은 시드 데이터로 1회 입력 후 고정
- 에디터가 아닌 **채점/기록 입력 UI**에서 definition을 참조하는 구조

---

## 3. definition 구조 (예시)

```json
{
  "type": "projective",
  "administration": {
    "phases": ["free_association", "inquiry"],
    "instruction": "이 그림이 무엇처럼 보이는지 말씀해 주세요."
  },
  "stimuli": [
    {
      "number": 1,
      "card_id": "I",
      "image_url": "/assets/rorschach/card_01.png",
      "characteristics": {
        "chromatic": false,
        "description": "흑백 대칭 잉크반점"
      }
    },
    {
      "number": 2,
      "card_id": "II",
      "image_url": "/assets/rorschach/card_02.png",
      "characteristics": {
        "chromatic": true,
        "description": "흑백 + 적색 잉크반점"
      }
    },
    {
      "number": 10,
      "card_id": "X",
      "image_url": "/assets/rorschach/card_10.png",
      "characteristics": {
        "chromatic": true,
        "description": "다색 잉크반점"
      }
    }
  ],
  "coding_categories": {
    "location": {
      "label": "반응 영역",
      "codes": [
        { "code": "W", "label": "전체 반응" },
        { "code": "D", "label": "일반 부분 반응" },
        { "code": "Dd", "label": "특이 부분 반응" },
        { "code": "S", "label": "공백 반응" }
      ]
    },
    "determinant": {
      "label": "결정인",
      "codes": [
        { "code": "F", "label": "형태" },
        { "code": "M", "label": "인간 운동" },
        { "code": "FM", "label": "동물 운동" },
        { "code": "m", "label": "무생물 운동" },
        { "code": "C", "label": "순수 색채" },
        { "code": "CF", "label": "색채-형태" },
        { "code": "FC", "label": "형태-색채" },
        { "code": "T", "label": "질감" },
        { "code": "Y", "label": "음영-확산" },
        { "code": "V", "label": "음영-차원" }
      ]
    },
    "content": {
      "label": "반응 내용",
      "codes": [
        { "code": "H", "label": "전체 인간" },
        { "code": "Hd", "label": "부분 인간" },
        { "code": "A", "label": "전체 동물" },
        { "code": "Ad", "label": "부분 동물" },
        { "code": "An", "label": "해부" },
        { "code": "Art", "label": "예술" },
        { "code": "Bl", "label": "혈액" },
        { "code": "Na", "label": "자연" }
      ]
    },
    "form_quality": {
      "label": "형태 질",
      "codes": [
        { "code": "+", "label": "우수" },
        { "code": "o", "label": "보통" },
        { "code": "u", "label": "특이" },
        { "code": "-", "label": "부적절" }
      ]
    },
    "popular": {
      "label": "평범 반응",
      "codes": [
        { "code": "P", "label": "평범 반응" }
      ]
    }
  }
}
```

---

## 4. responses 구조 (예시)

definition이 채점 지원용이므로, 실제 데이터는 responses 쪽이 핵심:

```json
{
  "responses": [
    {
      "card_number": 1,
      "response_number": 1,
      "phase": "free_association",
      "verbatim": "박쥐처럼 보여요",
      "inquiry": "날개가 양쪽으로 펼쳐져 있고 가운데 몸통이 있어서요",
      "coding": {
        "location": "W",
        "determinant": ["F"],
        "content": ["A"],
        "form_quality": "o",
        "popular": true
      }
    },
    {
      "card_number": 1,
      "response_number": 2,
      "phase": "free_association",
      "verbatim": "나비 같기도 해요",
      "inquiry": "...",
      "coding": {
        "location": "W",
        "determinant": ["F"],
        "content": ["A"],
        "form_quality": "o",
        "popular": true
      }
    }
  ]
}
```

---

## 5. 구현 시 고려사항

### 5.1 UI 방향

- 문항 에디터 UI 불필요 (시드 고정)
- 필요한 것은 **채점 입력 UI**: 카드 이미지 표시 + 반응별 코딩 입력 폼
- coding_categories를 드롭다운/선택지로 제공

### 5.2 workflow_type

- `self_report`와 완전히 다른 흐름이므로 별도 workflow_type 필요
- 예: `projective` 또는 `manual_coding`

### 5.3 채점 엔진

- 코딩 결과를 기반으로 구조 요약(Structural Summary) 자동 계산
- 엔진 플러그인으로 분리 (definition과 독립)
