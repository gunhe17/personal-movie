# 멤버 학력·경력·자격 (Credentials) 도메인 설계

> **Status**: MVP 구현 완료 (Phase 1)
> **작성일**: 2026-05-27 · **최종 업데이트**: 2026-05-27
> **목적**: 전문가(상담사)의 학력·경력·자격을 등록하고, 플랫폼 어드민 검증을 거쳐 인증 배지로 신뢰도를 시각화하는 기능의 도메인/데이터/API 설계

---

## 0. 한 줄 요약

- credentials **원본**은 `Person`에 둔다 (사람의 정체성, 단일 테이블 `person_credentials`)
- credentials의 **센터별 공개 여부**는 `Member`에 둔다 (`credential_visibility`) — **MVP 제외**
- **검증 주체는 플랫폼 어드민** (apps/admin 전용) — 센터 관리자는 검증하지 않음
- **인증된 전문가 = 자격증 ≥1 verified AND 학력 ≥1 verified** (C안 정책)
- `Person.is_certified` **캐시 컬럼** — credential 변경 시 service 레이어 helper로 동기화 (조회 빠르게)
- **인증 배지**: 파란색 그라데이션 + Ψ(Psi) 심볼 — 심리학 도메인 + 인증 신호 (web + admin 동일 컴포넌트)
- 검증 결과 알림(승인·반려)은 **당사자에게 인앱 + push** — 당사자가 속한 모든 센터에 발송, 클릭 시 `/myInfo`
- 모달은 항목별 분리 (학력/경력/자격 각각 별도 폼)
- **모든 kind에 증빙 파일 업로드 가능** (자격증은 권장), 만료 알림은 제외 (시각 표시만)
- 첨부 URL은 조회 응답 시점에 **presigned URL로 자동 변환** (S3 path는 DB에만)
- 기존 `Member.educations/careers/certifications`(string[])는 **비파괴** — read-only 노출, 리핏 기간 후 DROP

---

## 1. 도메인 관점 분리 — 왜 Person/Member 분리인가

### 기존 구조의 문제

현재 `Member.careers / educations / certifications` (JSONB `list[str]`)는 **센터별 멤버십에 직접 종속**되어 있다. 이는 다음과 같은 문제를 가진다:

- 한 사람이 여러 센터의 멤버일 때 같은 학력을 두 번 입력해야 함
- "이 사람의 학력"은 사실이지 센터 종속 정보가 아님
- 자격증 증빙 파일 같은 첨부물이 센터별로 중복 저장됨

### 결정: Person이 원본, Member는 공개 여부만

| 정보 종류 | 귀속 | 이유 |
|----------|------|------|
| 학력/경력/자격 **원본** (사실 데이터) | `Person` | 사람의 정체성, 어디 가도 동일 |
| 자격증 **증빙 파일** | `Person` | 사실의 일부, 센터별 차별 불필요 |
| **검증 상태** (verified/pending/...) | `Person` | **플랫폼 어드민이 검증** → 센터 무관, 전역 단일 |
| 센터에서의 **공개 여부** (`is_visible`) | `Member` | 센터별로 노출 차등 가능 |

### 작동 시나리오

1. 홍길동이 A센터에 가입 → 본인 Person에 학력/경력/자격 입력
2. 홍길동이 자격증 검증 요청 → 플랫폼 어드민이 처리 → Person의 verification 갱신
3. **검증 완료 알림이 홍길동에게 인앱 + push로 전송**
4. 홍길동이 B센터에도 가입 → 학력·자격 재입력 없음, 검증 상태도 그대로 유지됨 (전역 검증)
5. B센터에서는 일부 항목만 공개로 설정 → B센터 Member에 `is_visible` 기록

---

## 2. 데이터 모델

### 2.1 `person_credentials` 테이블 (단일 통합 테이블)

학력·경력·자격을 **하나의 테이블에 `kind`로 구분**해서 저장한다.

이유:
- 세 종류 모두 "개인의 자격 증빙"이라는 동일 카테고리
- 공통 필드가 많음 (시작/종료일, organization, title 등)
- 통합 정렬·통합 검증 큐 등 운영 효율
- 미래에 종류 추가가 쉬움 (수상 이력, 출판물 등 → 새 `kind`만 추가)

#### 스키마

```sql
CREATE TABLE person_credentials (
  id                        VARCHAR(36)   PRIMARY KEY,
  person_id                 VARCHAR(36)   NOT NULL,          -- application-level FK
  kind                      VARCHAR(20)   NOT NULL,          -- 'education' | 'career' | 'certification'

  -- 공통 표시 필드
  title                     VARCHAR(200)  NOT NULL,          -- "서울대 심리학과 학사" / "선임상담사" / "임상심리사 1급"
  organization              VARCHAR(200)  NOT NULL,          -- "서울대학교" / "○○상담센터" / "한국심리학회"
  description               TEXT          NULL,              -- 부가 설명 (경력 상세 등)

  -- 기간
  start_date                DATE          NULL,              -- 학력=입학, 경력=입사, 자격=발급일
  end_date                  DATE          NULL,              -- 학력=졸업, 경력=퇴사, 자격=만료일
  is_current                BOOLEAN       NOT NULL DEFAULT FALSE,  -- 재학·재직 중 (자격증은 항상 FALSE)

  -- 종류별 추가 필드 (kind별로 의미가 다른 메타)
  metadata                  JSONB         NULL,

  -- 증빙 파일 (자격증 주로 사용, 다른 kind도 첨부 가능)
  attachment_url            VARCHAR(500)  NULL,
  attachment_filename       VARCHAR(255)  NULL,
  attachment_content_type   VARCHAR(100)  NULL,
  attachment_size           INTEGER       NULL,

  -- 검증 상태 (플랫폼 어드민이 처리)
  verification_status       VARCHAR(20)   NOT NULL DEFAULT 'unverified',
                                          -- 'unverified' | 'pending' | 'verified' | 'rejected'
  verification_requested_at TIMESTAMP     NULL,
  verification_reviewed_at  TIMESTAMP     NULL,
  verification_reviewed_by  VARCHAR(36)   NULL,             -- 플랫폼 어드민 account_id
  verification_reject_reason TEXT         NULL,

  -- 공통
  created_at                TIMESTAMP     NOT NULL,
  updated_at                TIMESTAMP     NOT NULL,
  deleted_at                TIMESTAMP     NULL
);

CREATE INDEX ix_person_credentials_person_id      ON person_credentials(person_id);
CREATE INDEX ix_person_credentials_kind           ON person_credentials(kind);
CREATE INDEX ix_person_credentials_verification   ON person_credentials(verification_status);
```

