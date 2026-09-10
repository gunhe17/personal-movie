# 문의관리 & FAQ 관리 기획

> 플랫폼 어드민에서 센터/사용자 문의를 접수·답변하고, FAQ를 등록/수정/관리하는 시스템

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

### 기능 구성

| 기능 | 설명 |
|------|------|
| **문의관리 (QnA)** | 센터/사용자 문의 접수, 답변 작성, 상태 관리 |
| **FAQ 관리** | 자주 묻는 질문 등록/수정/삭제, 카테고리·정렬 관리 |

### 현재 support 모듈과의 관계

현재 `support` 모듈 (`/support/inquiry`)은 센터 웹에서 이메일로 문의를 보내는 기능만 존재 (DB 저장 없음).
이번 구현은 **DB에 문의를 저장**하고 관리자가 답변할 수 있는 완전한 문의 관리 시스템을 추가한다.

### 역할 구분

| 역할 | 문의 접수 | 문의 답변 | FAQ 관리 |
|------|-----------|-----------|---------|
| `super_admin` | O (조회/처리) | O | O |
| `admin` | O (조회/처리) | O | O |
| 센터 사용자 (web) | O (문의 등록) | X | O (조회만) |

---

## 데이터 모델

### 1. Inquiry (문의) 테이블

```sql
CREATE TABLE inquiries (
    id VARCHAR(36) PRIMARY KEY,
    center_id VARCHAR(36),                  -- 센터 문의 시 (nullable, 비회원/일반 문의면 null)
    center_name VARCHAR(200),               -- 비정규화 (JOIN 방지)
    inquiry_type VARCHAR(30) NOT NULL,      -- general / billing / technical / feature_request / other
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending / in_progress / resolved / closed
    subject VARCHAR(300) NOT NULL,          -- 문의 제목
    content TEXT NOT NULL,                  -- 문의 내용
    sender_name VARCHAR(100) NOT NULL,      -- 문의자 이름
    sender_email VARCHAR(200) NOT NULL,     -- 문의자 이메일
    answered_by VARCHAR(36),               -- 답변 관리자 account_id (nullable)
    answered_by_name VARCHAR(100),          -- 답변 관리자 이름 비정규화
    answer TEXT,                            -- 답변 내용 (nullable)
    answered_at TIMESTAMP,                  -- 답변 일시 (nullable)
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_inquiries_status ON inquiries(status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_inquiries_center ON inquiries(center_id, created_at DESC) WHERE deleted_at IS NULL;
```

### SQLAlchemy 모델

```python
class Inquiry(BaseModel):
    __tablename__ = "inquiries"

    center_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    center_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    inquiry_type: Mapped[str] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    subject: Mapped[str] = mapped_column(String(300))
    content: Mapped[str] = mapped_column(Text)
    sender_name: Mapped[str] = mapped_column(String(100))
    sender_email: Mapped[str] = mapped_column(String(200))
    answered_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    answered_by_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    answered_at: Mapped[datetime | None] = mapped_column(nullable=True)
```

### Enum

| Enum | 값 | 설명 |
|------|----|------|
| `inquiry_type` | `general` | 일반 문의 |
| | `billing` | 결제/청구 문의 |
| | `technical` | 기술 지원 |
| | `feature_request` | 기능 요청 |
| | `other` | 기타 |
| `status` | `pending` | 대기 |
| | `in_progress` | 처리 중 |
| | `resolved` | 처리 완료 |
| | `closed` | 종료 |

---

### 2. FAQ 테이블

```sql
CREATE TABLE faqs (
    id VARCHAR(36) PRIMARY KEY,
    category VARCHAR(50) NOT NULL,     -- general / billing / technical / feature / getting_started
    question VARCHAR(500) NOT NULL,    -- 질문
    answer TEXT NOT NULL,              -- 답변
    is_published BOOLEAN NOT NULL DEFAULT FALSE,  -- 게시 여부
    sort_order INT NOT NULL DEFAULT 0,  -- 정렬 순서 (낮을수록 위)
    created_by VARCHAR(36) NOT NULL,   -- admin account_id
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX idx_faqs_published ON faqs(category, sort_order ASC) WHERE is_published = true AND deleted_at IS NULL;
```

