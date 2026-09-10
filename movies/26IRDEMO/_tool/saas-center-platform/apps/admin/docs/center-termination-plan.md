# 해지 후 데이터 보관/삭제 관리 구현 계획

> 근거: 이용약관 제10조 (서비스 이용 제한 및 계약 해지)
> 관련 피드백: `apps/admin/docs/feedback.md` - "해지 후 데이터 보관/삭제 관리"

---

## 1. 개요

센터 이용 계약 해지 시 **30일 데이터 보관 → 완전 삭제** 프로세스를 관리자 대시보드에서 관리할 수 있도록 구현한다.

### 이용약관 요구사항 정리

| 조항 | 내용 | 시스템 반영 |
|------|------|-------------|
| 10조 1항 | 경고 → 일시 정지 → 영구 정지 단계적 제한 | 감사 로그 기반 이력 관리 |
| 10조 2항 | 제한 시 사유/유형/이의신청 방법 고지 | 이메일 알림 + 문의관리 연동 |
| 10조 3항 | 이용자가 설정/이메일로 해지 신청 가능 | 해지 신청 접수 API |
| 10조 4항-a | 해지 후 30일 보관 후 완전 삭제 | `deleted_at` + 30일 계산 |
| 10조 4항-b | 30일 내 데이터 내보내기 요청 가능 | 데이터 내보내기 API |
| 10조 4항-c | 법령 보존 필요 정보는 별도 보관 | 법적 보존 데이터 분리 |
| 10조 4항-d | 보관 기간 경과 후 복구 불가 | 완전 삭제 + 안내 |

---

## 2. Center 상태 관리 (기존 모델 활용)

### 2.1 설계 원칙

**Center 모델을 변경하지 않는다.** 기존 `is_active` + `deleted_at` 두 필드 조합으로 모든 상태를 표현한다.

```python
# Center 모델 (변경 없음)
is_active: bool          # 활성/정지
deleted_at: datetime     # Soft Delete → 해지 시점으로 활용
```

### 2.2 상태 판별 로직

| 상태 | `is_active` | `deleted_at` | 판별 조건 | API 접근 |
|------|:-----------:|:------------:|-----------|:--------:|
| 활성 | `true` | `null` | - | O |
| 정지 | `false` | `null` | - | X |
| 보관 중 | `false` | 설정됨 | `deleted_at + 30일 > now()` | X |
| 만료 (삭제 대상) | `false` | 설정됨 | `deleted_at + 30일 ≤ now()` | X |

> **30일 경과 → 데이터 완전 삭제.** 삭제가 실행되면 센터 레코드 자체가 사라지므로 `purged` 같은 별도 상태가 불필요하다.

### 2.3 상태 전이

```
active (is_active=true, deleted_at=null)
  │
  ├─ 정지 ──► suspended (is_active=false, deleted_at=null)
  │              │
  │              ├─ 해제 ──► active
  │              │
  │              └─ 해지 ──► terminated (is_active=false, deleted_at=now())
  │
  └─ 해지 ──► terminated (is_active=false, deleted_at=now())
                  │
                  ├─ 30일 이내: 보관 중 (내보내기 가능)
                  │
                  └─ 30일 경과: 완전 삭제 실행 → 데이터 제거
```

### 2.4 경고 처리

경고는 센터 상태를 변경하지 않는다 (서비스 계속 이용 가능).
**감사 로그(audit log)** 로 경고 이력을 기록하고, 관리자가 이력을 조회할 수 있도록 한다.

```
경고 발송 → audit_log에 action="center.warned" 기록
         → 센터 관리자에게 이메일 발송 (사유 + 이의신청 방법)
         → is_active, deleted_at 변경 없음
```

관리자가 센터 상세에서 해당 센터의 감사 로그를 필터링하면 경고 이력을 확인할 수 있다.

---

## 3. 백엔드 API 설계

### 3.1 모듈 구조

```
apps/api/app/modules/platform_admin/center_termination/
├── models.py                    # CenterDataExportRequest 모델
├── schemas.py                   # 요청/응답 스키마
├── router.py                    # API 엔드포인트
├── repository.py                # 해지 센터 조회 (deleted_at 기반)
├── handlers/
│   ├── list_terminated.py       # 해지/보관 중 센터 목록
│   ├── terminate_center.py      # 센터 해지 처리
│   ├── request_data_export.py   # 데이터 내보내기 요청 접수
│   ├── process_data_export.py   # 데이터 내보내기 처리
│   └── purge_center.py          # 데이터 완전 삭제 처리
└── services/
    ├── list_terminated.py
    ├── terminate_center.py
    ├── request_data_export.py
    ├── process_data_export.py
    └── purge_center.py
```