#### `metadata` JSONB 구조 (kind별)

```jsonc
// kind = 'education'
{
  "major": "심리학과",
  "degree": "bachelor"   // bachelor | master | doctorate | other
}

// kind = 'career'
{
  "position": "선임상담사"
}

// kind = 'certification'
{
  "certificate_number": "제2020-12345호"
}
```

#### 필드 매핑 (kind별 의미)

| 컬럼 | education | career | certification |
|------|-----------|--------|---------------|
| `title` | "심리학과 학사" | "선임상담사" | "임상심리사 1급" |
| `organization` | "서울대학교" | "○○상담센터" | "한국심리학회" |
| `start_date` | 입학일 | 입사일 | 발급일 |
| `end_date` | 졸업일 | 퇴사일 | 만료일 (없으면 NULL) |
| `is_current` | 재학 중 | 재직 중 | 항상 FALSE |
| `metadata.major` | 전공 | — | — |
| `metadata.degree` | 학위 | — | — |
| `metadata.position` | — | 직책 | — |
| `metadata.certificate_number` | — | — | 자격증 번호 |
| `attachment_*` | (선택) | (선택) | 증빙 파일 (권장) |

#### Pydantic 검증

DB 레벨에서는 kind별 필수 필드를 강제하지 못한다. **Pydantic 스키마에서 kind별 분기 검증**:

```python
class CredentialCreate(BaseModel):
    kind: Literal['education', 'career', 'certification']
    title: str
    organization: str
    # ...

    @model_validator(mode='after')
    def validate_by_kind(self):
        if self.kind == 'education':
            if not self.metadata.get('degree'):
                raise ValueError("학력은 degree 필수")
        elif self.kind == 'certification':
            if self.is_current:
                raise ValueError("자격증은 is_current=true 불가")
        # ...
```

#### 비고

- 수정 시 `verification_status`는 자동으로 `unverified`로 리셋 (3.3 참조)
- soft delete (`deleted_at`)
- 모듈러 모놀리스 원칙대로 `person_id` FK 제약 없음 (application-level)

### 2.2 `Member.credential_visibility` (센터별 공개 여부) — **MVP 제외 (후속 작업)**

> ⚠️ **MVP에서는 구현하지 않는다.** 외부 노출(§8)이 도입될 때 함께 추가.
>
> 이유: visibility는 "다른 멤버가 내 credentials를 볼 때" 의미가 생기는 기능이다. MVP에서는
> 본인 등록 / 어드민 검증 / 본인 조회만 다루므로 visibility 없이도 핵심 시나리오가 완성된다.
>
> 아래 구조는 후속 도입 시의 설계안으로 보존한다.

`Member` 테이블에 `credential_visibility` JSONB 컬럼을 추가한다.

검증 권한이 플랫폼 어드민으로 이동하면서 **이 컬럼의 역할은 단순화됨** — 공개 여부만 담는다.

```jsonc
{
  "<credential_id>": { "is_visible": true },
  "<credential_id>": { "is_visible": false }
}
```

**비고**:
- 키는 `person_credentials.id`
- 키가 없으면 기본값 `is_visible: true` (등록된 모든 credential 노출이 디폴트)
- 비공개로 설정한 항목만 키로 존재 → JSONB 사이즈 최소화 가능 (선택)
- kind별 구분 없음 (id가 이미 unique)

### 2.3 백엔드 DB 변경 요약

| 테이블 | 변경 | MVP | Alembic | 비고 |
|--------|------|:----:|---------|------|
| `person_credentials` | **신규 테이블 생성** | ✅ | `b7e9f3a2c8d1` | 학력/경력/자격 통합 |
| `persons` | `is_certified` Boolean 컬럼 추가 | ✅ | `c8d2a1f4b6e3` | 인증 여부 캐시. service 레이어 helper로 동기화 |
| `members` | `credential_visibility` JSONB 컬럼 추가 | ⛔ 후속 | — | 외부 노출(§8) 도입 시 함께 |
| `members` | `careers`, `educations`, `certifications` | — | — | **건드리지 않음** — 리핏 기간 후 별도 배포로 DROP (§7 참조) |

---

## 3. 검증 상태 흐름

### 3.1 상태 정의

```
unverified  : 등록만 됨, 아직 검증 요청 안 함
pending     : 본인이 검증 요청함, 플랫폼 어드민 처리 대기
verified    : 플랫폼 어드민이 승인함
rejected    : 플랫폼 어드민이 반려함 (reject_reason 필수)
```

### 3.2 상태 전이

```
[새 항목 등록]
       ↓
   unverified ──[본인: 검증 요청]────> pending
                                          │
   verified <──[어드민: 승인]─────────────┤
                                          │     ↓ [당사자에게 알림: 검증 완료]
                                          │
   rejected <──[어드민: 반려 + 사유]──────┘
                                                ↓ [당사자에게 알림: 반려 + 사유]
       │
       └──[본인: 수정 후 재요청]──> pending
```

### 3.3 자동 리셋 규칙

- 본인이 **person_credentials의 항목을 수정하면** → 해당 항목의 `verification_status`가 자동으로 `unverified`로 리셋
- 검증된 정보가 거짓이 되는 것을 방지
- 단순 표기 수정(예: 오타)도 동일하게 적용 → 어드민이 다시 검증해야 함
- 첨부 파일 변경/삭제도 리셋 트리거

### 3.4 검증 알림 (당사자에게)

검증 상태가 변경되면 당사자(Person)에게 알림을 발송한다. 만료 알림은 도입하지 않으며, **승인·반려 알림만 발송**한다.

| 이벤트 | event_type | priority | 채널 | 본문 예 |
|--------|-----------|----------|------|---------|
| 검증 승인 | `credential_verified` | important | 인앱 + push | "임상심리사 1급 인증이 완료되었어요" |
| 검증 반려 | `credential_rejected` | important | 인앱 + push | "임상심리사 1급 인증이 반려되었어요. 사유: ..." |

기존 `notification` 모듈의 `event_ref`로 멱등성 보장: `credential:{id}:verified` / `credential:{id}:rejected`.

스케줄러 잡 없음 — **이벤트 기반 즉시 발송** (어드민이 승인/반려 처리할 때).

### 3.5 자기 승인 정책 (단순화)

