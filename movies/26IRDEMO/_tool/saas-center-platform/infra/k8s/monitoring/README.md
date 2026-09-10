# MindScope 모니터링 배포 가이드

기존 Grafana + Loki 환경에 Prometheus를 추가하고, Admin 콘솔에서 iframe으로 대시보드를 임베드하는 가이드.

## 현재 환경

| 컴포넌트 | 상태 | 용도 |
|----------|------|------|
| Grafana 11.1.3 | 설치됨 | 대시보드 시각화 |
| Loki 3.0 | 설치됨 | 로그 수집/검색 |
| Promtail 3.0 | 설치됨 | 로그 전송 |
| Prometheus | **신규 설치** | 메트릭 수집 (CPU, 메모리, 요청 수 등) |

## 전제 조건

- EKS 클러스터에 여유 Pod 슬롯 (t3.small 기준 노드당 11개)
- Helm 3.x, kubectl 설정 완료

---

## 배포

```bash
cd infra/k8s/monitoring

# 실행 (비밀번호 입력 프롬프트)
./deploy-monitoring.sh

# 또는 환경변수로 전달
GRAFANA_PASSWORD="MindScope2024!Grafana" ./deploy-monitoring.sh
```

스크립트가 수행하는 작업:
1. **Grafana 업그레이드**: iframe 임베드 설정 + Prometheus 데이터소스 추가
2. **Prometheus 스택 설치**: kube-prometheus-stack (Grafana 없이)

---

## 보안 설정

| 항목 | 값 | 설명 |
|------|-----|------|
| allow_embedding | true | iframe 허용 |
| auth.anonymous | Viewer | 로그인 없이 읽기 전용 |
| csrf_trusted_origins | console.mindscope.kr | 허용 도메인 |
| cookie_samesite | none | cross-site iframe |
| cookie_secure | true | HTTPS only |

---

## 대시보드 UID 설정

Grafana에서 대시보드를 만든 후, Admin 모니터링 페이지에 연결:

`apps/admin/src/routes/(protected)/monitoring/+page.svelte`:

```typescript
const dashboards: Dashboard[] = [
  { id: 'cluster', label: '클러스터 개요', uid: 'grafana-dashboard-uid' },
  { id: 'api', label: 'API 서버', uid: 'api-dashboard-uid' },
  { id: 'nodes', label: '노드 리소스', uid: 'node-dashboard-uid' }
]
```

UID 확인: Grafana 대시보드 URL의 `/d/{UID}/` 부분

---

## 파일 구조

```
infra/k8s/monitoring/
├── README.md                # 이 문서
├── grafana-values.yaml      # Grafana 업그레이드 (iframe + 데이터소스)
├── prometheus-values.yaml   # Prometheus 스택 (Grafana 없이)
└── deploy-monitoring.sh     # 통합 배포 스크립트
```

## 관련 변경 파일

```
infra/k8s/dev/configmap-admin.yaml   # GRAFANA_URL 추가
infra/k8s/prod/configmap-admin.yaml  # GRAFANA_URL 추가

apps/admin/src/lib/assets/ChartIcon.svelte                    # 아이콘
apps/admin/src/lib/components/AdminSidebar.svelte              # 메뉴 추가
apps/admin/src/routes/(protected)/monitoring/+page.server.ts   # 서버 로드
apps/admin/src/routes/(protected)/monitoring/+page.svelte      # 모니터링 페이지
```
