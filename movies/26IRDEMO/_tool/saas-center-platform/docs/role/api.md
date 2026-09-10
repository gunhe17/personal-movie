# Role API 명세

---

## Permission API

### GET /permissions

권한 목록 조회

**권한**: `system:admin`

**Query Parameters**:
| 파라미터 | 타입 | 필수 | 설명 |
|----------|------|------|------|
| `category` | string | N | 카테고리 필터 (client, counseling 등) |
| `is_new` | boolean | N | 신규 권한만 조회 |

**Response**:
```json
{
  "items": [
    {
      "id": 1,
      "code": "client:read",
      "name": "내담자 조회",
      "description": "내담자 목록 및 상세 정보 조회",
      "category": "client",
      "is_new": false,
      "added_at": "2026-01-01T00:00:00Z",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "total": 50
}
```

---

### POST /permissions

권한 생성 (플랫폼 관리자 전용)

**권한**: `system:admin`

**Request**:
```json
{
  "code": "client:export",
  "name": "내담자 데이터 내보내기",
  "description": "내담자 정보를 Excel/CSV로 내보내기",
  "category": "client"
}
```

**Response**: `201 Created`

---

### POST /permissions/sync

코드 정의 권한과 DB 동기화

**권한**: `system:admin`

**동작**:
1. 코드에 정의된 권한 목록 조회
2. DB에 없는 권한 추가 (`is_new=true`)
3. DB에만 있는 권한 확인 (삭제 경고)

**Response**:
```json
{
  "added": [
    {
      "code": "client:export",
      "name": "내담자 데이터 내보내기"
    }
  ],
  "removed": [],
  "total": 50
}
```

---

## Role API

### GET /roles

역할 목록 조회 (프리셋 5개)

**권한**: `center:admin` (센터 관리자)

**Response**:
```json
{
  "items": [
    {
      "id": 1,
      "code": "platform_admin",
      "name": "플랫폼 관리자",
      "description": "전체 시스템 관리",
      "created_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": 2,
      "code": "center_admin",
      "name": "센터 관리자",
      "description": "센터 내 모든 권한"
    },
    {
      "id": 3,
      "code": "counselor",
      "name": "상담사",
      "description": "상담/검사 수행"
    },
    {
      "id": 4,
      "code": "intern",
      "name": "실습생",
      "description": "읽기 전용"
    },
    {
      "id": 5,
      "code": "receptionist",
      "name": "접수/행정",
      "description": "일정/결제 관리"
    }
  ],
  "total": 5
}
```

---

### GET /roles/{id}

역할 상세 조회

**권한**: `center:admin`

**Response**:
```json
{
  "id": 3,
  "code": "counselor",
  "name": "상담사",
  "description": "상담/검사 수행",
  "created_at": "2026-01-01T00:00:00Z"
}
```

---

## RolePermission API

### GET /roles/{role_id}/permissions

역할 권한 목록 조회

**권한**: `center:admin`

**Response**:
```json
{
  "role": {
    "id": 3,
    "code": "counselor",
    "name": "상담사"
  },
  "permissions": [
    {
      "id": 1,
      "code": "client:read",
      "name": "내담자 조회",
      "category": "client"
    },
    {
      "id": 2,
      "code": "client:write",
      "name": "내담자 생성/수정",
      "category": "client"
    },
    {
      "id": 10,
      "code": "counseling:read",
      "name": "상담 조회",
      "category": "counseling"
    },
    {
      "id": 11,
      "code": "counseling:write",
      "name": "상담 생성/수정",
      "category": "counseling"
    }
  ]
}
```

---

### PUT /roles/{role_id}/permissions

역할 권한 일괄 설정 (플랫폼 관리자 전용)

**권한**: `system:admin`

**Request**:
```json
{
  "permission_ids": [1, 2, 10, 11, 20, 21]
}
```

**동작**:
1. 기존 RolePermission 모두 삭제
2. 새 permission_ids로 일괄 생성

**Response**: `200 OK`

---

## Member 권한 API (Center 도메인)

Member 권한 커스터마이징은 Center 도메인에서 관리

### PATCH /centers/{center_id}/members/{member_id}/permissions

Member 권한 개별 조정 (센터 관리자)

**권한**: `center:admin`

**Request**:
```json
{
  "permissions": [
    "client:read",
    "client:write",
    "counseling:read",
    "assessment:read"
  ]
}
```

**Response**: `200 OK`

---

### POST /centers/{center_id}/members/{member_id}/sync-role-permissions

Role 권한으로 동기화 (센터 관리자)

**권한**: `center:admin`

**동작**:
1. Member의 role_id 조회
2. Role 권한 조회
3. Member의 permissions 배열 덮어쓰기

**Response**: `200 OK`
