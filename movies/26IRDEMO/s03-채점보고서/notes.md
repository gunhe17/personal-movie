# s03-채점보고서 — 서류는 257분

기기: web · 무대는 마인드봄(4503)
배역: **검사 축 — 윤도현(2014-05-08 · 만 12세 · 남)**. 배터리 `battery-yundohyun` 3종(로샤·HTP·SCT) 확정본이 한 문서로 묶인다 (정본 CAST.md)

## 촬영 직전 준비 — 이 셋을 순서대로

**0) 같은 DB를 지금 누가 쓰는지 먼저 본다.** 2026-09-10 17시에 다른 세션이 s02를 찍는 동안 s03 재시드를 돌렸다가
그쪽 `s02-reset.sh`·촬영이 로샤를 다시 `created` → `in_progress`·반응 2~3으로 만들었다(s02 촬영 자체가 같은 검사를 움직인다).
s02가 찍는 중이면 **기다렸다가** 재시드한다 — 기다린다고 상태가 보존되는 것도 아니므로 s02가 끝난 뒤 반드시 다시 돌린다.

**1) 시드가 s03 자리에 있는지 확인 (읽기 전용).** 이미 맞으면 재시드하지 않는다 — 재시드는 id를 바꾼다(실측: `seed.py`의 id는 결정적이라 2026-09-10 재시드에서 `5d000869…`가 그대로였다. 그래도 확인한다).

```bash
PGPASSWORD=mindbom_dev psql -h localhost -p 4501 -U mindbom -d mindbom -c "
select e.note, e.status from examinations e
where e.note in ('seed:yun-rorschach','seed:battery-htp','seed:battery-sct') and e.deleted_at is null;"
# → 3건 전부 confirmed. comprehensive_reports 1건(윤도현 · seed:report-yundohyun)
```

어긋났을 때만(예: **s02가 `_scripts/s02-reset.sh`로 `yun-rorschach`를 비워 놓은 뒤**) 재시드한다:

```bash
cd _tool/mindbom/apps/api
.venv/bin/python -m scripts.seed && .venv/bin/python -m scripts.seed_content
```

`uv run`을 쓰지 않는다(macOS가 `DYLD_*`를 벗긴다). `scripts.seed_rorschach_full`은 돌리지 않는다.
**재시드하면 검사 id가 바뀌므로 시작 URL을 다시 뽑는다** — psql 한 줄은 `features.md` §시작 URL.

**2) 로그인 상태 파일을 새로 만든다. 마인드봄 토큰은 30분이면 만료된다**(`ACCESS_TOKEN_EXPIRE_MINUTES=30`).
만료된 상태로 열면 `401 GET /api/auth/check`이고 편집기가 뜨지 않아 조작이 첫 단계에서 멈춘다.

```bash
CAP_EMAIL=counselor1@mindscope.com CAP_PASSWORD=test1234 \
  node ../../.claude/skills/capture-service/scripts/login.mjs \
  --base http://localhost:4503 --out _state/local-mindbom-counselor1.json
```

**3) `_tool/mindbom/apps/api/.env`에 `STORAGE_BACKEND=local`이 있는지.** 없으면 HTP 그림 넷이 500이라
사이드바 썸네일이 빈 칸이 된다(`features.md` §스토리지). 고쳤으면 **API 재기동**이 필요하다(reload 없음).

## 조작 순서 (2026-09-10 저녁 재구성)

`AI 종합 리뷰` → 네 단계 훑기 → **55점 · 검토사항 3건**
→ ② 사이드바 **SCT 영역별 점수 요약**을 본문 `4) 자기개념` 문단 아래로 **드래그 앤 드롭** → 표가 앉고 첨부됨 배지
→ ③ 섹션 누락(Ⅲ 행동 관찰) `초안 작성` → 미리보기 → `본문에 적용` → **77점 · 2건**

사용자 결정: "AI 분석 → 왼쪽 자료를 문서에 드래그 앤 드롭 → AI 지적 하나 사용". 서술 모순 통일·구간 리뷰·표현 교정은 조작에서 뺐다(지적은 패널에 남는다).
드래그 앤 드롭은 제품 사본에 이날 추가한 실기능이다 — `features.md` §드래그 앤 드롭.

## 캡처 지점

리허설 실측(2026-09-10 저녁, SPEC v5, 헤드리스, 재시드 뒤). **테이크는 하나다** — `aireview`.

