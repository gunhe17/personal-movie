#!/usr/bin/env node
// artlist.mjs — Artlist MCP 연결·인증·진단
//
// 이 러너는 자격증명을 읽지도 쓰지도 않는다 (촬영 규칙 7과 같은 원칙).
// OAuth 토큰은 Claude Code가 보관하고, 여기서는 상태만 판정한다.
//   판정 재료 둘 — ① `claude mcp list`의 상태 줄  ② 엔드포인트의 비인증 응답
//
//   node artlist.mjs status      등록·인증·엔드포인트를 한 번에 보고 다음 명령을 알려준다
//   node artlist.mjs connect     서버 등록 (멱등)
//   node artlist.mjs auth        인증 절차 안내 + 끝난 뒤 검증
//   node artlist.mjs verify      인증됐는지만 판정 (종료 코드로 답한다)
//   node artlist.mjs disconnect  등록 해제 (토큰은 Claude Code가 따로 들고 있다)
//   node artlist.mjs selftest    네트워크·인증 없이 도는 자체 검사

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const execFileP = promisify(execFile);

// ── 상수 (정본) ────────────────────────────────────────────────────────────
export const SPEC = {
  version: 1,
  name: 'artlist',                                   // claude mcp 안에서의 서버 이름
  url: 'https://mcp.artlist.io/mcp',                 // 랜딩 페이지(artlist.io/mcp)가 아니다
  transport: 'http',
  scope: 'project',                                  // .mcp.json — 다른 세션도 같은 배선을 얻는다
  resourceMetadata: 'https://mcp.artlist.io/.well-known/oauth-protected-resource',
  authIssuer: 'https://auth.artlist.io/',            // Auth0 · PKCE · 동적 클라이언트 등록
  timeoutMs: 15000,
};

const REPO = process.env.ARTLIST_REPO || process.cwd();

// ── 출력 ──────────────────────────────────────────────────────────────────
const C = process.stdout.isTTY
  ? { ok: '\x1b[32m', warn: '\x1b[33m', bad: '\x1b[31m', dim: '\x1b[2m', b: '\x1b[1m', r: '\x1b[0m' }
  : { ok: '', warn: '', bad: '', dim: '', b: '', r: '' };

const mark = (s) => (s === 'ok' ? `${C.ok}✓${C.r}` : s === 'warn' ? `${C.warn}!${C.r}` : `${C.bad}✗${C.r}`);
/** 한글은 터미널에서 두 칸을 먹는다 — 글자 수가 아니라 폭으로 채운다 */
const width = (s) => [...s].reduce((n, ch) => n + (/[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/.test(ch) ? 2 : 1), 0);
const pad = (s, w) => s + ' '.repeat(Math.max(1, w - width(s)));
const line = (s, label, detail) => console.log(` ${mark(s)} ${pad(label, 14)} ${detail ?? ''}`);
const head = (t) => console.log(`\n${C.b}${t}${C.r}`);

// ── claude CLI ────────────────────────────────────────────────────────────
async function claude(args) {
  try {
    const { stdout, stderr } = await execFileP('claude', args, { timeout: 90000, maxBuffer: 8 << 20 });
    return { code: 0, stdout, stderr };
  } catch (e) {
    return { code: e.code ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? String(e.message ?? e) };
  }
}

/**
 * `claude mcp list`를 파싱한다.
 *   `<이름>: <url> - <상태>`                 예) claude.ai Notion: https://… - ! Needs authentication
 *   `<이름>: <url> (HTTP) - <상태>`          .mcp.json(project 스코프) 줄에는 전송 표시가 끼어든다
 * 전송 표시를 선택항으로 두지 않으면 project 스코프 서버가 통째로 안 잡힌다.
 */
export function parseList(stdout) {
  const out = [];
  for (const raw of stdout.split('\n')) {
    const m = raw.match(/^(.+?):\s+(\S+)(?:\s+\(([^)]+)\))?\s+-\s+(.+?)\s*$/);
    if (!m) continue;                        // "Checking MCP server health…" 같은 줄
    const [, name, url, transport, status] = m;
    out.push({
      name: name.trim(),
      url,
      transport: transport ?? null,
      status: status.trim(),
      connected: /connected/i.test(status) && !/needs|fail/i.test(status),
      needsAuth: /needs auth/i.test(status),
      failed: /fail/i.test(status),
      pending: /pending/i.test(status),
    });
  }
  return out;
}

