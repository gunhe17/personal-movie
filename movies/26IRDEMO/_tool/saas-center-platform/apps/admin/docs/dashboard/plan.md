# 대시보드 플랜

> 플랫폼 어드민 대시보드 — 현재 구현된 모듈 기반으로 실제 데이터를 표시
> 진입점(얼굴) 페이지이므로 **디자인 완성도를 최우선**으로 한다.

---

## 1. 설계 원칙

- **기존 API만 사용** — 새 stats 전용 API 없이 현재 endpoint 파라미터 조합으로 구성
- **역할별 분기 없음** — 모든 역할이 같은 대시보드를 봄 (권한 없는 액션 버튼만 숨김)
- **빠른 로딩** — 카드 단위로 독립 queryBuilder, 하나가 느려도 나머지는 바로 표시
- **클릭 → 해당 페이지** — 각 위젯은 관련 목록 페이지로 이동하는 링크 역할
- **디자인 우선** — 어드민 전체의 첫 인상. 카드·위젯 간 여백·색상·타이포그래피 정돈, 밋밋하지 않게

---

## 2. 레이아웃 구성

```
┌─────────────────────────────────────────────────────────────────┐
│  PageHeader: "대시보드"  · 안녕하세요, {name}님                  │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│  전체     │  활성    │  대기    │  미답변  │  CS메모  │  어드민  │
│  센터 수  │  센터 수 │  신청 수 │  문의 수 │  오늘    │  계정 수 │
│  (숫자)  │  (숫자)  │  (숫자)  │  (숫자)  │  (숫자)  │  (숫자)  │
├──────────┴──────────┴──────────┴──────────┴──────────┴──────────┤
│                           2단 그리드                             │
│  ┌────────────────────────┐  ┌────────────────────────────────┐ │
│  │  대기 중인 센터 신청    │  │  미답변 문의                   │ │
│  │  (최근 5건, 테이블)    │  │  (최근 5건, 테이블)            │ │
│  │  → /center/applications│  │  → /inquiries                  │ │
│  └────────────────────────┘  └────────────────────────────────┘ │
│  ┌────────────────────────┐  ┌────────────────────────────────┐ │
│  │  오늘 CS 메모           │  │  최근 감사 로그                │ │
│  │  (최근 5건, 테이블)    │  │  (최근 5건, 테이블)            │ │
│  │  → /cs-memos           │  │  → /audit-logs                 │ │
│  └────────────────────────┘  └────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 상단 숫자 카드 (6개)

| # | 라벨 | 데이터 소스 | 파라미터 | 아이콘 색 | 클릭 이동 |
|---|------|------------|---------|----------|---------|
| 1 | 전체 센터 | `getCenterList` | `size=1` → `total` | primary | `/center/manage` |
| 2 | 활성 센터 | `getCenterList` | `is_active=true&size=1` → `total` | green | `/center/manage?status=active` |
| 3 | 대기 중인 신청 | `getApplicationList` | `status=pending&size=1` → `total` | amber | `/center/applications?status=pending` |
| 4 | 미답변 문의 | `getInquiryList` | `status=pending&size=1` → `total` | red | `/inquiries?status=pending` |
| 5 | 오늘 CS 메모 | `getCSMemoList` | `sort_order=desc&size=20` → 오늘 날짜 필터링 (클라이언트) | blue | `/cs-memos` |
| 6 | 어드민 계정 | `getAdminAccountList` | `size=1` → `total` | purple | `/account/admins` |

> 카드 3, 4는 값이 0보다 크면 빨간 뱃지 효과 (주의 필요 신호)

---

## 4. 하단 위젯 (4개)

### 4-1. 대기 중인 센터 신청

- **API**: `getApplicationList({ status: 'pending', size: 5, page: 1 })`
- **표시 컬럼**: 센터명 / 신청자 / 신청일
- **빈 상태**: "대기 중인 신청이 없습니다"
- **푸터**: "전체 보기 →" → `/center/applications?status=pending`

### 4-2. 미답변 문의

- **API**: `getInquiryList({ status: 'pending', size: 5, page: 1 })`
- **표시 컬럼**: 제목 / 센터명 / 유형 / 접수일
- **빈 상태**: "미답변 문의가 없습니다"
- **푸터**: "전체 보기 →" → `/inquiries?status=pending`

### 4-3. 오늘 CS 메모

- **API**: `getCSMemoList({ sort_order: 'desc', size: 20 })`
  → 응답에서 `created_at`이 오늘 날짜인 것만 슬라이스 (최대 5건)
- **표시 컬럼**: 제목 / 유형 뱃지 / 센터 / 작성자
- **빈 상태**: "오늘 작성된 메모가 없습니다"
- **푸터**: "전체 보기 →" → `/cs-memos`

### 4-4. 최근 감사 로그

- **API**: `getAuditLogList({ size: 5, page: 1 })`
- **표시 컬럼**: 행위(summary) / 관리자 / 시각
- **빈 상태**: "감사 로그가 없습니다"
- **푸터**: "전체 보기 →" → `/audit-logs`

---

## 5. 구현 방식

### 파일 구조

```
src/routes/(protected)/dashboard/
└── +page.svelte          # 단일 파일로 구현 (서비스 분리 불필요)
```

### 쿼리 패턴

각 위젯은 독립 `queryBuilder`로 병렬 로딩:

```typescript
// 숫자 카드
const centersQuery = $derived(queryBuilder(getCenterList, () => ({ size: 1 })))
const pendingAppsQuery = $derived(queryBuilder(getApplicationList, () => ({ status: 'pending', size: 1 })))
const pendingInquiriesQuery = $derived(queryBuilder(getInquiryList, () => ({ status: 'pending', size: 1 })))
const adminAccountsQuery = $derived(queryBuilder(getAdminAccountList, () => ({ size: 1 })))

