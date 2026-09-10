# Role 사용 시나리오

---

## 시나리오 1: 센터 최초 설정

### 상황
새 센터 가입 후 첫 관리자 설정

### 흐름
```
1. 센터 생성 (Center 생성)
2. 첫 관리자 초대 (Invitation 생성)
3. 관리자 가입 (Account 생성)
4. Member 생성
   - role_id = 2 (center_admin)
   - Role 권한 조회 → permissions 배열 복사
   - permissions = ["client:read", "client:write", ..., "center:admin"]
5. 센터 관리자 로그인
```

### 결과
- 센터 관리자가 센터 내 모든 기능 접근 가능

---

## 시나리오 2: 상담사 초대

### 상황
센터 관리자가 상담사를 초대

### 흐름
```
1. 센터 관리자: 상담사 초대
   - POST /centers/{center_id}/invitations
   - role_id = 3 (counselor)

2. 상담사 가입
   - Account 생성
   - Invitation 수락

3. Member 생성
   - role_id = 3
   - Role 권한 조회
   - permissions = [
       "client:read", "client:write",
       "counseling:read", "counseling:write",
       "assessment:read", "assessment:write",
       "schedule:read", "schedule:write"
     ]

4. 상담사 로그인
   - 내담자 관리, 상담/검사 수행 가능
   - 결제/센터 관리 불가
```

---

## 시나리오 3: Member 권한 커스터마이징

### 상황
특정 상담사에게 결제 권한 추가

### 흐름
```
1. 센터 관리자: Member 권한 조회
   GET /centers/{center_id}/members/{member_id}
   - permissions = ["client:read", "counseling:write", ...]

2. 권한 추가
   PATCH /centers/{center_id}/members/{member_id}/permissions
   - permissions = [
       "client:read", "counseling:write",
       "billing:read", "billing:write"  # 추가
     ]

3. 상담사 재로그인
   - 결제 관리 화면 접근 가능
```

---

## 시나리오 4: 신규 권한 배포

### 상황
코드 배포로 새 권한 `client:export` 추가

### 흐름
```
1. 코드 배포 (새 권한 정의 추가)
   DEFAULT_PERMISSIONS = [
       ...,
       {"code": "client:export", "name": "내담자 데이터 내보내기", "category": "client"}
   ]

2. 플랫폼 관리자: 권한 동기화
   POST /permissions/sync
   - DB에 `client:export` 추가 (is_new=true)

3. 플랫폼 관리자: 역할 권한 업데이트
   PUT /roles/2/permissions  # center_admin
   - permission_ids에 client:export 추가

4. 센터 관리자에게 알림
   "새 권한이 추가되었습니다: client:export"

5. 센터 관리자: Member 권한 동기화 (선택)
   POST /centers/{center_id}/members/{member_id}/sync-role-permissions
   - Role 권한으로 덮어쓰기
```

---

## 시나리오 5: 역할 변경

### 상황
실습생이 정식 상담사가 됨

### 흐름
```
1. 센터 관리자: Member 역할 변경
   PATCH /centers/{center_id}/members/{member_id}
   - role_id = 4 (intern) → 3 (counselor)

2. 자동으로 권한 배열 업데이트
   - Role 권한 조회
   - permissions 배열 덮어쓰기
   - permissions = ["client:read", "counseling:write", ...]

3. 사용자 재로그인
   - 상담/검사 생성/수정 가능
```

---

## 시나리오 6: 임시 권한 부여

### 상황
실습생에게 일시적으로 상담 작성 권한 부여

### 흐름
```
1. 센터 관리자: Member 권한 조회
   - role_id = 4 (intern)
   - permissions = ["client:read", "counseling:read", ...]  # 읽기만

2. 권한 추가
   PATCH /centers/{center_id}/members/{member_id}/permissions
   - permissions = [
       "client:read",
       "counseling:read",
       "counseling:write"  # 추가 (임시)
     ]

3. 실습생: 상담 일지 작성 가능

4. 나중에 권한 제거
   PATCH /centers/{center_id}/members/{member_id}/permissions
   - permissions = ["client:read", "counseling:read"]  # 원복
```

---

## 시나리오 7: 플랫폼 관리자의 센터 접근

### 상황
플랫폼 관리자가 특정 센터의 이슈 해결

### 흐름
```
1. 플랫폼 관리자 로그인
   - role_id = 1 (platform_admin)
   - Member 없음 (특수 처리)

2. 센터 선택
   GET /centers/{center_id}/clients
   - require_permission("client:read") 체크
   - platform_admin 예외 처리 → 통과

3. 센터 데이터 접근
   - 모든 센터의 모든 리소스 접근 가능
   - Audit Log 기록
```

---

## 시나리오 8: 권한 부족 시 접근 제어

### 상황
실습생이 내담자 삭제 시도

### 흐름
```
1. 실습생 로그인
   - permissions = ["client:read", "counseling:read", ...]

2. 내담자 삭제 시도
   DELETE /centers/{center_id}/clients/{client_id}
   - require_permission("client:delete") 체크
   - "client:delete" not in member.permissions
   - 403 Forbidden

3. 프론트엔드
   - 권한 없음 → 삭제 버튼 비활성화 (UI)
```

---

## 시나리오 9: Role 권한 일괄 변경

### 상황
플랫폼 관리자가 `counselor` 역할 권한 조정

### 흐름
```
1. 플랫폼 관리자: 역할 권한 조회
   GET /roles/3/permissions  # counselor
   - permissions = [client:*, counseling:*, assessment:*, ...]

2. 권한 업데이트
   PUT /roles/3/permissions
   - permission_ids = [1, 2, 10, 11, ...]  # assessment:write 제거

3. 기존 Member 영향
   - Member의 permissions 배열은 변경되지 않음
   - assessment:write 권한 그대로 유지

4. 신규 Member 생성
   - Role 권한 조회 (assessment:write 없음)
   - permissions 배열 복사
   - assessment:write 권한 없음
```

---

## 시나리오 10: 센터 관리자의 권한 동기화

### 상황
센터 관리자가 팀원 권한을 Role 기본 권한으로 초기화

### 흐름
```
1. 센터 관리자: Member 권한 동기화 요청
   POST /centers/{center_id}/members/{member_id}/sync-role-permissions

2. 서버 처리
   - Member의 role_id 조회 (예: counselor)
   - Role 권한 조회
   - Member의 permissions 배열 덮어쓰기

3. 결과
   - 개별 커스터마이징 권한 제거
   - Role 기본 권한으로 초기화
```
