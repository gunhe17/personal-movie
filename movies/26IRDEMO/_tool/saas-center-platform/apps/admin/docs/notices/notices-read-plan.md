# 공지사항 읽음 확인 기능 설계

> 어떤 센터가 읽었는지, 각 센터에서 누가 읽었는지 추적하여 공지 전달 확인 용도로 사용

---

## 1. 개요

### 목적

- 플랫폼 관리자가 공지사항을 게시한 후, 각 센터별 읽음 여부를 확인
- 센터 단위 + 개인(멤버) 단위 읽음 추적
- 공지 전달 확인 (미확인 센터 파악 → 필요시 개별 연락)

### 핵심 흐름

```
[Admin] 공지 게시 → [센터 웹] 멤버가 공지 조회 → 읽음 기록 자동 생성
                                                      ↓
                   [Admin] 공지 상세에서 읽음 현황 확인 ←
```

---

## 2. 데이터 모델

### NoticeRead (새 테이블)

```python
class NoticeRead(BaseModel):
    """공지사항 읽음 기록"""
    __tablename__ = "notice_reads"
    __table_args__ = (
        UniqueConstraint("notice_id", "member_id", name="uq_notice_reads_notice_member"),
        Index("idx_notice_reads_notice", "notice_id"),
        Index("idx_notice_reads_center", "notice_id", "center_id"),
    )

    notice_id: str       # 공지사항 ID
    center_id: str       # 센터 ID (센터별 집계용, 비정규화)
    member_id: str       # 읽은 멤버 ID
```

**설계 의도:**

- `member_id` 기준 1인 1레코드 (같은 공지를 여러 번 읽어도 최초 1회만 기록)
- `center_id` 저장 이유: 센터별 읽음 집계 시 JOIN 없이 바로 GROUP BY 가능
- BaseModel 상속 → `id`, `created_at`, `updated_at`, `deleted_at` 자동 제공
- **`read_at` 제거**: `created_at`이 곧 읽은 시각. 레코드 생성 = 읽음이므로 별도 컬럼 불필요

### 고려 사항

- **deleted_at 사용 안 함**: 읽음 기록은 소프트 삭제 불필요 (공지 삭제 시 cascade 또는 무시)
- **FK 없음**: 프로젝트 설계 원칙 (모듈 간 FK 제약 없음, application level 관리)

---

## 3. API 설계

### 3.1 센터 웹용 (읽음 기록)

> 센터 웹에 공지 조회 기능이 아직 없으므로, 공지 조회 API와 함께 구현 필요

#### 공지 목록 조회 (센터 웹)

```
GET /api/v1/centers/{center_id}/notices?page=1&size=20
```

