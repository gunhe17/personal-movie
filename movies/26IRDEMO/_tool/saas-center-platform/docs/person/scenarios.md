# Person 시나리오

Person 도메인의 실제 사용 시나리오를 HTTP 요청/응답, DB 변경, 비즈니스 룰과 함께 문서화합니다.

---

## 시나리오 1: 회원가입 시 Person 생성

**상황**: 새로운 사용자가 회원가입하면서 Person 정보를 함께 등록합니다.

### HTTP 요청

```http
POST /auth/signup
Content-Type: application/json

{
  "email": "kim.chulsoo@example.com",
  "password": "SecurePass123!",
  "person": {
    "name": "김철수",
    "phone": "010-1234-5678",
    "birth": "1990-05-15",
    "gender": "male"
  }
}
```

### HTTP 응답

```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "account": {
    "id": 1,
    "email": "kim.chulsoo@example.com",
    "person_id": 1,
    "privacy_mask_enabled": false,
    "created_at": "2024-01-15T10:00:00Z"
  },
  "person": {
    "id": 1,
    "name": "김철수",
    "phone": "010-1234-5678",
    "birth": "1990-05-15",
    "gender": "male",
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  }
}
```

### DB 변경

```sql
-- 1. Person 생성
INSERT INTO persons (name, phone, birth, gender, created_at, updated_at)
VALUES ('김철수', '010-1234-5678', '1990-05-15', 'male', '2024-01-15 10:00:00', '2024-01-15 10:00:00');
-- → person_id = 1

-- 2. Account 생성 (Person과 연결)
INSERT INTO accounts (email, password_hash, person_id, privacy_mask_enabled, created_at)
VALUES ('kim.chulsoo@example.com', '$2b$12$...', 1, false, '2024-01-15 10:00:00');
-- → account_id = 1
```

### 적용된 비즈니스 룰

1. **Person 필수 검증**: name과 phone은 필수, birth/gender는 선택
2. **전화번호 형식 검증**: `010-1234-5678` 패턴 (한국 형식)
3. **생년월일 검증**: 미래 날짜 불가
4. **성별 검증**: `male` 또는 `female`
5. **Account-Person 1:1 연결**: Account.person_id = Person.id

### 변형 케이스: 최소 정보만 제공

```http
POST /auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "person": {
    "name": "홍길동",
    "phone": "010-5555-6666"
  }
}
```

**결과**: Person은 name과 phone이 필수이므로 성공 (birth, gender는 NULL)

---

## 시나리오 2: Person 정보 조회 (본인)

**상황**: 로그인한 사용자가 자신의 Account와 Person 정보를 조회합니다.

### HTTP 요청

```http
GET /accounts/me
Authorization: Bearer eyJhbGc...
```

### HTTP 응답

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "account": {
    "id": 1,
    "email": "kim.chulsoo@example.com",
    "person_id": 1,
    "privacy_mask_enabled": false,
    "created_at": "2024-01-15T10:00:00Z"
  },
  "person": {
    "id": 1,
    "name": "김철수",
    "phone": "010-1234-5678",
    "birth": "1990-05-15",
    "gender": "male",
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  }
}
```

### DB 쿼리

```sql
-- 1. JWT에서 account_id 추출 (account_id = 1)

-- 2. Account + Person 조인 조회
SELECT
  a.id, a.email, a.person_id, a.privacy_mask_enabled, a.created_at,
  p.id, p.name, p.phone, p.birth, p.gender, p.created_at, p.updated_at
FROM accounts a
LEFT JOIN persons p ON a.person_id = p.id
WHERE a.id = 1 AND a.deleted_at IS NULL AND (p.deleted_at IS NULL OR p.deleted_at IS NOT NULL);
```

### 적용된 비즈니스 룰

1. **본인 조회**: JWT의 account_id와 조회 대상 일치
2. **마스킹 없음**: 본인이므로 원본 데이터 반환
3. **Soft Delete 제외**: deleted_at IS NULL인 Person만 조회

---

## 시나리오 3: Person 정보 수정

**상황**: 사용자가 전화번호를 변경합니다.

### HTTP 요청

```http
PATCH /accounts/me
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "person": {
    "phone": "010-9999-8888"
  }
}
```

### HTTP 응답

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "account": {
    "id": 1,
    "email": "kim.chulsoo@example.com",
    "person_id": 1,
    "privacy_mask_enabled": false,
    "created_at": "2024-01-15T10:00:00Z"
  },
  "person": {
    "id": 1,
    "name": "김철수",
    "phone": "010-9999-8888",
    "birth": "1990-05-15",
    "gender": "male",
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-16T14:30:00Z"
  }
}
```