### 3.2 API 엔드포인트

#### 해지 센터 관리

```
GET    /api/v1/admin/center-terminations                    # 해지/보관 중 센터 목록
POST   /api/v1/admin/center-terminations/{center_id}        # 센터 해지 처리
```

#### 데이터 내보내기

```
GET    /api/v1/admin/center-terminations/{center_id}/exports          # 내보내기 요청 목록
POST   /api/v1/admin/center-terminations/{center_id}/exports          # 내보내기 요청 접수
PATCH  /api/v1/admin/center-terminations/{center_id}/exports/{id}     # 내보내기 처리 상태 업데이트
```

#### 데이터 삭제

```
POST   /api/v1/admin/center-terminations/{center_id}/purge  # 데이터 완전 삭제 실행
```

#### 경고 (기존 center 모듈 확장)

```
POST   /api/v1/admin/centers/{center_id}/warn               # 경고 발송
```

### 3.3 상세 스펙

#### GET /api/v1/admin/center-terminations

해지된 센터 목록 조회. `deleted_at IS NOT NULL`인 센터를 대상으로 한다.

| 파라미터 | 타입 | 설명 |
|---------|------|------|
| `status` | query | `retention` (보관 중) \| `expired` (만료, 삭제 대상) \| `all` |
| `search` | query | 센터명/사업자번호 검색 |
| `expiring_soon` | query | `true` → 보관 만료 7일 이내 센터만 |
| `page`, `size` | query | 페이징 |

Response:
```json
{
  "items": [
    {
      "id": "uuid",
      "center_name": "마음샘 상담센터",
      "deleted_at": "2026-03-01T00:00:00",
      "retention_expires_at": "2026-03-31T00:00:00",
      "retention_remaining_days": 14,
      "is_expired": false,
      "has_pending_export": true,
      "export_count": 1
    }
  ],
  "total": 5,
  "page": 1,
  "size": 20,
  "pages": 1
}
```

> `retention_expires_at`과 `retention_remaining_days`는 응답 시 `deleted_at + 30일`로 계산하여 반환하는 가상 필드다. DB에 저장하지 않는다.

#### POST /api/v1/admin/center-terminations/{center_id}

센터 해지 처리.

Request:
```json
{
  "reason": "이용자 본인 해지 요청",
  "notify_center": true
}
```

동작:
1. Center.is_active → `false`
2. Center.deleted_at → `now()`
3. 감사 로그 기록 (`center.terminated`, summary에 reason 포함)
4. `notify_center=true`이면 센터 관리자에게 해지 확인 + 30일 보관 안내 + 데이터 내보내기 방법 이메일 발송

#### POST /api/v1/admin/center-terminations/{center_id}/exports

데이터 내보내기 요청 접수. 보관 기간(30일) 내에만 가능.

Request:
```json
{
  "requested_by_email": "kim@example.com",
  "export_types": ["clients", "assessments", "counseling", "schedules"],
  "format": "csv",
  "note": "모든 내담자 데이터 요청"
}
```

검증:
- `deleted_at + 30일 < now()`이면 보관 기간 만료로 거부

#### POST /api/v1/admin/center-terminations/{center_id}/purge

보관 기간 만료된 센터의 데이터 완전 삭제. **super_admin 전용.**

Request:
```json
{
  "confirm": true,
  "exclude_legal_retention": true
}
```

동작:
1. `deleted_at + 30일 ≤ now()` 확인 (미경과 시 거부)
2. 미처리 내보내기 요청 확인 (있으면 경고 응답, 강제 진행 옵션)
3. 센터 관련 데이터 완전 삭제 (법적 보존 제외)
4. **파일 서버/S3 저장 파일 삭제** (logo_url, image_urls, 첨부파일 등 — 아래 10.6 참고)
5. Center 레코드 자체도 삭제 (또는 최소 식별 정보만 남김)
6. 감사 로그 기록 (`center.purged`)

#### POST /api/v1/admin/centers/{center_id}/warn

경고 발송. 센터 상태 변경 없이 감사 로그 + 이메일 알림만 수행.

Request:
```json
{
  "reason": "약관 위반: 무단 데이터 수집",
  "notify": true
}
```

