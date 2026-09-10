---
name: doc-drift
description: Codex가 컨텍스트로 로드하는 문서들(AGENTS.md, 메모리, .Codex/skills·agents·commands, 플러그인)을 스캔해 outdated·conflict·risky/ambiguous 세 종류의 드리프트를 찾는다. 모든 발견은 file:line 증거 필수. 솔루션 프레이밍.
disable-model-invocation: true
---

# doc-drift — Codex 컨텍스트 문서 감사

Codex가 실제로 읽어들이는 문서가 코드·설정과 어긋나거나, 서로 충돌하거나, 위험·모호한 표현을 담고 있는지 점검한다.

## 호출 옵션

- `/doc-drift` — 전체 감사
- `/doc-drift recent [N]` — 최근 N개 커밋이 건드린 파일과 관련된 문서만 점검
- `/doc-drift path <glob>` — 특정 경로만 (예: `apps/mobile/**`)

호출 인자가 없거나 애매하면 사용자에게 한 번만 확인한다.

---

## 1단계: 컨텍스트 파일 수집

Codex가 실제로 로드하는 파일들을 빠짐없이 모은다. **읽는 건 메타 정보(파일 경로·구조)와 본문이지, 사용자 프롬프트가 아니다.**

### 글로벌 (User scope)
- `~/.Codex/AGENTS.md`
- `~/.Codex/*.md` (SuperClaude 프레임워크 등 import된 것들)
- `~/.Codex/skills/`, `~/.Codex/agents/`, `~/.Codex/commands/`
- `~/.Codex/projects/<encoded-cwd>/memory/MEMORY.md` 및 같은 폴더의 메모리 파일들

### 프로젝트 (Project scope)
- `<repo>/AGENTS.md` (루트)
- `<repo>/apps/*/AGENTS.md` (모노레포: web/mobile/api 등 nested AGENTS.md)
- `<repo>/.Codex/skills/`, `<repo>/.Codex/agents/`, `<repo>/.Codex/commands/`
- `<repo>/.Codex/settings*.json`

### 플러그인
- `~/.Codex/plugins/` 하위에 설치된 플러그인의 SKILL.md / AGENT.md / commands

### 재귀 추적
파일 안의 다음 토큰을 따라가서 함께 평가 대상에 넣는다.
- `@import` / `@<path>` 토큰
- 마크다운 상대 링크 `[text](./path)`
- 백틱 안의 파일 경로 ``` `apps/web/src/lib/...` ```

---

## 2단계: 세 가지 드리프트 탐지

각 발견은 **반드시 양쪽 file:line을 증거로 동반**한다. 한쪽만 보이는 추측은 발견으로 올리지 않는다.

### 🔴 Outdated — 코드/설정과 어긋나는 주장
문서가 주장하는 경로·버전·정책·구조가 실제 저장소 상태와 다를 때.

예시:
- AGENTS.md가 `apps/web/src/routes/(protected)/clients/` 라고 하는데 폴더가 이미 옮겨졌거나 이름이 바뀜
- `pnpm dev`라고 적혀있는데 `package.json` script는 `pnpm dev:all`
- 디자인 토큰이 `tailwind.config.js`와 `theme.ts` 둘 다 동기화되어야 한다고 적혀있는데 실제로 값이 다름 (이 프로젝트 특수 케이스)
- Pydantic v1 표현(`@validator`)이 가이드에 남아있는데 코드는 v2(`@field_validator`) 사용

**검증 방법**: 문서의 주장 → 실제 코드/설정 파일을 직접 열어 확인 → 두 file:line을 함께 인용.

### 🟡 Conflict — 두 문서가 같은 주제를 다르게 말함
같은 규칙·경로·컨벤션을 두 문서가 다르게 명시하는 경우.

예시:
- 루트 AGENTS.md는 "Service 간 호출 금지", 다른 가이드는 "Service에서 다른 Service 호출 가능"
- 글로벌 RULES.md는 "TodoWrite for >3 step tasks", 프로젝트 가이드는 "5단계 이상에서만"
- 모바일 AGENTS.md는 "border-gray-200", 다른 섹션은 "border 사용 금지"

**검증 방법**: 두 문서의 file:line을 나란히 인용 + 어느 쪽이 최신·우세인지 후보 의견 제시(결정은 사용자).

### 🟠 Risky / Ambiguous — 위험하거나 해석 여지가 큰 표현
스코프 없는 삭제 지시, 강한 모호어, 적용 조건 없는 절대 명령.

예시:
- "필요 없는 파일은 삭제하라" — 어떤 기준? 어디까지?
- "성능이 나쁘면 캐시를 도입하라" — '나쁘다'의 기준이 없음
- "테스트는 항상 실행한다" — 어떤 명령? 어떤 환경?
- "centerId가 없으면 throw" 가이드와 "null 허용 패턴" 가이드가 같이 존재

**검증 방법**: 모호어/위험 지시문을 인용 + 해석 가능한 경우의 수 2개 이상 제시.

---

## 3단계: 우선순위 정렬

발견 항목을 다음 기준으로 정렬한다.