### SQLAlchemy 모델

```python
class FAQ(BaseModel):
    __tablename__ = "faqs"

    category: Mapped[str] = mapped_column(String(50))
    question: Mapped[str] = mapped_column(String(500))
    answer: Mapped[str] = mapped_column(Text)
    is_published: Mapped[bool] = mapped_column(default=False)
    sort_order: Mapped[int] = mapped_column(default=0)
    created_by: Mapped[str] = mapped_column(String(36))
```

### FAQ 카테고리

| 코드 | 한글명 |
|------|--------|
| `getting_started` | 시작하기 |
| `general` | 일반 |
| `billing` | 결제/청구 |
| `technical` | 기술 지원 |
| `feature` | 기능 안내 |

---

## API 설계

### 문의 관리 API (Admin)

| 용도 | 메서드 | 엔드포인트 |
|------|--------|-----------|
| 문의 목록 조회 | GET | `/admin/inquiries` |
| 문의 상세 조회 | GET | `/admin/inquiries/{inquiry_id}` |
| 문의 답변 등록/수정 | PATCH | `/admin/inquiries/{inquiry_id}/answer` |
| 문의 상태 변경 | PATCH | `/admin/inquiries/{inquiry_id}/status` |
| 문의 삭제 | DELETE | `/admin/inquiries/{inquiry_id}` |

> 문의 생성은 센터 웹(web)에서 POST `/support/inquiry` 경유. 기존 support 모듈에 DB 저장 추가.

#### GET `/admin/inquiries`

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `inquiry_type` | query? | 문의 유형 필터 |
| `status` | query? | 상태 필터 |
| `search` | query? | 제목/내용/발신자 검색 |
| `page` | query | 1 (기본값) |
| `size` | query | 20 (기본값) |

Response:
```json
{
  "items": [
    {
      "id": "uuid",
      "center_name": "마음샘 상담센터",
      "inquiry_type": "technical",
      "status": "pending",
      "subject": "검사 결과 PDF 다운로드가 안 됩니다",
      "sender_name": "김원장",
      "sender_email": "director@example.com",
      "answered_by_name": null,
      "answered_at": null,
      "created_at": "2026-03-04T09:00:00"
    }
  ],
  "total": 25,
  "page": 1,
  "size": 20,
  "pages": 2
}
```

#### PATCH `/admin/inquiries/{inquiry_id}/answer`

Request:
```json
{
  "answer": "안녕하세요. PDF 다운로드 문제를 확인해드리겠습니다..."
}
```
> 답변 저장 시 `status` → `resolved`, `answered_by`, `answered_at` 자동 설정

#### PATCH `/admin/inquiries/{inquiry_id}/status`

Request:
```json
{
  "status": "in_progress"
}
```

---

### FAQ 관리 API (Admin)

| 용도 | 메서드 | 엔드포인트 |
|------|--------|-----------|
| FAQ 목록 조회 | GET | `/admin/faqs` |
| FAQ 상세 조회 | GET | `/admin/faqs/{faq_id}` |
| FAQ 등록 | POST | `/admin/faqs` |
| FAQ 수정 | PATCH | `/admin/faqs/{faq_id}` |
| FAQ 삭제 | DELETE | `/admin/faqs/{faq_id}` |
| FAQ 순서 일괄 변경 | PATCH | `/admin/faqs/reorder` |

#### GET `/admin/faqs`

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `category` | query? | 카테고리 필터 (탭 선택 시 전달) |
| `is_published` | query? | 게시 여부 필터 |
| `search` | query? | 질문/답변 검색 |
| `page` | query | 1 (기본값) |
| `size` | query | 20 (기본값) |

