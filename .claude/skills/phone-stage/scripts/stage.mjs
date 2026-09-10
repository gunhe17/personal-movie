#!/usr/bin/env node
// stage.mjs — 전문가 앱(apps/mobile)을 iOS 시뮬레이터에 세우고 원하는 화면까지 데려간다.
// **촬영하지 않는다.** sckcap · simctl io · screencapture 전부 이 파일에 없다 — 촬영은 capture-service의 capture-phone.mjs다.
//
//   node stage.mjs status                     지금 무엇이 준비됐고 무엇이 빠졌나
//   node stage.mjs sim                        시뮬레이터 부팅 + SPEC 설정 맞추기
//   node stage.mjs build                      prebuild(없으면) + xcodebuild (Release · 시뮬레이터)
//   node stage.mjs install                    simctl install
//   CAP_PASSWORD=… node stage.mjs login       API 로그인 → AsyncStorage에 토큰·센터 주입 → 실행 → 검증
//   node stage.mjs goto /field-note/home      딥링크로 그 화면까지
//   CAP_PASSWORD=… node stage.mjs up          sim → install → login → goto (기본 /field-note/home)
//   node stage.mjs selftest                   시뮬레이터 없이 도는 자체 검사
//
// 공통 옵션: --udid <UDID|booted>  --account <accounts.json 키>  --route <경로>  --api <URL>
// 자격증명은 CAP_PASSWORD(·CAP_EMAIL) 환경변수로만 받는다 — 파일 어디에도 쓰지 않는다.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { DEMO_ROOT, parseArgs, sh, sleep, log, die } from '../../capture-service/scripts/common.mjs'

// ── 앱 상수 (app.config.ts의 IS_DEV 분기와 1:1) ──────────────────────────
const APP = {
  bundle: 'kr.mindscope.app.dev',            // app.config.ts:34  ios.bundleIdentifier (IS_DEV)
  scheme: 'mindscope-dev',                   // app.config.ts:22  scheme (IS_DEV)
  variant: 'development',                    // APP_VARIANT — 이게 없으면 운영 번들로 빌드된다
  workspace: 'MindScopeDev.xcworkspace',
  xcscheme: 'MindScopeDev',
  config: 'Release',                         // Metro 없이 혼자 서는 빌드. Debug는 --debug (아래 주석)
  deviceName: 'iPhone 17 Pro',               // capture-service SPEC_PHONE
  defaultRoute: '/field-note/home',
}
const MOBILE = path.join(DEMO_ROOT, '_tool/saas-center-platform/apps/mobile')
const IOS = path.join(MOBILE, 'ios')
// SPEC의 주인은 capture-service다. 여기서는 검사·강제만 하고 값을 새로 정하지 않는다.
const SPEC_PREFS = { ShowChrome: '0', ShowSingleTouches: '1' }
const STORAGE_SUBPATH = ['Library', 'Application Support', APP.bundle, 'RCTAsyncLocalStorage_V1']
const INLINE_MAX = 1024   // RNCAsyncStorage.mm:21 RCTInlineValueThreshold — 넘으면 별도 파일(md5(key))로 나간다

const args = parseArgs(process.argv.slice(3))
const cmd = process.argv[2]
const API = args.api ?? process.env.CAP_API ?? 'http://localhost:3502'
const positional = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : null
const ROUTE = args.route ?? positional ?? APP.defaultRoute

// ── 순수 함수 (selftest가 검사하는 것) ────────────────────────────────────
export function deepLink(route) { return `${APP.scheme}:///${String(route).replace(/^\/+/, '')}` }
export function mergeManifest(prev, entries) {
  const out = { ...prev }
  for (const [k, v] of Object.entries(entries)) {
    if (typeof v !== 'string') throw new Error(`값은 문자열이어야 한다: ${k}`)
    if (v.length > INLINE_MAX) throw new Error(`${k}: ${v.length}자 — manifest 인라인 한계(${INLINE_MAX})를 넘었다. 별도 파일 쓰기가 필요하다`)
    out[k] = v
  }
  return out
}
export function routeKind(route, files) {
  // expo-router는 `[scheduleId].tsx` 같은 동적 세그먼트가 **무엇이든** 받는다.
  // 그래서 오타 라우트도 404가 아니라 그 화면(필드노트에선 녹음 화면)에 선다 — 실측으로 확인했다.
  const seg = String(route).replace(/^\/+/, '').split('/').pop()
  const statics = files.filter((f) => f.endsWith('.tsx') && !f.startsWith('[')).map((f) => f.replace(/\.tsx$/, ''))
  return statics.includes(seg) ? 'static' : 'dynamic'
}
export function centerStoreValue(center) {
  // zustand persist v5 형식 + center/store.ts의 partialize({centerId, centerName, roleCode})
  return JSON.stringify({ state: { centerId: center.id, centerName: center.name, roleCode: center.role_code ?? null }, version: 0 })
}

