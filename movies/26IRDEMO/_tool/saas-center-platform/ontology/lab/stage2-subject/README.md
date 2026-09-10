# Lab: 2단계(정의→생성)를 사람 축에 적용하면

harness가 `ontology/`(catalog·attributes·bindings)를 입력으로 대상자(subject→clients) 도메인의
표준 use-case를 생성한다고 가정한 **구조 시뮬레이션**. 실제 배선 아님 — 정렬 회의 안건 3(handler layer 범위)의 입력.

- `input/`     harness 입력 — 온톨로지 참조 + 액션 선언 (yaml 분기 논의의 수렴 형태)
- `generated/` 🤖 생성물 시뮬레이션 — DO NOT EDIT 헤더+해시, 재생성 대상
- `custom/`    ✋ 커스텀 3경로 예시 — 오버라이드 / 훅 / (SPI는 기존 engine 선례 참조)
- `audit/`     생성물 무결성·커버리지 감사 스케치

요약 문서: `stage2-사용자-적용도.html`
