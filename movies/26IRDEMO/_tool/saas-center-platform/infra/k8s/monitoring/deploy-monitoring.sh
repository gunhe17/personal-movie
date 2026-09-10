#!/bin/bash
# ============================================================
# MindScope 모니터링 배포 스크립트
#
# 1단계: 기존 Grafana 업그레이드 (iframe 임베드 + Prometheus 데이터소스)
# 2단계: Prometheus 스택 설치 (Grafana 없이)
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NAMESPACE="monitoring"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── 사전 검증 ──
command -v helm >/dev/null 2>&1 || err "helm이 설치되어 있지 않습니다"
command -v kubectl >/dev/null 2>&1 || err "kubectl이 설치되어 있지 않습니다"

CONTEXT=$(kubectl config current-context 2>/dev/null || echo "none")
log "K8s 컨텍스트: ${CONTEXT}"

# ── Grafana 비밀번호 ──
if [ -z "${GRAFANA_PASSWORD:-}" ]; then
  echo -n "Grafana 관리자 비밀번호: "
  read -rs GRAFANA_PASSWORD
  echo
fi
[ -z "$GRAFANA_PASSWORD" ] && err "비밀번호가 비어있습니다"

# ── Helm 리포 추가 ──
log "Helm 리포지토리 업데이트 중..."
helm repo add grafana https://grafana.github.io/helm-charts 2>/dev/null || true
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts 2>/dev/null || true
helm repo update

# ============================================================
# 1단계: 기존 Grafana 업그레이드
# ============================================================
log ""
log "━━━ 1단계: Grafana 업그레이드 (iframe + Prometheus 데이터소스) ━━━"

helm status grafana -n "${NAMESPACE}" >/dev/null 2>&1 || \
  err "기존 Grafana release를 찾을 수 없습니다"

helm upgrade grafana grafana/grafana \
  --namespace "${NAMESPACE}" \
  --values "${SCRIPT_DIR}/grafana-values.yaml" \
  --set adminPassword="${GRAFANA_PASSWORD}" \
  --timeout 5m \
  --wait

log "Grafana 업그레이드 완료"

# ============================================================
# 2단계: Prometheus 스택 설치
# ============================================================
log ""
log "━━━ 2단계: Prometheus 스택 설치 ━━━"

# 이전 실패한 release 정리
if helm status monitoring -n "${NAMESPACE}" >/dev/null 2>&1; then
  warn "기존 'monitoring' release 발견 → 삭제 후 재설치"
  helm uninstall monitoring -n "${NAMESPACE}" --wait 2>/dev/null || true
  sleep 5
fi

helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  --namespace "${NAMESPACE}" \
  --values "${SCRIPT_DIR}/prometheus-values.yaml" \
  --timeout 10m \
  --wait

log "Prometheus 스택 설치 완료"

# ============================================================
# 확인
# ============================================================
log ""
log "Pod 상태 확인..."
kubectl -n "${NAMESPACE}" get pods

echo ""
echo "============================================================"
log "모니터링 배포 완료!"
echo "============================================================"
echo ""
echo "  Grafana:     https://monitoring.mindscope.kr"
echo "  계정:        admin / (입력한 비밀번호)"
echo ""
echo "  데이터소스:"
echo "    - Loki (로그)        → 기존 유지"
echo "    - Prometheus (메트릭) → 신규 추가"
echo ""
echo "  Grafana 설정:"
echo "    - allow_embedding: true"
echo "    - anonymous: Viewer (읽기 전용)"
echo "    - csrf_trusted_origins: console.mindscope.kr"
echo ""
echo "  Admin 콘솔: https://console.mindscope.kr/monitoring"
echo "============================================================"
