# 상담센터 SaaS 플랫폼

상담센터 운영을 위한 SaaS 시스템. 상담/검사 관리, 일정, 결제/청구를 통합 관리.

## 기술 스택

### Frontend

- **SvelteKit** 2.15+ with Svelte 5 (Runes)
- **TailStack Query** 5.64+ (서버 상태 관리)
- **Tailwind CSS** 3.4+
- **TypeScript** 5.7+

### Backend

- **FastAPI** 0.115+ (Python 3.11)
- **SQLAlchemy** 2.0+ (Async)
- **PostgreSQL** 16
- **Alembic** (마이그레이션)

### Infrastructure

- **Docker & Docker Compose**
- **pnpm** 9.15+ (패키지 매니저)
- **Turborepo** 2.3+ (모노리포 빌드)
- **uv** (Python 패키지 매니저)

## 포트 구성

- **3501**: PostgreSQL
- **3502**: API (FastAPI)
- **3503**: Web (SvelteKit)

## 시작하기

### 1. 환경 변수 설정

```bash
cp .env.example .env
```

### 2. Docker Compose로 전체 실행

```bash
# 전체 서비스 실행
docker-compose up

# 특정 서비스만 실행
docker-compose up postgres  # DB만
docker-compose up api       # API만
docker-compose up web       # Frontend만
```

### 3. 로컬에서 개발 (옵션)

**Backend (API)**:

```bash
cd apps/api
uv sync                     # 의존성 설치
uv run alembic upgrade head # 마이그레이션
uv run uvicorn app.main:app --reload --port 8000
```

**Frontend (Web)**:

```bash
cd apps/web
pnpm install
pnpm dev
```

## 프로젝트 구조

상세한 프로젝트 구조와 아키텍처는 [CLAUDE.md](./CLAUDE.md)를 참고하세요.

```
saas-center-platform/
├── apps/
│   ├── api/                # FastAPI Backend (모듈러 모놀리스)
│   │   ├── app/
│   │   │   ├── core/       # 공통 인프라
│   │   │   ├── modules/    # 도메인 모듈
│   │   │   └── application/# 크로스 모듈 조합
│   │   └── migrations/     # Alembic
│   │
│   └── web/                # SvelteKit Frontend
│       └── src/
│           ├── lib/
│           └── routes/
│
├── docs/                   # 도메인별 설계 문서
├── docker-compose.yml
└── CLAUDE.md              # 개발 가이드
```

## 개발 가이드

전체 개발 규칙과 아키텍처 가이드는 [CLAUDE.md](./CLAUDE.md)를 참고하세요.

## 변경 내역 (작업 중)

> 아래는 현재 브랜치에서 진행 중인 변경사항을 도메인별로 정리한 것입니다.

### 📒 상담일지 (Counseling Note)

- **내정보 → 상담일지 리스트 화면 신설** (Mobile): 상담사 본인의 상담일지를 한 화면에서 모아보고 미작성 회기의 작성을 유도. `전체 / 작성 / 미작성` 세그먼트 필터 + 내담자명 검색 + 무한스크롤. 그룹 회기는 `(회기 × 내담자)` 단위로 펼쳐 "A는 작성·B는 미작성"을 구분 표시.
- **상담일지 목록 조회 API** (`GET /centers/{id}/counseling/notes`): 작성분(본인 author)과 미작성(완료 회기 × 내담자 차집합)을 합성해 반환. 여러 Facade(Note·Session·Case·Program·Schedule·Client)를 Application Handler에서 크로스 모듈로 조합하며 N+1 방지 batch 조회 사용.
- **라우트 등록 순서 조정**: 정적 경로 `/counseling/notes` 가 `GET /counseling/{case_id}` 에 `case_id="notes"` 로 가로채이지 않도록 note 라우터를 case 라우터보다 먼저 등록.
- **필드노트 → 상담일지 초안 자동 생성** (Mobile): 녹취·요약이 끝난 필드노트로 회기 참여 내담자 전원의 상담일지 초안을 LLM 생성. 진입점 3곳 — ⒜ 필드노트 완료 화면 ⒝ 회기 연결 직후 토스트 ⒞ 상담일지 작성 시트. `note_status` 폴링으로 완료 감지 후 캐시 무효화.

### 💳 청구 (Billing, Mobile)

- **모바일 청구 처리 도입**: counselor `write:billing`(본인 담당) 기준으로 **발행·납부 등록·패키지 선결제**를 모바일에서 처리. **환불·삭제는 비범위**(관리자 web 전용).
- **상담 상세**: 세션 단건 청구 발행 + 패키지 선결제(세션 개별 청구와 상호배제) + 청구 상세/납부 등록 시트.
- **검사 상세**: 세션 단건 청구만 (검사는 패키지 선결제 없음).
- **내담자 상세**: 미수 안전망 — `billing_unpaid` 신호 탭 시 미수 청구 목록 → 상세 → 납부 등록까지 (기존 "웹에서 확인" 안내 대체).
- **billing feature 모듈 신설** (`src/features/billing/`): api·types·constants·hooks + 5개 시트 컴포넌트(Session/Package/Client/Billable/Payment). 상태 표현은 web `BillingActionButton` 과 통일(`none`=청구하기 / `pending`=청구 확인 / `completed`=청구 완료).

### 👥 내담자 (Client) — 회기 임박순 정렬

- **목록 정렬에 "회기 임박순"(기본) + "이름순" 추가** (API + Web).
- **회기 임박순**은 정렬 키가 타 모듈(Counseling → Schedule)에 있어 SQL 페이지네이션이 불가하므로 Application Handler에서 크로스 모듈 조합으로 정렬·페이징. 미지정/미지원 정렬값은 `created_at desc` 폴백(기존 클라이언트 호환).
- **Web sticky 정렬**: `/clients` 목록만 기본값 `회기 임박순` + localStorage 영속화. 우선순위 `URL 파라미터 > 저장값 > 기본값`. 셀렉터/드롭다운 등 공유 소비처는 중립값(`desc`) 유지.

### 🧪 검사 (Assessment) — 현황 카드 통일

- **검사 현황 리스트 카드를 상담 현황 카드와 시각 통일** (Mobile): 뱃지 색상(진행중 orange / 완료 primary / 예정·취소 gray), 진행바 + `N/M건`, 짧은 날짜(`M월 d일 (요일)`) + D-day(임박 강조). 시간·상담실명은 상세로 이관.

### 📄 문서

- **`apps/mobile/docs/INFORMATION_SPEC.md`**: 청구(§3-2·§3-4·§4) · 상담일지 리스트(§3-5-1·§3-8) · 검사 현황 카드(§3-6) 스펙 반영.
- **`apps/mobile/CLAUDE.md`**: 청구를 모바일의 예외 영역으로 명시(발행·납부·패키지 선결제 가능, 환불·삭제만 web) — 권한 판단을 "역할"이 아닌 "액션 단위"로.

## 라이선스

Proprietary