검증 주체가 플랫폼 어드민(별도 권한, 별도 앱)이므로 **센터 멤버의 "자기 승인" 이슈가 자연 소멸**한다. 단, 플랫폼 어드민 본인의 credentials를 본인이 검증할 가능성은 있음 — 이 경우 감사 로그(`audit_log` 모듈)에 `reviewed_by == person_id` 사실이 그대로 남는다 (운영 차원에서 별도 처리 안 함).

---

## 4. 권한 매트릭스

| 동작 | 본인 | 센터 관리자 | 플랫폼 어드민 |
|------|:--:|:----------:|:-----------:|
| credentials 조회 (본인) | ✅ | — | ✅ |
| 같은 센터 다른 멤버의 credentials 조회 (공개 항목만) | — | ✅ | ✅ |
| credentials 추가/수정/삭제 | ✅ | ❌ (대리 입력 금지) | ❌ (사실 데이터 손대지 않음) |
| 증빙 파일 업로드/삭제 | ✅ | ❌ | ❌ |
| `credential_visibility` 변경 (`is_visible`) | ✅ (본인 멤버십) | ❌ | ✅ |
| 검증 요청 (unverified → pending) | ✅ (본인 것만) | ❌ | — |
| **검증 승인/반려 (pending → verified/rejected)** | ❌ | ❌ | ✅ |
| 검증 큐 조회 (전체 pending 목록) | ❌ | ❌ | ✅ |

**원칙**:
- 사실 데이터(`person_credentials`)는 본인만 손댐 — 대리 입력 금지
- 검증 권한은 **플랫폼 어드민 전용** — 센터 관리자도 검증 못 함
  - 이유: 검증의 전역성·신뢰도 확보, 자기 센터 멤버를 자기가 인증하는 이해상충 회피
- 센터 관리자는 멤버 운영(공개 여부는 본인 권한이므로 관리자도 못 만짐)
- 플랫폼 어드민은 사실 데이터를 손대지 않음 — 검증 액션과 visibility 강제 변경만 가능

---

## 5. API 명세

엔드포인트는 사용 주체별로 그룹화한다:
- **본인용** (`/persons/me/...`) — 본인 credentials CRUD, 검증 요청
- **센터용** (`/centers/{cid}/...`) — 센터 내 조회, 공개 여부
- **어드민용** (`/admin/...`) — 검증 처리, 검증 큐 (별도 인증 스코프)

### 5.1 본인 credentials CRUD (`/persons/me/credentials`)

```
GET    /persons/me/credentials
       Query: ?kind=education (선택, kind 필터)
       → [
           { id, kind, title, organization, start_date, end_date, is_current,
             metadata, attachment_*, verification_status, verification_*, ... },
           ...
         ]

POST   /persons/me/credentials
       Body: {
         kind: 'education' | 'career' | 'certification',
         title, organization, description?,
         start_date?, end_date?, is_current,
         metadata: { /* kind별 */ }
       }
       → { id, ...created } (verification_status: 'unverified')

PATCH  /persons/me/credentials/{credential_id}
       Body: 부분 업데이트
       → { id, ...updated }
       ※ 수정 시 verification_status가 자동 'unverified'로 리셋

DELETE /persons/me/credentials/{credential_id}
       → 204
```

### 5.2 본인 증빙 파일 업로드

```
POST   /persons/me/credentials/{credential_id}/attachment
       Multipart: file (PDF, JPG, PNG 허용, 10MB 제한)
       → { attachment_url, attachment_filename, ... }
       ※ 첨부 변경 시 verification_status도 'unverified'로 리셋

DELETE /persons/me/credentials/{credential_id}/attachment
       → 204
```

### 5.3 본인 검증 요청

```
POST   /persons/me/credentials/{credential_id}/request-verification
       → { verification_status: 'pending', verification_requested_at: ... }
       ※ verification_status가 'unverified' 또는 'rejected'일 때만 가능
       ※ 'pending' 상태에서는 재요청 불가 (이미 큐에 있음)
```

### 5.4 센터 — 멤버 credentials 조회

```
// 멤버 상세 화면에서 1번 호출로 끝나는 통합 조회
GET    /centers/{cid}/members/{mid}/credentials
       → {
           structured: [
             {
               id, kind, title, organization, start_date, end_date, ...,
               verification_status, verification_requested_at, verification_reviewed_at, ...,
               is_visible    // Member.credential_visibility에서 머지
             },
             ...
           ],
           legacy: {
             educations: ["...", "..."],   // 기존 string[] 그대로 (read-only)
             careers: ["...", "..."],
             certifications: ["...", "..."]
           }
         }

       ※ 본인이 조회하는 경우: 모든 항목 노출 (is_visible 무관)
       ※ 다른 멤버를 조회하는 경우: is_visible=true 항목만 노출
       ※ legacy는 본인일 때만 노출 (외부에서는 항상 빈 배열)
```

### 5.5 센터 — 공개 여부 (visibility)

```
PATCH  /centers/{cid}/members/me/credential-visibility/{credential_id}
       Body: { is_visible: boolean }
       → 업데이트된 visibility 매핑
       ※ 본인 멤버십만 가능
```

### 5.6 플랫폼 어드민 — 검증 큐 / 승인 / 반려

별도 인증 스코프 (`platform_admin` 권한 필요).

```
// 검증 대기 큐 조회 (페이지네이션)
GET    /admin/credentials?status=pending
       Query: ?status=pending&kind=certification&page=1&limit=20
       → {
           items: [
             {
               id, kind, title, organization, ...,
               person_id, person_name, person_email,    // 누구의 credential인지
               verification_status, verification_requested_at,
               attachment_url, ...
             }
           ],
           total, page, limit
         }

// 승인
POST   /admin/credentials/{credential_id}/approve
       → { verification_status: 'verified', verification_reviewed_at, verification_reviewed_by }
       ※ 자동 알림: person에게 credential_verified 이벤트 발송

// 반려
POST   /admin/credentials/{credential_id}/reject
       Body: { reason: string }
       → { verification_status: 'rejected', verification_reject_reason, ... }
       ※ 자동 알림: person에게 credential_rejected 이벤트 발송 (사유 포함)

// 어드민의 강제 visibility 변경 (예: 부적절 항목 강제 비공개)
PATCH  /admin/centers/{cid}/members/{mid}/credential-visibility/{credential_id}
       Body: { is_visible: boolean, reason?: string }
       → 업데이트된 visibility (audit_log 기록)
```

### 5.7 외부 노출용 (후속 작업)

내담자가 보는 상담사 카드 등에서 사용. 본 MVP 범위가 아니지만 설계상 자리만 명시:

