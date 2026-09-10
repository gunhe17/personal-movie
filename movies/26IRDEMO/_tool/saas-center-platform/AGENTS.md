# 상담센터 SaaS 플랫폼

상담센터 운영 SaaS — 상담·검사 관리, 일정, 결제/청구를 통합한다. turbo + pnpm 모노레포.

이 파일은 **전역 사실과 앱 공통 작업 원칙**을 둔다. 레이어·패턴 규칙은 경로 스코프로 자동 로드되는 `.Codex/rules/`에 있고, 여기서 재서술하지 않는다.

## 기획 누락 방지와 완료 기준 (모든 세션 공통)

- 기획 기반 구현·보완·누락 점검을 요청받으면, 수정 전에 최신 기획과 사용자 선택·메모·후속 결정을 읽고 현재 코드와 요구사항별로 대조한다. 최근 지적된 UI나 이미 구현된 기능만 점검하지 않는다.
- 기존 기획/구현 추적 문서에 요구사항 ID 또는 이름, 원본 근거, 현재 구현 근거, 검증 결과, 다음 행동을 남긴다. 다음 세션은 이 기록을 읽고 현행 코드와 재대조한다. 별도 추적 문서가 필요하면 관련 앱 안에 만들고 기획 문서에서 연결한다.
- 범위(`포함 / 보류 / 제외 / 미결정`)와 구현 상태(`미구현 / 부분 구현 / 구현됨·미검증 / 구현·검증 완료 / 결정 필요`)를 구분한다. 후보 추천·내용 검토·테스트 통과를 사용자 범위 확정이나 디자인 승인으로 해석하지 않는다.
- 정책 미정은 기능 전체를 묵시적으로 제외할 이유가 아니다. 확정되어 독립적으로 진행 가능한 부분과 정책에 막힌 부분을 분리하고, 막힌 부분은 필요한 질문·영향 범위·다음 행동을 기록하여 사용자에게 확인한다. 권한·공개 범위·운영 정책을 임의로 확정하지 않는다.
- 사용자 흐름의 시작부터 종료까지 관련 화면·API·상태 전파를 확인한다. 사용자 요청 기능은 수신/처리하는 직원 화면까지, 온라인/방문 등 기획에 있는 분기는 각각 확인한다. 버튼만 있거나 정상 경로 테스트만 통과한 상태는 전체 완료가 아니다.
- 검증은 구현된 코드뿐 아니라 요구사항 목록을 기준으로 잡는다. 정상 흐름 외에 해당 기능의 실패·재시도·중단/재진입·권한·상태 변경을 확인하고, 실제 미검증 영역과 모의 API 검증을 명시한다.
- 마무리 전 원래 포함 범위와 구현·검증 결과를 다시 대조한다. 남은 항목은 최종 보고에 `보완 완료 / 미구현·미검증 / 결정 필요`로 구분한다. 테스트 개수로 기획 충족 여부를 대신하거나, 미구현을 한 번 언급했다는 이유로 추적에서 없애지 않는다.
- 사용자가 좁은 수정만 요청한 경우 무관한 기능까지 구현 범위를 넓히지는 않는다. 다만 관련 기획의 알려진 누락은 기록에 유지하며, 이번 수정 완료와 기획 전체 완료를 구분한다.
- 재발 방지 사례: 바로링크의 온라인 응시 UI만 개선하면서 기획에 포함된 방문 검사 일정 조회·승인형 일정 변경을 남겨둔 일이 있었다. 승인 담당자 미정과 일정 기능 전체 미구현은 별개이며, 전체 요구 대조 없이 온라인 응시 테스트 성공만으로 마무리하지 않는다.

## 모노레포 (`apps/`)

| 앱 | 스택 | 용도 |
|----|------|------|
| `api` | FastAPI · SQLAlchemy 2.0 async · PostgreSQL 16 | 백엔드 (모듈러 모놀리스) |
| `web` | SvelteKit 5 (Runes) · TS · Tailwind | SaaS — 상담사 + 관리자 |
| `admin` | SvelteKit 5 | 플랫폼 운영자 대시보드 |
| `mobile` | Expo · NativeWind | 상담사 전용 앱 |
| `mobile-client` | Expo · NativeWind | 내담자(보호자) 앱 "마인드스코프" — 기획: `docs/client-app/내담자앱-설계.md` §0 |
| `landing` | — | 마케팅 랜딩 |

## 도메인 핵심