async function findServer() {
  const r = await claude(['mcp', 'list']);
  if (r.code !== 0 && !r.stdout) return { error: r.stderr.trim() || 'claude mcp list 실패', servers: [] };
  const servers = parseList(r.stdout);
  return { servers, server: servers.find((s) => s.name === SPEC.name) };
}

/** .mcp.json에 적혀 있나 — project 스코프인지 알려주는 유일한 단서 */
function projectScoped() {
  const p = join(REPO, '.mcp.json');
  if (!existsSync(p)) return { file: p, present: false };
  try {
    const j = JSON.parse(readFileSync(p, 'utf8'));
    const e = j.mcpServers?.[SPEC.name];
    return { file: p, present: !!e, entry: e };
  } catch (e) {
    return { file: p, present: false, error: `.mcp.json 파싱 실패: ${e.message}` };
  }
}

// ── 엔드포인트 ────────────────────────────────────────────────────────────
/**
 * 비인증으로 두 군데를 두드린다. 자격증명을 보내지 않는다.
 *   ① 리소스 메타데이터 200 → 서버가 살아 있고 OAuth 발급처를 광고한다
 *   ② /mcp 에 initialize → 401 + WWW-Authenticate 가 정상이다 (인증이 필요하다는 뜻)
 */
export async function probe() {
  const out = { alive: false, issuer: null, resourceName: null, challenged: false, note: null };
  try {
    const r = await fetch(SPEC.resourceMetadata, { signal: AbortSignal.timeout(SPEC.timeoutMs) });
    if (r.ok) {
      const j = await r.json();
      out.alive = true;
      out.issuer = j.authorization_servers?.[0] ?? null;
      out.resourceName = j.resource_name ?? null;
    } else {
      out.note = `리소스 메타데이터 HTTP ${r.status}`;
    }
  } catch (e) {
    out.note = `리소스 메타데이터 요청 실패: ${e.message}`;
    return out;
  }
  try {
    const r = await fetch(SPEC.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'artlist-skill', version: '1' } },
      }),
      signal: AbortSignal.timeout(SPEC.timeoutMs),
    });
    out.challenged = r.status === 401 && /bearer/i.test(r.headers.get('www-authenticate') ?? '');
    out.initStatus = r.status;
  } catch (e) {
    out.note = (out.note ? out.note + ' · ' : '') + `initialize 요청 실패: ${e.message}`;
  }
  return out;
}

// ── 명령 ──────────────────────────────────────────────────────────────────
async function cmdStatus() {
  head('Artlist MCP');
  console.log(`${C.dim} 서버 ${SPEC.url}${C.r}`);

  const net = await probe();
  if (net.alive) line('ok', '엔드포인트', `살아 있다${net.resourceName ? ` · ${net.resourceName}` : ''}`);
  else line('bad', '엔드포인트', net.note ?? '응답 없음');
  if (net.alive) {
    line(net.challenged ? 'ok' : 'warn', '인증 방식',
      net.challenged ? `OAuth Bearer · 발급처 ${net.issuer}` : `401 Bearer 도전을 받지 못했다 (HTTP ${net.initStatus})`);
  }

  const { server, error } = await findServer();
  if (error) line('bad', '등록', error);
  else if (!server) line('warn', '등록', `안 돼 있다 — ${C.b}node artlist.mjs connect${C.r}`);
  else line('ok', '등록', `${server.name} → ${server.url}`);

  const ps = projectScoped();
  if (ps.error) line('warn', '스코프', ps.error);
  else if (ps.present) line('ok', '스코프', `project · ${ps.file}`);
  else if (server) line('warn', '스코프', 'local 또는 user — .mcp.json에는 없다 (다른 세션은 못 본다)');

  if (server) {
    if (server.connected) line('ok', '인증', '됐다 — 도구를 쓸 수 있다');
    else if (server.needsAuth) line('warn', '인증', `안 됐다 — ${C.b}/mcp${C.r} 에서 artlist 선택 후 로그인`);
    else if (server.pending) line('warn', '승인 대기', '.mcp.json 서버다 — 이 폴더에서 `claude`를 새로 띄워 승인한다');
    else line('bad', '인증', server.status);
  }

  head('다음');
  if (!net.alive) console.log(' 엔드포인트가 안 뜬다. 네트워크를 확인하고 다시 본다.');
  else if (!server) console.log(` node ${rel()} connect`);
  else if (server.pending) console.log(` 이 폴더에서 ${C.b}claude${C.r} 를 새로 띄워 .mcp.json 서버를 승인 → 그다음 /mcp 로 인증`);
  else if (server.needsAuth) console.log(` /mcp  →  artlist  →  브라우저 로그인  →  node ${rel()} verify`);
  else if (server.connected) console.log(' 준비됐다. 대화에서 artlist 도구를 부르면 된다.');
  console.log();
  return 0;
}

