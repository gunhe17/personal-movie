# Harness 성숙도 체크리스트

> 출처: `team-attention/harness`의 `materials/harness-checklist.md` (5축 × 3단계)를 우리 `check-harness` 스킬의 6축 구조에 매핑.
> 핵심 원칙: **Compound, don't compact.** 3번 반복되면 자동화, 3번 실수하면 규칙화, 안 쓰이는 건 제거.

---

## 6축 ↔ 원본 5축 매핑

우리 `check-harness`는 6축(Structure · Context · Planning · Execution · Verification · Improvement)을 사용한다. 원본은 5축이라 다음과 같이 매핑한다.

| 우리 6축 | 원본 5축 |
|---------|---------|
| 1. Structure | Scaffolding |
| 2. Context | Context |
| 3. Planning | Orchestration의 계획 부분 |
| 4. Execution | Orchestration의 실행 부분 |
| 5. Verification | Verification |
| 6. Improvement | Compounding |

Orchestration이 우리에서는 Planning(전)/Execution(중)으로 쪼개진다.

---

## Axis 1 · Structure (Scaffolding)

### L1 — Getting Started
- [ ] 명확한 디렉토리 구조 (탑레벨 폴더에 README 또는 CLAUDE.md 트리 다이어그램)
- [ ] 프로젝트 루트에 `CLAUDE.md` 또는 동등 가이드 파일
- [ ] 작업/대화 컨텍스트 간 분리 (예: 모노레포면 앱별 nested CLAUDE.md)
- [ ] 민감 파일 보호 (`.env`, 키 파일 등이 `.gitignore`에 등록)

### L2 — Making It Yours
- [ ] 도메인별 룰 파일 (`.claude/rules/`, 또는 CLAUDE.md 내 도메인 섹션)
- [ ] 프로젝트 자동화 일부 작동 (CI, pre-commit hook 등 1종 이상)
- [ ] AI 행동 경계 명시 (예: "main에 직접 커밋 금지", "lab 외부 수정 금지" 등)

### L3 — Self-Operating
- [ ] 신규 입사자가 추가 설명 없이 프로젝트 파악 가능 (CLAUDE.md만 읽고 핵심 흐름·명령 이해)

---

## Axis 2 · Context

### L1
- [ ] 반복되는 지시사항이 문서화됨 (같은 말 3번 했으면 CLAUDE.md/메모리에 기록)
- [ ] 설정/README가 길지 않고 핵심 위주
- [ ] 암묵지가 명시적 문서로 전환 ("팀이 다 아는 규칙"이라도 적혀있음)

### L2
- [ ] 계층화된 정보 구조 (요약 → 상세 / 루트 CLAUDE.md → docs/)
- [ ] 도메인 용어·정책이 문서로 (용어집·정책 노트)
- [ ] 외부 시스템 연동 정보 명시 (API 베이스 URL, 인증 방식 등)

### L3
- [ ] 점진적 컨텍스트 로딩 (필요할 때만 불러오는 구조 — `@import`, references/, sub-skills 활용)

---

## Axis 3 · Planning (Orchestration · 계획)

### L1
- [ ] 작업 시작 시 배경·목적·제약을 공유
- [ ] 완료 기준을 사전에 정의

### L2
- [ ] 실행 전 계획 작성 (Plan tool, TodoWrite, 또는 명시적 계획 단계)
- [ ] 작업에 적합한 위임 결정 (직접 vs 서브에이전트 vs 스킬)

### L3
- [ ] 자기 반복 워크플로우 ("/loop" 같은 자동 반복)
- [ ] 커스텀 계획 프로세스 (도메인 전용 계획 스킬 또는 룰)

---

## Axis 4 · Execution (Orchestration · 실행)

### L1
- [ ] 핸드오프 문서화 (서브에이전트에게 충분한 컨텍스트 전달)

### L2
- [ ] 병렬 실행 활용 (독립 작업을 동시에)
- [ ] 도구 선택이 적절 (전용 툴 vs Bash, MCP vs 네이티브)

### L3
- [ ] 정교한 오케스트레이션 패턴 사용 (Sequential / Parallel / Team / Loop 등 의도적 선택)

---

## Axis 5 · Verification

### L1
- [ ] 테스트 환경 존재 (단위/통합/E2E 중 최소 1종)
- [ ] 자동 포맷팅/린트 작동 (Prettier/ESLint/Ruff 등 + 커밋 시 동작)
- [ ] 위험 작업 안전망 (force push 금지, main 직접 커밋 차단 등)

### L2
- [ ] 되돌릴 수 있는 구조 (feature branch, draft PR, dry-run)
- [ ] dry-run → 확인 → 실제 실행 흐름이 위험 작업에 적용
- [ ] 에러 복구 메커니즘 (자동 롤백, 트랜잭션 경계)

### L3
- [ ] E2E 검증 자동화
- [ ] 별도 검증 에이전트/스킬 사용 (예: `/review`, `/security-review`, ultrareview)

---

## Axis 6 · Improvement (Compounding)

> 절대 점수보다 "최근에 늘고 있는가"를 본다.

### L1
- [ ] AI가 반복한 실수를 규칙으로 전환 (feedback 메모리, RULES.md)
- [ ] 반복 작업이 추적되고 있음 (메모에 패턴 기록)

### L2
- [ ] 반복 작업을 자동화 (스킬·훅·스크립트로 흡수)
- [ ] 사용 메트릭 모니터링 (어떤 스킬이 실제로 쓰이는가)

### L3
- [ ] 정기 감사 후 안 쓰이는 룰·자동화 제거 (스킬 묘지 방지)

---

## 빠른 자가 점검 — 3개의 질문

성숙도 레벨 빠르게 추정할 때.

1. **새 입사자에게 `CLAUDE.md`만 던져주면 첫 PR을 낼 수 있나?**
   - 그렇다 → Structure·Context L2 이상
2. **지난 30일 동안 새 스킬·룰·훅이 추가되었나?**
   - 그렇다 → Improvement L2 이상
3. **AI가 같은 실수를 두 번째 했을 때 그 다음엔 안 하게 만든 장치가 있나?**
   - 그렇다 → Improvement L3 후보

---

## 안티 패턴 (피해야 할 신호)

- CLAUDE.md가 1000줄 넘는데 실제로는 30%만 정확 — **doc-drift 돌릴 시점**
- 스킬·에이전트가 많은데 최근 30일간 호출 0회 — **묘지**
- 같은 규칙이 여러 문서에 다르게 적혀있음 — **Conflict 드리프트**
- 메모리에 같은 사실이 3번 이상 중복 — **중복 정리 필요**
- "필요시 ~한다" 류 모호한 지시문 다수 — **Risky 드리프트**
