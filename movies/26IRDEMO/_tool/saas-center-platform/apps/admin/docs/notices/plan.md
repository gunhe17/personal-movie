# 공지사항 관리 기획

> 플랫폼 어드민에서 등록/관리하고, 센터 웹에서 조회만 가능한 공지사항 시스템

---

## 목차

1. [개요](#개요)
2. [데이터 모델](#데이터-모델)
3. [API 설계](#api-설계)
4. [페이지 설계 (Admin)](#페이지-설계-admin)
5. [백엔드 모듈 구조](#백엔드-모듈-구조)
6. [프론트엔드 구조](#프론트엔드-구조)
7. [구현 순서](#구현-순서)
8. [미정 / 논의 필요 사항](#미정--논의-필요-사항)

---

## 개요

### 핵심 원칙

- **등록/수정/삭제**: 플랫폼 어드민(admin)에서만 가능
- **조회**: 센터 웹(web)에서 게시된 공지를 조회

### 공지 유형 (category)

| 카테고리 | 코드 | 예시 |
|----------|------|------|
| 점검 안내 | `maintenance` | "3/10 02:00~06:00 서버 점검" |
| 업데이트 | `update` | "검사 결과 PDF 다운로드 기능 추가" |
| 일반 공지 | `announcement` | "이용약관 변경 안내" |

### 공지 상태

| 상태 | 조건 | 센터 노출 |
|------|------|-----------|
| **초안** (draft) | `is_published = false` | X |
| **게시됨** (published) | `is_published = true` | O |

---

## 데이터 모델

### Notice 테이블

```sql
CREATE TABLE notices (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(30) NOT NULL,               -- maintenance, update, announcement
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,    -- 상단 고정
    published_at TIMESTAMP,                      -- 최초 게시 시각
    created_by VARCHAR(36) NOT NULL,             -- account_id (플랫폼 관리자)
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- 조회 성능용 인덱스
CREATE INDEX idx_notices_published ON notices(is_published, is_pinned, created_at DESC)
    WHERE deleted_at IS NULL;
```

### SQLAlchemy 모델

```python
class Notice(BaseModel):
    __tablename__ = "notices"

    title: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(30))       # maintenance, update, announcement
    is_published: Mapped[bool] = mapped_column(default=False)
    is_pinned: Mapped[bool] = mapped_column(default=False)
    published_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_by: Mapped[str] = mapped_column(String(36))     # account_id
```

---

## API 설계

### 1. 관리자 API (apps/admin → backend)

> 플랫폼 관리자가 공지를 CRUD

| 용도 | 메서드 | 엔드포인트 |
|------|--------|-----------|
| 공지 목록 조회 | GET | `/admin/notices` |
| 공지 상세 조회 | GET | `/admin/notices/{notice_id}` |
| 공지 작성 | POST | `/admin/notices` |
| 공지 수정 | PATCH | `/admin/notices/{notice_id}` |
| 공지 삭제 | DELETE | `/admin/notices/{notice_id}` |

### 2. 센터 사용자 조회 API (apps/web → backend) — 추후 구현

> 센터 사용자가 게시된 공지를 조회만 가능 (RBAC: `read:notice`)

| 용도 | 메서드 | 엔드포인트 |
|------|--------|-----------|
| 공지 목록 | GET | `/centers/{center_id}/notices` |
| 공지 상세 | GET | `/centers/{center_id}/notices/{notice_id}` |

> 조회 시 `is_published = true AND deleted_at IS NULL` 조건 적용

---

### 상세 스펙

#### GET `/admin/notices`

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `category` | query | `maintenance` \| `update` \| `announcement` \| 전체(미입력) |
| `is_published` | query | `true` \| `false` \| 전체(미입력) |
| `search` | query | 제목 검색 (디바운스 300ms) |
| `page` | query | 페이지 번호 (default: 1) |
| `size` | query | 페이지 크기 (default: 20) |

Response:
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "3월 10일 서버 점검 안내",
      "category": "maintenance",
      "is_published": true,
      "is_pinned": false,
      "published_at": "2026-03-05T10:00:00",
      "created_by_name": "관리자",
      "created_at": "2026-03-04T09:00:00",
      "updated_at": "2026-03-04T09:30:00"
    }
  ],
  "total": 15,
  "page": 1,
  "size": 20,
  "pages": 1
}
```

#### GET `/admin/notices/{notice_id}`

Response:
```json
{
  "id": "uuid",
  "title": "3월 10일 서버 점검 안내",
  "content": "안녕하세요. 시스템 안정화를 위해...",
  "category": "maintenance",
  "is_published": true,
  "is_pinned": false,
  "published_at": "2026-03-05T10:00:00",
  "created_by": "admin-account-uuid",
  "created_by_name": "관리자",
  "created_at": "2026-03-04T09:00:00",
  "updated_at": "2026-03-04T09:30:00"
}
```

#### POST `/admin/notices`

Request:
```json
{
  "title": "3월 10일 서버 점검 안내",
  "content": "안녕하세요. 시스템 안정화를 위해...",
  "category": "maintenance",
  "is_published": false,
  "is_pinned": false
}
```

> `is_published: true`로 보내면 즉시 게시 (`published_at` 자동 설정)

#### PATCH `/admin/notices/{notice_id}`

Request (부분 수정):
```json
{
  "title": "수정된 제목",
  "content": "수정된 내용",
  "is_published": true,
  "is_pinned": true
}
```

> 초안 → 게시로 변경 시 `published_at` 자동 설정

#### DELETE `/admin/notices/{notice_id}`

Soft Delete (`deleted_at` 설정). 게시 중인 공지도 삭제 가능 (확인 모달 필요).

---

## 페이지 설계 (Admin)

### 1. 공지사항 목록 (`/notices`)

#### 화면 구성

```
┌─────────────────────────────────────────────────────────────┐
│  공지사항 관리                                    [새 공지 작성] │
├─────────────────────────────────────────────────────────────┤
│  [전체] [점검] [업데이트] [일반]   [상태: 전체▼]  [검색: ______] │
├─────────────────────────────────────────────────────────────┤
│  📌│ 제목                │ 유형   │ 상태   │ 작성자 │ 작성일    │
│  ──────────────────────────────────────────────────────────  │
│  📌│ 이용약관 변경 안내    │ 일반   │ 게시됨 │ 관리자 │ 03.01    │
│    │ 3월 서버 점검 안내    │ 점검   │ 초안   │ 관리자 │ 03.04    │
│    │ 검사 PDF 기능 추가   │ 업데이트│ 게시됨 │ 관리자 │ 02.28    │
│    │ ...                 │        │       │       │          │
├─────────────────────────────────────────────────────────────┤
│                       < 1  2  3 >                            │
└─────────────────────────────────────────────────────────────┘
```

#### 상세 사양

| 항목 | 설명 |
|------|------|
| **카테고리 필터** | 전체 / 점검 / 업데이트 / 일반 (탭 또는 Select) |
| **상태 필터** | 전체 / 게시됨 / 초안 (Select) |
| **검색** | 제목 검색 (디바운스 300ms) |
| **정렬** | 고정(pinned) 우선 → 작성일 최신순 |
| **페이지네이션** | 20건/페이지 |
| **행 클릭** | 공지 상세/수정 페이지로 이동 |
| **새 공지 작성** | 작성 페이지(`/notices/new`)로 이동 |

#### 테이블 컬럼

| 컬럼 | 필드 | 비고 |
|------|------|------|
| 고정 | `is_pinned` | 📌 아이콘 표시 |
| 제목 | `title` | |
| 유형 | `category` | 뱃지: 점검(주황), 업데이트(파랑), 일반(회색) |
| 상태 | `is_published` | 뱃지: 게시됨(초록), 초안(회색) |
| 작성자 | `created_by_name` | |
| 작성일 | `created_at` | YYYY.MM.DD |

---

### 2. 공지사항 작성 (`/notices/new`)

#### 화면 구성

```
┌─────────────────────────────────────────────────────────────┐
│  ← 목록으로                                                  │
│                                                              │
│  공지사항 작성                                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  유형     [점검 안내 ▼]                                      │
│                                                              │
│  제목     [______________________________________]           │
│                                                              │
│  내용                                                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                     │    │
│  │  (textarea - 최소 10줄 높이)                          │    │
│  │                                                     │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ☐ 상단에 고정                                               │
│                                                              │
│                          [임시저장]  [게시하기]                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 상세 사양

| 항목 | 설명 |
|------|------|
| **유형** | Select: 점검 안내 / 업데이트 / 일반 공지 |
| **제목** | 필수, 최대 200자 |
| **내용** | 필수, textarea (plain text) |
| **상단 고정** | 체크박스, 기본값 false |
| **임시저장** | `is_published: false`로 저장 → 토스트 "임시저장되었습니다" → 상세 페이지로 이동 |
| **게시하기** | 게시 확인 모달 → `is_published: true`로 저장 → 토스트 "게시되었습니다" → 목록으로 이동 |

#### 게시 확인 모달

```
┌──────────────────────────────────────┐
│  공지사항 게시                        │
│                                      │
│  공지사항을 게시하시겠습니까?           │
│  게시 즉시 모든 센터 사용자에게        │
│  노출됩니다.                          │
│                                      │
│              [취소]  [게시]            │
└──────────────────────────────────────┘
```

---

### 3. 공지사항 상세/수정 (`/notices/[noticeId]`)

#### 화면 구성

```
┌─────────────────────────────────────────────────────────────┐
│  ← 목록으로                                                  │
│                                                              │
│  공지사항 상세                     [상태: 게시됨]  [삭제하기]   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  유형     점검 안내                              [수정 ✏️]    │
│  제목     3월 10일 서버 점검 안내                              │
│  내용     안녕하세요. 시스템 안정화를 위해...                   │
│  상단 고정 고정됨                                              │
│                                                              │
│  작성일: 2026.03.04  │  수정일: 2026.03.05  │  게시일: 2026.03.05  │
│                                                              │
│                          [저장하기]  [게시하기/게시취소]        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 상세 사양

| 항목 | 설명 |
|------|------|
| **보기/수정 모드** | 수정 아이콘 클릭으로 편집 모드 토글 |
| **초안 상태** | [게시하기] 버튼 |
| **게시 상태** | [게시 취소] 버튼 |
| **저장하기** | 수정 모드에서만 표시, 현재 상태 유지한 채 내용만 수정 → 토스트 "저장되었습니다" |
| **게시하기** | 게시 확인 모달 → is_published=true → 토스트 "게시되었습니다" |
| **게시 취소** | 확인 모달 → is_published=false → 토스트 "게시가 취소되었습니다" |
| **삭제하기** | 삭제 확인 모달 → soft delete → 토스트 "삭제되었습니다" → 목록으로 이동 |

#### 삭제 확인 모달

```
┌──────────────────────────────────────┐
│  공지사항 삭제                        │
│                                      │
│  이 공지사항을 삭제하시겠습니까?        │
│  (게시 중인 공지는 즉시 비노출됩니다)   │
│                                      │
│              [취소]  [삭제]            │
└──────────────────────────────────────┘
```

#### 게시 취소 확인 모달

```
┌──────────────────────────────────────┐
│  게시 취소                           │
│                                      │
│  공지사항 게시를 취소하시겠습니까?      │
│  센터 사용자에게 더 이상 노출되지      │
│  않습니다.                           │
│                                      │
│              [취소]  [게시 취소]       │
└──────────────────────────────────────┘
```

---

## 백엔드 모듈 구조

### 설계 원칙

- **독립 `notice` 모듈**로 분리 (`modules/notice/`)
- **단순 모듈** (엔티티 1개) — Handler에서 직접 쿼리 (Service/Repository/Facade 불필요)
- 관리자 Router는 `platform_admin/router.py`에서 include

### 디렉토리 구조

```
apps/api/app/modules/notice/
├── __init__.py
├── models.py                              # Notice 엔티티
├── schemas.py                             # Pydantic DTOs
├── handlers/
│   ├── __init__.py
│   ├── list_notices.py
│   ├── get_notice.py
│   ├── create_notice.py
│   ├── update_notice.py
│   └── delete_notice.py
└── admin_router.py                        # /admin/notices
```

### Router 등록

```python
# modules/notice/__init__.py
from .admin_router import router as notice_admin_router

# platform_admin/router.py
router.include_router(notice_admin_router, prefix="/notices")
```

### 패턴

- **복잡도**: 단순 (엔티티 1개)
- **패턴**: Handler에서 직접 SQL 쿼리 (UnitOfWork 사용)
- **관리자 권한**: `get_current_user` (플랫폼 관리자 인증)

---

## 프론트엔드 구조

### Admin (apps/admin)

#### 라우트 구조

```
apps/admin/src/routes/(protected)/notices/
├── +page.svelte                     # 공지 목록
├── new/
│   └── +page.svelte                 # 공지 작성
└── [noticeId]/
    └── +page.svelte                 # 공지 상세/수정
```

#### Action 파일

```
apps/admin/src/lib/hooks/actions/notice.action.ts
```

#### 사이드바 메뉴

```
대시보드
센터 관리
센터 신청
계정 관리
검사 관리
공지사항 관리     ← 신규
```

### Web (apps/web) — 추후 구현

> 센터 웹에서 게시된 공지를 조회만 가능

```
공지 목록 조회: GET /centers/{center_id}/notices
공지 상세 조회: GET /centers/{center_id}/notices/{notice_id}
```

---

## 구현 순서

### Phase 1: 플랫폼 공지 (Admin) — ✅ 완료

#### Step 1: 백엔드

1. ✅ Notice 모델 작성 (`models.py`)
2. ✅ Alembic 마이그레이션 생성/실행
3. ✅ Pydantic 스키마 작성 (`schemas.py`)
4. ✅ Handlers 작성 (CRUD 5개)
5. ✅ Router 작성 (`admin_router.py`) + platform_admin router에 등록

#### Step 2: 프론트엔드 (Admin)

1. ✅ Action 파일 작성 (`notice.action.ts`)
2. ✅ 사이드바 메뉴 추가
3. ✅ 공지 목록 페이지 (`/notices`)
4. ✅ 공지 작성 페이지 (`/notices/new`)
5. ✅ 공지 상세/수정 페이지 (`/notices/[noticeId]`)

### Phase 2: 센터 조회 (Web) — 추후

1. 센터용 조회 전용 Router/Handler 추가
2. apps/web 공지 조회 페이지 구현

---

## 미정 / 논의 필요 사항

- [ ] **내용 에디터**: plain textarea vs 리치 텍스트 에디터 (마크다운 등)
- [ ] **센터 사용자 노출 방식**: 별도 공지 페이지 vs 대시보드 배너 vs 모달
- [ ] **알림 발송**: 공지 게시 시 이메일/알림톡 발송 여부
- [ ] **첨부파일**: 파일 첨부 필요 여부 (점검 안내 이미지 등)