### DB 변경

```sql
-- Person 업데이트
UPDATE persons
SET
  phone = '010-9999-8888',
  updated_at = '2024-01-16 14:30:00'
WHERE id = 1 AND deleted_at IS NULL;
```

### 적용된 비즈니스 룰

1. **본인만 수정 가능**: JWT account_id = Account.person_id의 소유자
2. **부분 업데이트**: 제공된 필드만 수정 (name, birth, gender는 유지)
3. **전화번호 형식 검증**: 새로운 phone도 `010-XXXX-XXXX` 패턴 검증
4. **updated_at 갱신**: 수정 시각 자동 기록

### 에러 케이스: 타인 Person 수정 시도

```http
PATCH /accounts/123
Authorization: Bearer eyJhbGc...  (account_id=1인 토큰)
Content-Type: application/json

{
  "person": {
    "phone": "010-1111-2222"
  }
}
```

**응답**:
```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "detail": "본인의 정보만 수정할 수 있습니다"
}
```

---

## 시나리오 4: 마스킹 적용된 Person 조회

**상황**: 센터 관리자가 Client 목록을 조회할 때, 일부 사용자는 마스킹을 활성화했습니다.

### HTTP 요청

```http
GET /centers/1/clients
Authorization: Bearer eyJhbGc...  (센터 관리자 토큰)
```

### HTTP 응답

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "items": [
    {
      "id": 1,
      "center_id": 1,
      "person_id": 1,
      "status": "active",
      "person": {
        "id": 1,
        "name": "김철수",
        "phone": "010-1234-5678",
        "birth": "1990-05-15",
        "gender": "male"
      }
    },
    {
      "id": 2,
      "center_id": 1,
      "person_id": 2,
      "status": "active",
      "person": {
        "id": 2,
        "name": "이*동",
        "phone": "010-****-8888",
        "birth": null,
        "gender": null
      }
    }
  ],
  "total": 2
}
```

### DB 쿼리

```sql
-- 1. Center의 Client 목록 조회 (Person, Account 조인)
SELECT
  c.id, c.center_id, c.person_id, c.status,
  p.id, p.name, p.phone, p.birth, p.gender,
  a.privacy_mask_enabled
FROM clients c
LEFT JOIN persons p ON c.person_id = p.id
LEFT JOIN accounts a ON a.person_id = p.id
WHERE c.center_id = 1
  AND c.deleted_at IS NULL
  AND p.deleted_at IS NULL;

-- 2. Application Layer에서 마스킹 적용
-- IF a.privacy_mask_enabled = true:
--   name = mask_name(p.name)        → "이*동"
--   phone = mask_phone(p.phone)     → "010-****-8888"
--   birth = None
--   gender = None
```

### 적용된 비즈니스 룰

1. **마스킹 설정 확인**: Account.privacy_mask_enabled = true
2. **마스킹 함수 적용**:
   - `mask_name()`: 첫 글자 + `*` (예: "이영동" → "이*동")
   - `mask_phone()`: `010-****-8888` 형식
   - `birth`, `gender`: None으로 마스킹
3. **본인 조회 시 예외**: 본인이 자신의 Person 조회 시 마스킹 없음

---

## 시나리오 5: 멀티센터 Person 사용

**상황**: 한 사용자(Person)가 여러 센터에서 Client로 등록됩니다.

### 초기 상태

```sql
-- Person (id=1)
SELECT * FROM persons WHERE id = 1;
-- name='김철수', phone='010-1234-5678'

-- Account (id=1)
SELECT * FROM accounts WHERE id = 1;
-- email='kim.chulsoo@example.com', person_id=1
```

### 시나리오 흐름

#### Step 1: A센터에서 Client 등록

```http
POST /centers/1/clients
Authorization: Bearer eyJhbGc...  (센터 A 관리자)
Content-Type: application/json

{
  "person_id": 1,
  "status": "active",
  "note": "A센터 내담자"
}
```

**DB 변경**:
```sql
INSERT INTO clients (center_id, person_id, status, note, created_at)
VALUES (1, 1, 'active', 'A센터 내담자', NOW());
-- → client_id = 101
```

#### Step 2: B센터에서 동일 Person을 Client로 등록

```http
POST /centers/2/clients
Authorization: Bearer eyJhbGc...  (센터 B 관리자)
Content-Type: application/json

{
  "person_id": 1,
  "status": "active",
  "note": "B센터 내담자"
}
```

**DB 변경**:
```sql
INSERT INTO clients (center_id, person_id, status, note, created_at)
VALUES (2, 1, 'active', 'B센터 내담자', NOW());
-- → client_id = 102
```

### 결과 상태

```sql
-- Person 1개
SELECT * FROM persons WHERE id = 1;
-- name='김철수' (변경 없음)

