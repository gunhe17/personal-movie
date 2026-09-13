---
name: artlist
description: Artlist MCP를 붙이고 인증 상태를 판정한다. "아트리스트 연결해줘", "MCP 인증 상태", "artlist 도구가 안 보인다", "생성이 401이다" 요청에 쓴다. 연결·인증·진단까지가 이 스킬이고, 생성 자체는 붙은 뒤 대화에서 artlist 도구를 직접 부른다.
---

# artlist — Artlist MCP 붙이기

Artlist의 생성 도구(이미지 · 영상 · 음악 · 보이스오버)와 에셋 라이브러리를 대화 안으로 들인다.
**이 스킬이 하는 일은 배선과 진단까지다.** 붙고 나면 생성은 대화에서 artlist 도구를 직접 부르는 것이지,
이 스킬을 거치지 않는다.

러너 하나: `scripts/artlist.mjs`. **설치할 것이 없다** — Node와 `claude` CLI만 쓴다.

```bash
cd .claude/skills/artlist/scripts

node artlist.mjs status       # 등록·인증·엔드포인트를 한 번에 + 다음에 칠 명령
node artlist.mjs connect      # 서버 등록 (멱등) [--scope project|local|user]
node artlist.mjs auth         # 인증 절차 안내
node artlist.mjs verify       # 인증 판정 — 종료 코드로 답한다
node artlist.mjs disconnect   # 등록 해제 [--scope …]
node artlist.mjs selftest     # 네트워크·인증 없이 도는 자체 검사
```

`verify`의 종료 코드: **0** 인증됨 · **2** 인증 필요 · **3** 미등록 · **4** 연결 실패 · **1** 판정 불가.
스크립트에서 조건으로 쓰라고 나눠 놓았다.

## 주소를 틀리지 말 것

| | |
|---|---|
| **MCP 서버** | `https://mcp.artlist.io/mcp` ← 이것만 서버다 |
| 가입 안내 랜딩 | `https://artlist.io/mcp` — 사람이 읽는 페이지다. Cloudflare가 막아 도구로는 안 열린다 |
| OAuth 발급처 | `https://auth.artlist.io/` (Auth0 · PKCE · 동적 클라이언트 등록) |

둘을 섞으면 등록은 되는데 호출이 전부 깨진다. `selftest`가 이 혼동을 한 줄로 막는다.

## 인증은 사람이 한다 — 스크립트가 대신 못 한다

OAuth는 브라우저를 연다. **비대화형 세션(서브에이전트 · 백그라운드 · print 모드)에서는 끝나지 않는다.**
러너가 `auth`에서 절차만 찍고 종료 코드 2로 물러나는 이유다.

1. **`.mcp.json` 서버를 먼저 승인한다** — 이 폴더에서 `claude`를 **새로 띄우면** 승인을 묻는다.
   승인 전에는 `⏸ Pending approval`이라 `/mcp`에 뜨지도 않는다 (실측)
2. 대화창에 `/mcp`
3. 목록에서 `artlist` → Authenticate
4. 브라우저에서 Artlist 계정 로그인 · 권한 승인
5. 돌아와서 `node artlist.mjs verify`

`status`가 이 두 단계를 구분해 준다 — **승인 대기**와 **인증 필요**는 다른 상태이고 푸는 법도 다르다.

## 자격증명을 만지지 않는다

**러너는 토큰을 읽지도 쓰지도 않는다.** 토큰은 Claude Code가 보관하고, 이 저장소에는 어떤 자격증명도 남지 않는다
(촬영 규칙 7과 같은 선이다). 인증 여부는 다음 둘로만 판정한다.

| 재료 | 무엇을 읽나 |
|---|---|
| `claude mcp list` | `<이름>: <url> - <상태>` 줄의 상태(`✓ Connected` · `! Needs authentication` · `✗ Failed` · `⏸ Pending`) |
| 엔드포인트 비인증 응답 | 리소스 메타데이터 200(서버 생존 · 발급처 광고) · `/mcp` initialize가 **401 + `WWW-Authenticate: Bearer`** 를 주는지 |

**401은 고장이 아니라 정상이다.** 인증이 필요한 서버라는 뜻이고, `status`는 그걸 초록으로 찍는다.

## 스코프를 project로 두는 이유

기본 `--scope project` → 저장소 루트 `.mcp.json`에 적힌다.
이 저장소는 **여러 세션이 번갈아 붙는다**(HANDOFF 문서가 그 기록이다). `local`에 두면 그 세션에만 있고
다음 세션은 배선이 없는 채로 시작한다. `.mcp.json`에는 주소만 들어가고 **토큰은 안 들어가므로** 공유해도 된다.

`.mcp.json`의 서버는 세션에서 한 번 **승인**을 거친다. `status`가 `⏸ 승인 대기`로 잡아 준다.

## 계정·크레딧

AI 크레딧이 있는 **유료 Artlist 계정**이어야 한다. 별도 과금은 없고 생성이 크레딧을 깎는다.
무제한 생성 요금제라도 **MCP 경로에는 무제한이 적용되지 않는다.** 크레딧이 마르면 도구는 붙어 있는데 생성만 실패한다 —
`verify`는 0을 주고 생성이 거절되는 모양이므로, 401(인증)과 크레딧 소진을 증상으로 구분한다.

## 함정

- **`artlist.io/mcp`를 서버 주소로 넣지 말 것.** 사람이 읽는 랜딩 페이지다
- **`claude mcp list`는 헬스체크를 돈다** — 서버가 여럿이면 수 초 걸린다. 타임아웃 90초를 줬다
- **비대화형 세션에서 `auth`를 기대하지 말 것.** 종료 코드 2가 정상 반환이다
- **`disconnect`는 등록만 지운다** — 저장된 토큰은 Claude Code가 따로 들고 있다. 계정 연결을 끊으려면 Artlist 쪽에서 권한을 회수한다
- **스코프를 섞지 말 것.** `local`에 등록해 놓고 `--scope project`로 지우면 "없다"가 뜬다. `status`가 어느 쪽인지 알려준다
- **`.mcp.json`에 적혔다고 붙은 게 아니다** — 승인 전에는 `claude mcp list`가 `⏸ Pending approval`로만 찍고 도구는 안 온다. 등록 직후 그 세션에서는 못 쓴다
- **project 스코프 줄은 목록 모양이 다르다** — `이름: url (HTTP) - 상태`로 전송 표시가 끼어든다. 이걸 선택항으로 안 두면 파서가 그 줄을 통째로 놓친다(첫 판에서 실제로 놓쳤다). `selftest`가 그 줄을 붙들고 있다

## 이 스킬이 하지 않는 것

**서비스 화면 촬영과 무관하다.** 마인드스코프 화면은 `capture-service`만 찍는다(`.claude/rules/capture.md` 규칙 1).
여기서 만든 생성물은 편집 소재이지 촬영본이 아니다. `raw/`에 넣지 않는다.
