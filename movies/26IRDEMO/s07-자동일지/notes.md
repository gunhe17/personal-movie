# s07-자동일지 — 10분, 그리고 가방 속 녹음기

## 촬영 (2026-09-11 새벽 · SPEC v6 · s01 배치 규칙)

**선택본 `s07_web_draft_t06` — 10.27초 · 충실도 99% · 드롭 0 · 노컷 2.22–6.17.**
목업 `mockup/s07_web_draft_t06_imac.mp4`.

배치 그대로(초안이 채워지는 것은 **상태 변화**라 `beat`가 맞다). 막혀 있던 것을 풀었다 — 로컬에 `OPENAI_API_KEY`가 없고 **이벤트 워커가 따로 돌아야** 초안이 생성된다. `app.worker.event`를 띄우고, 모델 한 홉만 `_scripts/llm-stub.mjs`로 갈아 끼웠다(대본은 제품 자신의 `production_ai_configs`에 있다). `llm_calls`에 기록이 남는 진짜 경로다.

부하로 굶은 판은 `_scripts/capture-until-good.sh`가 자동으로 다시 찍는다(기준 충실도 98%).

기기: web
배역: **검사 축 — 윤도현**(2014-05-08 · 만 12세) · 개인상담 C00003 1회기(2026-09-09 16:00–16:50) — **s06이 녹음한 그 회기**  (정본 CAST.md)
시드: `_seed/saas-2026-09-10c.json` (sha256 앞 8자리 `c901b092`) + s01 촬영 결과(윤도현) + `s06-setup.sql` + `s07-setup.sql`

## 선행 의존 — s01 → s06 → s07

윤도현은 시드에 없다(s01이 화면에서 만든다). 회기·전사는 `s06-setup.sql`이 만든다.
**s07-setup.sql은 그 다음에 돌린다** — 일지를 비우고 `note_status`를 되돌리고 초안 본문을 고정한다.

```bash
.claude/skills/scene-prep/scripts/reset-seed.sh --yes                        # ① 되돌리기
node .claude/skills/scene-prep/scripts/rehearse.mjs --scene s01-접수 \
  --url http://localhost:3503/agent --state _state/local-saas-counselor1.json \
  --script _scripts/s01-intake.mjs --mock _mocks/s01-intake.json --headless    # ② 윤도현
PGPASSWORD=imomtae_dev psql -h localhost -p 3501 -U imomtae -d imomtae \
  -v ON_ERROR_STOP=1 -f _scripts/s06-setup.sql                                 # ③ 케이스·회기·전사
PGPASSWORD=imomtae_dev psql -h localhost -p 3501 -U imomtae -d imomtae \
  -v ON_ERROR_STOP=1 -f _scripts/s07-setup.sql                                 # ④ 일지 비우기 + 본문 고정
```

④의 마지막 `select`가 **caseId · sessionId**를 뽑는다 — ③을 다시 돌리면 바뀐다. 명령에 박지 말고 그때 뽑는다.
(이 기계는 `docker exec` 권한이 막혀 있다 — `psql -h localhost -p 3501`로 붙는다.)

## 조작 순서
회기 상세(`?session=` 딥링크) → `일지 초안 생성`(인라인) → "전사 분석 중…" → 세 칸이 채워짐 → **아래로 한 번**(다음 상담 내용까지 보여준다)
본문은 `_scripts/s07-setup.sql`이 넣는 `production_ai_configs` 행으로 고정된다(진짜 gpt-4o-mini 호출 · 받아쓰기만 시킨다). features.md 참조.

## 캡처 지점

리허설 실측(2026-09-10 · SPEC v4 · 윤도현 본문). 촬영 시각은 lead 1.5초가 앞에 붙는다.

