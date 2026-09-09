# 발행된 아티팩트

| 파일 | 제목 | URL | 발행 |
|---|---|---|---|
| `as-is-flow.html` | 상담센터 AS-IS 흐름도 | https://claude.ai/code/artifact/c33d118b-2aec-405e-8590-68d2fcecd2ea | 2026-09-08 |
| `pivot75.html` | 75초의 전환 | https://claude.ai/code/artifact/33665cff-b28b-4000-8f14-df6484aecff1 | 2026-09-09 |
| `demo-v2.html` | 데모 v2 선별안 | https://claude.ai/code/artifact/77909a15-5168-4d5c-a9b0-de9b81320f73 | 2026-09-09 |
| `scenes11.html` | 열한 개의 장면 | https://claude.ai/code/artifact/f3b76487-5c87-416b-bb7a-76b62458275e | 2026-09-09 |
| `scenes9.html` | 아홉 장면 | https://claude.ai/code/artifact/7fbf954e-8fd0-457f-bd1f-ca8ab71bffed | 2026-09-09 |
| `faceless.html` | 얼굴 없는 열한 장면 | https://claude.ai/code/artifact/ad9c9a76-358d-4516-86c8-7bcfb70a1bfe | 2026-09-09 |

여섯 파일은 발행 시점 원본 그대로다. 로컬에서 열 때는 `<!doctype html>`과 `<head>`가 없으므로 (아티팩트 발행 시 자동 래핑됨) 브라우저에 따라 폰트가 다르게 보일 수 있다. Google Fonts 링크는 파일 안에 있다.

## as-is-flow.html
- A. 역할 6개 (SVG 아이콘, 외부 역할은 점선)
- B. 10단계 × 6역할 스윔레인, 고장 표식 5종
- C. 고장 메커니즘 확대도 4장 (이중 입력 회로 / 내담자 왕복 / 정보 소실 지점 / 끊어진 원스톱)
- D. 고장 패턴 5종 정의

## pivot75.html
- 00 근거 등급 (A/B/C/D/✕ 미터)
- 01 먼저 정해야 할 일곱 가지
- 02 화면에 올릴 수 있는 숫자
- 03 BEFORE 13개 기법
- 04 피벗 4개
- 05 AFTER 스펙 표 + 4개
- 06 하지 말 것 6개
- 07 실패 사례 6개
- 08 현장 어휘
- 09 레퍼런스 12개
- 10 75초 마스터 컷 스펙 (4트랙 타임라인)

## demo-v2.html
- 00 결론 — v2 축 유지, 변경 3가지 + 선별 결과 스트립
- 01 코드 현실 지도 (실재/부분/연기/없음/별도, 21개 후보)
- 02 section.md 단위별 판정 (고통·해결·적합 3축)
- 03 75초 마스터 구성
- 04 논의 5개 답 + 회색 문장 교체표
- 05 잘라낸 것 9개
- 06 촬영 전 확인 6개 + 다음 작업
- 로컬 원본: `02-findings/demo-proposal.md`

## scenes11.html — section.md 재작성
- 00 장면을 자르는 기준 (6시험 · 3규칙 · 4층) — 조사에서 도출
- 01–11 장면: AS-IS 10단계 순서. 각 장면 = 역할·물건·정점·패턴 + 시험 통과 표식 + 현장/왜 소모인가/우리가 푼 방식(+반론과 답)/무엇이 돌아오는가
- A section.md 대조표 — 초안의 각 줄이 어디로 갔나
- B 풀지 못한 것 — 미해결 6건, 근거 두께순

## faceless.html — 촬영 없이 장면을 세우는 법
- 00 구조를 정하는 발견 — Jiang 2023: 공포는 실제 사람, 효능은 애니메이션 (n=1,095)
- 01 기법 8개 × 검증 사례 14 × 우리 기준 판정 (권장 6 · 제한 1 · 금지 1)
- 02 열한 장면 × BEFORE/AFTER 기법 배정표
- 03 권장 조합 세 층 — 실제 목소리 / 손과 물건 탑다운 / Screenlife + Remotion
- 출처 26개 링크. 미확인 항목 명시

## scenes9.html — 확정본 (section.md 최종)
- 아홉 장면, 센터 하루 순서. 요소는 제목 · 아날로그 흐름의 문제 · 우리 서비스의 기능적 해결 셋뿐
- 부분 해결·미구현은 각 장면의 "범위" 상자에
- 기능은 web · mobile(상담사) · mobile-client(내담자) 9/9 소스로 확인
