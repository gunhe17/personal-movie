# CS 전화 메모 기능 구현 계획서

## 1. 기능 개요

CS 담당자가 전화 상담 내용을 텍스트로 기록하고 조회하는 기능. 플랫폼 어드민(apps/admin)에서 사용.

**핵심 기능:**

- 전화 메모 작성/수정/상세 — 모달로 처리
- 메모 목록 조회 (검색, 필터링, 페이지네이션)
- 메모 삭제 (Soft Delete)
- 우하단 플로팅 버튼 — 어느 페이지에서든 간편 메모 작성

**권한 규칙:**

| 역할              | 조회               | 작성 | 수정/삭제      |
| ----------------- | ------------------ | ---- | -------------- |
| `super_admin`     | 전체 메모          | O    | 전체 메모      |
| `admin`           | 본인 작성 메모만   | O    | 본인 메모만    |
| `customer_service`| 본인 작성 메모만   | O    | 본인 메모만    |

**설계 원칙:**

- 단순 모듈 패턴 (엔티티 1개) → Handler → Service 직접 호출
- notice 모듈 패턴 참고
- admin route 내부에서만 동작, 기존 센터용 API 영향 없음

---

## 2. DB 모델 설계

### `cs_memos` 테이블

| 컬럼             | 타입          | 설명                                         |
| ---------------- | ------------- | -------------------------------------------- |
| title            | String(200)   | 메모 제목 (예: "마음샘 상담센터 - 결제 문의") |
| content          | Text          | 메모 내용                                    |
| memo_type        | String(30)    | inquiry / complaint / request / other        |
| center_id        | String(36)?   | 관련 센터 ID (nullable)                      |
| center_name      | String(200)?  | 센터명 비정규화 (JOIN 방지)                  |
| created_by       | String(36)    | 작성자 admin_account_id                      |
| created_by_name  | String(100)?  | 작성자 이름 비정규화                         |

> BaseModel 제공: id, created_at, updated_at, deleted_at

**인덱스:**

- `(created_by, created_at DESC)` — 작성자별 조회
- `(center_id, created_at DESC)` — 센터별 조회
- `(memo_type, created_at DESC)` — 유형별 조회

---

## 3. API 엔드포인트

모든 엔드포인트: `/api/v1/admin/cs-memos` prefix

| Method   | Path                       | 설명          |
| -------- | -------------------------- | ------------- |
| `GET`    | `/admin/cs-memos`          | 목록 조회     |
| `GET`    | `/admin/cs-memos/{id}`     | 상세 조회     |
| `POST`   | `/admin/cs-memos`          | 메모 작성     |
| `PATCH`  | `/admin/cs-memos/{id}`     | 메모 수정     |
| `DELETE` | `/admin/cs-memos/{id}`     | 메모 삭제     |

### 권한 적용 방식

- **목록 조회**: super_admin → 전체, 그 외 → `created_by = current_admin.id` 자동 필터
- **상세 조회**: super_admin → 전체, 그 외 → 본인 메모가 아니면 403
- **수정/삭제**: super_admin → 전체, 그 외 → 본인 메모가 아니면 403

### GET /admin/cs-memos (목록)

| 파라미터     | 타입   | 설명                              |
| ------------ | ------ | --------------------------------- |
| `search`     | query? | 제목/내용 검색                    |
| `memo_type`  | query? | inquiry/complaint/request/other   |
| `center_id`  | query? | 특정 센터 메모만                  |
| `created_by` | query? | 특정 작성자 메모만 (super_admin만) |
| `sort_order` | query  | desc (기본값)                     |
| `page`       | query  | 1 (기본값)                        |
| `size`       | query  | 20 (기본값)                       |

### POST /admin/cs-memos (작성)

```json
{
  "title": "마음샘 상담센터 - 문의",
  "content": "3월 검사 관련 문의...",
  "memo_type": "inquiry",
  "center_id": "uuid (선택)"
}
```

### PATCH /admin/cs-memos/{id} (수정)

```json
{
  "title": "수정된 제목 (선택)",
  "content": "수정된 내용 (선택)",
  "memo_type": "request (선택)"
}
```

---

## 4. 백엔드 모듈 구조

### 새 모듈

```
apps/api/app/modules/platform_admin/cs_memo/
├── __init__.py
├── router.py              # 5개 엔드포인트
├── models.py              # CSMemo 모델
├── schemas.py             # Request/Response 스키마
└── handlers/
    ├── __init__.py
    ├── list_memos.py
    ├── get_memo.py
    ├── create_memo.py
    ├── update_memo.py
    └── delete_memo.py
```

### 기존 파일 수정

| 파일                                                   | 변경 내용                    |
| ------------------------------------------------------ | ---------------------------- |
| `apps/api/app/modules/platform_admin/router.py`        | cs_memo 라우터 등록 (2줄 추가) |

---

## 5. 프론트엔드 구조

### 새 파일

