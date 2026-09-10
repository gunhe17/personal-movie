---
name: check-harness
description: Claude Code 환경의 성숙도를 6축 × 3단계로 진단하고 우선순위 액션을 제시한다. 슬림 버전 — 서브에이전트 없이 단일 흐름으로 동작하며, 글로벌(User)과 프로젝트(Project) 양쪽을 점검한다.
disable-model-invocation: true
---

# check-harness — Claude Code 환경 성숙도 진단

"AI 에이전트가 잘 일하도록 하는 환경(harness)"이 얼마나 갖춰져 있는지를 6축 × 3단계로 평가하고, 다음에 손댈 만한 우선순위 액션 3~7개를 제시한다.

> 원본: `team-attention/harness`의 `check-harness` 스킬을 우리 환경에 맞춰 단순화한 버전. 4개의 서브에이전트를 spawn하는 대신 단일 흐름으로 진행한다.

## 호출

- `/check-harness` — 글로벌+프로젝트 둘 다
- `/check-harness user` — 글로벌만 (`~/.claude/`)
- `/check-harness project` — 프로젝트만 (현재 cwd의 `.claude` + CLAUDE.md)
- `/check-harness both` — 위 둘을 분리 점수로 산출 (default와 같음)

---

## 6축 (cyclical)

진단은 다음 6축으로 한다. 각 축은 L1(Getting Started) → L2(Making It Yours) → L3(Self-Operating)로 성숙도가 올라간다.

| # | 축 | 핵심 질문 |
|---|----|-----------|
| 1 | **Structure (Scaffolding)** | AI가 프로젝트를 스스로 파악할 수 있는가? |
| 2 | **Context** | 도메인·정책·암묵지가 명시적인 문서로 노출되는가? |
| 3 | **Planning** | 작업 전에 계획·분해·승인 게이트가 있는가? |
| 4 | **Execution** | 위임·병렬·도구 선택이 적절히 이뤄지는가? |
| 5 | **Verification** | 테스트·린트·리뷰·되돌리기 안전망이 있는가? |
| 6 | **Improvement (Compounding)** | 반복되는 일이 규칙/자동화로 축적되는가? |

각 축의 상세 체크 항목은 `references/checklist.md`를 사용한다.

---

## 진행 절차 (단일 흐름)

서브에이전트를 spawn하지 않고 한 흐름으로 진행한다. 단계마다 raw 증거(파일 경로·라인·명령 출력)를 수집해 두고, 평가 시 인용한다.

### 0. Scope 결정
호출 인자로 결정. `/check-harness`만 들어오면 `both` 기본.

### 1. 정적 수집 (Static)
설치·존재 자체를 확인. 다음 위치를 훑는다.

**User scope:**
- `~/.claude/CLAUDE.md`, `~/.claude/*.md` (import 포함)
- `~/.claude/skills/`, `~/.claude/agents/`, `~/.claude/commands/`
- `~/.claude/plugins/`
- `~/.claude/settings*.json`

**Project scope:**
- `<repo>/CLAUDE.md` (루트), `<repo>/apps/*/CLAUDE.md`
- `<repo>/.claude/skills/`, `<repo>/.claude/agents/`, `<repo>/.claude/commands/`
- `<repo>/.claude/settings*.json`
- 테스트/린트 설정: `package.json` scripts, `pyproject.toml`, `eslint.config.*`, `vitest.config.*`, `pytest.ini` 등
- CI 설정: `.github/workflows/`, `.gitlab-ci.yml` 등
- 훅: `.husky/`, `lefthook.yml`, `.git/hooks/`

### 2. 행동 신호 (Behavioral)
**사용자 프롬프트는 읽지 않는다. 메타 정보(스킬 호출 빈도, MCP 서버 활성/비활성, 최근 커밋 패턴)만 본다.**

- 최근 30일 git 활동: `git log --since="30 days ago" --pretty=format:"%h %s" | head -50` 등으로 작업 패턴 파악
- `.claude/` 폴더 mtime으로 최근 갱신 여부
- 메모리 디렉토리에 메모가 쌓이고 있는지 (`~/.claude/projects/<encoded>/memory/`)

### 3. 성장 신호 (Growth)
- 스킬·에이전트·룰 파일의 추가/수정 빈도
- 새로 추가된 자동화(훅, CI 작업, scripts)
- 메모리 신규 항목 수

### 4. 채점
`references/checklist.md`의 항목들을 PASS / WEAK_PASS / FAIL / N/A로 판정.

