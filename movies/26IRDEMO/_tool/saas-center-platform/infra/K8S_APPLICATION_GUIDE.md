# Mindscope - 모놀리스 애플리케이션 K8s 적용 가이드

## 목차

1. [현재 상태 및 목표](#1-현재-상태-및-목표)
2. [프로젝트 구조](#2-프로젝트-구조)
3. [Docker 컨테이너화](#3-docker-컨테이너화)
4. [K8s 리소스 설계](#4-k8s-리소스-설계)
5. [환경 설정 관리](#5-환경-설정-관리)
6. [Ingress 라우팅 설계](#6-ingress-라우팅-설계)
7. [데이터베이스 연결](#7-데이터베이스-연결)
8. [배포 전략](#8-배포-전략)
9. [모니터링 및 로깅](#9-모니터링-및-로깅)
10. [CI/CD 파이프라인](#10-cicd-파이프라인)
11. [향후 마이크로서비스 전환 로드맵](#11-향후-마이크로서비스-전환-로드맵)

---

## 1. 현재 상태 및 목표

### 현재 상태

- **아키텍처**: 모놀리스 (Web + API가 하나의 애플리케이션)
- **프레임워크**: Python FastAPI
- **데이터베이스**: PostgreSQL (AWS RDS)

### 목표 인프라

```
Client
  │
  ├── https://app.mindscope.kr  (Web)
  ├── https://api.mindscope.kr  (API)
  └── https://admin.mindscope.kr (Admin) ← 향후 확장
  │
  ▼
┌─────────────────────────────────────┐
│        NLB (ACM SSL 종료)            │
└──────────────┬──────────────────────┘
               ▼
┌─────────────────────────────────────┐
│     NGINX Ingress Controller        │
│     (Host 기반 라우팅)               │
└──┬──────────┬──────────┬────────────┘
   ▼          ▼          ▼
 Web Svc   API Svc   Admin Svc   ← ClusterIP Services
   ▼          ▼          ▼
 Web Pod   API Pod   Admin Pod   ← Deployments
   │          │          │
   └──────────┴──────────┘
              ▼
         RDS PostgreSQL
```

### 설계 원칙

- **단계적 전환**: 모놀리스를 그대로 컨테이너화하여 먼저 배포하고, 이후 점진적으로 분리
- **환경 분리**: dev/prod 환경은 동일한 매니페스트 구조를 사용하되, 설정값만 다르게 관리
- **Stateless 설계**: 애플리케이션 Pod는 상태를 가지지 않으며, 모든 영속 데이터는 RDS에 저장

---

## 2. 프로젝트 구조

### 권장 디렉토리 구조

```
mindscope/
├── src/                          # 애플리케이션 소스 코드
│   ├── main.py
│   ├── requirements.txt
│   └── ...
├── Dockerfile                    # 컨테이너 빌드 정의
├── .dockerignore
├── k8s/                          # K8s 매니페스트
│   ├── base/                     # 공통 리소스
│   │   ├── namespace.yaml
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── ingress.yaml
│   ├── overlays/                 # 환경별 오버라이드
│   │   ├── dev/
│   │   │   ├── configmap.yaml
│   │   │   ├── secret.yaml
│   │   │   └── patches/
│   │   │       └── deployment-patch.yaml
│   │   └── prod/
│   │       ├── configmap.yaml
│   │       ├── secret.yaml
│   │       └── patches/
│   │           └── deployment-patch.yaml
│   └── nginx-ingress-values.yaml
└── scripts/
    └── deploy.sh
```

> 위 구조는 Kustomize 패턴을 따릅니다.
> 초기에는 단순하게 시작하고, 서비스가 늘어나면 Kustomize 또는 Helm Chart로 전환할 수 있습니다.

### 초기 단순 구조 (권장)

서비스가 1~2개인 현재 단계에서는 아래처럼 단순하게 시작합니다:

```
k8s/
├── namespace.yaml
├── configmap.yaml
├── secret.yaml
├── deployment.yaml
├── service.yaml
├── ingress.yaml
└── nginx-ingress-values.yaml
```

서비스별로 분리가 필요해지면 그때 Kustomize를 도입합니다.

---

## 3. Docker 컨테이너화

### Dockerfile 작성 원칙

```dockerfile
# 멀티스테이지 빌드로 이미지 크기 최소화
FROM python:3.11-slim AS builder

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.11-slim

# 보안: root가 아닌 사용자로 실행
RUN useradd --create-home appuser
USER appuser

WORKDIR /app
COPY --from=builder /root/.local /home/appuser/.local
COPY . .

ENV PATH=/home/appuser/.local/bin:$PATH

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### .dockerignore

```
__pycache__
*.pyc
.git
.env
.venv
k8s/
scripts/
*.md
.DS_Store
```

### 이미지 태깅 규칙

| 태그 | 용도 | 예시 |
|---|---|---|
| `latest` | 개발 환경 최신 | `mindscope-dev/api:latest` |
| `v{버전}` | 릴리스 버전 | `mindscope-prod/api:v1.2.3` |
| `{commit-sha}` | CI/CD 추적 | `mindscope-dev/api:abc1234` |

> **prod 환경에서는 `latest` 태그 사용을 금지합니다.**
> 반드시 버전 태그 또는 commit SHA를 사용합니다.

---

## 4. K8s 리소스 설계

### 4-1. Namespace

환경과 서비스를 분리하기 위한 네임스페이스 전략:

```yaml
# 현재 단계: 환경별 단일 네임스페이스
apiVersion: v1
kind: Namespace
metadata:
  name: mindscope-dev     # 또는 mindscope-prod
  labels:
    project: mindscope
    environment: dev
```

### 4-2. Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mindscope-api
  namespace: mindscope-dev
  labels:
    app: mindscope-api
    version: v1
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mindscope-api
  # 배포 전략: RollingUpdate로 무중단 배포
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # 한 번에 1개 Pod 추가 생성
      maxUnavailable: 0     # 기존 Pod를 먼저 죽이지 않음 → 무중단 보장
  template:
    metadata:
      labels:
        app: mindscope-api
        version: v1
    spec:
      containers:
      - name: api
        image: <ACCOUNT_ID>.dkr.ecr.ap-northeast-2.amazonaws.com/mindscope-dev/api:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 8000

        # 환경 변수: ConfigMap + Secret에서 주입
        envFrom:
        - configMapRef:
            name: mindscope-api-config
        - secretRef:
            name: mindscope-api-secret

        # 헬스 체크
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
          failureThreshold: 3

        # 리소스 제한
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "500m"
            memory: "512Mi"
```

#### 헬스 체크 설명

| Probe | 역할 | 실패 시 동작 |
|---|---|---|
| `livenessProbe` | Pod가 살아있는지 확인 | Pod 재시작 |
| `readinessProbe` | 트래픽 수신 가능한지 확인 | Service에서 제외 (재시작 안함) |

> **주의**: `livenessProbe`의 `initialDelaySeconds`는 앱 시작 시간보다 길게 설정합니다.
> DB 마이그레이션 등으로 시작이 오래 걸리면 `startupProbe`를 추가합니다.

#### 리소스 설정 가이드

| 환경 | CPU requests/limits | Memory requests/limits |
|---|---|---|
| dev | 100m / 500m | 128Mi / 512Mi |
| prod | 250m / 1000m | 256Mi / 1Gi |

> `requests`는 스케줄링 보장값, `limits`는 최대 사용 가능값입니다.
> 초기에는 넉넉하게 설정하고, 실제 사용량을 모니터링한 후 조정합니다.

### 4-3. Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mindscope-api-svc
  namespace: mindscope-dev
spec:
  selector:
    app: mindscope-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8000
  type: ClusterIP
```

> 모든 Service는 **ClusterIP** 타입으로 생성합니다.
> 외부 트래픽은 NGINX Ingress Controller가 담당합니다.

---

## 5. 환경 설정 관리

### ConfigMap (비밀이 아닌 설정)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mindscope-api-config
  namespace: mindscope-dev
data:
  ENVIRONMENT: "dev"
  DB_PORT: "5432"
  DB_NAME: "mindscope_dev"
  DB_USER: "dbadmin"
  LOG_LEVEL: "debug"            # prod에서는 "info"
  ALLOWED_ORIGINS: "https://app.mindscope.kr"
```

### Secret (민감 정보)

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mindscope-api-secret
  namespace: mindscope-dev
type: Opaque
stringData:                     # stringData는 base64 인코딩 불필요
  DB_HOST: "mindscope-dev-db.xxxxx.ap-northeast-2.rds.amazonaws.com"
  DB_PASSWORD: "실제_비밀번호"
  SECRET_KEY: "jwt-또는-앱-시크릿-키"
```

> **Secret 관리 원칙**:
> - Secret yaml 파일은 **git에 커밋하지 않습니다** (`.gitignore`에 추가)
> - 클러스터에 직접 `kubectl apply` 하거나, 향후 AWS Secrets Manager + External Secrets Operator로 전환
> - `stringData` 필드를 사용하면 base64 인코딩 없이 평문으로 작성 가능

### .gitignore 추가

```
# K8s secrets (절대 커밋 금지)
k8s/**/secret.yaml
k8s/**/secret-*.yaml
```

---

## 6. Ingress 라우팅 설계

### 단일 서비스 (현재)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mindscope-ingress
  namespace: mindscope-dev
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
spec:
  ingressClassName: nginx
  rules:
  - host: api.mindscope.kr
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: mindscope-api-svc
            port:
              number: 80
```

### 멀티 서비스 (향후)

서비스가 추가되면 하나의 Ingress에 여러 host를 정의합니다:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mindscope-ingress
  namespace: mindscope-dev
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
spec:
  ingressClassName: nginx
  rules:
  # API 서비스
  - host: api.mindscope.kr
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: mindscope-api-svc
            port:
              number: 80

  # Web 프론트엔드
  - host: app.mindscope.kr
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: mindscope-web-svc
            port:
              number: 80

  # 관리자 페이지
  - host: admin.mindscope.kr
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: mindscope-admin-svc
            port:
              number: 80
```

### 라우팅 옵션 비교

| 방식 | 예시 | 장점 | 단점 |
|---|---|---|---|
| **서브도메인 분리** | api.mindscope.kr / app.mindscope.kr | 서비스별 독립 관리 | DNS 레코드 추가 필요 |
| **Path 기반 분리** | mindscope.kr/api / mindscope.kr/app | DNS 설정 단순 | 프론트엔드 라우팅과 충돌 가능 |

> **권장**: 서브도메인 분리 방식. `*.mindscope.kr` 와일드카드 인증서를 이미 보유하고 있으므로
> 서브도메인을 추가할 때 Route 53에 CNAME 레코드만 추가하면 됩니다.
> 모든 서브도메인은 동일한 NLB를 가리키고, NGINX Ingress가 Host 헤더로 분기합니다.

### 새 서비스 추가 체크리스트

1. `deployment.yaml` 작성 (새 서비스용)
2. `service.yaml` 작성 (ClusterIP)
3. `ingress.yaml`에 host 규칙 추가
4. Route 53에 CNAME 레코드 추가 (서브도메인 → NLB 호스트네임)

---

## 7. 데이터베이스 연결

### RDS 접속 정보

Terraform 출력에서 RDS 엔드포인트를 확인합니다:

```bash
cd environments/dev
terraform output -json database_info
```

### 연결 구조

```
Pod (Private Subnet) → RDS Security Group (5432 허용) → RDS (Private Subnet)
```

- Pod와 RDS는 같은 VPC의 Private Subnet에 있으므로 직접 통신 가능
- Security Group에서 VPC CIDR 대역의 5432 포트가 허용되어 있음

### DB 마이그레이션

컨테이너 환경에서 DB 마이그레이션을 실행하는 방법:

#### 방법 1: K8s Job (권장)

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migrate
  namespace: mindscope-dev
spec:
  template:
    spec:
      containers:
      - name: migrate
        image: <ECR_URL>/mindscope-dev/api:latest
        command: ["python", "-m", "alembic", "upgrade", "head"]
        envFrom:
        - configMapRef:
            name: mindscope-api-config
        - secretRef:
            name: mindscope-api-secret
      restartPolicy: Never
  backCompletionLimit: 1
```

```bash
kubectl apply -f k8s/migrate-job.yaml
kubectl logs job/db-migrate -n mindscope-dev
```

#### 방법 2: 앱 시작 시 자동 실행

```python
# main.py의 startup 이벤트에서 실행
@app.on_event("startup")
async def startup():
    # Alembic 마이그레이션 자동 실행
    from alembic.config import Config
    from alembic import command
    alembic_cfg = Config("alembic.ini")
    command.upgrade(alembic_cfg, "head")
```

> **prod에서는 방법 1(Job)을 권장합니다.** 배포와 마이그레이션을 분리해야 롤백이 용이합니다.

---

## 8. 배포 전략

### 배포 플로우

```
코드 변경 → Docker Build → ECR Push → kubectl apply → Rolling Update
```

### 수동 배포 스크립트

```bash
#!/bin/bash
# deploy.sh
set -e

ENV=${1:-dev}
VERSION=${2:-latest}
ACCOUNT_ID="786180311928"
REGION="ap-northeast-2"
REPO="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/mindscope-${ENV}/api"

echo "=== Deploying mindscope-${ENV} (${VERSION}) ==="

# 1. ECR 로그인
aws ecr get-login-password --region ${REGION} | \
  docker login --username AWS --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com

# 2. 이미지 빌드 및 푸시
docker build -t ${REPO}:${VERSION} .
docker push ${REPO}:${VERSION}

# 3. K8s 배포 (이미지 태그 업데이트로 Rolling Update 트리거)
kubectl set image deployment/mindscope-api \
  api=${REPO}:${VERSION} \
  -n mindscope-${ENV}

# 4. 롤아웃 상태 확인
kubectl rollout status deployment/mindscope-api -n mindscope-${ENV} --timeout=120s

echo "=== Deploy complete ==="
```

### 롤백

```bash
# 직전 버전으로 롤백
kubectl rollout undo deployment/mindscope-api -n mindscope-dev

# 특정 리비전으로 롤백
kubectl rollout history deployment/mindscope-api -n mindscope-dev
kubectl rollout undo deployment/mindscope-api --to-revision=3 -n mindscope-dev
```

---

## 9. 모니터링 및 로깅

### 기본 모니터링 (kubectl)

```bash
# Pod 상태 확인
kubectl get pods -n mindscope-dev -w

# Pod 로그 확인
kubectl logs -f deployment/mindscope-api -n mindscope-dev

# 리소스 사용량 확인 (metrics-server 필요)
kubectl top pods -n mindscope-dev
```

### 로깅 원칙

- **stdout/stderr로 출력**: 파일 로그 대신 표준 출력 사용
- **JSON 포맷 권장**: 구조화된 로그로 검색 용이

```python
import logging
import json

class JSONFormatter(logging.Formatter):
    def format(self, record):
        return json.dumps({
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
        })

handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logger = logging.getLogger()
logger.addHandler(handler)
```

### 향후 도입 고려

| 도구 | 용도 | 도입 시점 |
|---|---|---|
| metrics-server | 기본 리소스 메트릭 | 즉시 |
| CloudWatch Container Insights | EKS 모니터링 | 서비스 안정화 후 |
| Prometheus + Grafana | 상세 메트릭/대시보드 | 서비스 확장 시 |
| Fluent Bit | 로그 수집 → CloudWatch | 서비스 안정화 후 |

---

## 10. CI/CD 파이프라인

### GitHub Actions 예시

```yaml
# .github/workflows/deploy.yml
name: Deploy to EKS

on:
  push:
    branches: [main]        # prod
  pull_request:
    branches: [main]        # dev (PR 머지 시)

env:
  AWS_REGION: ap-northeast-2
  ECR_REGISTRY: 786180311928.dkr.ecr.ap-northeast-2.amazonaws.com

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ${{ env.AWS_REGION }}

    - name: Login to ECR
      uses: aws-actions/amazon-ecr-login@v2

    - name: Build and push image
      run: |
        IMAGE_TAG=${GITHUB_SHA::7}
        docker build -t $ECR_REGISTRY/mindscope-dev/api:$IMAGE_TAG .
        docker push $ECR_REGISTRY/mindscope-dev/api:$IMAGE_TAG

    - name: Update kubeconfig
      run: |
        aws eks update-kubeconfig --region $AWS_REGION --name mindscope-dev-eks

    - name: Deploy to EKS
      run: |
        IMAGE_TAG=${GITHUB_SHA::7}
        kubectl set image deployment/mindscope-api \
          api=$ECR_REGISTRY/mindscope-dev/api:$IMAGE_TAG \
          -n mindscope-dev
        kubectl rollout status deployment/mindscope-api \
          -n mindscope-dev --timeout=120s
```

> CI/CD는 서비스가 안정화된 후 도입합니다.
> 초기에는 `deploy.sh` 수동 배포로 시작하는 것을 권장합니다.

---

## 11. 향후 마이크로서비스 전환 로드맵

### Phase 1: 모놀리스 컨테이너화 (현재)

```
[모놀리스 App] → 1개 Deployment, 1개 Service, 1개 Ingress Host
```

- 기존 코드를 그대로 Docker 이미지로 패키징
- K8s에 배포하여 인프라 운영 경험 축적
- 모니터링 체계 구축

### Phase 2: 프론트엔드 분리

```
[Web Frontend] → app.mindscope.kr
[API Backend]  → api.mindscope.kr   (모놀리스 유지)
```

- Web(프론트엔드)을 별도 컨테이너로 분리
- API는 모놀리스 상태 유지
- 프론트엔드와 백엔드 독립 배포 가능

### Phase 3: 도메인별 서비스 분리 (필요 시)

```
[Web Frontend]  → app.mindscope.kr
[Auth Service]  → api.mindscope.kr/auth
[User Service]  → api.mindscope.kr/users
[Core Service]  → api.mindscope.kr/core
```

- 트래픽/복잡도가 높은 도메인부터 순차 분리
- 서비스 간 통신: 클러스터 내부 DNS (예: `auth-svc.mindscope-dev.svc.cluster.local`)

### 분리 판단 기준

아래 조건 중 2개 이상 해당되면 분리를 검토합니다:

- 특정 기능의 배포 주기가 다른 기능과 크게 다름
- 특정 기능의 스케일링 요구사항이 다름 (예: API는 스케일 필요하지만 Admin은 불필요)
- 팀이 분리되어 독립적으로 개발/배포해야 함
- 특정 기능의 장애가 전체 시스템에 영향을 줌

> **핵심**: 마이크로서비스는 필요해질 때 전환합니다.
> 모놀리스가 잘 동작하고 있다면 무리하게 분리할 필요가 없습니다.
