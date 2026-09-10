# Center 도메인 시나리오

> 상담센터 관리의 실제 사용 시나리오

---

## 목차

1. [시나리오 1: 센터 생성 (플랫폼 관리자)](#시나리오-1-센터-생성-플랫폼-관리자)
2. [시나리오 2: 센터 정보 조회 및 수정](#시나리오-2-센터-정보-조회-및-수정)
3. [시나리오 3: 멤버 초대 생성](#시나리오-3-멤버-초대-생성)
4. [시나리오 4: 초대 수락 및 센터 가입](#시나리오-4-초대-수락-및-센터-가입)
5. [시나리오 5: 멤버 권한 수정](#시나리오-5-멤버-권한-수정)
6. [시나리오 6: 멤버 퇴사 처리](#시나리오-6-멤버-퇴사-처리)
7. [시나리오 7: 상담실 생성 및 관리](#시나리오-7-상담실-생성-및-관리)
8. [시나리오 8: 운영 시간 설정](#시나리오-8-운영-시간-설정)
9. [시나리오 9: 특정 날짜 휴무 설정](#시나리오-9-특정-날짜-휴무-설정)
10. [시나리오 10: 특정 날짜 운영 정보 조회](#시나리오-10-특정-날짜-운영-정보-조회)
11. [시나리오 11: 초대 재발송 및 취소](#시나리오-11-초대-재발송-및-취소)
12. [시나리오 12: 멤버 역할 변경](#시나리오-12-멤버-역할-변경)

---

## 시나리오 1: 센터 생성 (플랫폼 관리자)

### 설명
플랫폼 관리자가 새로운 상담센터를 생성

### 사전 조건
- 플랫폼 관리자 계정으로 로그인
- `system:admin` 권한 보유

### HTTP 요청

```http
POST /centers
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "name": "마음건강 상담센터",
  "phone": "02-1234-5678",
  "address": "서울특별시 강남구 테헤란로 123",
  "description": "전문 상담사가 함께하는 마음건강 센터입니다.",
  "logo_url": "https://example.com/logo.png",
  "business_registration_number": "123-45-67890",
  "representative_name": "홍길동",
  "bank_account": "신한은행 110-123-456789"
}
```

### HTTP 응답 (201 Created)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "마음건강 상담센터",
  "code": "A3K9M2X7",
  "phone": "02-1234-5678",
  "address": "서울특별시 강남구 테헤란로 123",
  "description": "전문 상담사가 함께하는 마음건강 센터입니다.",
  "logo_url": "https://example.com/logo.png",
  "business_registration_number": "123-45-67890",
  "representative_name": "홍길동",
  "bank_account": "신한은행 110-123-456789",
  "approved_at": null,
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-15T10:00:00Z"
}
```

### 데이터베이스 변경

**centers 테이블 삽입**:
```sql
INSERT INTO centers (
  id, name, code, phone, address, description, logo_url,
  business_registration_number, representative_name, bank_account,
  approved_at, deleted_at, created_at, updated_at
)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  '마음건강 상담센터',
  'A3K9M2X7',  -- 자동 생성
  '02-1234-5678',
  '서울특별시 강남구 테헤란로 123',
  '전문 상담사가 함께하는 마음건강 센터입니다.',
  'https://example.com/logo.png',
  '123-45-67890',
  '홍길동',
  '신한은행 110-123-456789',
  NULL,  -- 미승인 상태
  NULL,
  NOW(),
  NOW()
);
```

### 비즈니스 규칙 적용

1. 플랫폼 관리자 권한 체크 (`system:admin`)
2. 센터 코드 자동 생성 (8자리 대문자 + 숫자)
3. `name` 필수 필드 검증
4. 센터 생성 (미승인 상태)

---

## 시나리오 2: 센터 정보 조회 및 수정

### 설명
센터 관리자가 센터 정보를 조회하고 수정

### 사전 조건
- 센터에 소속된 멤버로 로그인
- 센터 전환 완료 (JWT에 center_id 포함)
- 센터 정보 수정 권한 보유

### HTTP 요청 1: 센터 조회

```http
GET /centers/{center_id}
Authorization: Bearer {access_token}
```

### HTTP 응답 1 (200 OK)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "마음건강 상담센터",
  "code": "A3K9M2X7",
  "phone": "02-1234-5678",
  "address": "서울특별시 강남구 테헤란로 123",
  "description": "전문 상담사가 함께하는 마음건강 센터입니다.",
  "logo_url": "https://example.com/logo.png",
  "business_registration_number": "123-45-67890",
  "representative_name": "홍길동",
  "bank_account": "신한은행 110-123-456789",
  "approved_at": "2026-01-15T12:00:00Z",
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-15T10:00:00Z"
}
```

### HTTP 요청 2: 센터 수정

```http
PATCH /centers/{center_id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "phone": "02-9999-8888",
  "description": "업데이트된 설명입니다."
}
```

### HTTP 응답 2 (200 OK)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "마음건강 상담센터",
  "code": "A3K9M2X7",
  "phone": "02-9999-8888",
  "address": "서울특별시 강남구 테헤란로 123",
  "description": "업데이트된 설명입니다.",
  "logo_url": "https://example.com/logo.png",
  "business_registration_number": "123-45-67890",
  "representative_name": "홍길동",
  "bank_account": "신한은행 110-123-456789",
  "approved_at": "2026-01-15T12:00:00Z",
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-15T14:00:00Z"
}
```

### 데이터베이스 변경

**centers 테이블 업데이트**:
```sql
UPDATE centers
SET
  phone = '02-9999-8888',
  description = '업데이트된 설명입니다.',
  updated_at = NOW()
WHERE id = '550e8400-e29b-41d4-a716-446655440000';
```

### 비즈니스 규칙 적용

1. 센터 소속 멤버 체크 (JWT의 center_id)
2. 수정 권한 체크
3. `code`는 수정 불가 (생성 시 자동 생성)
4. Partial Update 지원 (제공된 필드만 수정)

---

## 시나리오 3: 멤버 초대 생성

### 설명
센터 관리자가 새로운 상담사를 초대

### 사전 조건
- 센터 관리자로 로그인
- 센터 전환 완료 (JWT에 center_id 포함)
- 멤버 관리 권한 보유

### HTTP 요청

```http
POST /centers/{center_id}/invitations
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "email": "newcounselor@example.com",
  "role_id": 2,
  "employment_type": "FULLTIME"
}
```

### HTTP 응답 (201 Created)

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "center_id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "newcounselor@example.com",
  "role_id": 2,
  "role_name": "상담사",
  "employment_type": "FULLTIME",
  "expires_at": "2026-01-22T10:00:00Z",
  "accepted_at": null,
  "created_at": "2026-01-15T10:00:00Z"
}
```

### 데이터베이스 변경

**member_invitations 테이블 삽입**:
```sql
INSERT INTO member_invitations (
  id, center_id, role_id, email, employment_type,
  expires_at, accepted_at, created_at, updated_at
)
VALUES (
  '660e8400-e29b-41d4-a716-446655440001',
  '550e8400-e29b-41d4-a716-446655440000',
  2,  -- 상담사 역할
  'newcounselor@example.com',
  'FULLTIME',
  NOW() + INTERVAL '7 days',  -- 7일 후 만료
  NULL,
  NOW(),
  NOW()
);
```

### 이메일 발송

```
To: newcounselor@example.com
Subject: [마음건강 상담센터] 멤버 초대

안녕하세요,

마음건강 상담센터에서 상담사로 초대합니다.

센터 코드: A3K9M2X7
역할: 상담사
고용형태: 정규직

아래 링크를 통해 회원가입 후 센터에 가입해주세요.
https://app.example.com/signup?center_code=A3K9M2X7

이 초대는 7일 후 만료됩니다.
```

### 비즈니스 규칙 적용

1. 센터 관리자 권한 체크
2. 이메일 형식 검증
3. 역할 존재 여부 체크 (role_id → roles 테이블)
4. 고용형태 유효성 체크 (FULLTIME, CONTRACT, FREELANCER)
5. 초대 만료일 설정 (7일)
6. 초대 이메일 발송 (비동기)
7. 동일 이메일로 대기 중인 초대 중복 체크

---

## 시나리오 4: 초대 수락 및 센터 가입

### 설명
초대받은 사용자가 회원가입 후 센터에 가입

### 사전 조건
- 초대 이메일 수신
- 회원가입 완료 (Person, Account 생성됨)
- 로그인 완료 (Access Token 보유)

### HTTP 요청

```http
POST /centers/{center_code}/join
Authorization: Bearer {access_token}
```

**참고**: `center_code`는 센터 코드 (예: A3K9M2X7)

### HTTP 응답 (201 Created)

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "center_id": "550e8400-e29b-41d4-a716-446655440000",
  "person_id": "990e8400-e29b-41d4-a716-446655440004",
  "role_id": 2,
  "role_name": "상담사",
  "permissions": [
    "client:read",
    "client:create",
    "counseling:read",
    "counseling:create"
  ],
  "employment_type": "FULLTIME",
  "memo": null,
  "effective_from": "2026-01-15T10:00:00Z",
  "effective_to": null,
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-15T10:00:00Z"
}
```

### 데이터베이스 변경

**1. 초대 조회 및 검증**:
```sql
SELECT * FROM member_invitations
WHERE center_id = (SELECT id FROM centers WHERE code = 'A3K9M2X7')
  AND email = 'newcounselor@example.com'
  AND accepted_at IS NULL
  AND expires_at > NOW();
```

**2. Role 권한 조회**:
```sql
SELECT rp.permission_id, p.code
FROM role_permissions rp
JOIN permissions p ON rp.permission_id = p.id
WHERE rp.role_id = 2;
-- 결과: ["client:read", "client:create", "counseling:read", "counseling:create"]
```

**3. members 테이블 삽입**:
```sql
INSERT INTO members (
  id, center_id, person_id, role_id, permissions,
  employment_type, memo, effective_from, effective_to,
  deleted_at, created_at, updated_at
)
VALUES (
  '880e8400-e29b-41d4-a716-446655440003',
  '550e8400-e29b-41d4-a716-446655440000',
  '990e8400-e29b-41d4-a716-446655440004',
  2,
  '["client:read", "client:create", "counseling:read", "counseling:create"]'::jsonb,
  'FULLTIME',
  NULL,
  NOW(),
  NULL,
  NULL,
  NOW(),
  NOW()
);
```

**4. member_invitations 테이블 업데이트**:
```sql
UPDATE member_invitations
SET
  accepted_at = NOW(),
  updated_at = NOW()
WHERE id = '660e8400-e29b-41d4-a716-446655440001';
```

### 비즈니스 규칙 적용

1. 센터 코드로 센터 조회
2. 로그인한 사용자의 이메일로 초대 조회
3. 초대 만료 여부 확인 (`expires_at > NOW()`)
4. 초대 수락 여부 확인 (`accepted_at IS NULL`)
5. **Role 권한 복사**: Role의 기본 권한을 Member.permissions에 복사
6. Member 생성 (`effective_from = NOW()`)
7. 초대 수락 처리 (`accepted_at` 업데이트)

---

## 시나리오 5: 멤버 권한 수정

### 설명
센터 관리자가 멤버의 개별 권한을 수정

### 사전 조건
- 센터 관리자로 로그인
- 멤버 관리 권한 보유
- 대상 멤버가 센터에 소속

### HTTP 요청

```http
PATCH /centers/{center_id}/members/{member_id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "permissions": [
    "client:read",
    "client:create",
    "client:update",
    "counseling:read",
    "counseling:create",
    "assessment:read"
  ]
}
```

### HTTP 응답 (200 OK)

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "center_id": "550e8400-e29b-41d4-a716-446655440000",
  "person_id": "990e8400-e29b-41d4-a716-446655440004",
  "role_id": 2,
  "role_name": "상담사",
  "permissions": [
    "client:read",
    "client:create",
    "client:update",
    "counseling:read",
    "counseling:create",
    "assessment:read"
  ],
  "employment_type": "FULLTIME",
  "memo": null,
  "effective_from": "2026-01-15T10:00:00Z",
  "effective_to": null,
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-16T09:00:00Z"
}
```

### 데이터베이스 변경

**members 테이블 업데이트**:
```sql
UPDATE members
SET
  permissions = '["client:read", "client:create", "client:update", "counseling:read", "counseling:create", "assessment:read"]'::jsonb,
  updated_at = NOW()
WHERE id = '880e8400-e29b-41d4-a716-446655440003';
```

### 비즈니스 규칙 적용

1. 센터 관리자 권한 체크
2. 대상 멤버 존재 및 소속 확인
3. 권한 코드 유효성 검증 (permissions 테이블에 존재)
4. 권한 개별 수정 (Role과 독립적으로 관리)
5. **주의**: Role 변경 없이 권한만 수정

---

## 시나리오 6: 멤버 퇴사 처리

### 설명
센터 관리자가 퇴사한 멤버의 소속을 종료

### 사전 조건
- 센터 관리자로 로그인
- 멤버 관리 권한 보유
- 대상 멤버가 활성 상태

### HTTP 요청

```http
PATCH /centers/{center_id}/members/{member_id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "effective_to": "2026-01-31T23:59:59Z"
}
```

### HTTP 응답 (200 OK)

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "center_id": "550e8400-e29b-41d4-a716-446655440000",
  "person_id": "990e8400-e29b-41d4-a716-446655440004",
  "role_id": 2,
  "role_name": "상담사",
  "permissions": [
    "client:read",
    "client:create",
    "counseling:read",
    "counseling:create"
  ],
  "employment_type": "FULLTIME",
  "memo": null,
  "effective_from": "2026-01-15T10:00:00Z",
  "effective_to": "2026-01-31T23:59:59Z",
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-20T10:00:00Z"
}
```

### 데이터베이스 변경

**members 테이블 업데이트**:
```sql
UPDATE members
SET
  effective_to = '2026-01-31T23:59:59Z',
  updated_at = NOW()
WHERE id = '880e8400-e29b-41d4-a716-446655440003';
```

### 비즈니스 규칙 적용

1. 센터 관리자 권한 체크
2. 대상 멤버 존재 및 활성 상태 확인
3. `effective_to` 설정 (퇴사일)
4. **이력 보존**: Soft Delete 대신 effective_to 사용
5. `effective_to` 이후에는 해당 센터 접근 불가

### 활성 멤버 조회 쿼리

```sql
SELECT * FROM members
WHERE center_id = '550e8400-e29b-41d4-a716-446655440000'
  AND effective_from <= NOW()
  AND (effective_to IS NULL OR effective_to > NOW())
  AND deleted_at IS NULL;
```

---

## 시나리오 7: 상담실 생성 및 관리

### 설명
센터 관리자가 상담실을 생성하고 관리

### 사전 조건
- 센터 관리자로 로그인
- 센터 관리 권한 보유

### HTTP 요청 1: 상담실 생성

```http
POST /centers/{center_id}/rooms
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "상담실 A",
  "memo": "창가 쪽, 조용한 분위기"
}
```

### HTTP 응답 1 (201 Created)

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "center_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "상담실 A",
  "memo": "창가 쪽, 조용한 분위기",
  "is_active": true,
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-15T10:00:00Z"
}
```

### HTTP 요청 2: 상담실 목록 조회

```http
GET /centers/{center_id}/rooms
Authorization: Bearer {access_token}
```

### HTTP 응답 2 (200 OK)

```json
{
  "items": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "center_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "상담실 A",
      "memo": "창가 쪽, 조용한 분위기",
      "is_active": true,
      "created_at": "2026-01-15T10:00:00Z",
      "updated_at": "2026-01-15T10:00:00Z"
    },
    {
      "id": "770e8400-e29b-41d4-a716-446655440003",
      "center_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "상담실 B",
      "memo": null,
      "is_active": true,
      "created_at": "2026-01-15T11:00:00Z",
      "updated_at": "2026-01-15T11:00:00Z"
    }
  ],
  "total": 2
}
```

### HTTP 요청 3: 상담실 비활성화

```http
PATCH /centers/{center_id}/rooms/{room_id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "is_active": false
}
```

### HTTP 응답 3 (200 OK)

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "center_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "상담실 A",
  "memo": "창가 쪽, 조용한 분위기",
  "is_active": false,
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-16T09:00:00Z"
}
```

### 비즈니스 규칙 적용

1. 센터 관리 권한 체크
2. 상담실 이름 필수
3. `is_active=false`로 비활성화 (신규 예약 불가)
4. Soft Delete 지원 (`deleted_at`)
5. 삭제된 상담실의 기존 예약은 유지

---

## 시나리오 8: 운영 시간 설정

> **TODO**: 도메인 구조 고민 중

---

## 시나리오 9: 특정 날짜 휴무 설정

> **TODO**: 도메인 구조 고민 중

---

## 시나리오 10: 특정 날짜 운영 정보 조회

> **TODO**: 도메인 구조 고민 중

---

## 시나리오 11: 초대 재발송 및 취소

### 설명
센터 관리자가 만료된 초대를 재발송하거나 대기 중인 초대를 취소

### 사전 조건
- 센터 관리자로 로그인
- 멤버 관리 권한 보유

### HTTP 요청 1: 초대 목록 조회

```http
GET /centers/{center_id}/invitations?status=pending
Authorization: Bearer {access_token}
```

### HTTP 응답 1 (200 OK)

```json
{
  "items": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "center_id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "newcounselor@example.com",
      "role_id": 2,
      "role_name": "상담사",
      "employment_type": "FULLTIME",
      "expires_at": "2026-01-22T10:00:00Z",
      "accepted_at": null,
      "created_at": "2026-01-15T10:00:00Z"
    }
  ],
  "total": 1
}
```

### HTTP 요청 2: 초대 취소

```http
DELETE /centers/{center_id}/invitations/{invitation_id}
Authorization: Bearer {access_token}
```

### HTTP 응답 2 (204 No Content)

(응답 본문 없음)

### 데이터베이스 변경

**member_invitations 테이블 삭제**:
```sql
DELETE FROM member_invitations
WHERE id = '660e8400-e29b-41d4-a716-446655440001'
  AND center_id = '550e8400-e29b-41d4-a716-446655440000'
  AND accepted_at IS NULL;  -- 수락되지 않은 초대만 삭제 가능
```

### HTTP 요청 3: 만료된 초대 재발송

```http
POST /centers/{center_id}/invitations
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "email": "newcounselor@example.com",
  "role_id": 2,
  "employment_type": "FULLTIME"
}
```

**참고**: 기존 만료된 초대와 동일한 이메일로 새 초대 생성

### 비즈니스 규칙 적용

1. 수락된 초대는 취소 불가 (`accepted_at IS NOT NULL`)
2. 만료된 초대는 자동 정리 또는 새 초대로 대체
3. 동일 이메일로 대기 중인 초대가 있으면 중복 생성 불가

---

## 시나리오 12: 멤버 역할 변경

### 설명
센터 관리자가 멤버의 역할을 변경하고 권한 재설정

### 사전 조건
- 센터 관리자로 로그인
- 멤버 관리 권한 보유
- 대상 멤버가 센터에 소속

### HTTP 요청 1: 역할 목록 조회 (Auth 모듈)

```http
GET /auth/roles
Authorization: Bearer {access_token}
```

### HTTP 응답 1 (200 OK)

```json
{
  "items": [
    {
      "id": 1,
      "code": "center_admin",
      "name": "센터 관리자",
      "permissions": ["client:read", "client:create", "client:update", "client:delete", "member:manage", ...]
    },
    {
      "id": 2,
      "code": "counselor",
      "name": "상담사",
      "permissions": ["client:read", "client:create", "counseling:read", "counseling:create"]
    },
    {
      "id": 3,
      "code": "receptionist",
      "name": "접수직원",
      "permissions": ["client:read", "client:create", "schedule:read"]
    }
  ],
  "total": 3
}
```

### HTTP 요청 2: 멤버 역할 변경

```http
PATCH /centers/{center_id}/members/{member_id}
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "role_id": 1
}
```

**참고**: 역할 변경 시 권한은 새 역할의 기본 권한으로 **자동 재설정**됨

### HTTP 응답 2 (200 OK)

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "center_id": "550e8400-e29b-41d4-a716-446655440000",
  "person_id": "990e8400-e29b-41d4-a716-446655440004",
  "role_id": 1,
  "role_name": "센터 관리자",
  "permissions": [
    "client:read",
    "client:create",
    "client:update",
    "client:delete",
    "counseling:read",
    "counseling:create",
    "counseling:update",
    "counseling:delete",
    "member:manage"
  ],
  "employment_type": "FULLTIME",
  "memo": null,
  "effective_from": "2026-01-15T10:00:00Z",
  "effective_to": null,
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-20T10:00:00Z"
}
```