- 멀티테넌트 — 모든 엔티티에 `center_id`, 센터 단위로 격리.
- Client = 통합 연락처 DB(1인 1레코드). 같은 사람이 내담자이자 보호자일 수 있다(`role="both"`).
- 식별·정합 — UUID PK, soft delete(`deleted_at`), DB FK/Enum 제약 없음. 정합은 애플리케이션이 보장.

## 규칙이 사는 곳 (경로 스코프 자동 로드)

작업 중인 파일 경로에 따라 하네스가 해당 규칙을 자동으로 읽는다 — 손으로 찾아 열 필요 없다.

- `apps/api/**` → `.Codex/rules/api/*` (router·service·facade·behavior·persistence·eventing·infrastructure·schema·testing 등). 백엔드 코딩 컨벤션은 [apps/api/AGENTS.md](apps/api/AGENTS.md).
- `apps/{web,admin,mobile,mobile-client}/**` → `.Codex/rules/frontend/{web,admin,mobile,mobile-client}.md`. mobile-client 규칙에는 피그마→코드 변환 절차(타이포 variant 매핑 필수)가 있다.

각 앱 폴더 외부 파일을 고쳐야 하면, 고치지 말고 먼저 확인하고 알린다.

## 역할 (앱별 사용 주체)

| 역할 | 코드값 | web | mobile |
|------|--------|-----|--------|
| 상담사 | `counselor` | O | O (모바일 전용 주체) |
| 관리자 | `manager` | O (멤버·결제·운영) | X |
| 슈퍼관리자 | `super_admin` | O | X |

- web은 관리자+상담사 공용 — 같은 화면도 역할에 따라 섹션·액션이 달라진다.
- mobile은 상담사 전용 — 관리자 기능은 모바일로 가져오지 않는다. 두 앱 일관성은 web의 counselor 시점 기준(모바일이 따라잡는 방향).
- mobile-client는 내담자(보호자)용 — Member 없는 Account가 JWT `aud=client_app` 토큰으로 `/api/v1/app/*`만 사용(직원 표면과 상호 차단). 센터 연결은 초대 코드→`center_links`, 읽기 전용 투영(G1/G2/G3 게이트 — `.Codex/rules/api/global-module.md`).

## 개발 명령어

```bash
pnpm install                       # 워크스페이스 의존성 (apps/api는 uv sync)
pnpm dev                           # turbo 전체 (필터: dev:web / dev:admin / dev:api / dev:mobile)
pnpm db:up && pnpm db:migrate      # DB 기동 + 마이그레이션
```

```bash
# apps/api
uv run uvicorn app.main:app --reload --port 3502
uv run alembic revision --autogenerate -m "..."   # 작성 규칙: .Codex/rules/api/migration.md
uv run alembic upgrade head
uv run python -m scripts.seed.develop             # common+개발 픽스처 (기준데이터만: -m scripts.seed.common) — 규칙: .Codex/rules/api/seed.md
```

## Git 커밋 (전 앱 공통)

한글로 작성한다.

| Prefix | 용도 |
|--------|------|
| `feat:` | 새 기능 |
| `modify:` | 기존 기능 수정 |
| `fix:` | 버그 수정 |
| `style:` | 스타일 변경 |
| `refactor:` | 리팩토링 |
| `docs:` | 문서 |
| `chore:` | 설정·잡무 |

## 온톨로지 모델 (사람·기관 도메인의 AI 판독 정본)

`ontology/`가 사람·기관 도메인의 개념·바인딩 정본이다 (catalog·bindings·attributes). 기관별 어휘 프로필은 유일한 빌드 소비자인 웹이 소유한다 — `apps/web/src/lib/ontology/profiles/*.json`.

- **사람/내담자/멤버/기관 도메인 작업 전에 `ontology/`를 먼저 읽는다** — 개념↔테이블 사상, 결정 근거(A1~A7·D1~D8)가 전부 여기 있다.
- 화면의 도메인 어휘("내담자"·"보호자" 등)는 리터럴 금지 — `apps/web/src/lib/ontology/terms.ts`의 `t()/has()/josa()` 경유 (프로필 JSON을 주입받아 소비).
- 모델에 영향을 주는 변경(개념·필드·관계)은 온톨로지 갱신을 동반한다. 새 기관 유형 = `apps/web/src/lib/ontology/profiles/*.json` 추가 + explorer `public/data/profiles/` 사본 (쉼터 선례: shelter.json).
- 시각 확인: `cd tools/ontology-explorer && pnpm dev` (모델 그래프·감사·API 콘솔).