-- Account 1개
SELECT * FROM accounts WHERE person_id = 1;
-- id=1 (변경 없음)

-- Client 2개 (같은 Person, 다른 Center)
SELECT * FROM clients WHERE person_id = 1;
-- (client_id=101, center_id=1)
-- (client_id=102, center_id=2)
```

### 적용된 비즈니스 룰

1. **Person 재사용**: 같은 Person이 여러 Center의 Client로 등록 가능
2. **Client 독립성**: 각 Center의 Client는 독립적 (상담 기록, 결제 등 분리)
3. **Person 정보 공유**: 김철수가 본인 정보 수정 시 모든 Center에 반영
4. **Center 격리**: A센터는 B센터의 상담 기록 볼 수 없음

---

## 시나리오 6: ClientLinkRequest 승인 플로우

**상황**: 센터가 기존 Account 사용자를 Client로 연결하기 위해 승인 요청을 보냅니다.

### Step 1: 센터 관리자가 LinkRequest 생성

```http
POST /centers/1/client-link-requests
Authorization: Bearer eyJhbGc...  (센터 관리자)
Content-Type: application/json

{
  "target_account_id": 5,
  "message": "상담 서비스를 위해 내담자 등록을 요청합니다."
}
```

**응답**:
```http
HTTP/1.1 201 Created

{
  "id": 1,
  "center_id": 1,
  "target_account_id": 5,
  "target_person_id": 5,
  "status": "pending",
  "message": "상담 서비스를 위해 내담자 등록을 요청합니다.",
  "created_at": "2024-01-20T10:00:00Z"
}
```

**DB 변경**:
```sql
-- 1. Account에서 person_id 조회
SELECT person_id FROM accounts WHERE id = 5;
-- → person_id = 5

-- 2. ClientLinkRequest 생성
INSERT INTO client_link_requests (center_id, target_account_id, target_person_id, status, message, created_at)
VALUES (1, 5, 5, 'pending', '상담 서비스를 위해...', NOW());
```

### Step 2: 사용자가 승인 요청 확인

```http
GET /accounts/me/client-link-requests
Authorization: Bearer eyJhbGc...  (account_id=5 토큰)
```

**응답**:
```http
HTTP/1.1 200 OK

{
  "items": [
    {
      "id": 1,
      "center": {
        "id": 1,
        "name": "행복 상담센터"
      },
      "status": "pending",
      "message": "상담 서비스를 위해 내담자 등록을 요청합니다.",
      "created_at": "2024-01-20T10:00:00Z"
    }
  ]
}
```

### Step 3: 사용자가 승인

```http
POST /client-link-requests/1/approve
Authorization: Bearer eyJhbGc...  (account_id=5 토큰)
```

**응답**:
```http
HTTP/1.1 200 OK

{
  "request": {
    "id": 1,
    "status": "approved",
    "approved_at": "2024-01-20T11:00:00Z"
  },
  "client": {
    "id": 201,
    "center_id": 1,
    "person_id": 5,
    "status": "active",
    "created_at": "2024-01-20T11:00:00Z"
  }
}
```

**DB 변경**:
```sql
-- 1. ClientLinkRequest 승인 처리
UPDATE client_link_requests
SET status = 'approved', approved_at = NOW()
WHERE id = 1;

-- 2. Client 생성 (Person 연결)
INSERT INTO clients (center_id, person_id, status, created_at)
VALUES (1, 5, 'active', NOW());
-- → client_id = 201
```

### Step 4 (선택): 사용자가 거부

```http
POST /client-link-requests/1/reject
Authorization: Bearer eyJhbGc...
```

**DB 변경**:
```sql
UPDATE client_link_requests
SET status = 'rejected', rejected_at = NOW()
WHERE id = 1;
-- Client는 생성되지 않음
```

### 적용된 비즈니스 룰

1. **Person 연결 검증**: target_account_id → person_id 추출
2. **중복 방지**: 같은 center_id + target_person_id 조합은 pending 상태로 1개만 허용
3. **본인만 승인/거부**: JWT의 account_id = target_account_id 확인
4. **Client 자동 생성**: 승인 시 Client 레코드 자동 생성 (person_id 연결)
5. **거부 시**: Client 생성 없음, request 상태만 'rejected'로 변경

---

## 시나리오 7: Account 탈퇴 시 Person Soft Delete

**상황**: 사용자가 회원 탈퇴를 요청합니다.

### HTTP 요청

```http
DELETE /accounts/me
Authorization: Bearer eyJhbGc...  (account_id=1 토큰)
```

### HTTP 응답

```http
HTTP/1.1 204 No Content
```

### DB 변경

```sql
-- 1. Account Soft Delete
UPDATE accounts
SET deleted_at = NOW()
WHERE id = 1;

