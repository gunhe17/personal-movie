#!/bin/bash
set -euo pipefail

# ============================================
# Mindscope K8s Deploy Script
# ============================================
# Usage:
#   ./deploy.sh [dev|staging|prod] [api|web|migrate|all] [version]
#
# Examples:
#   ./deploy.sh dev all latest
#   ./deploy.sh staging api staging-a1b2c3d
#   ./deploy.sh prod api v1.2.3
#   ./deploy.sh prod web v1.2.3
#   ./deploy.sh dev migrate latest

ENV="${1:-dev}"
TARGET="${2:-all}"
VERSION="${3:-latest}"

ACCOUNT_ID="786180311928"
REGION="ap-northeast-2"
NAMESPACE="mindscope-${ENV}"

# ECR repository prefix: dev/staging share mindscope-staging, prod uses mindscope-prod
case "${ENV}" in
  prod)    ECR_PREFIX="mindscope-prod" ;;
  staging) ECR_PREFIX="mindscope-staging" ;;
  *)       ECR_PREFIX="mindscope-staging" ;;
esac
ECR_BASE="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_PREFIX}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Prod/Staging 환경에서 latest 태그 사용 방지
if [[ "${ENV}" =~ ^(prod|staging)$ && "${VERSION}" == "latest" ]]; then
  echo "ERROR: 'latest' tag is not allowed for ${ENV}. Use a version tag (e.g., v1.2.3) or commit SHA."
  exit 1
fi

echo "=== Deploying mindscope-${ENV} / ${TARGET} / ${VERSION} ==="

# ECR Login
aws ecr get-login-password --region "${REGION}" | \
  docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

deploy_api() {
  echo "--- Building API image ---"
  docker build \
    -f "${PROJECT_ROOT}/apps/api/Dockerfile.prod" \
    -t "${ECR_BASE}/api:${VERSION}" \
    "${PROJECT_ROOT}/apps/api"

  echo "--- Pushing API image ---"
  docker push "${ECR_BASE}/api:${VERSION}"

  echo "--- Deploying API to K8s ---"
  kubectl set image "deployment/mindscope-api" \
    "api=${ECR_BASE}/api:${VERSION}" \
    -n "${NAMESPACE}"

  echo "--- Waiting for rollout ---"
  kubectl rollout status "deployment/mindscope-api" -n "${NAMESPACE}" --timeout=120s
}

deploy_web() {
  echo "--- Building Web image (context: monorepo root) ---"
  docker build \
    -f "${PROJECT_ROOT}/apps/web/Dockerfile.prod" \
    -t "${ECR_BASE}/web:${VERSION}" \
    "${PROJECT_ROOT}"

  echo "--- Pushing Web image ---"
  docker push "${ECR_BASE}/web:${VERSION}"

  echo "--- Deploying Web to K8s ---"
  kubectl set image "deployment/mindscope-web" \
    "web=${ECR_BASE}/web:${VERSION}" \
    -n "${NAMESPACE}"

  echo "--- Waiting for rollout ---"
  kubectl rollout status "deployment/mindscope-web" -n "${NAMESPACE}" --timeout=120s
}

run_migration() {
  echo "--- Running DB Migration ---"
  TIMESTAMP=$(date +%s)

  sed -e "s|IMAGE_TAG|${VERSION}|g" \
      -e "s|NAMESPACE|${NAMESPACE}|g" \
      -e "s|ECR_REPO_PREFIX|${ECR_PREFIX}|g" \
      -e "s|TIMESTAMP|${TIMESTAMP}|g" \
      "${SCRIPT_DIR}/migrate-job.yaml" | kubectl apply -f -

  echo "Waiting for migration job to complete..."
  kubectl wait --for=condition=complete "job/db-migrate-${TIMESTAMP}" \
    -n "${NAMESPACE}" --timeout=120s

  echo "--- Migration logs ---"
  kubectl logs "job/db-migrate-${TIMESTAMP}" -n "${NAMESPACE}"
}

apply_infra() {
  echo "--- Applying K8s infrastructure (HPA, etc.) ---"
  if [[ -f "${SCRIPT_DIR}/${ENV}/hpa-api.yaml" ]]; then
    kubectl apply -f "${SCRIPT_DIR}/${ENV}/hpa-api.yaml"
    echo "HPA applied for API"
  fi
}

case "${TARGET}" in
  api)
    deploy_api
    ;;
  web)
    deploy_web
    ;;
  migrate)
    run_migration
    ;;
  infra)
    apply_infra
    ;;
  all)
    apply_infra
    deploy_api
    deploy_web
    ;;
  *)
    echo "Usage: $0 [dev|prod] [api|web|migrate|infra|all] [version]"
    echo ""
    echo "Arguments:"
    echo "  env      dev, staging, or prod"
    echo "  target   api, web, migrate, infra, or all"
    echo "  version  Docker image tag (e.g., latest, v1.2.3, abc1234)"
    exit 1
    ;;
esac

echo "=== Deploy complete ==="