**판정 규칙:**
- **PASS** — 명백한 증거 있음 (파일 존재 + 내용이 항목 요구를 충족)
- **WEAK_PASS** — 형식은 갖췄지만 실효성이 약함 (예: CLAUDE.md는 있는데 내용이 빈약)
- **FAIL** — 증거 없음
- **N/A** — 이 프로젝트에서 해당 항목이 무의미한 경우 (드물게)

**축 점수 (0~100):**
- L1 항목 = 가중치 3, L2 = 2, L3 = 1
- 점수 = (PASS합계 + WEAK_PASS×0.5) / 만점 × 100

**성숙도 레벨:**
- 모든 L1 항목 PASS → 최소 L1
- L1 모두 + L2의 70% 이상 PASS → L2
- L1·L2 모두 + L3 절반 이상 PASS → L3

**Execution 축은 User와 Project를 따로 점수 매기고, 더 낮은 쪽이 그 축의 최종 점수가 된다.**

**Compounding 축은 시간 미분(증가 추세)이라 절대 점수보다 "최근 N일간 성장 여부" 위주로 판단한다.**

### 5. TL;DR 합성
- 헤드라인 한 줄 (예: "Harness Score 64/100 · User L2 · Project L1")
- 축별 한 줄 평
- 강점 3개, 약점 3개
- **다음 액션 3~7개** — 각 액션은:
  - 무엇을 (어디에) 추가/수정할지 구체적
  - 가능하면 copy-paste 가능한 명령/파일 스니펫
  - 적용 시 기대 효과 (어느 축 점수가 얼마나 오를지)

### 6. 리포트 작성

**위치**: `claudedocs/harness/check-<YYYY-MM-DD>.md`
같은 날짜 리포트가 있으면 `-2`, `-3` suffix를 붙인다.

**템플릿:**

```markdown
# check-harness · <YYYY-MM-DD>

> scope: <user|project|both>
> Harness Score: NN/100
> User: L<1-3> · Project: L<1-3> · Compounding: <↑↗→↘↓>

## TL;DR
- <한 줄 헤드라인>
- 강점: ...
- 약점: ...
- 다음 3가지: ...

## 축별 점수

```
1. Structure       [████████░░] 80  L2
2. Context         [██████░░░░] 60  L1
3. Planning        [█████░░░░░] 50  L1
4. Execution       [███████░░░] 70  L2
5. Verification    [████░░░░░░] 40  L1
6. Improvement     [██░░░░░░░░] 20  L1
```

## Axis 1 · Structure
**점수 N/100 · 레벨 L?**

| 항목 | 판정 | 증거 |
|------|------|------|
| 명확한 디렉토리 구조 | ✅ PASS | `CLAUDE.md:5` 트리 다이어그램 + 실제 구조 일치 |
| ... | ... | ... |

**평가**: <2~3줄>

**다음 액션**:
- [ ] ...

(축 2~6 동일 형식)

## 우선순위 액션 (전체)

### 🔴 즉시 (1~2시간)
1. **<짧은 제목>** — 어느 축: ?
   - 무엇을: ...
   - 어디에: `path/to/file`
   - 기대 효과: <축> +Npt

### 🟡 다음 스프린트
...

### 🟢 장기
...

## 부록 · 수집 데이터
- scanned: N files
- skills installed: N (project) / N (user)
- last 30d commits: N
- recent additions: ...
```

### 7. 사용자에게 보고
짧게:
- 리포트 경로
- 점수와 레벨
- 가장 임팩트 큰 1~2개 액션 미리보기
- "전체 보려면 `claudedocs/harness/check-<date>.md`"

---

## 원칙

- **추측 금지**. 모든 판정은 증거(파일:라인, 명령 출력) 인용.
- **결함 프레이밍 금지**. "X가 없음" 대신 "X를 추가하면 Y 축 +Npt".
- **사용자 프롬프트는 안 읽는다**. 행동 신호는 메타 정보(파일 존재·갯수·mtime·git log)에서만 추출.
- **N/A는 신중하게**. 정말 해당 안 되는 경우에만. 보통은 FAIL.
- **Compounding은 별도 트랙**. 다른 축과 단순 합산하지 않고 추세(↑↗→↘↓)로만 표시.
- **세션 1회당 1번 권장**. 같은 날 여러 번 돌리면 의미 없음.

---

## references

- `references/checklist.md` — 6축 × 각 단계 체크 항목 (원본 5축 매핑 포함)