async function cmdConnect(argv) {
  const scope = flag(argv, '--scope') ?? SPEC.scope;
  const { server } = await findServer();
  if (server) {
    console.log(`${mark('ok')} 이미 등록돼 있다 — ${server.name} → ${server.url} (${server.status})`);
    console.log(`${C.dim}  다시 등록하지 않는다. 주소를 바꾸려면 disconnect 먼저.${C.r}`);
    return 0;
  }
  const args = ['mcp', 'add', '--transport', SPEC.transport, '--scope', scope, SPEC.name, SPEC.url];
  console.log(`${C.dim}$ claude ${args.join(' ')}${C.r}`);
  const r = await claude(args);
  process.stdout.write(r.stdout);
  if (r.code !== 0) {
    process.stderr.write(r.stderr);
    console.log(`\n${mark('bad')} 등록 실패 (종료 코드 ${r.code})`);
    return 1;
  }
  console.log(`${mark('ok')} 등록했다. 아직 인증 전이다.`);
  console.log(`\n다음: ${C.b}/mcp${C.r} → artlist → 브라우저 로그인 → ${C.b}node ${rel()} verify${C.r}`);
  return 0;
}

async function cmdAuth() {
  const { server } = await findServer();
  if (!server) {
    console.log(`${mark('warn')} 등록부터 해야 한다 — node ${rel()} connect`);
    return 3;
  }
  if (server.connected) {
    console.log(`${mark('ok')} 이미 인증돼 있다. 할 일이 없다.`);
    return 0;
  }
  head('인증은 사람이 한다');
  console.log(` OAuth는 브라우저를 연다. 스크립트가 대신할 수 없고, 비대화형 세션에서는 끝나지 않는다.`);
  console.log(`\n 1. 대화창에 ${C.b}/mcp${C.r} 를 친다`);
  console.log(` 2. 목록에서 ${C.b}artlist${C.r} 를 고르고 Authenticate 를 누른다`);
  console.log(` 3. 브라우저에서 Artlist 계정으로 로그인하고 권한을 승인한다`);
  console.log(` 4. 돌아와서 ${C.b}node ${rel()} verify${C.r}`);
  console.log(`\n${C.dim} 발급처 ${SPEC.authIssuer} · AI 크레딧이 있는 유료 Artlist 계정이어야 한다.${C.r}`);
  console.log(`${C.dim} 토큰은 Claude Code가 보관한다. 이 저장소에는 어떤 자격증명도 쓰지 않는다.${C.r}`);
  return 2;
}

async function cmdVerify() {
  const { server, error } = await findServer();
  if (error) { console.log(`${mark('bad')} ${error}`); return 1; }
  if (!server) { console.log(`${mark('warn')} 등록 안 됨 — node ${rel()} connect`); return 3; }
  if (server.connected) { console.log(`${mark('ok')} 인증됨 — ${server.name} (${server.status})`); return 0; }
  if (server.pending) { console.log(`${mark('warn')} 승인 대기 — 이 폴더에서 \`claude\`를 새로 띄워 .mcp.json 서버를 승인한 뒤 /mcp 로 인증`); return 2; }
  if (server.needsAuth) { console.log(`${mark('warn')} 인증 필요 — ${server.status} · /mcp 에서 로그인`); return 2; }
  console.log(`${mark('bad')} 연결 실패 — ${server.status}`);
  return 4;
}