동작:
1. 감사 로그 기록 (`center.warned`, summary에 reason 포함)
2. `notify=true`이면 센터 관리자에게 경고 사유 + 이의신청 방법 이메일 발송
3. `is_active`, `deleted_at` 변경 없음

---

## 4. 데이터 내보내기 요청 모델

유일하게 신규 생성이 필요한 테이블:

```python
class CenterDataExportRequest(BaseModel):
    """센터 데이터 내보내기 요청"""
    __tablename__ = "center_data_export_requests"

    center_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    center_name: Mapped[str] = mapped_column(String(100), nullable=False)  # 비정규화
    requested_by_email: Mapped[str] = mapped_column(String(255), nullable=False)
    export_types: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    format: Mapped[str] = mapped_column(String(10), default="csv")
    status: Mapped[str] = mapped_column(
        String(20), default="pending",
        comment="pending, processing, completed, failed"
    )
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    download_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    processed_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
```

---

## 5. 이의 신청

이용약관 10조 2항에 따라 이의신청 방법을 고지해야 한다.
기존 **문의관리(qna/inquiry)** 모듈을 활용:

- 경고/정지 알림 이메일에 문의 링크 포함 (`support@insighter.co.kr`)
- 이의신청은 inquiry_type: `appeal`로 접수
- 관리자가 문의관리에서 확인 후 처리

---

## 6. 법적 보존 데이터 처리

이용약관 10조 4항-c에 따라 법령상 보존 필요 정보는 별도 보관.

### 6.1 보존 대상 (예시)

| 법령 | 보존 항목 | 기간 |
|------|----------|------|
| 전자상거래법 | 계약/청약철회 기록 | 5년 |
| 전자상거래법 | 대금결제/재화공급 기록 | 5년 |
| 전자상거래법 | 소비자 불만/분쟁 처리 | 3년 |
| 통신비밀보호법 | 로그인 기록 | 3개월 |

### 6.2 처리 방식

- purge 실행 시 `exclude_legal_retention=true`이면 위 항목은 삭제하지 않고 별도 보관
- 법적 보존 데이터는 `legal_retention_data` 테이블에 JSON으로 아카이빙
- 보존 기간 만료 시 자동 삭제 (Celery Beat)

> 법적 보존 항목의 구체적인 범위는 법무 검토 후 확정. 초기 구현에서는 결제/청구 기록과 로그인 기록만 보존 대상으로 한다.

---

## 7. 프론트엔드 구현

### 7.1 페이지 구조

```
apps/admin/src/routes/(protected)/
├── center/
│   ├── manage/                     # 기존 센터 관리 (경고/해지 버튼 추가)
│   └── terminations/               # 신규: 해지 관리
│       └── +page.svelte
```

### 7.2 해지 관리 페이지 (`/center/terminations`)

**레이아웃:**

```
┌─────────────────────────────────────────────────────┐
│ PageHeader: 해지 센터 관리 · 총 N개                  │
├─────────────────────────────────────────────────────┤
│ [검색] [상태 Select] [만료 임박 체크] [초기화]        │
├─────────────────────────────────────────────────────┤
│ 보관 만료 임박 알림 배너 (7일 이내 N건)               │
├─────────────────────────────────────────────────────┤
│ Table                                               │
│ ┌──────┬──────┬──────┬────────┬──────────┐          │
│ │센터명│해지일│잔여일│내보내기│액션      │          │
│ ├──────┼──────┼──────┼────────┼──────────┤          │
│ │마음샘│03-01 │14일  │1건대기 │상세      │          │
│ │행복  │02-01 │만료  │완료    │삭제 실행 │          │
│ └──────┴──────┴──────┴────────┴──────────┘          │
├─────────────────────────────────────────────────────┤
│ Pagination                                          │
└─────────────────────────────────────────────────────┘
```

**잔여일 표시:**

| 조건 | 색상 | 표시 |
|------|------|------|
| 8일 이상 | `gray` | N일 |
| 1~7일 | `red` | N일 (만료 임박) |
| 0일 이하 | `red` (진하게) | 만료 |

**행 클릭 → 상세 모달:**

- 센터 기본 정보 (이름, 해지일, 해지 사유 - 감사 로그에서 조회)
- 보관 만료까지 잔여일
- 데이터 내보내기 요청 목록 + 상태
- 액션: 내보내기 요청 접수 / 삭제 실행 (만료 시)

### 7.3 기존 센터 관리 페이지 수정