-- 2. Person Soft Delete (CASCADE)
UPDATE persons
SET deleted_at = NOW()
WHERE id = 1;

-- 3. Client는 유지 (센터의 상담 기록 보존)
-- clients 테이블은 변경 없음
-- 단, person_id=1인 Person이 deleted_at이 있으므로
-- Client 조회 시 Person 데이터는 NULL로 표시됨
```

### 적용된 비즈니스 룰

1. **Soft Delete**: deleted_at 타임스탬프 기록 (물리적 삭제 X)
2. **CASCADE**: Account 삭제 시 Person도 자동 Soft Delete
3. **Client 보존**: Client 레코드는 유지 (상담 기록, 결제 내역 보존)
4. **조회 제외**: deleted_at IS NOT NULL인 Person은 조회에서 제외
5. **복구 가능**: deleted_at을 NULL로 변경하면 복구 (GDPR 보관 기간 내)

### 탈퇴 후 Client 조회 결과

```http
GET /centers/1/clients/101
Authorization: Bearer eyJhbGc...  (센터 관리자)
```

**응답**:
```http
HTTP/1.1 200 OK

{
  "id": 101,
  "center_id": 1,
  "person_id": 1,
  "status": "active",
  "person": null,  // Person이 soft delete됨
  "note": "A센터 내담자",
  "created_at": "2024-01-15T10:00:00Z"
}
```

**DB 쿼리**:
```sql
SELECT
  c.id, c.center_id, c.person_id, c.status, c.note,
  p.id, p.name, p.phone
FROM clients c
LEFT JOIN persons p ON c.person_id = p.id AND p.deleted_at IS NULL
WHERE c.id = 101;
-- Person.deleted_at IS NOT NULL이므로 LEFT JOIN 실패 → person: null
```

---

## 시나리오 8: Person 없이 Client 생성 (센터 직접 등록)

**상황**: 센터가 Account가 없는 내담자를 Client로 등록합니다 (오프라인 상담 등).

### HTTP 요청

```http
POST /centers/1/clients
Authorization: Bearer eyJhbGc...  (센터 관리자)
Content-Type: application/json

{
  "person_id": null,
  "name": "박지민",
  "contact_phone": "010-5555-6666",
  "birth": "2010-03-20",
  "status": "active",
  "note": "오프라인으로 방문한 내담자 (Account 없음)"
}
```

### HTTP 응답

```http
HTTP/1.1 201 Created

{
  "id": 301,
  "center_id": 1,
  "person_id": null,
  "name": "박지민",
  "contact_phone": "010-5555-6666",
  "birth": "2010-03-20",
  "status": "active",
  "note": "오프라인으로 방문한 내담자 (Account 없음)",
  "created_at": "2024-01-25T15:00:00Z"
}
```

### DB 변경

```sql
INSERT INTO clients (center_id, person_id, name, contact_phone, birth, status, note, created_at)
VALUES (1, NULL, '박지민', '010-5555-6666', '2010-03-20', 'active', '오프라인으로 방문한 내담자...', NOW());
-- → client_id = 301
```

### 적용된 비즈니스 룰

1. **Client 독립 정보**: name, contact_phone, birth는 Client 자체 필드 (필수)
2. **Client.person_id nullable**: Person 없이 Client 생성 가능
3. **독립적 Client**: Account/Person 없이도 상담 기록 관리 가능
4. **나중에 연결 가능**: 향후 ClientLinkRequest로 Account-Person 연결 가능

### 향후 Person 연결

**Step 1**: 내담자가 회원가입 후 센터에서 LinkRequest 생성
**Step 2**: 내담자가 승인
**Step 3**: Client.person_id 업데이트 (Client.name은 유지)

```sql
-- LinkRequest 승인 후
UPDATE clients
SET person_id = 5, updated_at = NOW()
WHERE id = 301;
-- Client.name='박지민' 유지 (Person.name과 독립적)
```

### Client-Person 정보 독립성

```sql
-- Client 정보 (센터 관리)
SELECT name, contact_phone FROM clients WHERE id = 301;
-- name='박지민', contact_phone='010-5555-6666'