```
apps/admin/src/
├── lib/
│   ├── components/
│   │   └── FloatingMemoButton.svelte    # 우하단 플로팅 메모 버튼
│   └── hooks/actions/
│       └── cs-memo.action.ts            # API action (CRUD 5개)
└── routes/(protected)/cs-memos/
    ├── +page.svelte                     # 목록 페이지
    └── components/
        ├── MemoFormModal.svelte          # 작성/수정 모달 (공용)
        └── MemoDetailModal.svelte        # 상세 조회 모달
```

### 기존 파일 수정

| 파일                               | 변경 내용                      |
| ---------------------------------- | ------------------------------ |
| `AdminSidebar.svelte`              | CS 메모 메뉴 항목 추가         |
| `(protected)/+layout.svelte`       | FloatingMemoButton 추가        |

### UI 설계

**플로팅 메모 버튼 (FloatingMemoButton.svelte)**
- 우하단 고정 (`fixed bottom-6 right-6`)
- 메모 아이콘 원형 버튼 (56x56, primary 색상, 그림자)
- 클릭 → MemoFormModal 열기 (작성 모드)
- 모든 `(protected)` 페이지에서 노출

**목록 페이지 (`/cs-memos`)**
- PageHeader: "CS 전화 메모" + 총 N개 + "새 메모 작성" 버튼
- 필터 바: 검색, 유형 Select, 초기화
- Table: 제목, 유형(뱃지), 센터명, 작성자(super_admin만), 작성일
- Pagination
- 행 클릭 → MemoDetailModal 열기

**MemoFormModal (작성/수정 공용, size: md)**
- 제목 input (필수)
- 유형 Select (필수): 문의/불만/요청/기타
- 센터 Select (선택): getCenterList 드롭다운
- 내용 Textarea (필수)
- 저장 버튼 → POST or PATCH → 스낵바 + invalidate → 모달 닫기

**MemoDetailModal (상세, size: md)**
- `<dl>` 형태로 메모 정보 표시 (제목, 유형, 센터, 내용, 작성자, 작성일)
- 하단 버튼: 수정 (→ MemoFormModal 전환), 삭제 (확인 후 DELETE)

---

## 6. 구현 순서

### Step 1: 백엔드 모델 + 마이그레이션

1. `cs_memo/models.py` — CSMemo 모델
2. `cs_memo/__init__.py`
3. `alembic revision --autogenerate -m "add cs_memos table"`
4. `alembic upgrade head`

### Step 2: 백엔드 스키마

5. `cs_memo/schemas.py` — MemoType enum, Create/Update/Summary/Detail/List

### Step 3: 백엔드 핸들러

6. `handlers/list_memos.py` — 목록 (검색/필터/페이지네이션 + 권한 필터)
7. `handlers/get_memo.py` — 상세 (권한 체크)
8. `handlers/create_memo.py` — 작성 (center_name 비정규화 포함)
9. `handlers/update_memo.py` — 수정 (권한 체크)
10. `handlers/delete_memo.py` — 삭제 (soft delete + 권한 체크)

### Step 4: 백엔드 라우터

11. `cs_memo/router.py` — 5개 엔드포인트
12. `platform_admin/router.py` — 라우터 등록

### Step 5: 프론트엔드 Action

13. `cs-memo.action.ts` — 타입 + 5개 action

### Step 6: 프론트엔드 모달 컴포넌트

14. `MemoFormModal.svelte` — 작성/수정 공용 모달
15. `MemoDetailModal.svelte` — 상세 조회 모달

### Step 7: 프론트엔드 페이지 + 플로팅 버튼

16. `/cs-memos/+page.svelte` — 목록 페이지
17. `FloatingMemoButton.svelte` — 우하단 플로팅 버튼
18. `(protected)/+layout.svelte` — 플로팅 버튼 배치

### Step 8: 사이드바 메뉴

19. `AdminSidebar.svelte` — CS 메모 항목 추가

---

## 7. 설계 결정 사항

### 모달 기반 CRUD

- 메모는 필드가 적으므로(제목, 유형, 센터, 내용) 별도 페이지 불필요
- 작성/수정: MemoFormModal 하나로 통합 (props로 mode 구분)
- 상세: MemoDetailModal에서 조회 + 수정/삭제 버튼

### 플로팅 메모 버튼

- 어느 페이지에서든 전화 받으면서 바로 메모 작성 가능
- `(protected)/+layout.svelte`에 배치 → 인증된 모든 페이지에서 노출
- MemoFormModal을 직접 열어 작성 모드로 진입

### 센터 선택 UI

기존 `getCenterList` API 재사용하여 Select 드롭다운 제공.

### 센터명 비정규화

센터명 변경 시 기존 메모의 `center_name`은 업데이트하지 않음. 메모는 작성 시점 기록.

### 권한 분리

- super_admin만 전체 메모 조회/관리 가능
- 그 외 역할은 본인 작성 메모만 접근 → 개인 업무 기록
- 핸들러에서 `current_admin.role`로 분기 처리

### admin 외부 영향

- 기존 센터용 API 변경 없음
- 새 테이블 `cs_memos` 추가
- `platform_admin/router.py` 라우터 등록 1건만 기존 파일 수정