// 위젯 목록
const recentAppsQuery = $derived(queryBuilder(getApplicationList, () => ({ status: 'pending', size: 5 })))
const recentInquiriesQuery = $derived(queryBuilder(getInquiryList, () => ({ status: 'pending', size: 5 })))
const recentMemosQuery = $derived(queryBuilder(getCSMemoList, () => ({ sort_order: 'desc', size: 20 })))
const recentAuditLogsQuery = $derived(queryBuilder(getAuditLogList, () => ({ size: 5 })))
```

### 로딩 처리

카드/위젯 각각 독립 스켈레톤 처리 (전체 로딩 스피너 없음)

**숫자 카드 스켈레톤** — 값 자리에 pulse 블록:
```svelte
{#if query.isPending}
  <div class="h-8 w-20 animate-pulse rounded-md bg-gray-200"></div>
{:else}
  <span>{value}</span>
{/if}
```

**위젯 테이블 스켈레톤** — 행 5개 pulse:
```svelte
{#if query.isPending}
  <div class="space-y-2 p-4">
    {#each Array(5) as _}
      <div class="h-10 animate-pulse rounded-lg bg-gray-100"></div>
    {/each}
  </div>
{:else}
  <!-- 실제 목록 -->
{/if}
```

---

## 6. 구현 순서

1. 숫자 카드 6개 (실제 API 연결)
2. 대기 중인 센터 신청 위젯
3. 미답변 문의 위젯
4. 오늘 CS 메모 위젯
5. 최근 감사 로그 위젯

---

## 7. Phase 2 확장 (통계 API 구현 후)

현재 숫자 카드를 아래로 교체:

| 현재 | Phase 2 교체 |
|------|-------------|
| 카드 단순 숫자 | 전월 대비 증감 % 표시 |
| 없음 | 월별 신규 센터 라인 차트 |
| 없음 | 월별 문의 건수 바 차트 |

API: `GET /admin/stats/overview`, `GET /admin/stats/trend`
(platform-admin.md 4.2.1 참조)
