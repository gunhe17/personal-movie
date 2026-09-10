# Role 엣지 케이스

---

## Permission 관련

### 신규 권한 추가 시 기존 Member 영향

**시나리오**:
코드 배포로 새 권한 `client:export` 추가

**동작**:
1. `/permissions/sync` API 호출
2. DB에 `client:export` 생성 (`is_new=true`)
3. 기존 Member의 `permissions` 배열은 변경되지 않음
4. 센터 관리자에게 알림 ("새 권한 추가됨")

**해결**:
센터 관리자가 수동으로 Member 권한 업데이트 필요

---

### Permission 삭제 시

**시나리오**:
권한 `client:legacy` 삭제

**문제**:
- 기존 Member의 `permissions`에 `client:legacy` 남아 있음
- 접근 제어 시 유효하지 않은 권한 검사

**해결**:
1. Permission 삭제 전 영향 확인 (Member 검색)
2. 삭제 후 Member의 `permissions` 배열에서 자동 제거 (Cleanup Job)

---

### 권한 코드 변경 시

**시나리오**:
`client:read` → `client:view`로 변경

**문제**:
- Member의 `permissions` 배열에 구 코드 남음
- 접근 제어 실패

**해결**:
1. 권한 코드 변경 금지 (새 권한 추가 + 구 권한 Deprecated)
2. 마이그레이션 스크립트로 일괄 업데이트

---

## Role 관련

### Role 삭제 시도

**시나리오**:
프리셋 역할 `counselor` 삭제 시도

**동작**:
- **차단**: Role은 프리셋만 제공, 삭제 불가
- **응답**: `400 Bad Request` ("프리셋 역할은 삭제할 수 없습니다")

---

### Role 권한 변경 시 기존 Member 영향

**시나리오**:
`counselor` 역할의 권한에서 `assessment:write` 제거

**동작**:
1. RolePermission 업데이트 (플랫폼 관리자만)
2. 기존 Member의 `permissions` 배열은 변경되지 않음

**해결**:
- 센터 관리자에게 변경 알림
- 센터 관리자가 수동 동기화 수행

---

## Member 권한 관련

### Member 권한 배열이 비어있는 경우

**시나리오**:
Member의 `permissions = []`

**동작**:
- 모든 API 엔드포인트 접근 불가 (`403 Forbidden`)

**해결**:
- Member 생성 시 반드시 Role 권한 복사
- Validation: `permissions` 배열 최소 1개 이상

---

### Member 권한에 존재하지 않는 권한 코드

**시나리오**:
Member의 `permissions = ["client:read", "invalid:permission"]`

**동작**:
- `invalid:permission`은 Permission 테이블에 없음
- 접근 제어 시 무시됨 (없는 권한으로 간주)

**해결**:
- Member 권한 업데이트 시 Validation (Permission 테이블 조회)
- Cleanup Job으로 주기적 정리

---

### Member의 role_id 변경 시

**시나리오**:
Member의 역할 변경 (`counselor` → `intern`)

**문제**:
- `role_id`만 변경되면 `permissions` 배열은 기존 값 유지
- 실제 권한과 역할 불일치

**해결**:
1. **권장**: 역할 변경 시 자동으로 새 Role 권한 복사
2. **선택**: 센터 관리자가 수동 동기화

---

## 접근 제어 관련

### 센터 간 권한 혼용

**시나리오**:
사용자가 여러 센터에 소속 (Center A의 `center_admin`, Center B의 `intern`)

**문제**:
- Center A 권한으로 Center B 리소스 접근 시도

**해결**:
- `require_permission()` Dependency에서 `center_id` 검증
- Member는 `center_id`로 격리됨

---

### 플랫폼 관리자의 센터 접근

**시나리오**:
`platform_admin` 역할이 특정 센터 접근

**동작**:
- `platform_admin`은 모든 센터 접근 가능
- Member 없이 접근 가능 (특수 처리)

**해결**:
- `require_permission()` Dependency에서 `platform_admin` 예외 처리

---

## 동기화 관련

### Role 권한 변경 후 일괄 동기화

**시나리오**:
`counselor` 역할 권한 변경 → 모든 `counselor` Member 일괄 동기화

**문제**:
- 개별 커스터마이징한 Member 권한 덮어씀

**해결**:
1. **선택적 동기화**: 센터 관리자가 Member별로 선택
2. **병합 전략**: 기존 권한 + 새 Role 권한 합침 (중복 제거)

---

### 신규 권한 추가 후 자동 부여

**시나리오**:
새 권한 `client:export` 추가 → 특정 역할에 자동 부여

**문제**:
- 어느 역할에 자동 부여할지 판단 어려움

**해결**:
- 자동 부여 안 함
- 플랫폼 관리자가 RolePermission 수동 업데이트
- 센터 관리자에게 알림