#### POST `/admin/faqs`

Request:
```json
{
  "category": "getting_started",
  "question": "비밀번호를 잊어버렸을 때 어떻게 하나요?",
  "answer": "로그인 화면에서 '비밀번호 찾기'를 클릭하면 이메일로 재설정 링크가 발송됩니다.",
  "is_published": false
}
```

#### PATCH `/admin/faqs/{faq_id}`

Request (부분 수정):
```json
{
  "question": "수정된 질문",
  "answer": "수정된 답변",
  "is_published": true
}
```

#### PATCH `/admin/faqs/reorder`

드래그앤드롭 후 카테고리 내 순서를 일괄 저장.

Request:
```json
{
  "category": "getting_started",
  "faq_ids": ["uuid-1", "uuid-2", "uuid-3"]
}
```
> `faq_ids` 배열 순서대로 `sort_order` 0, 1, 2... 재설정

---

### 센터 웹용 공개 API

| 용도 | 메서드 | 엔드포인트 |
|------|--------|-----------|
| 문의 등록 | POST | `/support/inquiry` (기존 확장) |
| FAQ 목록 | GET | `/support/faqs` |
| FAQ 상세 | GET | `/support/faqs/{faq_id}` |

> 기존 `support/inquiry`에 DB 저장 로직 추가 (이메일 발송은 유지)

---

## 페이지 설계 (Admin)

### 1. 문의 목록 (`/inquiries`)

```
┌─────────────────────────────────────────────────────────────┐
│  문의 관리                                     총 25개      │
├─────────────────────────────────────────────────────────────┤
│  [🔍 검색___] [유형: 전체▼] [상태: 전체▼]  [↻]             │
├─────────────────────────────────────────────────────────────┤
│  제목              │ 유형   │ 상태   │ 발신자 │ 접수일       │
│  ──────────────────────────────────────────────────────────  │
│  PDF 다운로드 오류 │ 기술   │ 대기   │ 김원장 │ 03.04        │
│  로그인 오류 문의  │ 기술   │ 처리중 │ 이상담 │ 03.03        │
│  ...              │        │       │       │              │
├─────────────────────────────────────────────────────────────┤
│                       < 1  2 >                               │
└─────────────────────────────────────────────────────────────┘
```

**테이블 컬럼:**

| 컬럼 | 필드 | 비고 |
|------|------|------|
| 제목 | `subject` | 클릭 시 상세 모달 열기 |
| 센터명 | `center_name` | null이면 "-" |
| 유형 | `inquiry_type` | 뱃지 |
| 상태 | `status` | 뱃지: 대기(노랑), 처리중(파랑), 완료(초록), 종료(회색) |
| 발신자 | `sender_name` | |
| 접수일 | `created_at` | YYYY.MM.DD |

---

### 2. 문의 상세 모달 (size: `lg`)

```
┌──────────────────────────────────────────────────────────────┐
│  문의 상세                              [상태: 대기▼]  [삭제] │
├──────────────────────────────────────────────────────────────┤
│  제목   검사 결과 PDF 다운로드가 안 됩니다                     │
│  센터   마음샘 상담센터                                        │
│  유형   기술 지원                                              │
│  발신자 김원장 (director@example.com)                          │
│  접수일 2026.03.04                                             │
├──────────────────────────────────────────────────────────────┤
│  문의 내용                                                     │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 검사 완료 후 PDF 저장 버튼을 눌러도 반응이 없습니다...│    │
│  └──────────────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────────────┤
│  답변                                                          │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ (textarea: 답변 작성 또는 기존 답변 표시)             │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                [답변 저장]    │
└──────────────────────────────────────────────────────────────┘
```

**사양:**
- 상태 Select: 드롭다운으로 직접 변경 가능 (PATCH `/status`)
- 답변 textarea: 답변 있으면 기존 내용 표시 (수정 가능)
- 답변 저장: PATCH `/answer` → status 자동 `resolved` → 스낵바 "답변이 저장되었습니다"

