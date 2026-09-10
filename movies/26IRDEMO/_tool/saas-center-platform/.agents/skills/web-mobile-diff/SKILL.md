---
name: web-mobile-diff
description: 입력받은 도메인·페이지를 apps/web과 apps/mobile에서 찾아 비교 문서를 작성한다. 모바일은 상담사(counselor) 전용 앱이므로 web의 counselor 시점만 비교 대상으로 삼고, manager/super_admin 전용 기능은 "관리자 전용 — 모바일 적용 대상 아님"으로 분류한다. web의 counselor 동작을 정답(source of truth)으로 본다.
disable-model-invocation: true
---

# web ↔ mobile 페이지 비교 문서 생성

사용자가 `/web-mobile-diff <도메인> <페이지명>` 형태로 호출한다.
예시:
- `/web-mobile-diff 내담자 상세`
- `/web-mobile-diff 일정 캘린더`
- `/web-mobile-diff 검사 현황`
- `/web-mobile-diff 상담 상세`

목표: **모바일이 web을 따라잡기 위해 무엇을 추가/수정해야 하는지** 명확한 비교 문서를 생성한다.

---

## 1. 입력 해석

사용자가 적은 한국어 키워드를 도메인 슬러그로 매핑한다.

| 한국어 키워드 | 도메인 slug | Web 경로 | Mobile 경로 |
|------------|------------|---------|------------|
| 내담자, 고객 | `clients` | `apps/web/src/routes/(protected)/clients/` | `apps/mobile/app/(main)/client/`, `apps/mobile/app/(main)/(tabs)/clients.tsx` |
| 일정, 스케줄, 캘린더 | `schedule` | `apps/web/src/routes/(protected)/schedule/` | `apps/mobile/app/(main)/schedule/`, `apps/mobile/app/(main)/(tabs)/schedule.tsx` |
| 검사, 심리검사 | `assessment` | `apps/web/src/routes/(protected)/assessment/`, `.../assessment-case/` | `apps/mobile/app/(main)/assessment/` |
| 상담 | `counseling` | `apps/web/src/routes/(protected)/counseling/` | `apps/mobile/app/(main)/counseling/` |
| 알림 | `notifications` | `apps/web/src/routes/(protected)/notifications/` | `apps/mobile/app/(main)/notifications/`, `.../notification-settings/` |
| 회원, 직원, 멤버 | `member` | `apps/web/src/routes/(protected)/member/` | (모바일 없음 또는 더보기 내부 확인) |
| 내정보, 마이페이지 | `myInfo` | `apps/web/src/routes/(protected)/myInfo/` | `apps/mobile/app/(main)/(tabs)/more.tsx` 외 |

페이지명도 매핑한다:
- 상세 → `[id]` 동적 라우트 또는 `detail` 키워드 포함 파일
- 목록 → 도메인 루트 `+page.svelte` / `(tabs)/{domain}.tsx`
- 등록·생성 → `create`, `new`, `register`
- 수정 → `edit`, `update`
- 현황 → `status`

매핑이 애매하면 추측하지 말고 사용자에게 **어느 화면을 비교할지** 후보를 보여주고 한 번 더 확인한다.

### 1.1 역할(role) 컨텍스트 — 비교의 기본 전제

이 프로젝트는 **SaaS web = 관리자(manager) + 상담사(counselor) + super_admin 다중 역할, mobile = 상담사(counselor) 전용**이다 (root `AGENTS.md` / `apps/web/AGENTS.md` / `apps/mobile/AGENTS.md`에 명시). 비교는 항상 다음 원칙을 따른다.

- **비교 대상 = web의 counselor 시점**. manager 또는 super_admin만 쓰는 화면·필드·액션은 모바일에서 누락이 아니다.
- 같은 화면이라도 역할에 따라 다른 섹션이 보이면, **counselor에게 보이는 부분만** 모바일과 비교한다.
- 어떤 라우트가 counselor에게도 열려있는지 불확실하면 코드(`(protected)` 가드, `if ($role === ...)`, store/auth 분기)로 확인한다. 추정 금지.
- **mobile 코드의 `useRole` 헬퍼(isAdmin/isManager/hasFullAccess)에 헷갈리지 말 것.** mobile에 해당 헬퍼가 노출돼 있어도 **설계 의도는 counselor 전용**이다 (mobile AGENTS.md 명시). 헬퍼는 향후 확장·임시 안전망 용도이며, 이를 근거로 "mobile도 멀티 역할 앱"이라고 결론 짓지 않는다. 헤더 문구 분기처럼 헬퍼가 실제 사용되는 경우는 §9 mobile-only로 기록하되, 본 비교의 기준은 항상 counselor.
- 도메인 매핑 보조 힌트(코드 확인 전 추정용 — 실제 가드 확인 필수):
  - **counselor + 관리자 공용 가능성**: `clients`, `counseling`, `assessment`, `assessment-case`, `schedule`, `notifications`, `myInfo`, `notice`
  - **관리자 전용 가능성 (모바일 비교 대상 아님)**: `member`, `billing`, `dashboard`, `operation`, `settings`, `support`, `agent`