```
GET    /public/centers/{cid}/members/{mid}/credentials
       → 외부 노출용: verification_status='verified' 그리고 is_visible=true 항목만
```

---

## 6. 프론트엔드 적용 방향

작업은 **두 앱**에 걸쳐 있다:
- **apps/web** — 본인이 입력·요청, 센터 관리자가 조회
- **apps/admin** — 플랫폼 어드민이 **기존 계정 관리(account/clients) 화면에서 검증** 처리

### 6.1 apps/web — 멤버 상세 Credentials 탭

기존 `CareerTab` 교체. 본인 시점과 다른 멤버 조회 시점을 구분.

```
┌─ 학력 · 경력 · 자격 ──────────────────[+ 추가 ▾]─┐
│  [인증 등급: 🔵 검증 진행]                       │
│                                                  │
│  📚 학력 (1)                       [+]           │
│  └ 서울대 심리학 학사  2015 - 2019  ✓ ⋯         │
│                                                  │
│  💼 경력 (2)                       [+]           │
│  └ ○○상담센터 선임상담사  20.03 - 재직중  ⏳ ⋯ │
│  └ △△병원 임상심리사      18.01 - 20.02  · ⋯  │
│                                                  │
│  🏅 자격 (1)                       [+]           │
│  └ 임상심리사 1급 (한국심리학회)  20.08  ✓ ⋯   │
│                                                  │
│ ─────────────────────────────────────────────── │
│  📜 이전에 입력하신 정보 (참고)                  │
│  └ "서울대 심리학 학사" (legacy)                 │
│  ⓘ 새 형식으로 다시 등록하실 수 있어요          │
└──────────────────────────────────────────────────┘
```

#### 본인 시점
- `[+ 추가]` 드롭다운: 학력/경력/자격 중 선택 → kind별 모달 오픈
- 각 항목 ⋯ 메뉴: 수정, 삭제, **검증 요청** (unverified/rejected일 때만)
- 수정 모달 진입 시 "수정하면 검증 상태가 초기화돼요" 안내
- 자격증의 만료일이 도래했거나 임박한 경우 시각적 라벨 표시 (알림은 없음)
- legacy 영역 노출 (read-only, 회색 톤)

#### 다른 멤버 조회 시점 (센터 관리자 등)
- 추가/수정/삭제/검증 요청 **모두 숨김**
- `is_visible=true` 항목만 표시
- legacy 영역은 **숨김** (외부에 노출 안 함)

### 6.2 apps/admin — 계정 관리 화면에 통합

**별도 검증 대시보드를 만들지 않는다.** 기존 `account/clients` 화면을 확장:

#### 6.2.1 목록 화면 (`account/clients/+page.svelte`)

- 기존 필터 바에 **"검증 대기" 필터 추가**: 검증 요청이 있는 계정만 보이게
- 행에 **인증 상태 컬럼 추가**: verified 자격 수 / pending 요청 수
- pending이 있는 행은 시각적으로 강조 (오렌지 점 등)

```
┌─ 계정 관리 ─────────────────────────────────────────────┐
│  [🔍] [상태 ▾] [가입방식 ▾] [검증 ▾(전체/대기 있음)]    │
├─────────────────────────────────────────────────────────┤
│ 이름     이메일          상태   가입일   인증 상태       │
│ 홍길동   ...@gmail.com   활성   24.01   ✓ 자격 2 / ⏳ 1 │  ← 클릭
│ 김상담   ...@naver.com   활성   24.02   ⏳ 자격 1       │
│ ...                                                     │
└─────────────────────────────────────────────────────────┘
```

#### 6.2.2 계정 상세 — Credentials 섹션 (신규)

`AccountDetailModal` 또는 별도 라우트로 확장. 검증 액션이 들어가는 핵심 영역.

```
┌─ 홍길동 계정 ──────────────────────────────────────────┐
│  [기본 정보 섹션]                                       │
│  이름, 이메일, 상태, 가입일, 가입방식 등                │
│                                                         │
│  ─────────────────────────────────────────────────     │
│                                                         │
│  [학력·경력·자격]                                       │
│                                                         │
│  📚 학력                                                │
│  └ 서울대 심리학 학사  2015-2019  ✓ 인증됨             │
│                                                         │
│  💼 경력                                                │
│  └ ○○상담센터 선임상담사 ─ 재직중  ⏳ 검증 대기        │
│      📎 (첨부 미리보기 영역)                            │
│      [✓ 승인]   [✕ 반려]                                │
│                                                         │
│  🏅 자격                                                │
│  └ 임상심리사 1급 (한국심리학회)  20.08  ⏳ 검증 대기   │
│      📎 cert.pdf  [📥 다운로드] [👁 미리보기]           │
│      [✓ 승인]   [✕ 반려 + 사유]                         │
└─────────────────────────────────────────────────────────┘
```

- `verification_status === 'pending'`인 항목에만 **[승인] / [반려]** 버튼
- 반려 클릭 시 사유 입력 모달 → 확인 시 처리
- 처리 결과는 즉시 반영, 알림은 백엔드가 자동 발송 (당사자에게)
- 모든 승인/반려 액션은 `audit_log` 기록 (admin 표준)

#### 6.2.3 라우트 결정

두 가지 옵션:
- **A. AccountDetailModal에 섹션 추가** — 기존 모달이 충분히 크면 자연스러움
- **B. `account/clients/[id]/+page.svelte` 신규 라우트** — credentials가 많을 경우 별도 페이지가 더 깔끔

→ 권장: **B (별도 페이지)**. credentials는 첨부 미리보기/액션 버튼 등 화면 영역을 많이 차지함.

### 6.3 인증 배지 시각 (3등급 + 항목 상태)

#### 항목 단위 배지 (각 credential 옆)

| verification_status | 시각 | 라벨 |
|---|---|---|
| unverified | · (회색 점) | 미인증 |
| pending | ⏳ (노란) | 검증 대기 |
| verified | ✓ (파란 체크) | 인증됨 |
| rejected | ✕ (빨간) | 반려됨 (호버 시 사유) |

#### 종합 인증 등급 (멤버 카드 상단)

| 등급 | 시각 | 조건 |
|---|---|---|
| 🟢 인증 완료 | 진한 초록 체크 | 자격(`kind=certification`) 1개 이상이 verified |
| 🔵 검증 진행 | 옅은 파란 점 | 자격 verified는 없지만 학력/경력/자격 중 어느 하나라도 verified |
| ⚪ 미인증 | 회색 점 | verified 항목 없음 또는 등록 정보 없음 |

