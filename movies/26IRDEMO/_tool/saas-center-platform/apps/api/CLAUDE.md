# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

Backend(FastAPI) 컨벤션. 레포 루트 CLAUDE.md와 함께 적용한다.

## 주석 · docstring 컨벤션 (엄격 — 기본값은 "없음")

**좋은 코드는 이름·타입·구조로 말한다. 주석은 코드가 표현하지 못하는 것만 적는 최후 수단이다.**
주석을 달고 싶으면, 먼저 함수/변수로 추출해 **이름으로 의도를 드러낼 수 없는지** 본다.

### 🚫 지운다
- **동어반복.** 함수명·변수명·타입·다음 줄이 이미 말하는 것. (`x = sub_offset  # 갱신`, `# 결과 파싱`, `def send(): """전송"""`)
- **나레이션.** 제어 흐름을 말로 옮긴 것. (`# 첫 호출 시 시작`, `# 큐에 남은 것 수집`, `# 병렬 실행`)
- **장식·형식.** 배너(`# ──`, `# ##`), `Args:`/`Returns:` 블록, 파일명·클래스명 재진술 module docstring, 필드명 옮긴 `Field(description=...)`.

### ✅ 남긴다 (코드로 표현 불가능한 것에 한해, 한 줄로)
- 외부 API의 비자명한 제약·함정 (예: *AWS는 15초 무음이면 스트림을 끊는다*)
- 매직넘버의 단위·근거 (예: *PCM 16kHz 16bit mono: 1초 = 32000 bytes*)
- sentinel(`None` 등)의 의미, 의도된 정책(fallback 없음 등)

### 판단 기준 (주석 하나하나에)
**"이 주석이 없으면 다음 사람이 코드를 잘못 고칠 수 있나?"** — 아니면 지운다.