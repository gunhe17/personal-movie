# 회기 상세 우측 패널 — 1인 Focus 레이아웃 기획

> 1:1 개별 상담(내담자 1명)일 때 우측 회기 상세 패널이 비어 보이는 문제를, "회기 타임라인 + 가벼운 AI 브리핑"으로 전환하는 기획.
> 여러 명(그룹 상담)일 때는 기존 그리드를 그대로 유지한다.

작성일: 2026-06-05 · 상태: 기획 합의 대기

> ⚠️ **2026-09-03 — 이 문서가 참조하는 경과 분석 쪽 사실이 바뀌었습니다.**
> 기획 자체(1인 Focus 레이아웃)는 그대로 유효하지만, 아래 §5의 AI 브리핑 전제 중
> 세 가지가 낡았습니다. 현행은 [case-analysis.md](case-analysis.md)가 정본입니다.
>
> | 이 문서의 서술 | 현행 |
> |---|---|
> | "좌측 `CaseAnalysisSection`에서 버튼을 눌러야" | 좌측 섹션은 없어졌고 **우측 도크**에서 실행한다 |
> | `content.progress_summary` · `recurring_themes` · `risk_factors` 재사용 | 옛 포맷이다. 신규는 `headline`·`session_track`·`themes`·`interventions`·`direction` (VM이 두 세대를 모두 읽는다) |
> | 11크레딧 | **14크레딧** (서버 `PURPOSE_ESTIMATED_CREDITS`) |
> | "그룹엔 개인 종단 맥락이 부적절" | 그룹도 **집단 단위로는 지원**한다. 다만 성원별 개인 리포트는 여전히 미지원이라, 1인 Focus를 1명일 때만 두는 판단 자체는 유효하다 |


---

## 1. 배경 / 문제

상담 상세 화면 우측 패널([SessionDetailPanel.svelte](../../apps/web/src/lib/components/counseling/SessionDetailPanel.svelte))은 **선택된 한 회기에 참석한 내담자**를 카드(ClientActionCard)로 그리드 배치한다.

```
grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr))
```

- **여러 명(그룹)**: 카드 2~3열로 꽉 참 → 문제 없음
- **1명(1:1 개별)**: `1fr`이 전체 폭을 먹어 카드가 와이드 데스크탑에서 **가로로 과하게 퍼진 빈 카드**가 됨

> 본질은 "빈 공간을 채운다"가 아니라, **세로로 긴 우측 패널의 잉여 면적을, 상담사가 이 회기에서 실제로 필요로 하는 맥락(직전 회기 흐름 + 케이스 진행 위치)으로 전환**하는 것.

**적용 조건**: `session.clients.length === 1` 일 때만 Focus 레이아웃. 그 외에는 기존 그리드.

---

## 2. 레이아웃 (상하 스택)

좌우 2분할이 아니라 **상하 스택**. 주 액션 카드는 폭을 가두고(`max-w`), 잉여는 세로로만 쌓는다.

