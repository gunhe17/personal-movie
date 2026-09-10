#!/usr/bin/env python
"""모델 ↔ 마이그레이션 드리프트 가드.

배경: 이 프로젝트는 스키마를 **모델**(`metadata.create_all`, init_db)로 만든다.
alembic 은 *기존 배포 DB* 증분 패치용이다(빈 DB에서 `upgrade head` 는 root 마이그가
schedules 를 가정하므로 실패한다). 따라서:

  모델에 컬럼을 추가/삭제하고 대응 마이그레이션을 안 쓰면
  → dev/test/fresh(create_all)는 통과하지만, 기존 prod DB(alembic만 적용)는 깨진다.
  → 테스트는 모델로 스키마를 만들기 때문에 이 누락을 절대 못 잡는다.

이 가드는 그 누락을 git diff 로 잡는다:
  - 변경된 app/modules/**/models.py 에서 컬럼 수준 변화 감지
    (`mapped_column(` / `Column(` / `__tablename__`)
  - 같은 diff 에 migrations/versions/ 새 파일이 없으면 → 경고 + exit 1

사용:
  uv run python scripts/check_migration_drift.py              # 워킹트리(+staged) vs HEAD
  uv run python scripts/check_migration_drift.py --staged     # 스테이지된 변경만 (pre-commit)
  uv run python scripts/check_migration_drift.py origin/main  # base 브랜치 대비 (CI/PR)
"""
from __future__ import annotations

import subprocess
import sys

COLUMN_MARKERS = ("mapped_column(", "__tablename__", "Column(")


_REPO_ROOT = subprocess.run(
    ["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True
).stdout.strip()


def _git(*args: str) -> str:
    # repo 루트에서 실행 — name-only(루트 상대경로)와 pathspec 기준을 일치시킨다.
    return subprocess.run(
        ["git", *args], capture_output=True, text=True, cwd=_REPO_ROOT
    ).stdout


def main() -> int:
    arg = sys.argv[1] if len(sys.argv) > 1 else "HEAD"
    # --staged: 스테이지된 변경만(`git diff --cached`). 그 외: base ref 대비.
    diff_spec = ["--cached"] if arg == "--staged" else [arg]

    # 변경된 파일 목록 (pathspec glob 의존 없이 파이썬에서 필터)
    changed = _git("diff", "--name-only", *diff_spec).splitlines()
    model_files = [
        f for f in changed
        if "app/modules/" in f and f.endswith("/models.py")
    ]

    # 1) 컬럼 수준 변화가 있는 models.py 모으기 (파일별 diff 스캔)
    changed_models: list[str] = []
    for f in model_files:
        patch = _git("diff", *diff_spec, "--", f)
        for line in patch.splitlines():
            if line and line[0] in "+-" and not line.startswith(("+++", "---")):
                if any(m in line[1:] for m in COLUMN_MARKERS):
                    changed_models.append(f)
                    break

    if not changed_models:
        print("✅ 컬럼 수준 모델 변경 없음 — 마이그레이션 드리프트 가드 통과")
        return 0

    # 2) 같은 변경에 새 마이그레이션 파일이 추가됐나
    #    - 커밋/스테이지: git diff --name-status 의 A 라인 (CI: base=브랜치)
    #    - 워킹트리 untracked: git status --porcelain 의 ?? / A 라인 (pre-commit)
    name_status = _git(
        "diff", "--name-status", *diff_spec, "--", "apps/api/migrations/versions/"
    )
    porcelain = _git("status", "--porcelain", "--", "apps/api/migrations/versions/")
    added_migration = any(
        ln.startswith("A") and ln.rstrip().endswith(".py")
        for ln in name_status.splitlines()
    ) or any(
        ln[:2].strip() in ("A", "??") and ln.rstrip().endswith(".py")
        for ln in porcelain.splitlines()
    )

    if added_migration:
        print("✅ 모델 컬럼 변경 + 새 마이그레이션 동반 — 통과")
        return 0

    # 3) 드리프트 — 경고
    print("🔴 마이그레이션 드리프트 의심", file=sys.stderr)
    print(file=sys.stderr)
    print("아래 모델의 컬럼이 바뀌었는데 새 alembic 마이그레이션이 없습니다:", file=sys.stderr)
    for f in sorted(set(changed_models)):
        print(f"  - {f}", file=sys.stderr)
    print(file=sys.stderr)
    print("dev/test(create_all)는 통과하지만 기존 prod DB는 배포 후 깨질 수 있습니다.", file=sys.stderr)
    print("대응 마이그레이션을 추가하세요:", file=sys.stderr)
    print("  cd apps/api && uv run alembic revision --autogenerate -m '<설명>'", file=sys.stderr)
    print("(컬럼 변경이 아니어서 마이그레이션이 불필요하면 이 경고는 무시 가능)", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