-- Person 정보 (본인 관리, person_id=5와 연결 후)
SELECT name, phone FROM persons WHERE id = 5;
-- name='김지민', phone='010-7777-8888' (다를 수 있음)
```

**결론**: Client는 센터가 관리하는 독립적인 정보. Person 연결은 인증/식별 용도.

---

## 시나리오 9: Person 정보 변경 시 멀티센터 동기화

**상황**: 사용자가 Person 정보를 수정하면, 해당 Person과 연결된 모든 Client에 즉시 반영됩니다.

### 초기 상태

```sql
-- Person
SELECT * FROM persons WHERE id = 1;
-- name='김철수', phone='010-1234-5678'

-- Client (A센터, B센터)
SELECT * FROM clients WHERE person_id = 1;
-- (id=101, center_id=1, person_id=1)
-- (id=102, center_id=2, person_id=1)
```

### HTTP 요청 (사용자)

```http
PATCH /accounts/me
Authorization: Bearer eyJhbGc...  (account_id=1)
Content-Type: application/json

{
  "person": {
    "name": "김영철",
    "phone": "010-9999-8888"
  }
}
```

### DB 변경

```sql
-- Person 업데이트 (단일 레코드)
UPDATE persons
SET
  name = '김영철',
  phone = '010-9999-8888',
  updated_at = NOW()
WHERE id = 1;
```

### 결과 (자동 동기화)

```sql
-- A센터에서 Client 조회
SELECT c.*, p.name, p.phone
FROM clients c
JOIN persons p ON c.person_id = p.id
WHERE c.id = 101;
-- name='김영철', phone='010-9999-8888' (자동 반영)

-- B센터에서 Client 조회
SELECT c.*, p.name, p.phone
FROM clients c
JOIN persons p ON c.person_id = p.id
WHERE c.id = 102;
-- name='김영철', phone='010-9999-8888' (자동 반영)
```

### 적용된 비즈니스 룰

1. **단일 Person 레코드**: person_id=1은 DB에 1개만 존재
2. **JOIN 기반 조회**: Client는 항상 Person을 JOIN하여 최신 정보 반환
3. **자동 동기화**: Person 수정 시 별도 동기화 로직 불필요
4. **즉시 반영**: 모든 Center에서 즉시 변경된 정보 확인 가능

---

## 시나리오 10: CenterMember 생성 및 조회 (Person JOIN 기반)

**상황**: 센터에 직원(상담사)을 추가할 때 CenterMember를 생성하고, Person 정보는 항상 JOIN으로 가져옵니다.

### 전제 조건

```sql
-- Account + Person 존재 (회원가입 완료)
SELECT * FROM accounts WHERE id = 10;
-- email='lee.counselor@example.com', person_id=10

SELECT * FROM persons WHERE id = 10;
-- name='이상담', phone='010-2222-3333'
```

### HTTP 요청 (CenterMember 생성)

```http
POST /centers/1/members
Authorization: Bearer eyJhbGc...  (센터 관리자)
Content-Type: application/json

{
  "person_id": 10,
  "role_id": 2,
  "note": "심리상담 전문"
}
```

### HTTP 응답

```http
HTTP/1.1 201 Created

{
  "id": 501,
  "center_id": 1,
  "person_id": 10,
  "role_id": 2,
  "person": {
    "id": 10,
    "name": "이상담",
    "phone": "010-2222-3333"
  },
  "note": "심리상담 전문",
  "created_at": "2024-02-01T10:00:00Z"
}
```

### DB 변경

```sql
-- CenterMember 생성 (name, phone 필드 없음!)
INSERT INTO center_members (center_id, person_id, role_id, note, created_at)
VALUES (1, 10, 2, '심리상담 전문', NOW());
-- → center_member_id = 501
```

### CenterMember 목록 조회

```http
GET /centers/1/members
Authorization: Bearer eyJhbGc...
```

**응답**:
```http
HTTP/1.1 200 OK

{
  "items": [
    {
      "id": 501,
      "center_id": 1,
      "person_id": 10,
      "role_id": 2,
      "person": {
        "id": 10,
        "name": "이상담",
        "phone": "010-2222-3333"
      },
      "note": "심리상담 전문",
      "created_at": "2024-02-01T10:00:00Z"
    }
  ]
}
```

**DB 쿼리** (항상 Person JOIN):
```sql
SELECT
  cm.id, cm.center_id, cm.person_id, cm.role_id, cm.note, cm.created_at,
  p.id, p.name, p.phone, p.birth, p.gender
FROM center_members cm
JOIN persons p ON cm.person_id = p.id
WHERE cm.center_id = 1
  AND cm.deleted_at IS NULL
  AND p.deleted_at IS NULL