---

### 3. FAQ 목록 (`/faqs`)

```
┌─────────────────────────────────────────────────────────────┐
│  FAQ 관리                                    [새 FAQ 등록]   │
├─────────────────────────────────────────────────────────────┤
│  [전체] [시작하기] [일반] [기술지원] [기능안내]              │  ← 카테고리 탭
├─────────────────────────────────────────────────────────────┤
│  [🔍 검색___] [상태: 전체▼]  [↻]                            │
├─────────────────────────────────────────────────────────────┤
│  ⠿ │ 질문                        │ 상태  │ 등록일           │
│  ──────────────────────────────────────────────────────────  │
│  ⠿ │ 비밀번호를 잊어버렸어요       │ 게시  │ 02.15           │
│  ⠿ │ 검사 결과는 어디서 확인하나요 │ 초안  │ 02.20           │
│  ...│                             │      │                  │
├─────────────────────────────────────────────────────────────┤
│                       < 1  2 >                               │
└─────────────────────────────────────────────────────────────┘
```

**사양:**
- 카테고리 탭 선택 시 해당 카테고리로 필터링 (`category` 쿼리 파라미터)
- 탭이 특정 카테고리로 선택된 경우에만 드래그앤드롭 핸들(⠿) 활성화 (전체 탭에서는 비활성)
- 드래그앤드롭 완료 시 PATCH `/admin/faqs/reorder` 호출로 순서 저장

**테이블 컬럼:**

| 컬럼 | 필드 | 비고 |
|------|------|------|
| 드래그 핸들 | — | 특정 카테고리 탭에서만 활성 |
| 질문 | `question` | 행 클릭 시 수정 모달 |
| 카테고리 | `category` | 전체 탭에서만 뱃지 표시 |
| 상태 | `is_published` | 게시됨(초록) / 초안(회색) |
| 등록일 | `created_at` | YYYY.MM.DD |

---

### 4. FAQ 등록/수정 모달 (size: `lg`)

```
┌──────────────────────────────────────────────────────────────┐
│  FAQ 등록 (또는 수정)                                         │
├──────────────────────────────────────────────────────────────┤
│  카테고리  [시작하기 ▼]                                       │
│                                                              │
│  질문      [_______________________________________]         │
│                                                              │
│  답변                                                         │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ (textarea - 최소 6줄)                                │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  ☐ 즉시 게시                                                 │
│                                                              │
│                              [취소]  [저장]                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 백엔드 모듈 구조

### 설계 원칙

- **독립 `qna` 모듈**로 분리 (`modules/platform_admin/qna/`)
- **단순 모듈 패턴** (엔티티 2개) — Handler → Service
- 기존 `support` 모듈의 `/inquiry` endpoint에는 DB 저장 로직만 추가 (최소 변경)

### 디렉토리 구조

```
apps/api/app/modules/platform_admin/qna/
├── __init__.py
├── router.py                          # 문의 + FAQ 라우터 통합
├── models.py                          # Inquiry, FAQ 모델
├── schemas.py                         # Request/Response 스키마
└── handlers/
    ├── __init__.py
    ├── inquiry/
    │   ├── list_inquiries.py
    │   ├── get_inquiry.py
    │   ├── answer_inquiry.py          # PATCH /answer
    │   ├── update_inquiry_status.py   # PATCH /status
    │   └── delete_inquiry.py
    └── faq/
        ├── list_faqs.py
        ├── get_faq.py
        ├── create_faq.py
        ├── update_faq.py
        └── delete_faq.py