```
┌─ SessionDetailPanel 우측 (기존 헤더 유지) ───────────────────┐
│ [상태뱃지] 2026-06-05(목) 14:00~15:00   [회기완료][⋯]        │ ← 기존 헤더 그대로
├──────────────────────────────────────────────────────────────┤
│  (px-6 py-6, 내부 max-w-[640px] mx-auto)                      │
│                                                               │
│  ① 회기 타임라인 스트립 (슬림, h~56px)                       │
│     ①─②─③─●④─⑤─⑥              [4/6회기]                  │
│                                                               │
│  ② 내담자 액션 카드 (주역, bg-white border)                  │
│     김민수 ↗                        [참석 ▾]                 │
│     상담 일지를 작성해주세요                                  │
│     [ ✎ 일지 쓰기 ]   [ 청구하기 ]          ← 기존 카드 재사용 │
│                                                               │
│  ③ 이 회기 브리핑 (AI, 접힘 기본 / 없으면 미렌더)            │
│     ✦ 직전까지 흐름  3회기 불참 후 재방문, 정서 다소 위축    │
│     #불안  #가족관계                    전체 분석 보기 →     │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 레이아웃 규칙

| 항목 | 규칙 | 근거 |
|------|------|------|
| 폭 제한 | 스택 전체 `max-w-[640px] mx-auto` | 와이드에서 카드 퍼짐 차단 |
| 스택 간격 | `space-y-4` | ③ 생략돼도 자연스럽게 닫힘 |
| 시각 위계 | ①·③은 `bg-gray-50`, ②만 `bg-white border-gray-200` | 시선이 카드→일지버튼으로 |
| 스크롤 | 기존 `xl:overflow-y-auto` 자리에 ScrollFadeArea | 넘칠 때만 fade·화살표 |

### 왜 상하 스택인가 (좌우 분할 ❌)

주 액션("일지 쓰기")이 카드 안에 있다. 2분할하면 카드가 좁아지고 일지 버튼이 더 작아져 **동선 훼손**. 상하 스택은 카드 폭을 유지하며 위/아래로만 맥락을 붙인다.

---

## 3. ① 회기 타임라인

이 내담자의 **전 회기 출결 시퀀스**를 가로 점+선 스트립으로. (간트/막대 ❌ — 회기는 이산 이벤트지 기간이 아님)

```
①──②──③──●④──⑤──⑥
참  참  불  지금  예  예
```

### 색상 규칙 (ClientActionCard 출결 색 토큰 재사용)

| 출결 | 색 토큰 | 점 스타일 |
|------|---------|-----------|
| 참석 attended | green-yellow | 옅은 채움 `bg-{color}/10` |
| 지각 late | yellow-400 | 옅은 채움 |
| 공결 excused | blue-400 | 옅은 채움 |
| 불참 absent | red | 채움 |
| 노쇼 no_show | orange | 채움 |
| 예정 scheduled(미래) | gray-300 | `border-dashed`, 채움 없음 |
| **현재 회기** | **ring-2 ring-primary-500** | 크게(w-7) + 숫자 진하게 |

### 디테일

- 점: `w-5 h-5 rounded-full border-[1.5px]` (현재 회기만 w-7)
- 연결선: 과거 구간 `bg-gray-300`, 미래 구간 점선 느낌 — 과거/미래 경계 인지
- **회기 차감(is_consumed)**: 점 우상단 작은 `−` 마이크로 인디케이터 (색 의존 금지)
- 우측 끝 카운터: `4 / 6회기` 또는 `완료 2 · 불참 1 · 남은 2` (색만으로 정보 전달 금지, WCAG 1.4.1)
- 호버: `3회기 · 6/2(월) · 불참` 한 줄 툴팁(기존 Tooltip 컴포넌트)
- 세로 폭 `h-14`(56px) 내외 — 슬림하게, 타임라인이 주역이 되면 안 됨

### 접근성

- 컨테이너 `role="list"`, 각 점 `role="listitem"` + `aria-label="3회기, 6월 2일, 불참"`
- 점 클릭 가능하게 할 경우 hit area `p-1.5`로 확장(44px 근접)

---

## 4. ③ AI 브리핑

위치는 **카드 아래**(위 ❌). 주 액션에 먼저 도달해야 하므로 AI는 보조.

### 분량 — 1~2문장 + 칩 (좌측 중복 회피)

좌측 [CaseAnalysisSection.svelte](../../apps/web/src/lib/components/counseling/CaseAnalysisSection.svelte)가 이미 진행경과 전문 + 반복주제 + 정서변화 + 위험요인 + 제안을 전부 보여준다. 우측은 가벼운 신호만:

| 우측 표시 | 소스 필드 |
|-----------|-----------|
| 1문장 요약 | `content.progress_summary` 첫 문장(마침표 split) |
| 주제 칩 2개 | `content.recurring_themes[0..1]` |
| 위험 신호 | `content.risk_factors` 있으면 "⚠ 주의 N건"만 (내용은 좌측에) |
| 전체 보기 | "전체 분석 보기 →" (좌측 섹션으로 스크롤/포커스) |

### 톤

- 출처 + 완화 표현: "정서가 위축되어 있습니다"(단정) ❌ → "직전 분석 기준, 정서 다소 위축"
- `✦ AI 요약` 라벨로 AI 추정임을 명시

### 기본 상태 / Fallback

- **접힘(collapsed) 기본**. 단 `risk_factors` 있으면 펼침 기본(주의 신호 능동 노출)
- 분석 없음(`getCaseAnalysisLatest` → null): **AI 블록 자체를 미렌더** (빈 카드/스켈레톤 금지). ①+② 만으로 레이아웃 성립

---

## 5. 데이터 / API (모두 기존 인프라로 충분)

### 타임라인 데이터 — 추가 API 불필요

이미 라우트가 보유한 전체 회기 배열을 우측 패널에 넘기면 됨.

- [counseling/status/[id]/+page.svelte](<../../apps/web/src/routes/(protected)/counseling/status/[id]/+page.svelte>): `counselingSessions = counselingData?.sessions` (전체 회기 배열 보유)
- 각 `session.clients`(SessionParticipant[])에 `attendance_status`, `is_consumed` 포함 ([types/counseling.ts](../../apps/web/src/lib/types/counseling.ts) L208-224)
- **할 일**: SessionDetailPanel에 `counselingSessions` prop 추가 → 내부에서 `participant_id`로 필터링해 타임라인 생성 (ProgramInfoPanel의 `clientStats` L212-270와 동일 패턴)

```ts
// SessionDetailPanel 내부 (의사코드)
const participantId = $derived(session?.clients?.[0]?.participant_id)
const timeline = $derived.by(() =>
  counselingSessions
    .filter((s) => s.status !== 'cancelled')
    .map((s) => {
      const p = s.clients.find((c) => c.participant_id === participantId)
      return p && {
        sessionNumber: s.session_number,
        start: s.start,
        status: s.status,
        attendance: p.attendance_status,
        isConsumed: p.is_consumed,
        isCurrent: s.session_id === session.session_id
      }
    })
    .filter(Boolean)
)
```

### AI 브리핑 데이터 — 추가 API 불필요, 크레딧 0

기능 자체는 **production에서 완전히 작동 중**(stub/미완성 아님). 프론트 액션 → 백엔드 라우터 → LLM 호출 → 크레딧 차감 → DB 저장까지 종단 검증됨.

- [case-analysis.action.ts](../../apps/web/src/lib/hooks/actions/case-analysis.action.ts): `getCaseAnalysisLatest()` — **이미 생성된 분석만 GET 조회 → 크레딧 소모 없음**, 404면 null
- 응답 `content.progress_summary` / `recurring_themes` / `risk_factors` 재사용
- ⚠️ AI 분석은 **케이스 전체 단위**(개별 내담자 단위 아님). 단, 본 Focus는 **1명일 때만** 동작 → 1:1 개별 상담 = 케이스 = 그 내담자라 의미상 일치. 표현만 "이 내담자"가 아닌 "상담 종합" 톤으로.

#### ⚠️ 브리핑이 실제로 뜨는 전제 조건 (중요)

이 두 조건 때문에 **브리핑은 "있으면 보이는 보조 신호"**이지 항상 뜨는 게 아니다. Phase 2 설계 시 fallback(미렌더)을 기본값으로 둬야 하는 이유.

1. **구독 Feature flag 게이팅** — 백엔드 라우터가 `require_feature("ai_case_analysis")`로 보호됨. 구독 플랜에 이 기능이 없는 센터는 분석 자체가 불가 → 우측 브리핑도 안 뜸. 프론트는 `hasFeature(subVM, 'ai_case_analysis')`로 동일 게이팅(ProgramInfoPanel 패턴 재사용).
2. **분석은 자동 생성되지 않음** — `postCaseAnalysis`는 상담사가 좌측 CaseAnalysisSection에서 **버튼을 눌러야** 실행되고 11크레딧을 소모한다. 즉 우측 브리핑은 **"상담사가 이미 한 번 분석을 돌린 케이스"에서만** 데이터가 존재. 안 돌린 케이스는 `getCaseAnalysisLatest` → null → ③ 블록 미렌더(설계와 일치).

> 결론: 우측 브리핑은 별도 비용·생성 트리거 없이 **좌측에서 이미 생성된 결과를 가볍게 재활용**하는 read-only 위젯. 데이터 없으면 조용히 사라지는 게 정상 동작.

---

## 6. 1명 ↔ 2명+ 전환 원칙

> 카드는 항상 그리드 셀이다. Focus는 그리드를 깨는 게 아니라 그리드 위/아래에 맥락을 더하는 것.

```
1명:   [타임라인]
       [grid: 카드 1개, max-w로 가둠]
       [브리핑]