> "자격증 verified"를 최상위 신호로 단순화. 인증 등급 계산 로직은 `view-model.ts`에 분리.

### 6.4 Feature 모듈 구조

#### apps/web 쪽 (V4 아키텍처 준수)

```
apps/web/src/lib/features/members/credentials/
├── constants.ts          # KIND_LABELS, BADGE_LABELS, DEGREE_LABELS, MODAL_SIZES
├── view-model.ts         # API → UI 매핑 (배지, 등급, 라벨, 만료 라벨)
├── query-builders.ts     # CRUD + 검증 요청 빌더, 폼 데이터 타입
├── credentials-service.ts# 모달/토스트/invalidate 캡슐화
└── components/
    ├── CredentialBadge.svelte         # 항목 단위 배지
    ├── OverallGradeBadge.svelte       # 종합 등급 배지
    ├── CredentialItemRow.svelte       # 항목 행 (kind 무관)
    └── LegacyCredentialPanel.svelte   # legacy 영역 read-only
```

페이지 전용 모달 (EducationModal, CareerModal, CertificationModal)은 `apps/web/src/routes/(protected)/.../components/`에 둔다 (메모리: `feedback_local_modal_placement`).

#### apps/admin 쪽 (3단 레이어 아키텍처 준수)

admin은 단순한 건 단순하게가 원칙이라 필요할 때만 분리.

```
apps/admin/src/lib/features/accounts/credentials/
├── constants.ts                       # KIND_LABELS, BADGE_LABELS
├── credentials-admin-service.ts       # 승인/반려 + invalidate + 토스트 (복잡해지면 만듦)
└── components/
    ├── CredentialReviewSection.svelte # 계정 상세에 박는 섹션
    ├── AttachmentPreview.svelte       # PDF/이미지 미리보기
    └── RejectReasonModal.svelte       # 반려 사유 입력

apps/admin/src/lib/hooks/actions/
└── credential.action.ts               # admin용 endpoint 정의 (큐 조회, 승인, 반려)
```

audit_log는 admin 표준대로 백엔드 Handler에서 `audit.log()` 호출.

---

## 7. 마이그레이션 전략 (비파괴적 — 기존 데이터 손대지 않음)

### 7.1 핵심 원칙

- **기존 `Member.educations / careers / certifications` (string[]) 컬럼·데이터를 건들지 않는다.**
- 새 구조(`person_credentials` 테이블, `Member.credential_visibility` 컬럼)는 **나란히 추가**한다.
- 사용자는 새 영역에 다시 입력하면 됨 — 자동 이전 스크립트 없음.
- 이전 데이터는 "참고용"으로 별도 영역에 노출 (시나리오 C).

### 7.2 단계 (Phase)

| Phase | 작업 | 운영 영향 |
|------|------|---------|
| **Phase 1: 신규 영역 추가** | `person_credentials` 테이블 생성, `Member.credential_visibility` 컬럼 추가, API/UI 배포. 기존 컬럼은 read-only로 유지. | 기존 사용자 동작 동일. 새 사용자는 새 폼 사용. |
| **Phase 2: 운영 (3~6개월)** | 새 폼으로의 자율 이전 유도. 이전율 모니터링. | 기존 string[] 데이터는 "이전에 입력하신 정보" 안내 영역에만 노출. 검증 배지/외부 노출 대상이 아님. |
| **Phase 3: 이전 컬럼 제거** | 이전율이 충분히 높아지면 `Member.educations / careers / certifications` DROP. 별도 배포. | 별도 공지 + 마이그레이션 가이드 제공. |

### 7.3 시나리오 C — 기존 데이터 노출 방식

신규 구조화 영역과 기존 string[] 영역을 **명확히 분리**해서 보여준다.

```
[Credentials 탭]
├ ✨ 학력 · 경력 · 자격 (신규)
│   ├ 구조화 입력 가능
│   ├ 인증 배지 적용
│   └ 외부 노출 가능
│
└ 📜 이전에 입력하신 정보 (참고)
    ├ 학력: ["서울대 심리학 학사", ...]
    ├ 경력: ["○○센터 상담사", ...]
    ├ 자격: ["임상심리사 1급", ...]
    └ ⓘ "이 정보는 새로운 형식으로 다시 등록하실 수 있어요" (안내)
```

**UX 원칙**:
- 이전 데이터는 **읽기 전용** — 수정/삭제 불가 (불변 영역)
- 인증 배지 없음 — 시각적으로 명확히 구분 (회색 톤)
- "새 형식으로 다시 등록" 가이드만 제공 (자동 마이그레이션 도구는 만들지 않음)
- 외부 노출/검증 흐름에서는 **완전히 제외**

### 7.4 백엔드 처리

- API `GET /centers/{cid}/members/{mid}/credentials` 응답에 두 영역을 함께 담는다:
  ```json
  {
    "structured": {
      "educations": [...],
      "careers": [...],
      "certifications": [...]
    },
    "legacy": {
      "educations": ["...", "..."],
      "careers": ["...", "..."],
      "certifications": ["...", "..."]
    }
  }
  ```
- `legacy` 영역은 단순 read-only로만 노출. 어떤 쓰기 API도 새 항목을 legacy에 추가하지 않음.

### 7.5 Phase 3 (DROP) 조건

다음 조건이 모두 충족되면 이전 컬럼 제거:

- 활성 멤버 중 legacy 데이터를 가진 비율 < 5%
- 신규 폼 사용률 > 80%
- 운영팀 공지 후 충분한 유예 기간 경과 (최소 1개월)

### 7.6 비파괴 마이그레이션의 함의

- ✅ 데이터 손실 위험 0
- ✅ Alembic 데이터 마이그레이션 스크립트 불필요 (스키마 추가만)
- ✅ 롤백 자유 — 새 기능 폐기해도 기존 동작 그대로
- ⚠️ 사용자가 직접 다시 입력해야 함 → 이전율 모니터링 + 안내 필요
- ⚠️ DB에 두 가지 데이터 형식이 공존 → 코드에서 명확히 분리 (`structured` vs `legacy`)

---

## 8. 외부 노출 (후속 작업)

이번 MVP에는 포함되지 않으나, 설계 시 고려:

- 내담자에게 보여지는 "상담사 소개 카드"는 `credential_visibility.is_visible == true`인 항목만 노출
- 자격증 증빙 파일은 외부 노출하지 않음 (관리/검증용)
- 인증 등급 배지는 외부 카드에도 표시 가능 (신뢰도 시각화 핵심)

---

## 9. 결정 사항 요약