ORDER BY cm.created_at DESC;
```

### 적용된 비즈니스 룰

1. **CenterMember Person 중심**: name, phone 필드 없음 (Person 참조)
2. **항상 JOIN 조회**: CenterMember 조회 시 항상 Person JOIN
3. **실시간 동기화**: Person 수정 시 모든 CenterMember에 자동 반영
4. **본인만 Person 수정**: CenterMember는 Person 수정 불가, 본인(Account 소유자)만 가능

---

## 시나리오 11: CenterMember vs Client 정보 수정 규칙

**상황**: CenterMember와 Client의 정보 수정 권한이 다릅니다.

### Case A: CenterMember 정보 수정 (불가능)

**시도**: 센터 관리자가 CenterMember의 이름/전화번호 수정 시도

```http
PATCH /centers/1/members/501
Authorization: Bearer eyJhbGc...  (센터 관리자)
Content-Type: application/json

{
  "name": "이상담사",
  "phone": "010-9999-0000"
}
```

**응답**:
```http
HTTP/1.1 400 Bad Request

{
  "detail": "CenterMember 정보는 수정할 수 없습니다. Person 본인(Account 소유자)만 수정 가능합니다."
}
```

**해결책**: Person 본인이 수정해야 함

```http
PATCH /accounts/me
Authorization: Bearer eyJhbGc...  (person_id=10의 Account 토큰)
Content-Type: application/json

{
  "person": {
    "name": "이상담사",
    "phone": "010-9999-0000"
  }
}
```

**결과**: 모든 CenterMember 레코드에 자동 반영 (JOIN 기반)

### Case B: Client 정보 수정 (가능)

**시도**: 센터 관리자가 Client의 이름/전화번호 수정

```http
PATCH /centers/1/clients/301
Authorization: Bearer eyJhbGc...  (센터 관리자)
Content-Type: application/json

{
  "name": "박지민(아동)",
  "contact_phone": "010-5555-7777"
}
```

**응답**:
```http
HTTP/1.1 200 OK

{
  "id": 301,
  "center_id": 1,
  "person_id": null,
  "name": "박지민(아동)",
  "contact_phone": "010-5555-7777",
  "birth": "2010-03-20",
  "status": "active",
  "updated_at": "2024-02-05T14:00:00Z"
}
```

**DB 변경**:
```sql
UPDATE clients
SET
  name = '박지민(아동)',
  contact_phone = '010-5555-7777',
  updated_at = NOW()
WHERE id = 301 AND center_id = 1;
```

### 적용된 비즈니스 룰

1. **CenterMember**: Person 중심 → 본인(Account 소유자)만 수정 가능
2. **Client**: 독립적 → 센터 관리자가 수정 가능
3. **권한 차이**: CenterMember는 센터 직원(본인), Client는 센터가 관리하는 내담자

---

## 시나리오 12: Client-Person 정보 독립성 검증

**상황**: Client와 Person이 연결되어 있지만, 정보는 완전히 독립적입니다.

### 초기 상태

```sql
-- Person (본인 정보)
SELECT * FROM persons WHERE id = 5;
-- name='김지민', phone='010-7777-8888', birth='1995-08-10'

-- Client (센터 관리 정보, Person 연결됨)
SELECT * FROM clients WHERE id = 301;
-- person_id=5, name='박지민', contact_phone='010-5555-6666', birth='2010-03-20'
```

### Step 1: Person 본인이 자신의 정보 수정

```http
PATCH /accounts/me
Authorization: Bearer eyJhbGc...  (person_id=5의 Account)
Content-Type: application/json

{
  "person": {
    "phone": "010-9999-1111"
  }
}
```

**DB 변경**:
```sql
UPDATE persons
SET phone = '010-9999-1111', updated_at = NOW()
WHERE id = 5;
```

### Step 2: Client 조회 (Person 변경 후)

```http
GET /centers/1/clients/301
Authorization: Bearer eyJhbGc...  (센터 관리자)
```

**응답**:
```http
HTTP/1.1 200 OK

{
  "id": 301,
  "center_id": 1,
  "person_id": 5,
  "name": "박지민",
  "contact_phone": "010-5555-6666",
  "birth": "2010-03-20",
  "person": {
    "id": 5,
    "name": "김지민",
    "phone": "010-9999-1111"
  }
}
```

### 결과 분석

| 항목 | Client (센터 관리) | Person (본인 관리) | 독립 여부 |
|------|-------------------|-------------------|----------|
| 이름 | `박지민` | `김지민` | ✅ 독립 |
| 전화번호 | `010-5555-6666` | `010-9999-1111` | ✅ 독립 |
| 생년월일 | `2010-03-20` | `1995-08-10` | ✅ 독립 |

### 적용된 비즈니스 룰

1. **정보 독립성**: Client.name ≠ Person.name 가능 (별칭, 아동명 등)
2. **연결 목적**: person_id는 인증/식별 용도 (ClientLinkRequest)
3. **수정 권한**: Client는 센터, Person은 본인
4. **실제 사용 케이스**:
   - Client: 센터가 관리하는 내담자 정보 (상담 기록용)
   - Person: 본인의 계정 정보 (로그인, 인증용)

---

## 시나리오 13: Person 정보 변경 시 CenterMember 실시간 동기화

**상황**: Person이 정보를 수정하면, 모든 센터의 CenterMember에 즉시 반영됩니다.

### 초기 상태

```sql
-- Person
SELECT * FROM persons WHERE id = 10;
-- name='이상담', phone='010-2222-3333'