### 비즈니스 규칙 적용

1. 역할 변경 시 `role_id` 업데이트
2. **역할 변경 시 권한 자동 재설정**: 새 역할의 기본 권한으로 자동 대체
3. 이전 역할의 불필요한 권한 잔존 방지
4. 역할 변경 후 해당 멤버의 JWT는 다음 재발급 시 반영

---

## 시나리오 요약

| # | 시나리오 | 주요 API | 결과 |
|---|---------|---------|------|
| 1 | 센터 생성 | POST /centers | Center 생성 (코드 자동 생성) |
| 2 | 센터 정보 조회/수정 | GET /centers/{id}<br>PATCH /centers/{id} | 센터 정보 반환/업데이트 |
| 3 | 멤버 초대 생성 | POST /centers/{id}/invitations | MemberInvitation 생성 + 이메일 발송 |
| 4 | 초대 수락 및 센터 가입 | POST /centers/{code}/join | Member 생성 (권한 복사) |
| 5 | 멤버 권한 수정 | PATCH /centers/{id}/members/{id} | permissions 업데이트 |
| 6 | 멤버 퇴사 처리 | PATCH /centers/{id}/members/{id} | effective_to 설정 |
| 7 | 상담실 생성/관리 | POST /centers/{id}/rooms<br>GET /centers/{id}/rooms | Room 생성/조회 |
| 8 | 운영 시간 설정 | POST /centers/{id}/operating-hours | OperatingHour 생성 |
| 9 | 특정 날짜 휴무 설정 | POST /centers/{id}/operating-hours | year/month/day로 휴무 설정 |
| 10 | 특정 날짜 운영 정보 조회 | GET /centers/{id}/operating-hours/date/{date} | 우선순위 기반 운영 정보 |
| 11 | 초대 재발송/취소 | DELETE /centers/{id}/invitations/{id} | 초대 삭제 |
| 12 | 멤버 역할 변경 | PATCH /centers/{id}/members/{id} | role_id 업데이트 |

---

## 참고 문서

- **메인 도메인**: `/docs/center/domain.md`
- **의사결정 기록**: `/docs/center/decision-log.md`
- **엣지 케이스**: `/docs/center/edge-cases.md` (예정)
- **Auth 도메인**: `/docs/auth/domain.md` - Role, Permission 참조
- **Auth 시나리오**: `/docs/auth/scenarios.md`
- **프로젝트 설정**: `/CLAUDE.md`
