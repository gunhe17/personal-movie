# 마인드봄 (MindBom) — 투사적 심리검사 해석 보조 시스템

> SaMD 2등급 | 서울형 바이오·의료 기술사업화 지원사업 (BT260016)
> 사업기간: 2026.07.01 ~ 2028.06.30 (24개월)

---

## 프로젝트 개요

투사적 심리검사(HTP, Rorschach, SCT)의 AI 기반 해석 보조 시스템.
CDSS(Clinical Decision Support System) 원칙: **AI가 초안 → 임상가가 검토/수정/확인**.

### 핵심 검사
- **HTP (House-Tree-Person)**: 그림 분석 → 객체 탐지 + 측정 + 해석 초안
- **Rorschach**: 음성 녹취 → 화자분리 + Exner CS 채점
- **SCT (Sentence Completion Test)**: 문장완성 → 영역별 채점

### 검사 상태 머신
```
created → in_progress → ai_draft_ready
→ under_review → confirmed → report_generated
```

---

## 기술 스택

### Backend (apps/api)
| 기술 | 버전 | 비고 |
|------|------|------|
| Python | 3.11+ | |
| FastAPI | 0.115+ | async 기반 |
| SQLAlchemy | 2.0+ | async 지원 |
| Pydantic | 2.10+ | 스키마 검증 |
| PostgreSQL | 16 | asyncpg |

### Frontend (apps/web)
| 기술 | 버전 | 비고 |
|------|------|------|
| SvelteKit | 2.15+ | SSR + SPA |
| Svelte | 5.16+ | Runes 문법 |
| TypeScript | 5.7+ | strict |
| Tailwind CSS | 4+ | 유틸리티 우선 |

---

## 아키텍처 (마인드스코프 동일)

```
Request → Router → Handler → Facade → Service → Repository → DB
                      ↓
                 Unit of Work
               (트랜잭션 경계)
```

### 레이어 규칙
- **Router**: HTTP 선언, Depends, response_model
- **Handler**: Facade 호출 + UoW 트랜잭션 (try-except 금지)
- **Facade**: Service 조합 + DTO 변환
- **Service**: 단일 비즈니스 로직 (도메인 예외 발생)
- **Repository**: 순수 쿼리 (commit/rollback 금지)

### 모듈 구조
```
apps/api/app/modules/
├── auth/                 # 인증 (account + token)
├── institution/          # 기관 관리
├── member/               # 기관 멤버
├── client/               # 내담자 (피검자)
├── examination/          # 검사 (핵심 도메인)
│   ├── common/           # 공통 모델 + 상태 머신
│   ├── facade/           # Examination Facade
│   ├── htp/              # HTP 서브모듈
│   ├── rorschach/        # Rorschach 서브모듈
│   ├── sct/              # SCT 서브모듈
│   └── report/           # 통합 보고서
├── dashboard/            # 대시보드
└── audit/                # 감사추적 (GMP 필수)
```

---

## AI 연동 (Mock-first)

`AI_SERVICE_ENABLED=false`면 MockAIService 사용.
AI팀 서버 준비되면 `RemoteAIService` 구현 후 전환.

### AI API 엔드포인트 (AI팀 제공 예정)
| 엔드포인트 | 입력 | 출력 |
|------------|------|------|
| POST /api/htp/detect | image (binary) | objects, measurements, interpretations |
| POST /api/rorschach/transcribe | audio (binary), card_no | segments (화자분리) |
| POST /api/rorschach/score | transcript, location 등 | Exner CS 채점 |
| POST /api/sct/score | items (문항+응답) | scores, domain_totals |
| POST /api/report/summarize | 검사 결과들 | summary, key_findings |

---

## 개발 명령어

```bash
# 의존성
pnpm install && cd apps/api && uv sync

# 개발
pnpm db:up && pnpm db:migrate
cd apps/api && uv run python -m scripts.seed   # 촬영 배역 시드 (scripts/cast.py)
pnpm dev:api          # API (localhost:4502)

# 마이그레이션
cd apps/api
uv run alembic revision --autogenerate -m "description"
uv run alembic upgrade head
```

### 포트
| 서비스 | 포트 |
|--------|------|
| PostgreSQL | 4501 |
| API | 4502 |
| Web | 4503 |

---

## 시드 — 촬영 배역 (scripts/cast.py)

영상 촬영에서 마인드스코프(saas-center-platform)와 **같은 사람들**을 쓴다. 한 영상에서 두 제품을
오가므로 기관·계정·내담자가 이름·생년월일·비밀번호까지 같아야 컷이 이어진다.

- 정본은 저쪽 `scripts/seed/develop/{center,account,client}.py`다. **저쪽이 바뀌면 이쪽을 고친다.**
- `scripts/cast.py`가 배역표, `scripts/seed.py`가 그것으로 자연키 멱등 시드를 만든다.
  재실행하면 사람은 그대로 두고(=id 유지) 검사 시각만 지금 기준으로 다시 맞춘다.
- 계정 5 / `test1234`. 역할은 4:3으로 매핑된다 — 김원장·이사무 → admin, 박접수 → researcher,
  정상담·최치료 → clinician.
- 검사 12건은 전부 정상담 담당이다. clinician은 본인이 examiner인 검사만 보므로 나누면 화면이 빈다.

## SaMD 규제 요구사항

### 필수 (현장점검 대비)
- **감사추적 (Audit Trail)**: 모든 데이터 변경 이력 기록
- **상태 머신**: 검사 상태 전이 엄격 관리
- **CDSS 원칙**: AI 초안 → 임상가 확인 (AI가 최종 결정 금지)
- **사용자 인증/권한**: 역할 기반 (admin, clinician, researcher)
- **데이터 무결성**: 검사 결과 변조 방지

### 문서화 대상 (V&V)
- 소프트웨어 설계 명세서
- 검증 및 확인 (V&V) 계획/보고서
- 위험 관리 파일

---

## Git Commits (한글)

| Prefix | 용도 | 예시 |
|--------|------|------|
| `feat:` | 새 기능 | `feat: HTP 검사 등록 기능 추가` |
| `modify:` | 기존 수정 | `modify: 상태 머신 전이 규칙 개선` |
| `fix:` | 버그 수정 | `fix: 로르샤하 채점 오류 수정` |
| `docs:` | 문서 | `docs: V&V 테스트 케이스 추가` |
