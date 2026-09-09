// s08 · 케어보드 (웹) — 우측 케어보드 패널 안에서, 남긴 메모가 팀에게 가 닿는다.
//
// t01은 탭(진행 현황 · 문서 · 바우처 · 내담자 정보)을 훑어 "흩어져 있던 것이 한 곳에"를 찍었다.
// 이 t02는 그 다음 문장을 찍는다 — **팀이 같은 화면을 본다**. 무대는 우측 도크 하나다.
//   ① 스트림   — 접수 · 회기 · 필드노트 · 바우처가 날짜 구분선 아래 한 줄기로
//   ② 남의 발화 — 센터장 김원장이 남긴 메모가 이름·시각과 함께 그 줄기에 있다 (s08-setup.sql)
//   ③ 내 답    — 그 자리에서 써서 같은 줄기에 쌓는다
//   ④ 공지     — 고정하면 이 보드를 여는 모두의 첫 줄이 된다
//   ⑤ 도착     — 접었다 여는 사이, 김원장이 **다른 계정으로 실제 API를 통해** 남긴 답이 와 있다
//
// 배역: 정상담(주인공) · 김원장(센터장 · 관리자). 최치료로는 이 장면이 성립하지 않는다 —
//   COUNSELOR는 access_level=own이라 담당이 아닌 이하준의 보드에 접근 자체가 404다.
// 시작 URL: /clients/<이하준 clientId>   ·   선행: _scripts/s08-setup.sql
import fs from 'node:fs'

const API = 'http://localhost:3502/api/v1'
const ADMIN_STATE = new URL('../_state/local-saas-admin.json', import.meta.url)

const MY_MEMO = '3회기부터 또래 놀이에서 먼저 말을 겁니다. 분리할 때 울음은 없어졌어요.'
const REPLY = '확인했습니다. 회의 자료에 그대로 넣을게요. 보호자 면담은 제가 잡겠습니다.'

export default async function steps(page, h) {
  const composer = page.getByPlaceholder('공유할 메모를 남겨보세요')

  // 도크는 진입 600ms 뒤 스스로 펼쳐진다(CareBoardDock INTRO_DELAY) — 열릴 때까지만 기다린다
  await h.until(composer, '케어보드 도크')
  await h.beat('한 아이에게 일어난 일이 한 줄기로 — 접수 · 회기 · 필드노트 · 바우처')

  // 위로 거슬러 올라가는 것이 곧 인수인계다(scenes9 §08)
  await h.hover(page.getByText('놀이치료 접수'), '스트림 위')
  await h.scroll(-280, '지난 회기로 거슬러')
  await h.scroll(280, '다시 최근으로')

  h.nocutStart('남긴다 → 팀이 본다')

  await h.until(page.getByText('사례회의 안건'), '센터장 김원장이 남긴 메모 — 이름과 시각이 붙는다')
  await h.type(composer, MY_MEMO, '그 자리에서 답을 쓴다')
  await h.click(page.getByRole('button', { name: '메모 등록' }), '메모 등록')
  await h.until(page.getByText('먼저 말을 겁니다'), '정상담 · 담당자 — 같은 줄기에 쌓인다')

  // 고정 = 이 보드를 여는 모두의 첫 줄. 핀 버튼은 행 우상단(호버하면 드러난다)
  const myRow = page.getByRole('listitem').filter({ hasText: '먼저 말을 겁니다' })
  await h.click(myRow.getByRole('button', { name: '공지로 고정' }), '공지로 고정')
  await h.until(page.getByRole('button', { name: '고정 해제' }), '상단 공지 카드로 올라간다')

  // 접은 사이에 **다른 계정**이 같은 보드에 답을 남긴다. 목이 아니라 진짜 API 호출이다.
  await h.click(page.getByRole('button', { name: '케어보드 접기' }), '케어보드 접기')
  await postAsAdmin(page, REPLY)
  await h.click(page.getByRole('button', { name: '케어보드 열기' }), '케어보드 열기')

  await h.until(page.getByText('회의 자료에'), '김원장의 답이 같은 보드에 도착해 있다')
  await h.beat('전달해야 하던 일이, 남겨두면 되는 일이 된다')
  h.nocutEnd()

  await h.hold(1500, '끝')
}

/**
 * 김원장(관리자) 계정으로 케어보드 메모를 하나 남긴다 — 화면 밖의 동료 역.
 * 자격증명은 쓰지 않는다. `_state/local-saas-admin.json`의 refresh 토큰으로 access 토큰을
 * 새로 받는다(access는 30분짜리라 상태 파일의 것을 그대로 쓰면 곧 만료된다).
 * 상태 파일은 `CAP_EMAIL=admin@mindscope.com CAP_PASSWORD=… login.mjs --out _state/local-saas-admin.json`.
 */
async function postAsAdmin(page, body) {
  const centerId = await page.evaluate(() => localStorage.getItem('currentCenterId'))
  const clientId = page.url().match(/\/clients\/([0-9a-f-]{36})/)?.[1]
  if (!centerId || !clientId) throw new Error(`센터·내담자 id를 못 읽었다: ${centerId} / ${clientId}`)

  const state = JSON.parse(fs.readFileSync(ADMIN_STATE, 'utf8'))
  const refresh = state.cookies?.find((c) => c.name === 'refreshToken')?.value
  if (!refresh) throw new Error('_state/local-saas-admin.json에 refreshToken이 없다 — login.mjs로 다시 만든다')

  const auth = await fetch(`${API}/auth/refresh`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh })
  })
  if (!auth.ok) throw new Error(`김원장 토큰 갱신 실패 ${auth.status} — 상태 파일을 다시 만든다`)
  const { access_token } = await auth.json()

  const res = await fetch(`${API}/centers/${centerId}/clients/${clientId}/care-board/memos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${access_token}` },
    body: JSON.stringify({ body })
  })
  if (res.status !== 201) throw new Error(`김원장 메모 작성 실패 ${res.status} ${await res.text()}`)
}
