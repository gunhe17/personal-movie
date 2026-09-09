# research/

마인드스코프(MOEUM) 제품 영상을 위한 조사 자료. 2026-09-08 ~ 09-09.

```
01-source/     1차 자료 — MOEUM 워크스페이스에서 가져온 원본
02-findings/   도출한 사실 — 1차 자료와 외부 조사에서 우리가 정리한 것
03-research/   외부 조사 원본 리포트 — 에이전트·Grok 출력 그대로
04-artifacts/  발행한 아티팩트 HTML 원본 + URL
```

## 읽는 순서

1. `02-findings/as-is-flow.md` — 도입 이전 상담이 어떻게 흘러갔나 (10단계 × 6역할)
2. `02-findings/failure-patterns.md` — 거기서 반복되는 다섯 가지 구조
3. `02-findings/video-craft.md` — 그걸 영상으로 옮길 때의 근거와 금지 사항
4. `02-findings/evidence-table.md` — 화면에 올릴 수 있는 숫자와 등급
5. `02-findings/practitioner-quotes.md` — 카피에 쓸 현장 어휘
6. **`02-findings/demo-proposal.md`** — 위 전부를 데모 영상 v2 초안에 대고 선별한 제안. 코드 현실 지도 포함
7. `04-artifacts/scenes11.html` — section.md 재작성 초안. 장면 11개 + 자르는 기준 + 근거
8. **`04-artifacts/scenes9.html`** — **확정본.** 아홉 장면, 제목 · 문제 · 해결만
9. **`04-artifacts/faceless.html`** — 그 장면들을 배우 없이 세우는 법. 기법 8개 사례 조사 + 장면별 배정 + 세 층 조합

## 01-source/

| 경로 | 내용 | 건수 |
|---|---|---|
| `moeum-artifacts-raw.json` | MOEUM 워크스페이스 `GET /artifacts` 원본 덤프 (440건) | 1 |
| `moeum-mcp-guide.html` | MOEUM API 가이드 (인증 · Base URL · 엔드포인트 15개) | 1 |
| `livinglab/` | 리빙랩 1·2·3차 정리 노트 | 15 |
| `meetings/` | 회의록. `094`·`101`은 2026-08-10 현장 실사 STT 녹취 | 6 |
| `memos/` | 센터 피드백 · 기능 정리 · 기획 메모 | 13 |
| `demo-plan/` | 데모 영상 v2 스텝 분류(9/7) + `section.md` 초안 | 2 |
| `webapp-audit/` | `saas-center-platform/apps/web`의 리빙랩 감사 문서 · changelog · 라우트/피처 스냅샷(9/9) | 7 |

`webapp-audit/`는 웹 앱 소스 자체가 아니라 **"무엇이 실제로 구현돼 있나"**를 판정한 문서들이다. 원본은 `/Users/gunhee/workspace/codespace/domain/imomtae/imomtae-v3/TF/saas-center-platform/apps/web`. 7월 판정과 9월 소스가 다른 지점(예약 변경 승인: 더미 → 실재)은 `demo-proposal.md` §1에 반영했다.

파일명 앞 세 자리는 `moeum-artifacts-raw.json` 배열 인덱스. 텍스트는 `content_json`에서 추출했고, 비어 있으면 `content`를 썼다.

1차 리빙랩(실장·전문가·학부모)이 순수 AS-IS 조사이고 2·3차는 프로토타입 검증이다. 성격이 다르니 섞어 읽지 말 것.

## 03-research/

| 파일 | 담당 | 범위 |
|---|---|---|
| `psych-persuasion.md` | Opus 에이전트 | 내러티브 전송 · 식별 가능한 피해자 · 손실 프레이밍 · 정점-종점 · 공포소구 · 반발. 36개 문헌, 90초 편집 설계 |
| `audiovisual-craft.md` | Opus 에이전트 | 편집 리듬 · 사운드 · 색 · 카메라 · 시간 압축 · 전환 · 레퍼런스 16편 · 통설 경고 |
| `clinical-evidence.md` | Opus 에이전트 | 문서화 부담 정량 연구 · 한국 자료 · 현장 발화 · 유사 제품 영상 · **실패 사례** |
| `x-discourse-grok.md` | Grok (X 실시간 검색) | B2B 영상 담론 · AI 스크라이브에 대한 임상의 반응 · 한국 종사자 발화 |
| `x-discourse-grok.prompt.txt` | — | Grok에 준 프롬프트 |

세 에이전트에는 "확인 못 한 것은 그렇게 적고 절대 지어내지 말 것"을, Grok에는 "검색 불가면 먼저 밝힐 것"을 제약으로 걸었다. 각 리포트 끝에 검증 실패 항목이 따로 있다.

## 도구 메모

- MOEUM API: `X-API-Key` 헤더, `.env`의 `MOEUM_TOKEN`. 목록은 `GET /artifacts`, 페이지네이션은 `POST /search/unified` — `meta`에 문서에 없는 필드(`total_artifacts`, `elapsed_ms`, `timing`)가 추가돼 있음.
- Grok 플러그인 브리지는 로컬에서 실패한다 — `/var/run/docker.sock`이 심볼릭 링크라 sandbox 프로파일 적용을 거부. `grok --sandbox none -p "..."` 직접 호출로 우회했다.
