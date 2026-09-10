#!/bin/bash
# ==============================================
# PostgreSQL 초기화: 브랜치별 database 생성
# docker-entrypoint-initdb.d에서 자동 실행
# ==============================================

set -e

DATABASES=("saas_main" "saas_agent" "saas_platform_admin" "saas_notification_system")

for db in "${DATABASES[@]}"; do
  echo "Creating database: $db"
  psql -v ON_ERROR_STOP=1 --username "mindscope" <<-EOSQL
    SELECT 'CREATE DATABASE $db OWNER mindscope'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')\gexec
EOSQL
done

echo "All databases initialized."
