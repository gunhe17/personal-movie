#!/usr/bin/env bash
# s08 되돌리기 + 준비 — 한 번에. (되돌리기 SQL은 setup 파일 주석에만 있었다)
# 시드 기준선은 care_memos 0행 · kind='memo' 엔트리 0행이다. 촬영 중 만들어진 메모·핀을 통째로 지우고
# setup을 다시 돌려 "김원장이 40분 전에 남긴 메모" 한 건만 있는 자리로 되돌린다.
set -euo pipefail
docker exec saas-postgres psql -U imomtae -d imomtae -q -c \
  "delete from care_board_entries where source_table='care_memos'; delete from care_memos;"
docker exec -i saas-postgres psql -U imomtae -d imomtae -qf- < "$(dirname "$0")/s08-setup.sql"
docker exec saas-postgres psql -U imomtae -d imomtae -t -c \
  "select '케어보드 메모 '||count(*)||'건' from care_board_entries where source_table='care_memos';"