---

## 2. 양쪽 코드 탐색

선택된 화면에 대해 다음을 수집한다.

### Web 쪽
- 라우트 파일: `+page.svelte`, `+page.ts`, `+layout.svelte`
- Feature 모듈: `apps/web/src/lib/features/<domain>/.../` 전체
  - `constants.ts`, `filters.ts`, `query-builders.ts`, `view-model.ts`, `*-service.ts`, `hooks.svelte.ts`, `components/`
- API 액션: `apps/web/src/lib/hooks/actions/<domain>.action.ts` — 호출되는 endpoint와 응답 타입
- 모달/하위 컴포넌트: 페이지에서 import 되는 컴포넌트들

### Mobile 쪽
- 스크린 파일: `apps/mobile/app/(main)/<domain>/...` (`[id].tsx`, `index.tsx` 등)
- 화면 전용 하위 컴포넌트: `_components/`
- Feature 모듈: `apps/mobile/src/features/<domain>/` (`api.ts`, `hooks.ts`, `store.ts`)
- 공용 컴포넌트 사용 패턴: `src/shared/components/ui/` 중 어떤 것을 사용 중인지

탐색은 Read를 우선 사용하고, 디렉토리 광범위 탐색이 필요하면 Explore agent에게 위임한다.

---

## 3. 비교 항목 (필수 추출)

각 화면에서 아래를 빠짐없이 추출한다.

### 3.1 데이터 모델
- 화면이 호출하는 API endpoint (전부)
- 응답에서 **실제로 화면에 표시되는 필드 목록**
- 응답에서 **fetch는 되지만 화면에 안 쓰이는 필드** (참고용)

### 3.2 UI 섹션
- 헤더 (제목, 뒤로가기, 우측 액션)
- 본문 섹션 단위로 나열 (예: 기본 정보 / 보호자 / 진행 이력 / 메모)
- 각 섹션에 표시되는 필드와 포맷 (날짜·연락처·뱃지 등)
- 빈 상태(empty state) 처리 방식

### 3.3 액션·인터랙션
- 버튼 (수정·삭제·추가·전화걸기·캘린더 이동 등)
- 모달/바텀시트 (열리는 트리거, 내부 폼 필드)
- 탭/세그먼트/필터
- 페이지네이션·무한스크롤·검색·정렬

### 3.4 상태
- 로딩/에러/빈 상태 UI
- 토스트/스낵바 메시지 문구

### 3.5 역할 가시성 (필수)
모든 §3.1~§3.3 항목을 추출할 때 **각 항목이 어느 역할에서 노출되는지**를 함께 기록한다.

- 화면 자체가 어느 역할에서 열리는가 (`(protected)` 가드 / 라우트별 권한)
- 화면 내 섹션·필드 단위 분기 (`{#if role === 'manager'}` 또는 권한 store 체크)
- 액션 단위 분기 (예: 삭제 버튼은 manager만)

표기 규약:
- `[C]` — counselor에게 노출
- `[M]` — manager 전용
- `[S]` — super_admin 전용
- `[C+M]` 등 조합 가능

**`[M]` 또는 `[S]` 단독인 항목은 §6 누락 표에 올리지 않는다.** 대신 §4.2 템플릿의 🟣 섹션에 기록만 한다.

---

## 4. 산출물 — 비교 문서

### 4.1 출력 위치
- 기본: `claudedocs/web-mobile-diff/<domain>-<page>.md`
- 디렉토리 없으면 생성한다.
- 같은 파일이 이미 있으면 **덮어쓰기 전 사용자에게 확인**한다 (기존 분석을 잃을 수 있음).

### 4.2 문서 템플릿

