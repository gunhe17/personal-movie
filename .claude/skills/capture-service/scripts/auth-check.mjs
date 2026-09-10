/**
 * 로그인 상태가 **살아 있는지** 촬영 전에 한 번 묻는다.
 *
 * 파일이 있다는 것과 유효하다는 것은 다르다. 토큰은 만료돼도 `_state/*.json` 안에
 * 그대로 남아 있고, 쿠키의 `expires`는 다음날까지 멀쩡해 보인다 — 그 값은 쿠키의
 * 수명이지 토큰의 수명이 아니다.
 *
 * ⚠️ **증상이 401로 오지 않는다.** 화면은 열리고 셀렉터만 영영 안 나타나 30초 뒤
 * 타임아웃으로 죽는다. 2026-09-10 s02에서 이걸로 테이크 둘(t06·t07)을 태웠다.
 * 그래서 여기서 먼저 묻고, 죽었으면 캡처를 시작하지 않는다.
 *
 * 엔드포인트는 제품마다 다르다 — 마인드봄은 `/api/auth/check`, saas는
 * `/api/proxy/auth/me`. 둘 다 없으면(404) 판단하지 않고 지나간다.
 * 없는 판정을 죽음으로 세면 새 앱에서 촬영 자체가 막힌다.
 *
 * ## 묻는 것이 곧 고치는 것이다
 *
 * 두 경로 모두 **부르는 김에 갱신까지 한다.** 마인드봄은 라우트 안에서
 * (`routes/api/auth/check/+server.ts:23` — 액세스 토큰이 죽었으면
 * `tryRefreshAndSetCookies`), saas는 모든 요청에 도는 훅에서
 * (`hooks.server.ts:27-40`) 리프레시 토큰으로 새 토큰을 발급하고 `Set-Cookie`로 내린다.
 *
 * Playwright의 `context.request`는 브라우저 컨텍스트와 **쿠키 저장소를 공유하므로**,
 * 그 새 토큰이 그대로 촬영에 쓰인다. 그래서 이 검사는 진단이자 **되살리기**다 —
 * 촬영 직전에 부르는 배치가 여기서 값을 한다.
 *
 * 뒤집어 말하면 **여기서 실패가 나오면 진짜로 죽은 것이다** — 액세스 토큰만 만료된 게
 * 아니라 리프레시까지 실패했다는 뜻이라, 헛된 차단은 없다.
 *
 * 다만 갱신은 **살아 있는 컨텍스트에만** 남는다. `_state/*.json`은 안 바뀌므로
 * 다음 실행은 다시 만료 상태에서 출발하고, 첫 요청에서 또 살아난다.
 * 상태 파일이 오래됐다는 것만으로 다시 로그인할 이유는 없다 — **기한 안에서는.**
 *
 * ## 상태 파일의 기한 — 두 제품이 네 배 다르다
 *
 * | | 리프레시 수명 | 근거 |
 * |---|---|---|
 * | saas | 30일 | `refresh_tokens.expires_at` |
 * | 마인드봄 | **7일** | `apps/api/app/core/config.py:16` `REFRESH_TOKEN_EXPIRE_DAYS = 7` |
 *
 * **시계는 리셋되지 않는다.** saas의 재발급 핸들러는 리프레시 토큰을 새로 주지 않는다
 * (`handlers/auth/refresh_token.py:86` — `refresh_token=data.refresh_token,  # 기존 토큰 그대로`).
 * 즉 수명은 **최초 로그인 시각부터** 흐르고 자주 갱신해도 늘지 않는다.
 *
 * 그래서 자기 치유는 그 기한 안에서만 된다. 마인드봄을 쓰는 장면(s02·s03)은
 * 상태 파일이 일주일을 넘기면 이 검사가 실패하기 시작한다 — 그때 다시 받으면 된다.
 */
const PATHS = ['/api/auth/check', '/api/proxy/auth/me']

/** @returns {Promise<{ok: boolean, why: string}>} ok=false면 촬영하지 않는다 */
export async function checkAuth(context, url, timeout = 8000) {
  const base = new URL(url).origin

  /*
   * **센터 로그인이 아닌 상태 파일은 이 검사의 대상이 아니다.**
   * 바로링크(s04-B)는 회원이 아니라 **링크 세션**으로 연다 — 상태 파일에 든 것은
   * `barolink_<linkId>` 쿠키 하나이고, 회원 엔드포인트(`/api/proxy/auth/me`)에는 당연히 401이다.
   * 그걸 죽음으로 세면 멀쩡한 촬영이 막힌다. 회원 쿠키가 하나도 없으면 그냥 지나간다.
   */
  const cookies = await context.cookies().catch(() => [])
  const memberish = cookies.some((c) => /^(accessToken|refreshToken)$/.test(c.name))
  if (cookies.length && !memberish)
    return { ok: true, why: '회원 로그인이 아닌 상태 파일 — 검사 건너뜀' }
  let seen404 = 0
  for (const p of PATHS) {
    let res
    try {
      res = await context.request.get(base + p, { timeout, failOnStatusCode: false })
    } catch (e) {
      // 타임아웃도 실패로 센다 — 401만 보면 이 증상을 못 잡는다
      return { ok: false, why: `${p} 응답 없음 (${timeout}ms) — ${String(e).split('\n')[0]}` }
    }
    if (res.status() === 404) { seen404++; continue }
    if (res.ok()) return { ok: true, why: `${p} ${res.status()}` }
    return { ok: false, why: `${p} ${res.status()}` }
  }
  return { ok: true, why: `확인 못 함 (${seen404}개 경로가 404) — 그대로 진행한다` }
}

/** 로그인을 다시 받는 법 — 실패 메시지에 그대로 붙인다 */
export const RELOGIN_HINT = (url, state) =>
  `로그인 상태가 죽었다. 다시 받고 시작하라:\n` +
  `  CAP_EMAIL='<계정>' CAP_PASSWORD='<비번>' node .claude/skills/capture-service/scripts/login.mjs \\\n` +
  `    --base ${new URL(url).origin} --out ${state ?? '_state/local-<앱>-<키>.json'}\n` +
  `  (계정은 movies/26IRDEMO/_state/accounts.json)`