- 시작: 회기 상세 — 녹음(30:00)은 있고 일지 세 칸은 비어 있다
- 종료: 세 칸이 다 보이도록 한 번 내린 일지
- 전체 길이: 조작 **11.5초** + lead/tail 2.7초 ≈ **14.2초** (LLM이 늦으면 최대 18.4초 — 실측 11.5·11.6·13.6·15.7초)

| 구간 | 리허설 t | 무엇 |
|---|---|---|
| **노컷** | 0.71 – 8.32 (7.6초) | `일지 초안 생성` → "전사 분석 중…" → 세 칸이 동시에 채워진다. **쓰는 일이 다듬는 일로 바뀌는 그 자리** |
| 마무리 | 9.0 – 10.7 | 커서를 일지 안에 두고 한 번 내려 `다음 상담 내용`까지 보여준다 |

**노컷 길이는 테이크마다 다르다** — OpenAI 응답이 6.1~10.1초 사이에서 흔들린다(네 번 실측: 6.1 · 6.1 · 8.1 · 10.1).
세 칸이 한 화면에 다 안 들어오는 것은 본문 길이 탓이 아니다 — 빈 칸 최소 높이가 108이라 구조적으로 그렇다(features.md 실측).

## 리허설
```bash
export PGPASSWORD=imomtae_dev
CASE=$(psql -h localhost -p 3501 -U imomtae -d imomtae -tAc \
  "select id from counseling_cases where case_code='C00003'")
SESS=$(psql -h localhost -p 3501 -U imomtae -d imomtae -tAc \
  "select cs.id from counseling_sessions cs join counseling_cases cc on cc.id=cs.counseling_case_id
    where cc.case_code='C00003' and cs.deleted_at is null")
node ../../.claude/skills/scene-prep/scripts/rehearse.mjs --scene s07-자동일지 \
  --url "http://localhost:3503/counseling/status/$CASE?session=$SESS" \
  --state _state/local-saas-counselor1.json --script _scripts/s07-draft.mjs --headless
```
**매번 `s07-setup.sql`부터** — 한 번 돌리면 일지가 채워지고 `note_status=completed`가 되며 초안 이력이 1건 쌓인다.
마지막 결과: **종료 코드 0 · 서버 오류 0 · 7단계 11.5초**(눈으로 본 시뮬레이션) / 11.6·13.6·15.7초(헤드리스, 2026-09-10).
DB: 일지 갱신 · `note_status=completed` · 초안 1건 · `llm_calls` 1줄(gpt-4o-mini, 4.3~5.3초).
**다섯 번 돌려 `counseling_notes.content`가 문자 단위로 동일**했다(md5 `538ff837…`). 회기를 다시 만든 뒤(새 id)에도 같았다.

## 이 장면에서 밟은 함정

- **회기 시작 시각이 미래면 일지가 통째로 안 열린다** — `isBeforeStart`(features.md). s06이 오늘 16:00으로 만든 회기를
  14:25에 열면 `일지 초안 생성` 버튼 자체가 없다. **s06-setup.sql의 회기를 2026-09-09 16:00으로 옮겨 해결했다**
- **초안은 진짜 LLM 호출이다** — 키가 죽으면 스낵바가 안 뜨고 `until`이 60초에서 던진다
- 화면의 시각 표기는 저장값 +9h다(`2026-09-10 (목) 01:00 ~ 01:50`) — 시드의 모든 회기가 같다. 제품 버그, 기록만 했다

## 테이크
| take | 파일 | 결과 | 재촬영 사유 |
|---|---|---|---|
| t01 | `s07_web_draft_t01.meta.json` (mov 없음) | 폐기 — 케이스 id가 세션과 어긋나 회기 상세가 안 열림 | |
| t02·t03 | meta만 (mov 없음) | 폐기 | |
| t04 | `raw/s07_web_draft_t04.mov` (15.13s) | **본편 제외** — 배역이 이하준 | 윤도현으로 옮기며 무효. 재촬영은 `--retake-of t04 --reason "배역 이동(이하준→윤도현)"` |
