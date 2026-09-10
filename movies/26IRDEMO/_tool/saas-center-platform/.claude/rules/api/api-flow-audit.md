---
paths:
  - "API-FLOW.csv"
  - "REFACTORED-API-FLOW.csv"
---

# API 흐름 맵 · 크로스모듈 충돌 감사 (절차)

두 산출물을 만들거나 갱신할 때 따른다. 판정 기준(금지 신호·신설/이동/재사용)은 [cross-module-write.md](cross-module-write.md)에 정의 — 여기선 인용만 한다.

| 산출물 | 담는 것 |
|---|---|
| `API-FLOW.csv` | API 1개 = 1행. 레이어별 함수 + 흐름, 마지막 열 `Entity 충돌` |
| `REFACTORED-API-FLOW.csv` | 충돌 행만. owning 모듈 facade + application handler 목표 + 신설/이동/재사용 상태 |

## 1. 레이어 추적 — 행 채우기

- 각 `router.py`의 `@router.{get,post,put,patch,delete}` 1개 = 1행. 서브라우터 포함, 비표준 선언(`add_api_route`·별도 `APIRouter`)도 누락 없이.
- 함수 셀 = `fn() — modules/.../file.py:line`. **실제 파일을 열어 확인** — 추론 금지(라벨/라인 모두).
- Handler 위치로 경로 구분: 모듈 내부 = `modules/<m>/.../handlers/`, 크로스모듈 = `application/handlers/<m>/`.
- 레이어 부재는 `—` + 한 줄 사유(예: `— (Facade 생략, Handler→Service 직접)`).
- CSV: comma 포함 셀은 따옴표, 작성 후 `python csv`로 전 행 열 수 일치 확인.

## 2. Entity 충돌 판정 (`API-FLOW.csv` 마지막 열)

엔티티를 만지는 `modules/` 코드의 모듈 ≠ 엔티티 소유 모듈이면 충돌. 정밀도 위해 둘만 본다:

| 기준 | 충돌 |
|---|---|
| Entity를 영속화하는 주체(Repository, 없으면 Service, 없으면 라우터 인라인)의 모듈 ≠ Entity 모듈 | 표기 |
| Service 파일이 타 모듈 `models`를 직접 import | 표기 |

- 금지 신호 전체 목록은 [cross-module-write.md](cross-module-write.md) §3.
- 충돌 없으면 비운다.

## 3. 인정 예외 제외 (충돌에서 비움)

쓰기만 충돌로 남긴다 — 읽기 예외는 [ARCHITECTURE.md](../../../apps/api/app/modules/ARCHITECTURE.md) EX-2·EX-10 / [persistence-repository.md](persistence-repository.md) §6.3.

| 대상 | 처리 |
|---|---|
| `support` 전체 | 비움 (EX-10 — FAQ/Inquiry read+접수) |
| `platform_admin` READ(GET) | 비움 (EX-2/§6.3 read-model JOIN) |
| `subscription`·`llm` 전 센터 집계 read(`*_all_centers` 등) | 비움 (§6.3) |
| `notification` 수신자 해석(recipient_resolver/helpers) facade→facade read | 비움 (EX-12) |
| `platform_admin` WRITE(타 모듈 엔티티 mutate/create) | 남김 (read-model 예외는 쓰기에 확장 안 됨) |

## 4. 해소 목표 매핑 (`REFACTORED-API-FLOW.csv`)

- 목표 형태: `Router(유지) → application handler → owning Facade.write_*() → owning Service → owning Repository → owning Entity`.
- 신설/이동/재사용은 [cross-module-write.md](cross-module-write.md) §2 결정표로 가른다.
- **라벨은 owning 모듈에 실제로 있는지 코드 확인 후** 단다(facade 파일·service·repository 존재를 grep/열람). 추론 라벨 금지 — read service만 있으면 write service 신설, 이미 있으면 재사용(중복 신설 금지).