-- CenterMember (A센터, B센터)
SELECT * FROM center_members WHERE person_id = 10;
-- (id=501, center_id=1, person_id=10)  -- A센터
-- (id=502, center_id=2, person_id=10)  -- B센터
```

### Step 1: Person 본인이 정보 수정

```http
PATCH /accounts/me
Authorization: Bearer eyJhbGc...  (person_id=10)
Content-Type: application/json

{
  "person": {
    "name": "이영상",
    "phone": "010-8888-9999"
  }
}
```

**DB 변경** (단일 레코드 수정):
```sql
UPDATE persons
SET name = '이영상', phone = '010-8888-9999', updated_at = NOW()
WHERE id = 10;
```

### Step 2: A센터에서 CenterMember 조회

```http
GET /centers/1/members
Authorization: Bearer eyJhbGc...  (A센터 관리자)
```

**응답** (자동 반영):
```json
{
  "items": [
    {
      "id": 501,
      "person": {
        "id": 10,
        "name": "이영상",
        "phone": "010-8888-9999"
      }
    }
  ]
}
```

### Step 3: B센터에서 CenterMember 조회

```http
GET /centers/2/members
Authorization: Bearer eyJhbGc...  (B센터 관리자)
```

**응답** (자동 반영):
```json
{
  "items": [
    {
      "id": 502,
      "person": {
        "id": 10,
        "name": "이영상",
        "phone": "010-8888-9999"
      }
    }
  ]
}
```

### 적용된 비즈니스 룰

1. **단일 Person 레코드**: person_id=10은 DB에 1개만 존재
2. **JOIN 기반 실시간 동기화**: 별도 동기화 로직 불필요
3. **즉시 반영**: 모든 센터에서 즉시 최신 정보 확인 가능
4. **데이터 일관성**: Person 정보 중복 저장 없음

---

## 시나리오 14: 에러 케이스 - 잘못된 형식

### Case 1: 잘못된 전화번호 형식

```http
PATCH /accounts/me
Content-Type: application/json

{
  "person": {
    "phone": "1234567890"  // 하이픈 없음
  }
}
```

**응답**:
```http
HTTP/1.1 422 Unprocessable Entity

{
  "detail": [
    {
      "loc": ["body", "person", "phone"],
      "msg": "올바른 전화번호 형식이 아닙니다 (예: 010-1234-5678)",
      "type": "value_error"
    }
  ]
}
```

### Case 2: 미래 생년월일

```http
POST /auth/signup
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Pass123!",
  "person": {
    "name": "테스트",
    "birth": "2030-01-01"  // 미래 날짜
  }
}
```

**응답**:
```http
HTTP/1.1 400 Bad Request

{
  "detail": "생년월일은 오늘 이전이어야 합니다"
}
```

### Case 3: 잘못된 성별 값

```http
PATCH /accounts/me
Content-Type: application/json

{
  "person": {
    "gender": "unknown"  // 허용되지 않는 값
  }
}
```

**응답**:
```http
HTTP/1.1 422 Unprocessable Entity

{
  "detail": [
    {
      "loc": ["body", "person", "gender"],
      "msg": "성별은 male, female, other 중 하나여야 합니다",
      "type": "value_error"
    }
  ]
}
```

### Case 4: 이름 누락

```http
POST /auth/signup
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Pass123!",
  "person": {
    "phone": "010-1234-5678"
    // name 누락
  }
}
```

**응답**:
```http
HTTP/1.1 422 Unprocessable Entity

