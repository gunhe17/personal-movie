---
paths:
  - "apps/api/scripts/seed/**"
---

# 시드 (scripts/seed)

개발/테스트용 Global 데이터 생성기. 두 갈래로 나뉜다.

| 갈래 | 폴더 | 내용 | 실행 |
|---|---|---|---|
| common | `scripts/seed/common/` | 운영 기준·카탈로그 데이터 | `python -m scripts.seed.common` |
| develop | `scripts/seed/develop/` | 로컬/테스트 픽스처(가짜 계정·센터·내담자) | `python -m scripts.seed.develop` |

`seed.develop` 은 `seed.common` 을 먼저 돌린 뒤 픽스처를 얹는다.

## 파일 네이밍 (필수)

- **파일명 = 데이터가 생성되는 모듈명.** 어디에 `session.add()` 하는가로 결정한다
  (조회만 하는 모듈은 기준이 아님). 예: `Voucher` 생성 → `voucher.py`, `GlobalDocument` 생성 → `document.py`.
- **한 모듈에 시드가 여러 개면 서브모듈명으로 구분.** 예: platform_admin → `admin_account.py`(AdminAccount), `qna.py`(FAQ).
- 구조는 **flat**(common/ 직하). 데이터셋 별칭(`local_service_manual`, `ahdong_emotion` 등) 금지 — 모듈/서브모듈명만.
- 예외: `develop/dev_*` 류 횡단 픽스처는 단일 모듈이 아니므로 모듈명 규칙 밖.

## 작성 규칙

- **멱등.** code/email/name 등 자연키로 중복 체크 → 존재하면 스킵, 누락분만 add.
- **데이터는 파이썬 인라인.** 사이드카 `*.json`/`Path(__file__)` 로드 금지. 캡처가 큰 경우 모듈 상수(`_CAPTURE = {...}`)로 둔다.
- **공유 헬퍼는 패키지 루트.** `develop/__init__.py` 의 `gen_id`/`gen_code`/`utc_now`/`DEFAULT_PASSWORD` 를 step 들이 import.
- **각 seed 모듈은 `async def main()` 제공**(개별 실행 진입점). 오케스트레이션은 패키지 `__init__.py` 의 `main()` + `__main__.py`.
- **develop 은 강결합.** step 함수들이 한 트랜잭션에서 컨텍스트(center_id·accounts·role_map·client_map…)를 주고받는다. 독립 실행 가정 금지 — `develop/__init__.py:seed_fixtures()` 가 순서대로 호출하며, 새 step 은 이 흐름에 끼워 넣는다.
- common 의존 순서: `document → voucher`(카탈로그가 원본 문서를 참조).

## README 동기화 [INV-SEED-README]

`scripts/seed/README.md` 는 **각 seed 가 만드는 데이터를 필드 레벨 표로 미러링**한다(코드가 정본, README 는 한눈 인덱스). 시드 데이터/구조를 바꾸면 **반드시 같은 PR 에서 README 표도 고친다.** (개수·필드·이름이 코드와 어긋나면 안 됨 — 예: 관계 쌍 수, assessment 종 수.)

- seed 파일 추가/삭제 → README 의 해당 섹션 행 추가/삭제
- 데이터 값 변경(금액·대상·계정 등) → 해당 표 셀 갱신
- PostToolUse hook 이 seed 수정 시 이 동기화를 리마인드한다.

## 민감 데이터

- `common/admin_account.py` 비밀번호 **하드코딩** — 실제 운영 적용 시 교체 전제.
- develop 계정은 전부 `@test.com` / `test1234` (운영 유입 금지).