2명+:  [grid: 카드 N개 auto-fill]   ← 타임라인/브리핑 생략
```

- **카드(ClientActionCard)는 두 경우 모두 동일** — 1명 전용 카드 신설 ❌ (1↔2명 토글 시 재마운트/점프 방지)
- 같은 grid 컨테이너에 `max-w-[640px] mx-auto` 클래스만 토글 → DOM 구조 동일, 위치 점프 최소
- 타임라인·브리핑은 1명 전용 부가 블록. 2명이 되면 사라지는 건 "그룹엔 개인 종단 맥락이 부적절"이라는 도메인 논리와 일치 → 사용자 납득

---

## 7. 안티패턴 (피할 것)

| 안티패턴 | 이유 |
|----------|------|
| 빈 공간을 차트/일러스트로 강제 충전 | 매일 보는 화면에 노이즈. 여백은 죄가 아님 |
| AI 블록을 크고 화려하게 | 좌측 섹션과 중복 + 주 액션 시선 뺏김 |
| 타임라인을 간트/막대로 | 회기는 이산 이벤트. 막대는 거짓 "기간" 의미 부여 |
| 색만으로 출결 구분 | 색맹 + WCAG 1.4.1 위배. 모양·텍스트 이중화 필수 |
| 1명 전용 카드 컴포넌트 신설 | 1↔2명 전환 시 카드 달라져 학습비용·점프 |
| AI 없을 때 스켈레톤/빈 카드 노출 | "없음"을 시각화하면 산만. 블록 생략 |

---

## 8. 단계별 실행 계획

### Phase 1 — 레이아웃 분기 + 타임라인 (핵심 가치)
1. SessionDetailPanel each 앞에 `{#if (session.clients ?? []).length === 1}` 분기 → 상하 스택(타임라인 + 단일 카드 `max-w-[640px] mx-auto`), `{:else}` 기존 grid
2. 라우트에서 `counselingSessions` prop 전달
3. `CounselingSessionTimeline.svelte` 신규 (점+선, 출결 색 토큰 재사용, role=list, 호버 Tooltip)

### Phase 2 — AI 브리핑
4. `SessionBriefing.svelte` 신규 (접힘 기본, progress_summary 1문장 + themes 2칩 + risk 신호, fallback=미렌더)
5. `getCaseAnalysisLatest` 조건부 조회(1명 + 완료 회기 존재 시에만)

### 검증 포인트
- 1명: 타임라인+카드 중앙 정렬, 일지 버튼이 스크롤 없이 보이는지
- 2명+: 기존 grid 그대로인지 (회귀)
- AI 없는 케이스: ③ 미렌더로 깔끔한지
- 출결 색 + 모양/텍스트 이중화 동작
- 1↔2명 전환 시 카드 점프 최소

---

## 부록 — 관련 파일

| 용도 | 경로 |
|------|------|
| 우측 패널 | [SessionDetailPanel.svelte](../../apps/web/src/lib/components/counseling/SessionDetailPanel.svelte) |
| 내담자 카드 | [ClientActionCard.svelte](../../apps/web/src/lib/components/counseling/ClientActionCard.svelte) |
| 좌측 AI 섹션 | [CaseAnalysisSection.svelte](../../apps/web/src/lib/components/counseling/CaseAnalysisSection.svelte) |
| AI 분석 액션 | [case-analysis.action.ts](../../apps/web/src/lib/hooks/actions/case-analysis.action.ts) |
| 타입 정의 | [types/counseling.ts](../../apps/web/src/lib/types/counseling.ts) (L185-224) |
| 라우트 | [counseling/status/[id]/+page.svelte](<../../apps/web/src/routes/(protected)/counseling/status/[id]/+page.svelte>) |