{
  "detail": [
    {
      "loc": ["body", "person", "name"],
      "msg": "이름은 필수입니다",
      "type": "value_error"
    }
  ]
}
```

---

## 요약

### Person 생명주기

```
1. Account 생성 → Person 생성 (1:1 연결)
2. Person 정보 수정 → 본인만 가능 (PATCH /accounts/me)
3. CenterMember/Client 등록 → Person 재사용 (멀티센터 지원)
4. Account 탈퇴 → Person Soft Delete (CenterMember/Client는 보존)
```

### 핵심 원칙

1. **Person은 Account의 서브 리소스**: 독립적 API 없음
2. **1:N 재사용**: 한 Person → 여러 CenterMember/Client (멀티센터)
3. **본인만 수정**: Person 정보는 Account 소유자만 수정 가능
4. **마스킹 지원**: Account.privacy_mask_enabled 설정 기반
5. **Soft Delete**: 삭제 시 deleted_at 기록, 복구 가능
6. **최소 필수 정보**: name만 필수, 나머지 선택 (privacy by design)

### CenterMember vs Client 정보 관리 전략

| 엔티티 | 정보 관리 방식 | 수정 권한 | Person 연결 | 필드 구조 |
|--------|---------------|----------|-------------|----------|
| **CenterMember** | Person 중심 | 본인(Account 소유자)만 | 필수 (NOT NULL) | name, phone 필드 없음 → Person JOIN |
| **Client** | 독립적 | 센터 관리자 | 선택적 (nullable) | name, contact_phone, birth 자체 필드 |

**이유**:
- **CenterMember**: 센터 직원(본인)이므로 생성 즉시 Person 연결, 정보 수정은 본인만
- **Client**: 센터가 관리하는 내담자이므로 독립적 정보 필요, Person 연결은 인증/식별 용도

### Client 정보 독립성

```python
# Client 정보 (센터 관리)
client.name = "박지민"  # 센터가 기록한 이름
client.contact_phone = "010-5555-6666"  # 센터가 관리하는 연락처

# Person 정보 (본인 관리, person_id 연결 시)
person.name = "김지민"  # 본인의 실명
person.phone = "010-7777-8888"  # 본인의 연락처

# Client.name ≠ Person.name 가능 (별칭, 아동명, 센터 관리 목적)
```

### API 엔드포인트 요약

| HTTP Method | Endpoint | 설명 | Person 작업 |
|-------------|----------|------|------------|
| POST | `/auth/signup` | 회원가입 | Person 생성 |
| GET | `/accounts/me` | 본인 정보 조회 | Person 포함 반환 |
| PATCH | `/accounts/me` | 본인 정보 수정 | Person 수정 |
| DELETE | `/accounts/me` | 회원 탈퇴 | Person Soft Delete |
| GET | `/centers/{id}/members` | CenterMember 목록 | Person JOIN 조회 |
| POST | `/centers/{id}/members` | CenterMember 생성 | Person 연결 (필수) |
| GET | `/centers/{id}/clients` | Client 목록 | Client 독립 정보 + Person 마스킹 |
| POST | `/centers/{id}/clients` | Client 생성 | Client 자체 정보 (name, contact_phone 필수) |
| PATCH | `/centers/{id}/clients/{id}` | Client 수정 | Client 정보만 수정 (Person 불변) |
| POST | `/centers/{id}/client-link-requests` | 연결 요청 | Person 연결 준비 |
| POST | `/client-link-requests/{id}/approve` | 연결 승인 | Person → Client 연결 |

### 시나리오 매트릭스

| 시나리오 | 주요 엔티티 | 핵심 개념 | 참고 |
|---------|----------|----------|------|
| 1. 회원가입 시 Person 생성 | Account, Person | 1:1 연결 | 기본 |
| 2. Person 정보 조회 (본인) | Account, Person | 마스킹 없음 | 기본 |
| 3. Person 정보 수정 | Person | 본인만 수정 가능 | 기본 |
| 4. 마스킹 적용된 Person 조회 | Client, Person, Account | 마스킹 적용 | 프라이버시 |
| 5. 멀티센터 Person 사용 | Client, Person | 1:N 재사용 | 기본 |
| 6. ClientLinkRequest 승인 | ClientLinkRequest, Client, Person | 승인 플로우 | 기본 |
| 7. Account 탈퇴 시 Soft Delete | Account, Person, Client | Soft Delete | GDPR |
| 8. Client 생성 (독립 정보) | Client | Client 자체 정보 | 독립성 |
| 9. Person 변경 시 멀티센터 동기화 | Client, Person | JOIN 기반 동기화 | 기본 |
| 10. CenterMember 생성 및 조회 | CenterMember, Person | Person JOIN 기반 | Person 중심 |
| 11. CenterMember vs Client 수정 | CenterMember, Client, Person | 권한 차이 | 정보 관리 전략 |
| 12. Client-Person 독립성 검증 | Client, Person | 정보 독립성 | 독립성 |
| 13. CenterMember 실시간 동기화 | CenterMember, Person | 자동 동기화 | Person 중심 |
| 14. 에러 케이스 | 모든 엔티티 | 검증 규칙 | 에러 처리 |