1. **Scope** — 매 대화마다 로드되는 파일(`AGENTS.md`, `MEMORY.md`, 글로벌 `RULES.md` 등)일수록 위
2. **Severity** — HIGH (실제 동작·결정 왜곡) > MED (혼란 유발) > LOW (사소한 불일치)
3. **Fix clarity** — 명백한 해결책이 있는 것 먼저

각 발견에는 **수정 제안**을 함께 적는다. 결함 프레이밍(`X가 없음`)이 아니라 **솔루션 프레이밍**(`X를 추가하면 Y가 개선됨`)으로 표현.

---

## 산출 — 리포트

### 위치
- `claudedocs/doc-drift/<YYYY-MM-DD-HHMM>.md` (타임스탬프 영구 보관)
- `claudedocs/doc-drift/latest.md` (최신본 복사 — 항상 덮어씀)
- 디렉토리 없으면 생성

### 템플릿

```markdown
# doc-drift report · <YYYY-MM-DD HH:MM>

> scope: <user|project|both> · mode: <full|recent|path>
> scanned: <N>개 파일 (<glob 또는 목록>)

## Summary
- 🔴 Outdated: N건 (HIGH N · MED N · LOW N)
- 🟡 Conflict: N건
- 🟠 Risky/Ambiguous: N건
- 가장 임팩트 큰 3건:
  1. [HIGH] <한 줄>
  2. [HIGH] <한 줄>
  3. [MED]  <한 줄>

---

## 🔴 Outdated

### O-1. [HIGH] <짧은 제목>
**주장 (문서)**: `AGENTS.md:42` — "X is at /a/b/c"
**실제 (코드)**: `apps/web/src/.../x.ts:1` — 경로가 /a/b/d 로 이동
**제안**: AGENTS.md:42를 `/a/b/d`로 갱신 → 새 입사자가 잘못된 경로를 찾지 않음

### O-2. ...

## 🟡 Conflict

### C-1. [MED] Service 간 호출 규칙
**문서 A**: `AGENTS.md:120` — "Service 간 호출 금지"
**문서 B**: `apps/api/docs/refactoring-checklist.md:88` — "Service에서 다른 Service 사용 가능"
**제안**: A를 정답으로 통일(전역 RULES와 부합). B를 "Application Handler에서 조합"으로 다시 표현

## 🟠 Risky / Ambiguous

### R-1. [LOW] 모호한 삭제 지시
**위치**: `RULES.md:230` — "필요 없는 파일은 삭제"
**해석 후보**:
  - (a) 모든 임시 산출물
  - (b) 작업 폴더 안의 산출물만
  - (c) 추적되지 않은 파일만
**제안**: 스코프와 검증 절차를 명시 (예: "`git status` 기준 untracked 임시 산출물만, 삭제 전 한 번 더 확인")

---

## Human Judgment Needed
자동 판단이 어려워 사용자 결정을 기다리는 항목 (정답이 둘 다 가능한 경우).

- ...

## 적용 제안 (선택)
- 일괄 수정 PR 초안: `Codex /doc-drift apply` (구현 시)
- 또는 위 항목을 하나씩 검토 후 수동 반영
```

---

## 원칙

- **거짓 양성 최소화**. 자신 없는 발견은 올리지 않거나 LOW로 강등.
- **증거 필수**. 모든 발견은 양쪽 file:line. 단일 인용은 발견으로 안 침.
- **요약 문서를 존중**. AGENTS.md가 다른 문서를 가리키기만 하는 경우는 정상. **의미상 어긋남(semantic drift)** 만 발견으로 본다.
- **고임팩트 우선**. AGENTS.md / MEMORY.md / RULES.md의 드리프트가 가장 위험.
- **추측 금지**. 한쪽을 못 찾았으면 발견이 아니라 "Human Judgment Needed"에 메모.
- **mock·lab·archived 경로는 제외** (예: `apps/mobile/app/(main)/lab/`, `claudedocs/archive/`).

---

## 우리 프로젝트 특수 체크포인트

이 프로젝트(`saas-center-platform`)에서 드리프트가 잘 생기는 곳을 평소보다 강하게 점검한다.

- **디자인 토큰 동기화** — `apps/mobile/tailwind.config.js` ↔ `apps/mobile/src/shared/constants/theme.ts` 색·radius·spacing 값이 1:1로 일치하는지
- **루트 AGENTS.md ↔ apps/mobile/AGENTS.md** — 같은 도메인을 양쪽에서 다르게 설명하는지 (디자인 시스템, 커밋 prefix 등)
- **API 레이어 규칙** — Handler/Facade/Service 책임 분리 규칙이 실제 코드와 일치하는지 (특히 `app/modules/*/handlers/` 내부)
- **Frontend V4 아키텍처** — `apps/web/src/lib/features/<domain>/` 의 5단 레이어 파일이 신규 도메인에 일관되게 존재하는지
- **메모리 stale 여부** — `~/.Codex/projects/.../memory/`의 project 메모리가 명시한 사실(파일 경로·정책)이 아직 유효한지
