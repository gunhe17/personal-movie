---
paths:
  - "apps/api/app/modules/**/models.py"
  - "apps/api/migrations/**"
---

# 스키마 출처 & 마이그레이션

스키마 정본은 **모델**(`metadata.create_all`)이다. alembic 은 *기존 배포 DB* 증분 패치용 —
빈 DB에서 `alembic upgrade head` 는 root 마이그(`07cf23178383`, schedules 가 이미 있다고
가정)에서 실패한다. 둘은 평행 트랙이다.

| 상황 | 방법 |
|---|---|
| fresh DB | `init_db`/`infra/dev/init-schema.py`: create_all + `alembic stamp head` (alembic 아님) |
| 기존 prod DB 변경 | alembic 증분 마이그레이션 |

배포(`infra/k8s/migrate-job.yaml`)는 `alembic upgrade head` 를 자동 실행한다 — 마이그레이션은
기존 DB 에서 항상 적용 가능해야 한다(히스토리 재작성·스쿼시는 이 자동배포를 깨므로 금지).

## 드리프트 불변식 [INV-MIG]

모델 컬럼을 추가/삭제하면 **같은 변경에 대응 alembic 마이그레이션을 포함**한다.

이유: 테스트·시드·fresh DB 는 모델(create_all)로 스키마를 만들므로 누락을 못 잡지만,
기존 prod DB 는 alembic 만 적용되어 그 컬럼이 없다 → 배포 후 깨진다.

- 마이그 생성: `cd apps/api && uv run alembic revision --autogenerate -m '<설명>'`
- 가드: `uv run python scripts/check_migration_drift.py [base_ref|--staged]`
  (모델 컬럼 변경 + 마이그 누락 시 exit 1. pre-commit 훅으로도 자동 실행.)

## autogenerate 산출물은 초안이다

그대로 커밋하지 않는다 — 두 곳을 항상 손본다. 레퍼런스 `aed7fdf3d8d7`.

| 산출물 | 고쳐 쓸 것 | 이유 |
|---|---|---|
| 같은 테이블의 `add_column` + `drop_column` 쌍 | `op.alter_column(t, old, new_column_name=new)` | 값을 이어받는 컬럼 = rename. drop+add는 데이터 유실 |
| 모든 `add_column`·`drop_column` | `_column_exists` 가드로 감싼다 | 평행 트랙이라 create_all로 만들어진 DB엔 이미 그 컬럼이 있다 |

- 자동 생성분을 다시 뽑으면 손질이 덮인다 — 재생성 후 위 둘을 다시 확인한다(실측 2026-08-14: vouchers·voucher_extractions 두 건이 이 경로로 가드를 잃었다).
- up → down → up 왕복 + 재적용 후 `alembic check`(드리프트 0)까지 확인하고 커밋한다.
