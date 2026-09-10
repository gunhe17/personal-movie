# 계정 관리 페이지 기획

> 플랫폼 관리자용 사용자 계정 조회 및 관리 화면 기획

---

## 목차

1. [도메인 개요](#도메인-개요)
2. [데이터 모델](#데이터-모델)
3. [페이지 구조 요약](#페이지-구조-요약)
4. [계정 목록](#계정-목록)
5. [계정 상세 모달](#계정-상세-모달)
6. [계정 액션](#계정-액션)
7. [API 엔드포인트](#api-엔드포인트)
8. [상태별 UI 동작 정리](#상태별-ui-동작-정리)

---

## 도메인 개요

### 범위

플랫폼에 가입한 **모든 사용자 계정**(Account + Person)을 관리한다.
운영 목적에 필요한 메타정보만 노출하며, 센터 내부 활동(상담/검사 결과 등)은 접근하지 않는다.

### 핵심 엔티티 관계

```
Account (인증 주체)
  │
  │ 1:1 (account_id)
  │
Person (인적 정보)
  │
  │ 1:N (person_id)
  │
Member (센터 소속)
  │
  ├── center_id → Center
  └── role_id → Role
```

### 관리 범위

| 접근 가능 (운영 필수) | 접근 불가 (미노출) |
|---|---|
| 이메일, 가입 방식, 계정 상태 | 상담 노트, 검사 결과 |
| 로그인 이력 (최근 로그인일) | 내담자 개인정보 |
| 소속 센터 목록 (센터명, 역할) | 센터 내부 활동 내역 |
| 계정 잠금/해제, 강제 로그아웃 | 비밀번호, 토큰 정보 |

---

## 데이터 모델

### Account (accounts 테이블)

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | UUID | PK |
| `email` | String(255) | 로그인 ID (UNIQUE) |
| `password` | String(255) | bcrypt 해시 |
| `is_active` | Boolean | 활성 상태 (false = 잠금) |
| `is_verified` | Boolean | 이메일 인증 여부 |
| `provider` | String(20) | 가입 방식: email, kakao, naver, google |
| `provider_id` | String(255) | 소셜 로그인 ID |
| `token_version` | Integer | JWT 무효화용 (증가 시 전 세션 만료) |
| `last_login_at` | DateTime | 최종 로그인 |
| `platform_role` | String(30) | 플랫폼 역할 (미구현, 추후 추가) |
| `created_at` | DateTime | 가입일 |

### Person (persons 테이블)

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | UUID | PK |
| `account_id` | UUID | Account FK (1:1) |
| `name` | String(100) | 이름 |
| `phone` | String(20) | 연락처 |
| `birth` | Date | 생년월일 |
| `gender` | String(10) | 성별 |

### Member (members 테이블)

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | UUID | PK |
| `center_id` | UUID | 소속 센터 |
| `person_id` | UUID | Person FK |
| `role_id` | UUID | 역할 FK |
| `employment_type` | String | 고용 형태 |
| `status` | String | active / inactive |

---

## 페이지 구조 요약

```
/accounts                    # 계정 목록
/accounts → 행 클릭 → 모달    # 계정 상세 모달
```

> 계정 상세는 별도 페이지가 아닌 **모달**로 처리 (센터 신청과 동일 패턴)

---

## 계정 목록

### 화면 구성

```
┌────────────────────────────────────────────────────────────┐
│  계정 관리                                    총 3,500개     │
├────────────────────────────────────────────────────────────┤
│  [🔍 이메일 / 이름 검색___]  [전체 상태▼]  [전체 가입방식▼]  [↻]│
├────────────────────────────────────────────────────────────┤
│  이메일           │ 이름   │ 가입방식 │ 소속 센터    │ 상태 │ 로그인 │
│──────────────────────────────────────────────────────────── │
│  hong@example.com │ 홍길동 │ 이메일   │ 마음건강센터  │ 활성 │ 03.01 │
│  kim@example.com  │ 김철수 │ 카카오   │ 행복상담센터  │ 잠금 │ 02.28 │
│  lee@kakao.com    │ 이영희 │ 네이버   │ -           │ 활성 │ 03.04 │
│  ...              │        │         │             │      │       │
├────────────────────────────────────────────────────────────┤
│                    < 1  2  3  4  5 >                       │
└────────────────────────────────────────────────────────────┘
```

### 필터 바

| 항목 | 설명 |
|---|---|
| **검색** | 이메일 또는 이름 검색 (디바운스 300ms) |
| **상태 필터** | 전체 / 활성(active) / 잠금(inactive) — Select 컴포넌트 |
| **가입 방식 필터** | 전체 / 이메일 / 카카오 / 네이버 / 구글 — Select 컴포넌트 |
| **초기화 버튼** | RefreshIcon — 모든 필터 초기화 |
| **기본 상태** | 전체 상태, 전체 가입방식, 검색 비워짐 |

### 테이블 컬럼

| 컬럼 | 필드 | 너비 | 비고 |
|---|---|---|---|
| 이메일 | `email` | 1.2fr | |
| 이름 | `name` | 100px | Person JOIN — 없으면 `-` |
| 가입 방식 | `provider` | 100px | 뱃지: 이메일(회색), 카카오(노랑), 네이버(초록), 구글(파랑) |
| 소속 센터 | `centers` | 1fr | 센터명 뱃지 (최대 2개 + "+N") |
| 상태 | `is_active` | 100px | 뱃지: 활성(초록), 잠금(빨강) |
| 최근 로그인 | `last_login_at` | 120px | YYYY.MM.DD 포맷, null이면 `-` |

### 행 클릭

행 클릭 시 계정 상세 모달 오픈 — `accountId`를 전달하여 모달 내부에서 상세 API 호출

---

## 계정 상세 모달

### 화면 구성

```
┌──────────────────────────────────────────────────┐
│  계정 상세                                    [X] │
├──────────────────────────────────────────────────┤
│                                                  │
│  이메일          │  상태                          │
│  hong@email.com  │  ● 활성                       │
│                  │                               │
│  이름            │  연락처                        │
│  홍길동          │  010-1234-5678                 │
│                  │                               │
│  가입 방식       │  가입일                        │
│  이메일          │  2026.01.15                    │
│                  │                               │
│  최근 로그인     │  이메일 인증                    │
│  2026.03.01      │  인증됨                        │
│                                                  │
│  ─── 소속 센터 ──────────────────────────────── │
│                                                  │
│  센터명         │ 역할       │ 상태              │
│  ────────────────────────────────────────────── │
│  마음건강센터    │ 센터 관리자 │ 활성              │
│  행복상담센터    │ 상담사     │ 활성              │
│                                                  │
├──────────────────────────────────────────────────┤
│            [강제 로그아웃]  [잠금]  or  [해제]     │
└──────────────────────────────────────────────────┘
```

### 기본 정보 그리드 (2열)

| 라벨 | 필드 | 비고 |
|---|---|---|
| 이메일 | `email` | |
| 상태 | `is_active` | 뱃지 표시 |
| 이름 | `name` | Person JOIN — 없으면 `-` |
| 연락처 | `phone` | Person JOIN — 없으면 `-` |
| 가입 방식 | `provider` | 뱃지 표시 |
| 가입일 | `created_at` | YYYY.MM.DD |
| 최근 로그인 | `last_login_at` | YYYY.MM.DD — null이면 `-` |
| 이메일 인증 | `is_verified` | 인증됨(초록) / 미인증(회색) |

### 소속 센터 테이블

| 컬럼 | 필드 | 비고 |
|---|---|---|
| 센터명 | `center_name` | |
| 역할 | `role_name` | |
| 상태 | `status` | active/inactive |

> 소속 센터가 없으면 "소속된 센터가 없습니다" NoData 표시

### 푸터 버튼

| 상태 | 표시 버튼 |
|---|---|
| `is_active = true` | [강제 로그아웃] (secondary) + [잠금] (delete) |
| `is_active = false` | [해제] (primary) |

---

## 계정 액션

### 계정 잠금

| 항목 | 설명 |
|---|---|
| **용도** | 보안 위반, 비정상 활동 등으로 계정 차단 |
| **동작** | `Account.is_active → false` + `token_version` 증가 (즉시 로그아웃) |
| **API** | `POST /admin/accounts/{id}/lock` |
| **Body** | `{ reason: string }` (필수) |
| **확인** | "계정을 잠금하시겠습니까?" 확인 모달 + 잠금 사유 입력 |
| **결과** | 토스트 "계정이 잠금되었습니다" + 목록 리프레시 + 모달 닫기 |

### 잠금 확인 모달

```
┌──────────────────────────────────────┐
│  계정 잠금                            │
│                                      │
│  "hong@example.com" 계정을            │
│  잠금하시겠습니까?                     │
│                                      │
│  잠금 사유 (필수):                     │
│  ┌──────────────────────────────┐    │
│  │                              │    │
│  └──────────────────────────────┘    │
│                                      │
│  ⚠ 잠금 시 해당 계정의 모든 세션이     │
│  즉시 만료되며, 로그인이 차단됩니다.    │
│                                      │
│              [취소]  [잠금]            │
└──────────────────────────────────────┘
```

### 계정 잠금 해제

| 항목 | 설명 |
|---|---|
| **용도** | 잠금된 계정 복구 |
| **동작** | `Account.is_active → true` |
| **API** | `POST /admin/accounts/{id}/unlock` |
| **확인** | "계정 잠금을 해제하시겠습니까?" 확인 모달 |
| **결과** | 토스트 "계정 잠금이 해제되었습니다" + 목록 리프레시 + 모달 닫기 |

### 강제 로그아웃

| 항목 | 설명 |
|---|---|
| **용도** | 세션 탈취 의심, 비밀번호 변경 후 세션 정리 등 |
| **동작** | `token_version` 증가 (기존 모든 세션 무효화, 재로그인 가능) |
| **API** | `POST /admin/accounts/{id}/force-logout` |
| **확인** | "강제 로그아웃하시겠습니까?" 확인 모달 |
| **결과** | 토스트 "강제 로그아웃되었습니다" |

> 잠금과 달리 로그인 자체는 가능. 현재 세션만 끊는 용도.

---

## API 엔드포인트

### 목록 조회

| 항목 | 값 |
|---|---|
| **메서드** | `GET /api/v1/admin/accounts` |
| **인가** | `get_verified_platform_admin` |

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `search` | query | 이메일 또는 이름 검색 |
| `is_active` | query | `true` / `false` |
| `provider` | query | `email` / `kakao` / `naver` / `google` |
| `page` | query | 페이지 번호 (default: 1) |
| `size` | query | 페이지 크기 (default: 20) |

**Response:**

```json
{
  "items": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "name": "홍길동",
      "phone": "010-1234-5678",
      "provider": "email",
      "is_active": true,
      "is_verified": true,
      "last_login_at": "2026-02-27T09:00:00",
      "created_at": "2026-01-01T00:00:00",
      "centers": [
        {
          "center_id": "uuid",
          "center_name": "마음샘 상담센터",
          "role_name": "상담사"
        }
      ]
    }
  ],
  "total": 3500,
  "page": 1,
  "size": 20,
  "pages": 175
}
```

**쿼리 구조:**

```
Account
  LEFT JOIN Person ON Person.account_id = Account.id
  LEFT JOIN Member ON Member.person_id = Person.id AND Member.status = 'active'
  LEFT JOIN Center ON Center.id = Member.center_id
  LEFT JOIN Role ON Role.id = Member.role_id
```

- 검색: `Account.email ILIKE` 또는 `Person.name ILIKE`
- 정렬: `Account.created_at DESC`
- `centers`는 서브쿼리 또는 어플리케이션 레벨에서 그룹핑

### 상세 조회

| 항목 | 값 |
|---|---|
| **메서드** | `GET /api/v1/admin/accounts/{account_id}` |
| **인가** | `get_verified_platform_admin` |

**Response:**

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "홍길동",
  "phone": "010-1234-5678",
  "provider": "email",
  "is_active": true,
  "is_verified": true,
  "last_login_at": "2026-02-27T09:00:00",
  "created_at": "2026-01-01T00:00:00",
  "centers": [
    {
      "center_id": "uuid",
      "center_name": "마음샘 상담센터",
      "role_name": "상담사",
      "status": "active"
    }
  ]
}
```

### 계정 잠금

| 항목 | 값 |
|---|---|
| **메서드** | `POST /api/v1/admin/accounts/{account_id}/lock` |
| **인가** | `get_verified_platform_admin` |

**Request:**

```json
{
  "reason": "보안 위반 의심"
}
```

**동작:**
1. `Account.is_active → false`
2. `Account.token_version += 1` (즉시 전 세션 무효화)
3. 감사 로그 기록

### 계정 잠금 해제

| 항목 | 값 |
|---|---|
| **메서드** | `POST /api/v1/admin/accounts/{account_id}/unlock` |
| **인가** | `get_verified_platform_admin` |

**동작:**
1. `Account.is_active → true`
2. 감사 로그 기록

### 강제 로그아웃

| 항목 | 값 |
|---|---|
| **메서드** | `POST /api/v1/admin/accounts/{account_id}/force-logout` |
| **인가** | `get_verified_platform_admin` |

**동작:**
1. `Account.token_version += 1` (기존 모든 세션 무효화)
2. `is_active`는 변경하지 않음 (재로그인 가능)
3. 감사 로그 기록

---

## 상태별 UI 동작 정리

### 계정 상태

| 상태 | 뱃지 | 목록 액션 | 모달 액션 |
|---|---|---|---|
| 활성 (`is_active=true`) | 초록 `● 활성` | - | [강제 로그아웃] + [잠금] |
| 잠금 (`is_active=false`) | 빨강 `● 잠금` | - | [해제] |

### 가입 방식 뱃지

| Provider | 라벨 | 색상 |
|---|---|---|
| `email` | 이메일 | 회색 (`bg-gray-100 text-gray-600`) |
| `kakao` | 카카오 | 노랑 (`bg-yellow-50 text-yellow-700`) |
| `naver` | 네이버 | 초록 (`bg-green-50 text-green-700`) |
| `google` | 구글 | 파랑 (`bg-blue-50 text-blue-700`) |

### 이메일 인증 상태

| 상태 | 표시 |
|---|---|
| `is_verified = true` | 인증됨 (초록 뱃지) |
| `is_verified = false` | 미인증 (회색 뱃지) |

---

## 구현 체크리스트

### 백엔드 (apps/api/app/modules/admin/account/)

- [ ] `schemas.py` — AdminAccountSummary, AdminAccountDetailResponse, AdminAccountListResponse
- [ ] `handlers/list_accounts.py` — Account + Person + Member + Center + Role JOIN 쿼리
- [ ] `handlers/get_account.py` — 계정 상세 (소속 센터 목록 포함)
- [ ] `handlers/lock_account.py` — is_active=false + token_version 증가
- [ ] `handlers/unlock_account.py` — is_active=true
- [ ] `handlers/force_logout.py` — token_version 증가
- [ ] `router.py` — 라우터 등록
- [ ] `admin/router.py` — `/accounts` prefix로 등록

### 프론트엔드 (apps/admin)

- [ ] 필터 바 업데이트 — Select 컴포넌트, SearchIcon, RefreshIcon (센터/신청 페이지와 동일 패턴)
- [ ] 행 클릭 → 계정 상세 모달 (ApplicationDetailModal 패턴)
- [ ] AccountDetailModal — queryBuilder로 상세 조회, 소속 센터 테이블
- [ ] 잠금/해제/강제 로그아웃 — mutationBuilder + 확인 모달 + 토스트
- [ ] action 타입 보강 — `name`, `phone` 필드 추가 (Person JOIN 결과)

---

## 사용되는 API 목록

| 용도 | 메서드 | 엔드포인트 |
|---|---|---|
| 계정 목록 조회 | GET | `/admin/accounts` |
| 계정 상세 조회 | GET | `/admin/accounts/{account_id}` |
| 계정 잠금 | POST | `/admin/accounts/{account_id}/lock` |
| 계정 잠금 해제 | POST | `/admin/accounts/{account_id}/unlock` |
| 강제 로그아웃 | POST | `/admin/accounts/{account_id}/force-logout` |
