# s07-자동일지 — 10분, 그리고 가방 속 녹음기

기기: web
배역: 회기 축 — 이하준 회기의 필드노트  (정본 CAST.md)

## 조작 순서
회기 상세(`?session=` 딥링크) → `일지 초안 생성`(인라인) → "전사 분석 중…" → 초안이 칸에 채워짐 → 초안 이력
제품 버그(`client_ids` 누락)를 고친 뒤 정상 동작. features.md 참조.

## 캡처 지점

리허설 실측(2026-09-10, SPEC v3). 촬영 시각은 lead 3초가 앞에 붙는다.

- 시작: 회기 상세 — 필드노트가 붙은 1회기
- 종료: 채워진 일지
- 전체 길이: 조작 15.3초 + lead/tail 6초 ≈ **21초**

| 구간 | 리허설 t | 무엇 |
|---|---|---|
| **노컷** | 1.2 – 12.0 (10.8초) | `일지 초안 생성` → "전사 분석 중…" → 칸이 채워진다. **쓰는 일이 다듬는 일로 바뀌는 그 자리** |

## 리허설
`node .claude/skills/scene-prep/scripts/rehearse.mjs --scene s07-자동일지 --url "http://localhost:3503/counseling/status/<caseId>?session=<sessionId>" --state _state/local-saas-counselor1.json --script _scripts/s07-draft.mjs`
전제: 필드노트가 붙은 회기를 골라야 한다(시드가 3건을 상담 일정에 연결한다). 한 번 돌리면 `note_status=completed`가 되므로 **재실행은 되돌린 뒤**
마지막 결과: **종료 코드 0 · 서버 오류 0 · 5단계 15.3초** (2026-09-10). DB: 그 회기 일지 갱신 · `note_status=completed`

## 테이크
| take | 파일 | 결과 | 재촬영 사유 |
|---|---|---|---|
| t01 | | | |