- 게시된 공지만 (`is_published=true`)
- 고정 공지 우선 정렬
- 응답에 `is_read` 플래그 포함 (현재 멤버 기준)

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "서비스 점검 안내",
      "category": "maintenance",
      "is_pinned": true,
      "is_read": false,
      "published_at": "2026-03-01T00:00:00"
    }
  ],
  "total": 15,
  "unread_count": 3
}
```

#### 공지 상세 조회 + 읽음 처리 (센터 웹)

```
GET /api/v1/centers/{center_id}/notices/{notice_id}
```

- 상세 조회 시 **자동으로 읽음 기록 생성** (이미 있으면 무시)
- 별도 POST 엔드포인트 불필요 → 조회 = 읽음 (UX 단순화)

#### member_id 획득 방법

센터 웹 인증은 `account_id` 기반이므로, 읽음 기록에 필요한 `member_id`를 다음 경로로 변환:

```
account_id → Person (person.account_id) → Member (member.person_id + member.center_id)
```

- 상세 조회 핸들러에서 `center_id` + `account_id`로 해당 센터의 `member_id`를 조회
- Member 모델 직접 참조 (센터 웹 모듈이므로 허용)

### 3.2 어드민용 (읽음 현황 조회)

> `API_ARCHITECTURE.md` 기준: `platform_admin/notice/` 모듈 내에 배치

#### 공지별 읽음 현황 요약

```
GET /api/v1/admin/notices/{notice_id}/read-status
```

**응답:**

```json
{
  "total_centers": 25,
  "read_centers": 18,
  "unread_centers": 7,
  "centers": [
    {
      "center_id": "uuid",
      "center_name": "해피 상담센터",
      "is_read": true,
      "first_read_at": "2026-03-02T09:30:00",
      "read_count": 3,
      "member_count": 5
    },
    {
      "center_id": "uuid",
      "center_name": "마음 치유센터",
      "is_read": false,
      "first_read_at": null,
      "read_count": 0,
      "member_count": 2
    }
  ]
}
```

**데이터 출처:**

- `center_name`: `Center` 모델에서 JOIN으로 조회 (Model 참조 허용)
- `member_count`: `Member` 모델에서 센터별 COUNT (Model 참조 허용)
- `read_count`, `first_read_at`: `NoticeRead` 테이블에서 `center_id` GROUP BY 집계

#### 센터별 읽음 상세 (누가 읽었는지)

```
GET /api/v1/admin/notices/{notice_id}/read-status/{center_id}
```

**응답:**

```json
{
  "center_id": "uuid",
  "center_name": "해피 상담센터",
  "members": [
    {
      "member_id": "uuid",
      "name": "김상담",
      "role_name": "관리자",
      "read_at": "2026-03-02T09:30:00"
    },
    {
      "member_id": "uuid",
      "name": "이상담",
      "role_name": "상담사",
      "read_at": null
    }
  ]
}
```

**데이터 출처:**

- `members` 목록: `Member` + `Person` 모델 JOIN으로 해당 센터 전체 멤버 조회
- `read_at`: `NoticeRead` 테이블에서 LEFT JOIN (읽지 않은 멤버는 null)
- `name`: `Person.name` 참조
- `role_name`: `Member.role_name` 참조

---

## 4. 구현 계획

### Phase 1: 기반 (API)

| 순서 | 작업                                      | 난이도 | 비고                                                     |
| ---- | ----------------------------------------- | ------ | -------------------------------------------------------- |
| 1    | NoticeRead 모델 생성                      | 쉬움   | `app/modules/notice/models.py`에 추가                    |
| 2    | Alembic 마이그레이션                      | 쉬움   | `notice_reads` 테이블 생성                               |
| 3    | 센터 웹용 공지 조회 라우터                | 중간   | 새 라우터 필요 (현재 없음)                               |
| 4    | 조회 시 자동 읽음 기록 생성               | 쉬움   | 상세 조회 핸들러에서 UPSERT                              |
| 5    | 어드민 읽음 현황 Repository + Service     | 중간   | `platform_admin/notice/` 내에 레이어별 구현              |
| 6    | 어드민 읽음 현황 Handler + Router 등록    | 쉬움   | 기존 `platform_admin/notice/router.py`에 엔드포인트 추가 |

### Phase 2: 어드민 프론트엔드

| 순서 | 작업                            | 난이도 | 비고                           |
| ---- | ------------------------------- | ------ | ------------------------------ |
| 7    | notice.action.ts에 API 추가    | 쉬움   | `getNoticeReadStatus` 액션     |
| 8    | 공지 상세 페이지에 읽음 현황 탭 | 중간   | 센터 목록 + 읽음/미읽음 뱃지   |
| 9    | 센터 클릭 → 멤버 읽음 상세 모달 | 쉬움   | 멤버별 읽음 시각 표시           |

### Phase 3: 센터 웹 프론트엔드

| 순서 | 작업                     | 난이도 | 비고                        |
| ---- | ------------------------ | ------ | --------------------------- |
| 10   | 센터 웹 공지 목록 페이지 | 중간   | 새 페이지 (읽음 여부 표시)  |
| 11   | 센터 웹 공지 상세 페이지 | 중간   | 조회 시 자동 읽음 처리      |

---

## 5. 파일 변경 목록

### API (apps/api)

```
수정:
  app/modules/notice/models.py                              # NoticeRead 모델 추가
  app/modules/notice/schemas.py                             # 센터 웹 공지 스키마 추가
  app/modules/platform_admin/notice/router.py               # 읽음 현황 엔드포인트 추가
  app/modules/platform_admin/notice/repository.py           # 읽음 집계 쿼리 추가

신규 (어드민 - platform_admin/notice/):
  app/modules/platform_admin/notice/schemas_read.py         # 읽음 현황 응답 스키마
  app/modules/platform_admin/notice/services/get_read_status.py         # 센터별 읽음 현황 집계
  app/modules/platform_admin/notice/services/get_center_read_detail.py  # 센터 멤버별 읽음 상세
  app/modules/platform_admin/notice/handlers/get_read_status.py         # 읽음 현황 조회 핸들러
  app/modules/platform_admin/notice/handlers/get_center_read_detail.py  # 센터별 읽음 상세 핸들러

신규 (센터 웹):
  app/modules/notice/center_router.py                       # 센터 웹용 공지 라우터
  app/modules/notice/center_handlers/list_notices.py        # 센터 웹 목록 조회
  app/modules/notice/center_handlers/get_notice.py          # 센터 웹 상세 조회 + 읽음 기록

마이그레이션:
  alembic/versions/xxx_add_notice_reads.py
```

### 레이어 구조 (어드민 읽음 현황)

```
Router → Handler → Service → Repository → DB
                                  ↓
                        Center, Member 모델 참조 (JOIN)
```

- **Repository**: `NoticeRead` GROUP BY 집계 + `Center`/`Member` JOIN 쿼리
- **Service**: 읽음/미읽음 분류, `is_read` 판정 (read_count > 0), 응답 DTO 조립
- **Handler**: `uow.repo()` → Service → return (GET이므로 audit/commit 불필요)

### Admin FE (apps/admin)

```
수정:
  src/lib/hooks/actions/notice.action.ts                # 읽음 현황 API 추가
  src/routes/(protected)/notices/[noticeId]/+page.svelte # 읽음 현황 섹션 추가
