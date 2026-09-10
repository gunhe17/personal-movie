---
name: run-web
description: SaaS 웹앱(apps/web, 상담사·관리자용 SvelteKit)을 실제로 띄우고 화면을 확인한다. "웹 실행", "웹 띄워", "화면 확인", "브라우저로 보여줘", 웹 UI 변경을 눈으로 검증해야 할 때. 로그인·센터 선택·특정 화면 도달까지의 절차와 포트·계정·의존성을 담는다.
---

# apps/web 실행 (상담사·관리자 SaaS)

웹 UI 변경을 **화면으로** 확인할 때. typecheck(`svelte-check`)로는 레이아웃·간격·스크롤·모달을 못 본다 — 실제로 띄워야 한다.

## 사전 조건 (먼저 확인, 없으면 기동)

웹은 API·DB에 붙는다. 셋 다 떠 있어야 화면이 정상 렌더된다.

```bash
# 1) DB (postgres+redis) — docker
docker ps --format '{{.Names}} {{.Status}}' | grep -E "saas-postgres|saas-redis" \
  || (cd /Users/insighter/project/imomtae/saas-center-platform && pnpm db:up)

# 2) API (포트 3502)
curl -s -m2 -o /dev/null -w "API: %{http_code}\n" http://localhost:3502/api/v1/app/vouchers \
  || echo "API 미기동 → 아래로 띄운다"
```

API가 죽어 있으면 (백그라운드):
```bash
cd /Users/insighter/project/imomtae/saas-center-platform
(pnpm dev:api > /tmp/api-dev.log 2>&1 &)
# 준비 대기 — /docs 아니라 실제 앱 라우트로 확인(기동 레이스 방지)
until curl -s -m1 -o /dev/null http://localhost:3502/api/v1/app/vouchers 2>/dev/null; do sleep 1; done
```

> ⚠️ API 프로세스 정리는 `pkill -f uvicorn`이 아니라 포트로: `kill -9 $(lsof -ti :3502)`.
> uvicorn은 `multiprocessing.spawn` 자식이 고아로 남아 포트를 계속 쥐는 사례가 있다.

## 웹 기동 (포트 3503)

```bash
cd /Users/insighter/project/imomtae/saas-center-platform/apps/web
[ -d node_modules ] || (cd ../.. && pnpm install)

# 이미 떠 있으면 재사용
lsof -ti :3503 >/dev/null 2>&1 && echo "웹 이미 실행중" || (npm run dev > /tmp/web-dev.log 2>&1 &)

# 준비 대기 (vite dev, 첫 기동은 20~40s)
for i in $(seq 1 60); do
  sleep 1
  [ "$(curl -s -m2 -o /dev/null -w '%{http_code}' http://localhost:3503/login)" = "200" ] \
    && { echo "✅ 웹 준비 완료 http://localhost:3503"; break; }
done
```

- **포트 = 3503** (vite.config.ts `server.port`, 5173 아님)
- 비로그인으로 보호 라우트 접근 시 `302 → /login?redirectTo=...` (정상)
- 정리: `kill -9 $(lsof -ti :3503)`

## 로그인 (직원 계정)

dev DB의 직원 계정 — 비밀번호는 시드 기준(보통 계정과 동일 관례). 확인 필요 시 아래 계정으로 시도:

| 이메일 | 용도 |
|---|---|
| `test@test.com` | 일반 직원 |
| `counselor@test.com` | 상담사 역할 |

> 비밀번호를 모르면 사용자에게 물어본다(스킬에 평문 저장 안 함). 로그인 후 **센터 선택**이 필요하면 그 화면에서 아무 센터나 고른다(`centerStore`가 localStorage에 저장 → 이후 라우트가 그 센터 스코프).

## 화면까지 도달 (브라우저 드라이빙)

`chromium-cli`가 없으면 설치가 필요하다(이 환경엔 미설치). 사용자에게 **직접 브라우저로 열어달라고** 요청하는 게 가장 빠르다:

```
http://localhost:3503/login  →  로그인  →  센터 선택  →  대상 화면
```

주요 화면 경로:
- 내담자 목록: `/clients`
- 내담자 상세(좌측 프로필·앱 연결 카드): `/clients/<clientId>`
- 상담 현황: `/counseling/status` · 검사 현황: `/assessment/status`

특정 내담자 상세를 봐야 하면 clientId를 DB에서 뽑아 URL로 바로 진입:
```bash
cd /Users/insighter/project/imomtae/saas-center-platform/apps/api
uv run python -c "
import asyncio
from app.infrastructure.persistence.database import AsyncSessionLocal
from sqlalchemy import text
async def main():
    async with AsyncSessionLocal() as s:
        # 예: 보호자(앱 연결 카드가 뜨는 role) 상세
        r=(await s.execute(text(\"SELECT id,name,role FROM clients WHERE role IN ('guardian','both') AND deleted_at IS NULL LIMIT 3\"))).all()
        for x in r: print(f'  /clients/{x[0]}  ({x[1]}·{x[2]})')
asyncio.run(main())
" 2>&1 | grep "/clients/"
```

## 드라이빙까지 자동화하려면 (선택)

`chromium-cli` 설치 후 `examples/playwright.md` 패턴으로 로그인→네비→스크린샷 자동화 가능. 이 환경엔 아직 없으니, 지금은 **사람이 브라우저로 확인 → 결과 공유**가 현실적이다.

## 함정

- 포트는 **3503**(웹)·**3502**(API) — 헷갈리지 말 것.
- API가 죽어 있으면 웹은 뜨지만 데이터가 안 나온다(로그인부터 실패). 사전 조건 먼저.
- vite dev 첫 기동은 느리다(의존성 최적화). 20s 넘어도 정상 — 60s까지 대기.
- 웹 변경만 했으면 vite HMR로 즉시 반영(재기동 불필요). API·스키마를 건드렸으면 API 재기동.