| 항목 | 결정 |
|------|------|
| 데이터 귀속 | Person이 원본, Member는 공개 여부(`is_visible`)만 |
| 저장 형태 | **단일 테이블 `person_credentials`** (kind + metadata JSONB) |
| 필드 구조 | 구조화 (kind별 metadata: degree, position, certificate_number) |
| 검증 상태 | 4단계: unverified / pending / verified / rejected |
| **검증 주체** | **플랫폼 어드민** (apps/admin) — 센터 관리자는 검증 못 함 |
| **검증 알림** | **승인·반려 시 당사자에게 인앱 + push** (`important` priority) <br/> → 당사자가 소속된 **모든 센터에 각각 1건씩** 발송 (notification이 center_id 기반 조회라서) |
| **알림 클릭** | `/myInfo`로 이동 (web `resolveNavigateTo`에 분기) |
| 만료 알림 | **없음** — 시각 표시만 (`expires_at` 필드는 유지) |
| 자동화 | MVP 제외 — 수동 검증 흐름만 |
| 모달 형태 | 항목별 분리 (학력/경력/자격 각각 다른 모달) |
| 파일 첨부 | **모든 kind**에 첨부 가능 (학력/경력은 선택, 자격증은 권장) |
| 첨부 URL | DB는 S3 path만 저장, **조회 응답 시점에 presigned URL로 자동 변환** (1시간 유효) |
| **인증된 전문가 정책** | **C안**: 자격증 ≥1 verified **AND** 학력 ≥1 verified |
| **인증 배지 디자인** | 파란색 그라데이션(blue-500 → sky-600) + **Ψ(Psi) 심볼** + 광택/링/shadow |
| Admin UI 위치 | **기존 `account/clients` 화면 확장** (별도 대시보드 X), 상세는 별도 페이지 (`[id]`) |
| Admin 상세 레이아웃 | 한 화면 (기본정보 + 가입센터 2-col, 자격정보 풀폭) — 탭 없음 |
| 외부 노출 | 후속 작업 |
| 기존 데이터 | 비파괴 — `Member.educations/careers/certifications` 그대로 유지, legacy 영역으로 read-only 노출, Phase 3에서 DROP |

---

## 10. 검증 자동화 — 이번 범위 제외

### 결정
- **MVP는 수동 검증 흐름만** 완성. OCR/위변조 탐지/외부 발급기관 API 연동은 후속.
- 이유: 자격증 발급기관의 공식 검증 API가 없고, 위변조 탐지는 책임 문제로 100% 자동화 불가. 관리자가 직접 사진 확인 + 외부 사이트 조회하는 것이 정석.

### 후속 단계로 미루는 항목 (참고용)

| 단계 | 내용 | 효과 |
|------|------|------|
| Stage 1 | 자격증 번호 정규식, 파일 해시 중복 체크, 발급기관 자동완성 | 명백한 오류 사전 차단 |
| Stage 2 | Naver Clova OCR로 입력 자동 채움 | 입력 부담 감소 |
| Stage 3 | 이미지 위변조 탐지 + 신뢰도 점수 | 관리자 의사결정 보조 |

→ **핵심 원칙**: 자격증의 "자동 승인"은 책임 리스크가 크기 때문에 도입하지 않음. 자동화는 어디까지나 **관리자가 빠르고 정확하게 판단하도록 돕는 도구**로 한정한다.

---

## 11. 결정된 질문 (이전 열린 질문 정리)

리뷰 과정에서 합의된 결정. 각 항목의 근거와 후속 메모를 남긴다.

### 1. 저장 형태 → 단일 테이블 `person_credentials`

- JSONB 단일 컬럼 대신 **별도 테이블 + `kind` + `metadata` JSONB** 구조 채택
- 이유: 검증 상태 인덱싱 필요, 항목별 CRUD가 자연스러움, 종류 확장 용이
- 학력/경력/자격을 한 테이블에 통합한 이유: 공통 필드 많음, 통합 정렬·통합 검증 큐 유리

### 2. 검증 이력 추적 → MVP 제외, 미래 대비 스키마만 메모

현재 `person_credentials`는 최신 verification만 컬럼으로 보관한다.

**미래 도입 시 별도 테이블** (참고용):
```sql
CREATE TABLE credential_verifications (
  id, credential_id, status, reviewed_by, reviewed_at, reject_reason, created_at
);
```
- 변경마다 1건 INSERT, 최신 1건이 person_credentials의 verification 컬럼과 동기
- 운영팀 감사 / 분쟁 대응 / 권한 남용 모니터링 필요 시 도입

### 3. 자격증 만료 알림 → 제외, 시각 표시만

- `expires_at` 필드는 유지 (DB 마이그레이션 후속 부담 없음)
- 만료 임박/만료 시 UI에서 시각적 라벨만 표시
- push/email 알림은 도입하지 않음 (운영 시 필요성 대두되면 후속)

### 4. 인증 등급 정의 → 임시 3등급 (자격증 verified 중심)

- 🟢 인증 완료: 자격 1개 이상 verified
- 🔵 검증 진행: 학력/경력/자격 중 어느 하나라도 verified
- ⚪ 미인증: verified 없음 또는 등록 없음

**근거**: "전문가의 신뢰도"의 핵심 신호는 자격증이라는 가설. 정책팀이 외부 노출 작업(후속) 시점에 최종 컨펌. 등급 계산 로직은 `view-model.ts`에 분리해서 정책 변경에 유연하게.

### 5. legacy 데이터 처리 → 비파괴 + read-only 노출

- 기존 `Member.educations/careers/certifications` 손대지 않음 (§7)
- "이전에 입력하신 정보" 영역에 회색 톤 read-only로 노출
- 검증 / 외부 노출 / 인증 등급 계산 대상에서 완전히 제외
- Phase 3에서 컬럼 DROP

### 새로 결정된 항목

#### Admin 계정 상세 → **별도 상세 페이지** (`/account/clients/[id]`)

기존 `AccountDetailModal`은 정보량이 많아지면서 한계. 별도 라우트로 분리.
**탭 구조는 시도 후 폐기**(2개뿐인 탭이 너무 헐거움) → **한 화면 누적 구조**로 결정.

**최종 레이아웃** (admin 스타일 가이드 준수: `← 계정 목록` + `section-border p-6` 카드):