// ── 얇은 헬퍼 ────────────────────────────────────────────────────────────
const try_ = (fn, dflt = null) => { try { return fn() } catch { return dflt } }
const appPath = () => path.join(IOS, `build/Build/Products/${APP.config}-iphonesimulator/${APP.xcscheme}.app`)
// .app 디렉터리는 링크가 끝나기 전에도 있다 — 실행 파일이 있어야 빌드가 끝난 것이다
const appBuilt = () => fs.existsSync(path.join(appPath(), APP.xcscheme))
function devices() { return Object.values(JSON.parse(sh('xcrun simctl list devices -j')).devices).flat() }
function resolveUdid(u = args.udid) {
  const all = devices()
  if (u && u !== 'booted') return all.find((d) => d.udid === u || d.name === u) ?? die(`시뮬레이터 없음: ${u}`)
  return all.find((d) => d.state === 'Booted' && d.isAvailable)
    ?? all.find((d) => d.name === APP.deviceName && d.isAvailable)
    ?? die(`시뮬레이터 없음: ${APP.deviceName}`)
}
function storageDir(udid) {
  const data = try_(() => sh(`xcrun simctl get_app_container ${udid} ${APP.bundle} data`).trim())
  return data ? path.join(data, ...STORAGE_SUBPATH) : null
}
function readManifest(udid) {
  const dir = storageDir(udid)
  if (!dir) return null
  return try_(() => JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')), {})
}
async function authOk(udid) {
  // 파일에 토큰이 있는 것과 그 토큰이 아직 유효한 것은 다르다. 만료된 토큰은 앱이 401을 받기
  // **전까지** 파일에 그대로 남아 있고, permission-store도 지난 성공의 잔상이라 같이 참으로 보인다.
  // 그래서 파일만 보면 죽은 무대를 통과시킨다 — API에 직접 묻는 것만이 결정적이다.
  const t = try_(() => readManifest(udid)?.access_token, null)
  if (!t) return { ok: false, why: '파일에 토큰 없음' }
  const code = await fetch(`${API}/api/v1/auth/me`, { headers: { Authorization: `Bearer ${t}` }, signal: AbortSignal.timeout(8000) })
    .then((r) => r.status).catch(() => null)
  return { ok: code === 200, why: code === null ? 'API 응답 없음(타임아웃)' : `/auth/me → ${code}` }
}
async function alive(url) { return await fetch(url, { signal: AbortSignal.timeout(2500) }).then((r) => r.status).catch(() => null) }
// pnpm 워크스페이스 구멍 메우기 — JS 번들(Release)과 Metro(Debug) 둘 다 babel.config.js를 타는데,
// `babel-preset-expo`도 그 프리셋이 문자열로 부르는 `@babel/*` 플러그인도 apps/mobile/node_modules에 없다.
// pnpm은 직접 의존만 링크하고, Babel은 플러그인 이름을 **프로젝트 루트 기준**으로 resolve하기 때문이다:
//   error: expo-router/entry.js: Cannot find module 'babel-preset-expo'
//   error: expo-router/entry.js: Cannot find module '@babel/plugin-transform-react-jsx'
// 제품의 package.json·락파일을 건드리지 않고, 이미 스토어에 있는 것을 심링크로 잇는다(node_modules는 생성물이다).
// 근본 해결은 워크스페이스 `.npmrc`에 `node-linker=hoisted`지만 그건 제품 전체를 다시 설치시킨다.
function linkBabelPreset() {
  const nm = path.join(MOBILE, 'node_modules')
  const store = path.join(MOBILE, '../../node_modules/.pnpm')
  const links = [
    ['babel-preset-expo', () => {
      const dir = fs.readdirSync(store).find((d) => d.startsWith('babel-preset-expo@'))
      return dir && path.join(store, dir, 'node_modules/babel-preset-expo')
    }],
    ['@babel', () => path.join(store, 'node_modules/@babel')],   // pnpm 숨은 스토어 — 평평하게 다 들어 있다
  ]
  for (const [name, resolve] of links) {
    const target = path.join(nm, name)
    if (fs.existsSync(target)) continue
    const src = resolve() ?? die(`${name}이 pnpm 스토어에도 없다 — 워크스페이스에서 pnpm install 먼저`)
    if (!fs.existsSync(src)) die(`${name} 스토어 경로가 없다: ${src}`)
    fs.symlinkSync(src, target)
    log(`링크: ${name} → ${path.relative(nm, src)}`)
  }
}
function run(cmdline, cwd) {
  const r = spawnSync('/bin/zsh', ['-c', cmdline], { cwd, stdio: 'inherit', env: { ...process.env, APP_VARIANT: APP.variant, API_URL: API } })
  if (r.status !== 0) die(`실패(exit ${r.status}): ${cmdline}`)
}

// ── 명령 ─────────────────────────────────────────────────────────────────
const CMDS = {
  async status() {
    const d = try_(() => resolveUdid(), null)
    const m = d ? readManifest(d.udid) : null
    const badPrefs = Object.entries(SPEC_PREFS).filter(([k, v]) => try_(() => sh(`defaults read com.apple.iphonesimulator ${k}`).trim()) !== v)
    const scaleKey = d && `SimulatorWindowLastScale-${d.deviceTypeIdentifier}`
    const scale = scaleKey && try_(() => sh(`defaults read com.apple.iphonesimulator "${scaleKey}"`).trim())
    const perm = m?.['permission-store'] && try_(() => JSON.parse(m['permission-store']).state?.context, null)
    const apiCode = await alive(`${API}/api/v1/auth/me`)
    const auth = d ? await authOk(d.udid) : { ok: false, why: '시뮬레이터 없음' }
    const rows = [
      ['시뮬레이터', d?.state === 'Booted', d ? `${d.name} ${d.udid} (${d.state})` : `없음 — ${APP.deviceName}`, 'sim'],
      ['Simulator 설정(SPEC)', badPrefs.length === 0 && scale === '1', `ShowChrome/ShowSingleTouches ${badPrefs.length ? '어긋남: ' + badPrefs.map((x) => x[0]).join(',') : 'OK'} · 스케일 ${scale ?? '?'}`, 'sim'],
      ['ios/ 생성물', fs.existsSync(IOS), fs.existsSync(IOS) ? path.relative(MOBILE, IOS) : 'expo prebuild 필요', 'build'],
      ['빌드 산출물', appBuilt(), appBuilt() ? `${APP.config}-iphonesimulator/${APP.xcscheme}.app` : '없음', 'build'],
      ['앱 설치', !!storageDir(d?.udid), storageDir(d?.udid) ? APP.bundle : `${APP.bundle} 미설치`, 'install'],
      ['API', apiCode === 401 || apiCode === 200, `${API} → ${apiCode ?? '응답 없음'}`, null],
      ['로그인 상태', auth.ok, m ? `${auth.why} · 센터 ${m['center-store'] ? '있음' : '없음'} · 권한 ${perm ? '받아옴' : '없음'}` : '컨테이너 없음', 'login'],
    ]
    for (const [name, ok, detail] of rows) log(`${ok ? '✅' : '❌'} ${name.padEnd(20)} ${detail}`)
    log(`—  Metro(8081)         ${(await alive('http://localhost:8081/status')) ? '떠 있음' : '없음'} (Release 빌드에는 필요 없다)`)
    log(`—  idb                 ${try_(() => sh('which idb').trim()) ?? '없음 (선택 — 탭·스와이프·입력용. 없어도 딥링크로 선다)'}`)
    const next = rows.find(([, ok, , c]) => !ok && c)
    log(next ? `\n다음: node stage.mjs ${next[3]}` : '\n무대 준비 완료 — 촬영은 capture-service의 capture-phone.mjs로.')
  },

  async sim() {
    const d = resolveUdid()
    const scaleKey = `SimulatorWindowLastScale-${d.deviceTypeIdentifier}`
    const wrong = [...Object.entries(SPEC_PREFS), [scaleKey, '1']]
      .filter(([k, v]) => try_(() => sh(`defaults read com.apple.iphonesimulator "${k}"`).trim()) !== v)
    if (wrong.length) {
      log(`Simulator 설정이 SPEC과 다르다 — 고치고 재시작한다: ${wrong.map((x) => x[0]).join(', ')}`)
      try_(() => sh('killall Simulator'))
      for (const [k, v] of wrong) sh(`defaults write com.apple.iphonesimulator "${k}" ${k.startsWith('Simulator') ? `-int ${v}` : `-bool ${v === '1'}`}`)
    }
    if (d.state !== 'Booted') { sh(`xcrun simctl boot ${d.udid}`); sh(`xcrun simctl bootstatus ${d.udid} -b`) }
    sh('open -a Simulator'); await sleep(2000)
    log(`시뮬레이터: ${d.name} ${d.udid} · 베젤 off · 터치 표시 on · Point Accurate`)
  },

  build() {
    linkBabelPreset()
    if (!fs.existsSync(IOS)) { log('ios/ 없음 — expo prebuild'); run(`npx expo prebuild -p ios`, MOBILE) }
    // expo run:ios를 쓰지 않는 이유: 마지막 '실행' 단계가 osascript 자동화 권한을 요구한다(STATUS.md 함정).
    // Release로 굽는 이유: JS 번들이 앱에 박혀 Metro 없이 서고, 촬영을 막는 개발자 메뉴·시스템 다이얼로그가 없다.
    // Debug가 필요하면 -configuration Debug로 바꾸고 `npx expo start --dev-client`를 따로 띄운다.
    run([
      'xcodebuild', `-workspace ${APP.workspace}`, `-scheme ${APP.xcscheme}`, `-configuration ${APP.config}`,
      '-sdk iphonesimulator', `-destination 'generic/platform=iOS Simulator'`, '-derivedDataPath build',
      'CODE_SIGNING_ALLOWED=NO', 'build',
    ].join(' '), IOS)
    if (!appBuilt()) die(`빌드는 끝났는데 산출물이 없다: ${appPath()}`)
    log(`빌드 완료: ${appPath()}`)
  },

  install() {
    const d = resolveUdid()
    if (!appBuilt()) die(`빌드 산출물 없음 — 먼저 node stage.mjs build`)
    if (d.state !== 'Booted') die(`시뮬레이터가 꺼져 있다 — 먼저 node stage.mjs sim`)
    sh(`xcrun simctl install ${d.udid} "${appPath()}"`)
    log(`설치: ${APP.bundle} → ${d.name}`)
  },

  async login() {
    const d = resolveUdid()
    const accounts = JSON.parse(fs.readFileSync(path.join(DEMO_ROOT, '_state/accounts.json'), 'utf8'))
    const key = args.account ?? 'counselor1'
    const email = process.env.CAP_EMAIL ?? accounts.accounts[key]?.email ?? die(`계정 없음: ${key}`)
    const password = process.env.CAP_PASSWORD ?? die('CAP_PASSWORD 필요 — 자격증명은 환경변수로만 받는다')
    const res = await fetch(`${API}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
    })
    if (!res.ok) die(`로그인 실패 ${res.status} — API(${API})와 시드를 확인한다`)
    const j = await res.json()
    const center = (args.center ? j.centers.find((c) => c.code === args.center || c.name === args.center) : j.centers[0])
      ?? die(`센터 없음: ${args.center ?? '(첫 번째)'}`)

    // 앱이 살아 있으면 AsyncStorage가 메모리 캐시를 들고 있어 파일 수정이 안 읽힌다 — 먼저 죽인다.
    try_(() => sh(`xcrun simctl terminate ${d.udid} ${APP.bundle}`))
    const dir = storageDir(d.udid) ?? die(`앱 컨테이너 없음 — 먼저 node stage.mjs install`)
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, 'manifest.json')
    const prev = try_(() => JSON.parse(fs.readFileSync(file, 'utf8')), {})
    const next = mergeManifest(prev, {
      access_token: j.access_token,          // storage.ts TokenStorage
      refresh_token: j.refresh_token,
      'center-store': centerStoreValue(center),
    })
    fs.writeFileSync(file, JSON.stringify(next))
    log(`주입: ${accounts.accounts[key]?.name ?? email} · ${center.name} → AsyncStorage (토큰 값은 남기지 않는다)`)

    // 검증: 앱을 띄우고 permission-store.state.context가 채워지길 기다린다.
    // 그 값은 centerId가 있고 토큰이 살아 있어야만 오는 인증 API 응답이다(permission-store.ts:fetchPermissions).
    sh(`xcrun simctl launch ${d.udid} ${APP.bundle}`)
    for (let i = 0; i < 20; i++) {
      await sleep(1000)
      const ctx = try_(() => JSON.parse(readManifest(d.udid)?.['permission-store'] ?? 'null')?.state?.context, null)
      if (ctx) return log(`로그인 확인: 권한 ${ctx.permissions?.length ?? 0}개 · 역할 ${ctx.roleCode}`)
    }
    die('앱이 20초 안에 권한을 받아오지 못했다 — API가 떠 있는지, 시드 계정이 그 센터 소속인지 확인한다')
  },

  async goto() {
    const d = resolveUdid()
    // 오타는 404가 아니라 [scheduleId] 화면(녹음)으로 조용히 샌다 — 가기 전에 말해 준다.
    const dir = path.join(MOBILE, 'app/(main)', String(ROUTE).replace(/^\/+/, '').split('/')[0])
    if (try_(() => routeKind(ROUTE, fs.readdirSync(dir)), null) === 'dynamic')
      log(`주의: '${ROUTE}'는 정적 라우트가 아니다 — 동적 세그먼트가 받는다(필드노트면 녹음 화면). 오타면 여기서 어긋난다`)
    sh(`xcrun simctl openurl ${d.udid} '${deepLink(ROUTE)}'`)   // 스킴이 안 잡히면 여기서 터진다
    await sleep(1500)
    if (!try_(() => sh(`pgrep -x ${APP.xcscheme}`))) die(`딥링크 뒤 앱이 죽었다: ${deepLink(ROUTE)}`)
    // 프로세스가 살아 있다고 무대가 선 게 아니다. 토큰은 30분이면 만료되고(ACCESS_TOKEN_EXPIRE_MINUTES=30),
    // 만료되면 앱이 **토큰을 지우고** 로그인 화면으로 간다. pgrep은 그걸 못 본다 — 실제로 한 번 속았다.
    const a = await authOk(d.udid)
    if (!a.ok) die(`딥링크는 갔지만 무대가 서지 않았다 (${a.why}) — 다시: CAP_PASSWORD=… node stage.mjs login`)
    log(`이동: ${deepLink(ROUTE)} · 인증 유효 (${a.why})`)
  },

  async up() {
    await CMDS.sim()
    CMDS.install()   // 덮어 설치해도 데이터 컨테이너는 남는다 — 새 빌드를 항상 집는다
    await CMDS.login()
    await CMDS.goto()
  },

  selftest() {
    const eq = (a, b, why) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${why}\n  받음: ${JSON.stringify(a)}\n  기대: ${JSON.stringify(b)}`) }
    eq(deepLink('/field-note/home'), 'mindscope-dev:///field-note/home', '딥링크: 앞 슬래시 정규화')
    eq(deepLink('field-note/list'), 'mindscope-dev:///field-note/list', '딥링크: 슬래시 없어도 같은 URL')
    eq(mergeManifest({ a: '1' }, { b: '2' }), { a: '1', b: '2' }, 'manifest: 기존 키를 보존한다')
    eq(mergeManifest({ access_token: 'old' }, { access_token: 'new' }), { access_token: 'new' }, 'manifest: 같은 키는 덮어쓴다')
    let threw = false
    try { mergeManifest({}, { big: 'x'.repeat(INLINE_MAX + 1) }) } catch { threw = true }
    if (!threw) throw new Error(`manifest: ${INLINE_MAX}자 초과는 조용히 통과하면 안 된다 (파일로 나가야 하는 값)`)
    const FILES = ['[scheduleId].tsx', 'home.tsx', 'index.tsx', 'link.tsx', 'list.tsx']   // 실제 app/(main)/field-note/
    eq(routeKind('/field-note/home', FILES), 'static', '라우트: 정적 파일이 있으면 static')
    eq(routeKind('/field-note/list', FILES), 'static', '라우트: list.tsx도 static')
    eq(routeKind('/field-note/oops', FILES), 'dynamic', '라우트: 없는 이름은 [scheduleId]가 삼킨다 — 조용히 넘어가면 안 된다')
    eq(JSON.parse(centerStoreValue({ id: 'c1', name: '센터', role_code: 'COUNSELOR' })),
      { state: { centerId: 'c1', centerName: '센터', roleCode: 'COUNSELOR' }, version: 0 }, 'center-store: zustand persist 형식')
    log('selftest 통과')
  },
}

if (!CMDS[cmd]) die(`사용법: node stage.mjs <status|sim|build|install|login|goto|up|selftest> [옵션]`)
await CMDS[cmd]()