```markdown
# <한국어 화면명> · web ↔ mobile 비교

> 기준일: <YYYY-MM-DD> · 기준: web 우선 (mobile이 따라잡는 방향)

## 1. 대상 화면

| | Web | Mobile |
|-|-----|--------|
| 라우트 | `apps/web/src/routes/(protected)/...` | `apps/mobile/app/(main)/...` |
| 메인 파일 | `<file>:<line>` | `<file>:<line>` |
| Feature 모듈 | `apps/web/src/lib/features/...` | `apps/mobile/src/features/...` |
| 허용 역할 | counselor / manager / super_admin (예: [C+M]) | counselor 전용 |
| 비교 기준 | **counselor 시점** | counselor 시점 |

## 2. 데이터 모델

> 비교 기준: **web의 counselor 시점**. manager/super_admin 전용 필드는 §8(🟣)에 별도 기록.

### 호출 API
| Endpoint | Web (counselor) | Web (manager+) | Mobile |
|----------|-----------------|----------------|--------|
| `GET /...` | ✅ | ✅ | ❌ 미사용 |
| `DELETE /...` | ❌ (가드됨) | ✅ | — |

### 화면 표시 필드
| 필드 | Web 가시성 | Mobile | 비고 |
|------|----------|--------|------|
| `name` | [C+M] ✅ | ✅ | |
| `birth_date` | [C+M] ✅ "1990.01.01" | ❌ | **🔴 누락** |
| `guardian_count` | [C+M] ✅ 뱃지 | ❌ | **🔴 누락** |
| `internal_memo` | [M] only | — | 🟣 관리자 전용 (모바일 비대상) |

## 3. UI 섹션

### 3.1 헤더
- Web: …
- Mobile: …
- 차이: …

### 3.2 기본 정보 카드
…

### 3.3 (섹션 단위로 계속)
…

## 4. 액션

| 액션 | Web 가시성 | Mobile | 비고 |
|------|----------|--------|------|
| 수정 | [C+M] ✅ 모달 | ✅ 별도 스크린 | OK |
| 삭제 | [M] only | — | 🟣 관리자 전용 (모바일 비대상) |
| 비밀 메모 보기 | [M] only | — | 🟣 관리자 전용 |
| 전화걸기 | — | ✅ tel: 링크 | 🟢 mobile only |
| 회기 추가 | [C+M] ✅ | ❌ | **🔴 누락** |

## 5. 상태 처리

- 로딩: …
- 에러: …
- 빈 상태: …
- 권한 분기 (web 내부): counselor에게 보이지 않는 섹션 목록 — §8(🟣)에 정리

## 6. 🔴 모바일에 누락된 것 (적용 대상)

**counselor 시점 기준** 누락 항목만. manager/super_admin 전용은 여기 올리지 않는다 (§8 🟣 참조).

작업 단위로 끊고, 가능하면 어디에 추가해야 하는지 경로까지 적는다.

- [ ] **필드 추가**: `birth_date`를 기본 정보 섹션에 표시
  - 파일: `apps/mobile/app/(main)/client/[id].tsx:N`
  - 포맷: `YYYY.MM.DD` (web의 `formatDate` 참고)
- [ ] **회기 추가 액션**: counselor가 web에서 사용 중이지만 모바일에 없음
  - 공용 컴포넌트: `src/shared/components/ui/BottomSheet.tsx` 사용 권장
- [ ] …

## 7. 🟡 모바일에서 다르게 동작 (검토 필요)

판단 보류 항목. 의도된 차이일 수 있으니 사용자 확인 필요. **counselor 시점**에서의 차이만.

- 정렬 기본값이 web=등록일 desc, mobile=이름 asc — 어느 쪽을 따라가야 하는지?
- 페이지네이션 방식 다름 (web=숫자, mobile=무한스크롤)

## 8. 🟣 관리자 전용 — 모바일 적용 대상 아님

web에서 manager/super_admin에게만 노출되는 항목. **누락이 아니라 의도된 분리**. 향후에도 모바일에 가져오지 않는다.

| 항목 | 역할 | 위치 |
|------|------|------|
| 삭제 액션 | [M] | `apps/web/src/routes/(protected)/clients/[id]/+page.svelte:N` |
| 비밀 메모 섹션 | [M] | … |
| `internal_memo` 필드 | [M] | API: `GET /clients/{id}` (manager 응답에만 포함) |

## 9. 🟢 mobile-only (유지)

- FAB 필드노트 진입 (web에 없음, mobile 고유 기능)

## 10. 테스트 체크리스트

위 누락 항목(§6)을 적용했는지 빠르게 확인하기 위한 수동 테스트 절차. **counselor 계정으로 로그인해서 확인**한다 (manager 계정 검증은 web 쪽 담당).

- [ ] counselor 계정으로 로그인 → 내담자 상세 진입 시 `birth_date` 노출
- [ ] 보호자 0명일 때 뱃지가 사라지는가
- [ ] counselor에게 보이지 않아야 할 [M] 전용 액션(삭제 등)이 모바일에도 노출되지 않는가
- [ ] 401/403 시 토스트 뜨고 로그인으로 이동하는가
```

---

## 5. 진행 절차 (Codex가 실제 따를 순서)