```
┌─ ← 계정 목록 ──────────────────────────────────────┐
│ user@email.com   [활성]   [Ψ 인증된 전문가]         │
└────────────────────────────────────────────────────┘

┌─ 기본 정보 ──────────┐  ┌─ 가입 센터 (2개) ──┐
│ dl 필드들             │  │ · 센터1 (역할) →   │ ← 클릭 시 센터 상세
│ [강제로그아웃] [잠금]  │  │ · 센터2 (역할) →   │
└────────────────────────┘  └──────────────────┘

┌─ 자격 정보  [⏳ 검증 대기 3건] ────────────────┐
│  📚 학력 (N)                                    │
│   └ 카드들 (제목 + 상태 + 우측 썸네일 + 액션)   │
│  💼 경력 (N) / 🏅 자격증 (N) 동일 구조           │
│                                                  │
│  pending 카드만 [✓승인] [✕반려] 노출            │
│  첨부 썸네일은 카드 우측 (이미지/PDF 분기)       │
└─────────────────────────────────────────────────┘
```

**경로**: `apps/admin/src/routes/(protected)/account/clients/[id]/+page.svelte`
**자격 정보 컴포넌트**: `components/AccountCredentialsTab.svelte` (이름은 탭 시절 그대로, 풀폭 섹션으로 동작)
**기존 `AccountDetailModal`은 폐기** (목록 → goto 전환).

#### `metadata.degree` enum 컬럼 승격 → **고려 안 함**

JSONB 그대로 유지. 통계 요구 등 명확한 필요가 생기면 그때 추출.

#### 첨부 파일 저장소 → **S3** (`app/infrastructure/storage.py`)

기존 S3 인프라 활용. 구현 단계에서 확인된 내용:
- **경로**: `credentials/{person_id}/{credential_id}/{uuid}_{filename}` (파일명 충돌 방지)
- **권한**: S3 버킷은 비공개 → 조회 응답 시점에 **presigned URL 자동 발급** (1시간 TTL)
- **헬퍼**: `app/modules/person/credential/presigned.py`의 `attach_presigned_url(s)` 함수가 모든 조회 라우터에 적용됨
- **DB 컬럼 `attachment_url`은 path만 저장** → URL 재발급 자유, 권한 정책 자유

#### 인증 배지 디자인 → **파란색 + Ψ(Psi)**

- 메인 컬러: web primary `#256ef4` (≈ blue-600) 톤
- 그라데이션: 원 배경 `blue-500 → blue-600 → sky-600`, 라벨 텍스트 `blue-600 → sky-600`
- 입체감: 상단 white/30 광택 + `shadow-blue-500/30` + `ring-blue-300/60`
- Ψ(Psi) 그리스 문자 = 심리학 도메인 상징
- 컴포넌트: `apps/admin/src/lib/components/CertifiedExpertBadge.svelte`
- 동일 디자인을 web에도 동기화 예정 (멤버 카드/myInfo 등)

#### 검증 알림 발송 → **당사자가 소속된 모든 센터에 각각 1건**

- `Notification` 모델이 `center_id`로 색인되어 있어 `center_id=""`로 보내면 조회 시 안 보임
- 해결: 핸들러에서 `MemberRepository.list_by_person(person_id)`로 center_ids 가져와서 루프 발송
- `event_ref`는 `credential:{id}:verified:{center_id}`로 센터별 unique → 멱등성 유지
- 클릭 시 이동: web `resolveNavigateTo`에 `credential_verified` / `credential_rejected` 분기 추가 → `/myInfo`로 이동
- EVENT_TYPE_LABELS에 `credential_verified` ("자격 인증 완료") / `credential_rejected` ("자격 인증 반려") 추가

#### Person.is_certified **캐시 컬럼** 도입 (denormalization)

- 멤버 목록처럼 N명 일괄 조회 시 매번 credential 집계하는 부담 제거
- DB: `persons.is_certified` (Boolean NOT NULL DEFAULT false) — Alembic `c8d2a1f4b6e3` 적용 + 기존 데이터 백필
- 갱신 helper: [`person/credential/recompute.py`](../../apps/api/app/modules/person/credential/recompute.py)의 `recompute_person_certification(session, person_id)`
- 호출 지점 (5 service):
  - ApproveCredentialService (verified로 변경)
  - RejectCredentialService (안전상 호출)
  - UpdateCredentialService (수정 → unverified 리셋)
  - DeleteCredentialService (verified가 사라질 수 있음)
  - UpdateAttachmentService.set_attachment / clear_attachment (첨부 변경 → unverified 리셋)
- **명시적 호출 방식** 선택 (vs SQLAlchemy event listener) — 코드 가시성/디버깅 우선
- 정책 일원화: facade 및 handler들이 모두 `person.is_certified` 직접 읽음 (집계 안 함)
  - admin `list_accounts` / `get_account`는 stats(pending/verified/rejected 카운트)는 여전히 집계하되 `is_certified`만 person 컬럼 값 사용

#### 멤버 목록 핸들러 위치 — **application layer**

- 실제 사용되는 핸들러는 `app/application/handlers/member/list_members.py` (크로스 모듈)
- 모듈 핸들러(`app/modules/center/member/handlers/list_members.py`)는 사용 안 됨
- `is_certified` 채울 때 application handler에 한 줄 추가 필요했음 (구현 시 시행착오)

#### 알림 클릭 라우팅

- `apps/web/src/lib/features/notification/view-model.ts`의 `resolveNavigateTo()`에 분기 추가
- 자격 인증 알림(`credential_verified` / `credential_rejected`) → `/myInfo`

---

## 12. MVP Phase 1 — 구현 완료 범위

### 백엔드 (apps/api)

**person/credential 서브모듈** (`apps/api/app/modules/person/credential/`)
- `PersonCredential` 모델 (단일 테이블, kind + metadata JSONB) + Pydantic 스키마 + Repository
- 9개 Service: Create/Update/Delete/Get/List/RequestVerification/Approve/Reject/UpdateAttachment
- 7개 본인용 엔드포인트 (`/persons/me/credentials/...`)
- S3 첨부 업로드/삭제 + verification 자동 리셋
- presigned URL 자동 주입 헬퍼(`presigned.py`) — 조회 응답 후처리
- **stats 헬퍼**(`stats.py`) — `compute_stats()` 한 곳에서 정책 판정
- **recompute 헬퍼**(`recompute.py`) — `recompute_person_certification(session, person_id)`
- Alembic 마이그레이션:
  - `b7e9f3a2c8d1` person_credentials 테이블 생성 ✅
  - `c8d2a1f4b6e3` persons.is_certified 컬럼 추가 + 백필 ✅

**person 모듈**
- `Person.is_certified` 캐시 컬럼 추가 (BaseModel 직접 정의)

