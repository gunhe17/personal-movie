// 전역 상태 + 데이터 로딩 — data/*.json이 정본, 앱은 렌더만

/* API 주소는 지금 열려 있는 주소에서 끌어온다 — localhost로 박아 두면
   다른 기기(휴대폰·다른 PC)에서 열었을 때 '그 기기의' localhost를 부르게 된다.
   다른 곳을 보게 하려면 VITE_API=http://... 로 띄운다. */
export const API =
  (import.meta.env.VITE_API as string | undefined) ??
  `${location.protocol}//${location.hostname}:3502`

type Detail =
  | { kind: 'concept'; key: string }
  | { kind: 'draftConcept'; key: string }
  | { kind: 'boundary' }
  | { kind: 'instance'; node: InstanceNode }
  | { kind: 'draft' }
  | null

export interface InstanceNode {
  id: string
  title: string
  concept: string
  sub?: string
  data: Record<string, unknown>
}

export const S = $state({
  loaded: false,
  catalog: null as any,
  decisions: null as any,
  attributes: null as any,
  bindings: null as any,
  audit: null as any,
  profiles: {} as Record<string, any>,
  profileKey: 'center',
  draft: null as any,
  transitionMsg: '' as string,

  drafts: null as any,
  draftAttrs: null as any,
  boundary: null as any,
  showDrafts: false,   // 검사 축 초안은 기본으로 숨긴다 — 켜면 지도가 두 배로 넓어져 글자가 작아진다

  view: 'model' as 'model' | 'audit' | 'console',
  modelTab: 'graph' as 'graph' | 'preview' | 'matrix' | 'json',
  detail: null as Detail,
  modalDecision: null as string | null,
  auditFilter: null as string | null,

  // API 콘솔
  token: null as string | null,
  centerId: null as string | null,
  centerName: null as string | null,
  clientId: null as string | null,
  clientName: null as string | null,
  personId: null as string | null,
  who: null as string | null,
  centers: [] as any[],
  toast: '',
})

export async function loadAll() {
  const j = (p: string) => fetch(p).then((r) => r.json())
  S.catalog = await j('/data/catalog.json')
  S.decisions = await j('/data/decisions.json')
  S.attributes = (await j('/data/attributes.json')).concepts
  S.bindings = (await j('/data/bindings.json')).bindings
  S.audit = await j('/data/audit.json')
  const idx = await j('/data/profiles/index.json')
  for (const k of idx.profiles) S.profiles[k] = await j(`/data/profiles/${k}.json`)
  // 초안 조각 (있으면) — 정본과 분리 렌더
  try { S.drafts = await j('/data/drafts/assessment.catalog.json') } catch { S.drafts = null }
  try { S.draftAttrs = (await j('/data/drafts/assessment.attributes.json')).concepts } catch { S.draftAttrs = null }
  try { S.boundary = await j('/data/drafts/mindbom.boundary.json') } catch { S.boundary = null }
  S.loaded = true
}

export function activeProfile() {
  return S.profileKey === '__draft__' ? S.draft : S.profiles[S.profileKey]
}

export function setProfile(k: string) {
  S.profileKey = k
  const p = activeProfile()
  S.transitionMsg = p ? `${p.name}로 바꿨습니다 — 코드는 그대로, 설정 파일만 갈아끼운 것` : ''
  setTimeout(() => (S.transitionMsg = ''), 1600)
}

export function toast(msg: string) {
  S.toast = msg
  setTimeout(() => (S.toast = ''), 3200)
}

export async function login(email: string, pw: string) {
  try {
    const res = await fetch(API + '/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pw }),
    })
    const d = await res.json()
    if (!res.ok) return toast('로그인 실패: ' + (d.detail?.message || d.detail || res.status))
    S.token = d.access_token || d.token
    S.centers = d.centers || []
    S.centerId = S.centers[0]?.id || null
    S.centerName = S.centers[0]?.name || null
    S.who = d.person?.name || email
    toast('로그인 완료 — API 콘솔에서 온톨로지 개념 조회 가능')
  } catch {
    toast('API 연결 실패 — localhost:3502 실행 여부 확인')
  }
}