- 시작: A4 편집기, 툴바 우측 `AI 종합 리뷰`
- 종료: Ⅲ 초안이 본문에 적용된 직후
- 총 **17단계 17.5초 · 종료 코드 0 · 서버 오류 0 · 페이지 오류 0 — "깨끗하다, 촬영 가능"**

| 구간 | 무엇 |
|---|---|
| **0.71–6.78 노컷** | 네 단계로 문서를 훑는다 → **완성도 55점 · 검사 3/3 반영 · 검토사항 3건** |
| **6.78–11.85 노컷** | 사이드바 `영역별 점수 요약`(SCT)을 집어 `4) 자기개념` 아래에 놓는다 → 표가 지면에 앉는다(뷰포트 안 349–551px, 6행) → 사이드바에 `첨부됨` |
| **11.85–16.10 노컷** | `섹션 누락`(Ⅲ 행동 관찰) → `초안 작성` → **바뀔 문장 미리보기** → `본문에 적용` → 지적이 사라지고 점수가 오른다 |
| 16.10–16.70 | 홀드. 최종 **77점 · 검토사항 2건** |

HTP 그림이 아니라 **표**를 넣는 이유: 그림은 666×942px라 900px 뷰포트에 잡히지 않았다(t05~t07). SCT 표는 5행이라 한 화면에 앉고, 4) 문단이 인용하는 바로 그 점수다.

**`draft` 테이크는 찍지 않는다.** 따라서 `rule-based-fallback` 글자는 이번 편 프레임에 없다(features.md).
화면의 "개발 예정" 라벨은 **편집에서 사용자가 직접** 넣는다 — 제품·스크립트에 넣지 않았다.

## 리허설

```bash
# movies/26IRDEMO 에서. --headless를 붙이면 헤드리스(반복용)
node ../../.claude/skills/scene-prep/scripts/rehearse.mjs --scene s03-채점보고서 \
  --url "http://localhost:4503/examinations/<yun-rorschach>/report?ids=<로샤>,<HTP>,<SCT>" \
  --state _state/local-mindbom-counselor1.json --script _scripts/s03-review.mjs
```

마지막 결과(2026-09-10 저녁, 재구성 흐름, s02 종료 후 재시드): **17단계 17.5초 · 종료 코드 0 · 서버 오류 0 · 페이지 오류 0 — "깨끗하다, 촬영 가능".**
그 전 판(로샤가 s02 상태였을 때)은 같은 17단계가 끝까지 갔지만 `structural-summary` 400이 1건이었다 — DB 상태 문제이지 흐름 문제가 아니었다.
드롭 위치는 DOM으로 확인했다 — `4) 자기개념`(16) → 빈 문단(17) → **표(18)** → 빈 문단(19) → `5) 대인 지각`.

저장이 없는 화면이라 DB 확인은 "**바뀌지 않았는가**"다 — 리허설 뒤에도 배터리 3종 `confirmed`,
`yun-rorschach` 반응 22, `comprehensive_reports` 1건 그대로였다.

## 테이크

| 테이크 | 길이 | 무엇 |
|---|---|---|
| `report_t01` · `report_t02` | — | 완성된 보고서를 스크롤만. AI가 일하는 장면이 없어 폐기 (파일은 `raw/`에 남긴다) |
| `draft_t01` | 19.07s | AI 초안 생성(진짜 서버). **배역이 박지우라 이번 편에서 뺐다** — 다시 찍지 않는다 (파일은 남긴다) |
| `aireview_t01` | 28.78s | 박지우·목업 6검사 시절 판. 폐기 (파일은 남긴다) |
| `aireview_t02`·`t03` | 28s | 윤도현·실검사 3종 · 구간 리뷰까지 (t03은 사이드바 썸네일을 실제 표로). 폐기 |
| `aireview_t04` | 22.27s | 구간 리뷰 제거, HTP 그림 삽입 추가 — 그림이 화면 밖. 폐기 |
| `aireview_t05`~`t07` | 19~21s | 서술 모순 교정 제거 · 삽입 위치 세 번 조정 — 그림(666×942)이 900px 뷰포트에 안 잡힘. 폐기 |
| `aireview_t08` | 14.53s | 삽입 제거. AI 리뷰 → Ⅲ 초안 적용만. 노컷 2.21–8.30 / 8.30–12.75 · 77점·2건 |
| **`aireview` (재촬영 예정)** | ~18s | **선택본.** 재구성 흐름 — AI 리뷰 → SCT 표 드래그 앤 드롭 → Ⅲ 초안 적용 |

**`raw/` 안의 파일은 폐기 테이크라도 지우거나 옮기지 않는다**(촬영 규칙 4).