```

### 기존 파일 수정

| 파일 | 변경 내용 |
|------|---------|
| `apps/api/app/modules/platform_admin/router.py` | qna 라우터 등록 (2줄 추가) |
| `apps/api/app/modules/support/router.py` | `/inquiry` POST에 DB 저장 추가 |

> **주의**: `support/router.py` 수정은 기존 기능(이메일 발송)을 유지하면서 DB 저장만 추가. 기존 response 구조 변경 없음.

### Router 등록

```python
# modules/platform_admin/qna/router.py
router = APIRouter()
router.include_router(inquiry_router, prefix="/inquiries", tags=["Admin Inquiries"])
router.include_router(faq_router, prefix="/faqs", tags=["Admin FAQs"])

# modules/platform_admin/router.py 에 추가
from app.modules.platform_admin.qna.router import router as qna_router
router.include_router(qna_router)
```

---

## 프론트엔드 구조

### 라우트 구조

```
apps/admin/src/routes/(protected)/
├── inquiries/
│   └── +page.svelte                   # 문의 목록
└── faqs/
    └── +page.svelte                   # FAQ 목록
```

### Action 파일

```
apps/admin/src/lib/hooks/actions/
├── inquiry.action.ts                  # 문의 CRUD
└── faq.action.ts                      # FAQ CRUD
```

### Feature 파일 (복잡도에 따라)

```
apps/admin/src/lib/features/
├── inquiries/
│   └── components/
│       └── InquiryDetailModal.svelte  # 문의 상세+답변 모달
└── faqs/
    └── components/
        └── FAQFormModal.svelte        # FAQ 등록/수정 모달
```

### 사이드바 메뉴 추가

```
대시보드
센터 관리
센터 신청
계정 관리
검사 관리
공지사항
CS 전화 메모
문의 관리      ← 신규
FAQ 관리       ← 신규
```

### 기존 파일 수정

| 파일 | 변경 내용 |
|------|---------|
| `AdminSidebar.svelte` | 문의 관리, FAQ 관리 메뉴 추가 |

---

## 구현 순서

### Phase 1: 문의 관리 백엔드

1. `qna/models.py` — Inquiry 모델
2. Alembic 마이그레이션: `add_inquiries_table`
3. `qna/schemas.py` — Inquiry 스키마 (InquiryType, InquiryStatus enum 포함)
4. `qna/handlers/inquiry/` — 5개 핸들러
5. `qna/router.py` — inquiry 라우터
6. `platform_admin/router.py` — qna 라우터 등록
7. `support/router.py` — DB 저장 추가

### Phase 2: FAQ 관리 백엔드

8. `qna/models.py` — FAQ 모델 추가
9. Alembic 마이그레이션: `add_faqs_table`
10. `qna/schemas.py` — FAQ 스키마 추가
11. `qna/handlers/faq/` — 5개 핸들러
12. `qna/router.py` — faq 라우터 추가
13. `support/router.py` — `/faqs` 공개 조회 엔드포인트 추가

### Phase 3: 프론트엔드 문의 관리

14. `inquiry.action.ts` — 타입 + action
15. `InquiryDetailModal.svelte` — 상세+답변 모달
16. `/inquiries/+page.svelte` — 목록 페이지
17. `AdminSidebar.svelte` — 메뉴 추가

### Phase 4: 프론트엔드 FAQ 관리

18. `faq.action.ts` — 타입 + action
19. `FAQFormModal.svelte` — 등록/수정 모달
20. `/faqs/+page.svelte` — 목록 페이지
21. `AdminSidebar.svelte` — FAQ 메뉴 추가

---

## 결정 사항

- [x] **문의 알림**: 내부 알림으로 처리 (추후 구현)
- [x] **답변 이메일 발송**: 내부 알림으로 처리 (추후 구현)
- [x] **문의 첨부파일**: 미지원
- [x] **FAQ 정렬 UI**: 드래그앤드롭 정렬 + 카테고리별 탭 분류
- [x] **FAQ 센터 웹 노출 위치**: 기존 고객센터 페이지에 통합
- [x] **기존 support 모듈**: 현행 유지 (이메일 발송 전용 endpoint 그대로, 별도 endpoint 신설 안 함)