async function cmdDisconnect(argv) {
  const scope = flag(argv, '--scope') ?? SPEC.scope;
  const r = await claude(['mcp', 'remove', '--scope', scope, SPEC.name]);
  process.stdout.write(r.stdout);
  if (r.code !== 0) {
    process.stderr.write(r.stderr);
    console.log(`${mark('bad')} 해제 실패. 다른 스코프일 수 있다 — --scope local | user | project`);
    return 1;
  }
  console.log(`${mark('ok')} 등록을 지웠다. 저장된 토큰은 Claude Code가 따로 들고 있다.`);
  return 0;
}

function cmdSelftest() {
  let fail = 0;
  const t = (name, cond, detail) => { line(cond ? 'ok' : 'bad', name, detail ?? ''); if (!cond) fail++; };

  head('selftest — 네트워크·인증 없이');
  const sample = [
    'Checking MCP server health…',
    '',
    'claude.ai Google Drive: https://drivemcp.googleapis.com/mcp/v1 - ✓ Connected',
    'artlist: https://mcp.artlist.io/mcp - ! Needs authentication',
    'broken: https://x.example/mcp - ✗ Failed to connect',
    'proj: https://mcp.artlist.io/mcp (HTTP) - ⏸ Pending approval (run `claude` to approve)',
  ].join('\n');
  const rows = parseList(sample);
  t('파싱 행수', rows.length === 4, `${rows.length}`);
  const a = rows.find((r) => r.name === 'artlist');
  t('artlist 인식', !!a, a?.url);
  t('인증필요 판정', a?.needsAuth === true && a?.connected === false);
  t('연결 판정', rows[0].connected === true);
  t('실패 판정', rows[2].failed === true && rows[2].connected === false);
  const pj = rows.find((r) => r.name === 'proj');
  t('전송표시 줄', pj?.url === 'https://mcp.artlist.io/mcp' && pj?.transport === 'HTTP', pj?.url);
  t('승인대기 판정', pj?.pending === true && pj?.connected === false);
  t('헤더줄 배제', !rows.some((r) => /Checking/.test(r.name)));
  t('URL 상수', SPEC.url === 'https://mcp.artlist.io/mcp', SPEC.url);
  t('랜딩 아님', !SPEC.url.startsWith('https://artlist.io/mcp'), '랜딩 페이지를 서버로 쓰지 않는다');

  console.log(fail === 0 ? `\n${mark('ok')} 통과` : `\n${mark('bad')} ${fail}건 실패`);
  return fail === 0 ? 0 : 1;
}

// ── 보조 ──────────────────────────────────────────────────────────────────
function flag(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
}
function rel() { return 'artlist.mjs'; }

const USAGE = `artlist — Artlist MCP 연결·인증

  node artlist.mjs status      등록·인증·엔드포인트 + 다음에 칠 명령
  node artlist.mjs connect     서버 등록 (멱등) [--scope project|local|user]
  node artlist.mjs auth        인증 절차 안내
  node artlist.mjs verify      인증 판정 — 0 인증됨 · 2 인증필요 · 3 미등록 · 4 실패
  node artlist.mjs disconnect  등록 해제 [--scope …]
  node artlist.mjs selftest    자체 검사
`;

const [, , cmd = 'status', ...argv] = process.argv;
const run = {
  status: () => cmdStatus(),
  connect: () => cmdConnect(argv),
  auth: () => cmdAuth(),
  verify: () => cmdVerify(),
  disconnect: () => cmdDisconnect(argv),
  selftest: () => cmdSelftest(),
}[cmd];

if (!run) { console.log(USAGE); process.exit(cmd === '--help' || cmd === '-h' ? 0 : 64); }
process.exit(await run());