```

### Web FE (apps/web) — Phase 3

```
신규:
  src/lib/hooks/actions/notice.action.ts                # 센터 웹 공지 API
  src/routes/(protected)/notices/+page.svelte           # 공지 목록
  src/routes/(protected)/notices/[noticeId]/+page.svelte # 공지 상세
```

---

## 6. 주요 설계 결정

### Q: 읽음 기록을 별도 POST로 할까, 조회 시 자동으로 할까?

**→ 조회 시 자동 기록** 채택

- 장점: 프론트엔드 구현 단순, 사용자 인지 부담 없음
- 단점: 목록에서 스크롤만 해도 "읽음"은 아님 → 상세 조회 시에만 기록
- GET 요청에서 쓰기 발생하는 부분은 trade-off로 수용 (읽음 기록은 부수 효과)
- **대안 고려**: POST `/notices/{notice_id}/read` 별도 엔드포인트 + 프론트에서 상세 페이지 진입 시 자동 호출. GET 멱등성을 유지하면서 UX도 동일하게 유지 가능. 추후 캐싱이 필요해지면 이 방식으로 전환 가능.

### Q: 센터별 읽음 기준은?

**→ 1명이라도 읽으면 센터는 "읽음" 처리**

- `is_read = read_count > 0`
- 전체 멤버 읽음 여부는 `read_count / member_count`로 별도 표시

### Q: 공지 수정 시 읽음 기록은?

**→ 유지** (리셋하지 않음)

- 공지 수정은 오탈자 등 경미한 변경이 대부분
- 리셋이 필요한 경우 새 공지로 작성하는 것이 명확

### Q: 센터 웹 라우터 위치는?

**→ `app/modules/notice/center_router.py` (notice 모듈 내부)**

- 읽음 기록 생성이 notice 도메인의 책임
- 센터별 라우트 prefix: `/api/v1/centers/{center_id}/notices`
- main.py에서 센터 라우터로 등록

### Q: 어드민 읽음 현황 API 위치는?

**→ `app/modules/platform_admin/notice/` (platform_admin 모듈 내부)**

- `API_ARCHITECTURE.md` 규칙: 관리자 API는 `platform_admin/` 하위에 배치
- 기존 `platform_admin/notice/router.py`에 읽음 현황 엔드포인트 추가
- Repository + Service + Handler 레이어 구조 적용

### Q: `read_at` 별도 컬럼이 필요한가?

**→ 불필요** (`created_at` 사용)

- 레코드 생성 시각 = 읽은 시각 (UPSERT로 최초 1회만 기록)
- BaseModel의 `created_at`이 이미 UTC 시각을 기록
- 불필요한 컬럼 제거로 테이블 단순화

### Q: `member_count`는 어디서 가져오는가?

**→ `Member` 모델 직접 쿼리**

- `API_ARCHITECTURE.md` 섹션 8: 다른 모듈의 Model 참조는 허용
- Repository에서 `Member` 테이블을 `center_id`로 COUNT
- `Center` 테이블도 동일하게 JOIN으로 `center_name` 조회

---

## 7. 스키마 초안

### 읽음 현황 응답 (어드민)

> 파일 위치: `app/modules/platform_admin/notice/schemas_read.py`

```python
class NoticeReadCenterSummary(BaseModel):
    """센터별 읽음 요약"""
    center_id: str
    center_name: str
    is_read: bool
    first_read_at: datetime | None   # NoticeRead.created_at의 MIN값
    read_count: int
    member_count: int

class NoticeReadStatusResponse(BaseModel):
    """공지 읽음 현황 전체"""
    total_centers: int
    read_centers: int
    unread_centers: int
    centers: list[NoticeReadCenterSummary]

class NoticeReadMemberDetail(BaseModel):
    """멤버별 읽음 상세"""
    member_id: str
    name: str
    role_name: str
    read_at: datetime | None   # NoticeRead.created_at (없으면 null)

class NoticeReadCenterDetailResponse(BaseModel):
    """센터별 멤버 읽음 상세"""
    center_id: str
    center_name: str
    members: list[NoticeReadMemberDetail]
```

### 센터 웹 공지 응답

> 파일 위치: `app/modules/notice/schemas.py`에 추가

```python
class CenterNoticeSummary(BaseModel):
    """센터 웹용 공지 목록"""
    id: str
    title: str
    category: NoticeCategory
    is_pinned: bool
    is_read: bool
    published_at: datetime | None

class CenterNoticeListResponse(BaseModel):
    """센터 웹 공지 목록 응답"""
    items: list[CenterNoticeSummary]
    total: int
    unread_count: int
    page: int
    size: int
    pages: int
```