1. **인자 파싱** — 사용자가 적은 키워드로 §1의 매핑 테이블을 사용해 도메인·페이지 후보를 결정한다. 애매하면 1회만 확인 질문.
2. **경로 확정 + 관리자 전용 여부 판정** — 양쪽 파일 시스템을 실제로 확인해 비교 대상 파일을 확정한다.
   - 해당 web 라우트가 **manager/super_admin 전용**으로 판명되면 즉시 중단하고 사용자에게 알린다: "이 화면은 관리자 전용이라 모바일 비교 대상이 아닙니다." 비교를 강행하지 않는다.
   - 한쪽이 없는 경우(예: web에만 있고 mobile에 없음 + counselor 전용)는 "전체 신규 작업"으로 분류.
3. **역할 가시성 매핑** — web 코드에서 다음을 확인해 §3.5의 `[C]/[M]/[S]` 태그를 만든다.
   - 라우트 가드 (`+layout.server.ts`, `+page.server.ts`, store 분기)
   - 페이지 내부의 `{#if role === ...}` / `hasPermission(...)` 분기
   - 액션·필드·섹션 단위로 누가 보는지 라벨링
4. **코드 수집** — Read로 핵심 파일들을 읽는다. 광범위 탐색이 필요하면 Explore agent에게 위임.
5. **추출** — §3의 항목들을 빠짐없이 채운다. 각 항목에 역할 태그 부착.
6. **분류** — counselor 가시성 기준으로 🔴/🟡 정리, manager/super_admin 전용은 🟣로 분리, mobile 고유는 🟢.
7. **문서 작성** — §4.2 템플릿을 그대로 따라 작성한다. 표는 필드/액션이 한 줄이라도 누락 없이 모두 적는다.
8. **저장** — `claudedocs/web-mobile-diff/<domain>-<page>.md`에 Write. 같은 파일이 있으면 덮어쓰기 전 확인.
9. **요약 보고** — 사용자에게는 짧게 보고:
   - 비교 문서 경로
   - 분류별 개수 (예: "🔴 5 누락 / 🟡 2 검토 / 🟣 3 관리자전용 / 🟢 1 mobile-only")
   - 가장 임팩트 큰 누락 1~2개 미리보기

---

## 6. 주의사항

- **web의 counselor 시점을 정답으로 본다.** mobile에서만 보이는 기능은 `🟢 mobile-only`로 분류하되, "web에 추가하라"는 권유는 하지 않는다.
- **manager/super_admin 전용 기능을 모바일 누락으로 분류하지 않는다.** 모바일은 counselor 전용 앱이라 이는 누락이 아닌 의도된 분리. 반드시 §8(🟣)로 격리.
- **역할 판정은 코드로만 한다.** "관리자 같은 화면이니 [M]"이라는 추정 금지. `(protected)` 가드·route layout·페이지 내부 권한 분기를 직접 확인.
- **추측 금지.** 한쪽 코드를 못 찾았거나 역할 판정이 모호하면 비교 표에 "❓ 확인 필요"로 적고 사용자에게 다시 묻는다. 빈 자리를 상상으로 채우지 않는다.
- **mock/lab 폴더는 비교 대상에서 제외.** (`apps/mobile/app/(main)/lab/` 등)
- **API endpoint는 실제 호출되는 것만.** action 파일에 정의돼 있어도 화면에서 안 쓰면 별도 표기. 같은 endpoint가 역할에 따라 응답 필드가 다를 수 있으니, **어느 역할 응답을 기준으로 비교했는지** 명시.
- **모바일 디자인 시스템 규칙은 본 비교에서 강요하지 않는다.** "web에 있으니 mobile에도 추가" 했을 때 모바일 AGENTS.md의 공용 컴포넌트·디자인 시스템과 충돌하는 경우 §7(검토 필요)로 분류.
- **정보 스펙(`apps/mobile/docs/INFORMATION_SPEC.md`)이 비교 결과보다 우선한다.** 비교 시 해당 화면의 스펙 섹션을 먼저 확인하고, 다음 규칙을 적용한다:
  - **스펙에 ❌ 또는 명시되지 않은 항목**: web에 있어도 §6(🔴 누락)이 아닌 **§7(🟡 검토)로 분류**하고 "스펙 미정의 — 추가 결정 필요"라고 적는다. 모바일로 가져오라고 권하지 않는다.
  - **스펙에 ✅로 정의됐는데 모바일에 없으면**: §6(🔴 누락)으로 분류. 가장 명확한 적용 대상.
  - **스펙이 ❓ 또는 ⚠️로 표시한 영역**: §7(🟡)로 분류하고 "스펙 결정 대기"로 라벨링. 결정 전 모바일 변경 권유 금지.
  - **스펙에 있는데 web에 없는 항목**: §9(🟢 mobile-only)와 별개로 §7에 "스펙 정의 vs web 미구현" 케이스로 기록. web 보강이 필요할 수 있음을 짧게 적되, 비교 문서의 결론은 어디까지나 모바일 방향이다.
