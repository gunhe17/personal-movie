import { dev } from '$app/environment'
import { error } from '@sveltejs/kit'

/**
 * `/dev/*`는 개발용 도구다 — 프로덕션에서는 존재하지 않는 것처럼 군다.
 *
 * 왜 필요한가: 예전에 VAD 측정 페이지를 `static/`에 두었다가 그대로
 * 프로덕션에 배포됐고, 그래서 지웠다(dictation.svelte.ts 주석). 라우트로
 * 옮기면 같은 일이 다시 나므로 여기서 막는다.
 *
 * **서버 load**인 것이 중요하다. `+layout.ts`(universal)에 두면 클라이언트
 * 라우팅으로 들어올 때만 걸리고, 번들에 들어간 페이지 코드는 그대로다.
 * 서버에서 404를 내면 어느 경로로 들어와도 문서가 나오지 않는다.
 *
 * 인증 가드는 걸지 않는다 — `(protected)` 바깥이라 로그인 없이 열린다.
 * 개발 서버에서만 사는 페이지이므로 그게 맞다.
 */
export const load = () => {
  if (!dev) error(404, 'Not found')
  return {}
}