- 센터 상세 페이지에 **경고** 버튼 추가 (`is_active=true`일 때)
- 센터 상세 페이지에 **해지** 버튼 추가 (`deleted_at=null`일 때)
- 센터 상세 페이지에 경고 이력 섹션 추가 (감사 로그 `center.warned` 필터)

### 7.4 대시보드 알림

- 보관 만료 임박 센터 수 표시 (7일 이내)
- 미처리 데이터 내보내기 요청 수 표시

---

## 8. 알림 시나리오

| 이벤트 | 수신자 | 채널 | 내용 |
|--------|--------|------|------|
| 경고 발송 | 센터 관리자 | 이메일 | 경고 사유 + 이의신청 방법 (문의 이메일) |
| 일시 정지 | 센터 관리자 | 이메일 | 정지 사유 + 기간 + 이의신청 방법 |
| 해지 확인 | 센터 관리자 | 이메일 | 해지 완료 + 30일 보관 안내 + 데이터 내보내기 방법 |
| 보관 만료 7일 전 | 센터 관리자 | 이메일 | 만료 임박 + 내보내기 마감 안내 |
| 보관 만료 7일 전 | 플랫폼 관리자 | 대시보드 알림 | 만료 임박 센터 N건 |
| 데이터 삭제 완료 | 센터 관리자 | 이메일 | 삭제 완료 + 복구 불가 안내 |

---

## 9. 구현 순서

### Step 1: DB 모델 (최소 변경)

- [ ] `CenterDataExportRequest` 모델 생성
- [ ] Alembic 마이그레이션 작성

> Center 모델은 변경하지 않는다. 기존 `is_active` + `deleted_at`을 그대로 활용.

### Step 2: 백엔드 API - 해지 관리

- [ ] `center_termination` 모듈 생성 (repository, schemas, router, handlers, services)
- [ ] 해지 센터 목록 조회 API (`GET /center-terminations`) — `deleted_at IS NOT NULL` 기반
- [ ] 센터 해지 처리 API (`POST /center-terminations/{center_id}`) — `is_active=false`, `deleted_at=now()`
- [ ] 데이터 삭제 처리 API (`POST /center-terminations/{center_id}/purge`) — `deleted_at + 30일` 경과 확인

### Step 3: 백엔드 API - 데이터 내보내기

- [ ] 내보내기 요청 접수 API (`POST /center-terminations/{center_id}/exports`)
- [ ] 내보내기 요청 목록 조회 API (`GET /center-terminations/{center_id}/exports`)
- [ ] 내보내기 상태 업데이트 API (`PATCH /center-terminations/{center_id}/exports/{id}`)

### Step 4: 백엔드 API - 경고

- [ ] 센터 경고 API (`POST /centers/{center_id}/warn`) — 감사 로그 + 이메일만, 상태 변경 없음

### Step 5: 프론트엔드

- [ ] 해지 센터 관리 페이지 구현 (`/center/terminations`)
- [ ] 기존 센터 관리 페이지에 경고/해지 버튼 추가
- [ ] 센터 상세에 경고 이력 섹션 추가 (감사 로그 기반)
- [ ] 대시보드에 만료 임박 알림 표시

### Step 6: 알림 + 자동화

- [ ] 해지/경고/삭제 이메일 템플릿 작성
- [ ] 보관 만료 7일 전 알림 (Celery Beat 또는 cron)
- [ ] 보관 만료 센터 자동 알림 (삭제는 수동 — 관리자 확인 필요)

---

## 10. 참고사항

- **Center 모델 무변경**: `is_active` + `deleted_at` 조합으로 모든 상태를 표현. 가상 필드(`retention_remaining_days` 등)는 API 응답 시 계산.
- **삭제는 반드시 수동**: 자동 삭제는 위험하므로, 관리자가 직접 purge 실행. 만료 알림만 자동화.
- **경고는 감사 로그**: 별도 상태 필드 없이 `audit_log`의 `center.warned` 액션으로 이력 관리.
- **법적 보존**: 구체적 범위는 법무 검토 후 확정. 초기엔 결제/로그인 기록만 대상.
- **데이터 내보내기 형식**: 초기엔 CSV. 추후 JSON 지원 추가 가능.
- **파일 서버 정리**: purge 시 DB 레코드뿐 아니라 S3/파일 서버에 저장된 파일도 함께 삭제해야 한다. 대상: `Center.logo_url`, `Center.image_urls`, 센터 소속 검사/상담 관련 첨부파일 등. `app/infrastructure/storage.py`의 `delete` 메서드 활용 (없으면 추가).