**platform_admin/credential 서브모듈** (`apps/api/app/modules/platform_admin/credential/`)
- 4개 엔드포인트: 검증 큐(`GET /admin/credentials/?status=pending`) / by-account 조회(`GET /admin/credentials/by-account/{account_id}`) / 승인 / 반려
- 알림 발송 — 당사자가 소속된 **모든 센터에 각각 1건** (centerId별 event_ref unique)
- audit_log 기록 (`credential.approved` / `credential.rejected`)

**platform_admin/account 확장**
- `AdminAccountSummary.credentials` (stats + `is_certified`)
- `has_pending_credentials` 필터 (목록에서 검증 대기 있는 계정만)
- `AdminAccountDetailResponse`에도 credentials stats 포함

**center/member 모듈**
- `MemberListSummary.is_certified` 추가
- `MemberFacade.list_members_with_response` + application handler `list_members_handler`가 `person.is_certified` 채움

**notification 도메인 분기**
- web `resolveNavigateTo`에 credential 분기 — `/myInfo`로 이동
- `EVENT_TYPE_LABELS`에 자격 인증 라벨 2개 추가

### 프론트 — apps/web

**myInfo (자격 관리 메인)**
- 카드 2 최상단에 **학력 · 경력 · 자격 섹션** 추가 — `MyCredentialsSection`
- 등록/수정/삭제/검증 요청/첨부 업로드 모두 본인 시점에서 가능
- 항목별 모달 3종 (Education / Career / Certification) — `BaseModal` + `Select`/`Checkbox`/`DatePickerInput` + 공통 `CredentialAttachmentField`
- 모든 kind에 첨부 가능 (자격증 권장)
- 종합 등급 배지(3단계) — 인증된 경우엔 `CertifiedExpertBadge`로 대체
- 헤더(이름 옆)에 `CertifiedExpertBadge size="md" iconOnly`
- 기존 string[] 학력·경력·자격은 **legacy 영역** (회색 톤 read-only, 새 형식 안내)

**멤버 목록(`/member`)**
- 그리드 뷰 `MemberCard`: 이름 옆 인증 배지(iconOnly)
- 리스트 뷰 `nameCell`: 인증된 사람만 배지 + 이름, 그 외 이름만 (아바타 자리 통일)
- 백엔드 `MemberListItem.is_certified` → `MemberVM.is_certified` 매핑

**공통 컴포넌트** (`lib/features/credentials/`)
- `CertifiedExpertBadge` — 파란 그라데이션 + Ψ (admin과 동일 디자인)
- `OverallGradeBadge`, `CredentialBadge`, `CredentialItemRow`, `CredentialKindSection`

**응답 구조 변경**
- `GET /persons/me/credentials` 응답이 `{ items, stats }` 객체로 변경 — 백엔드가 `is_certified` 판정해서 같이 내려줌

### 프론트 — apps/admin

**계정 목록 (`/account/clients`)**
- "자격 인증" 컬럼 — 인증된 계정은 `CertifiedExpertBadge`로 대체, 아니면 verified/pending/rejected 카운트
- "자격 상태" 필터 (전체 / 검증 대기 있음)
- 행 클릭 → 별도 상세 페이지로 이동 (모달 제거)

**계정 상세 (`/account/clients/[id]`)**
- 별도 라우트로 분리 (모달이 정보량 늘면서 한계)
- 헤더: 이메일 + 활성/잠금 상태 + `CertifiedExpertBadge`
- 2-col grid: 기본 정보 / 가입 센터 (센터 클릭 시 센터 상세로 이동)
- 풀폭 자격 정보 섹션 — **kind별 그룹** (학력/경력/자격) + 카드별 첨부 썸네일(우측) + pending이면 승인/반려 버튼
- 반려 시 사유 입력 모달(`RejectReasonModal`)
- 자격 정보 섹션 헤더에 "검증 대기 N건" 노란 배지

---

## 13. Phase 2 — 후속 작업

| 작업 | 비고 |
|------|------|
| **`Member.credential_visibility` 컬럼 + API** | 센터별 공개 여부 제어 (다음 우선 작업) |
| **외부 노출 API** (`GET /public/centers/{cid}/members/{mid}/credentials`) | 내담자가 상담사 프로필에서 자격 조회 |
| Web `/member/[memberId]`에 자격 정보 조회 (다른 멤버) | visibility + 외부 노출 완료 후 |
| Web 캘린더/예약 화면 등의 멤버 표시에도 인증 배지 | Web 전반에 점진 확산 |
| 기존 `members.educations/careers/certifications` DROP | 이전율 모니터링 후 별도 배포 (§7 Phase 3) |
| 검증 이력 추적 (`credential_verifications` 테이블) | 감사/분쟁 대응 필요 시 |
| 자격증 만료 알림 | 운영 시 필요성 대두되면 |
| 자동 검증 보조 (OCR, 위변조 탐지) | §10 참조 |
| RequestVerificationService에도 recompute 호출 (안전상) | 현재는 영향 없으나 일관성 위해 |
| 인증 등급 정책 정책팀 컨펌 | 외부 노출 작업 시 필수 |

---

## 14. 운영 가이드 (구현 단계 결과 기록)

### 코드 변경 시 체크리스트

자격 검증 상태에 영향을 주는 코드를 추가/수정할 때:

- [ ] PersonCredential의 `verification_status`를 바꾸나? → `recompute_person_certification` 호출 추가
- [ ] PersonCredential을 (soft) 삭제하나? → 동일
- [ ] 첨부 파일 변경이 verification을 리셋하나? → 동일
- [ ] 알림 발송이 필요한 신규 이벤트? → web `resolveNavigateTo` + `EVENT_TYPE_LABELS`
- [ ] 멤버/계정 목록 응답에 `is_certified` 필요한가? → 핸들러에서 `person.is_certified` 채움

### 디버깅 팁

- 인증 배지가 안 뜬다? → 응답 JSON 에서 `is_certified` 값 확인
- DB는 true인데 응답이 false → **올바른 핸들러를 수정했는지 확인**
  - 멤버 목록은 `app/application/handlers/member/list_members.py` (모듈 핸들러가 아닌 application layer)
  - admin 계정 목록은 `app/modules/platform_admin/account/handlers/list_accounts.py`
- credentials 응답 형태가 배열인 줄? → MVP에서 `{ items, stats }` 객체로 변경됨 (Phase 1)
- 첨부가 404 → S3 path만 저장하고 presigned는 응답 변환 시 발급. handler에서 `attach_presigned_url(s)` 호출 확인.
