#!/usr/bin/env node
// C1.7 — "쓰던 서식 그대로". 스캔한 종이 서식 한 장과, 그 위에 잡힌 필드를 **같은 좌표표에서** 만든다.
//
// 왜 생성하나: 로컬 시드의 서식 14건은 전부 `pages: []`(배경 이미지 없음)이라
// 제품의 원본 오버레이 화면(`FormFillBody` canOverlay)이 서지 않는다. 그리고 추출 자체는
// 멀티모달 LLM(`runtime/form_template/extraction`, google/gemini-2.5-flash)이라 로컬에 키가 없다.
// 컷의 약속은 "추출 과정"이 아니라 **결과 화면**이다(cuts.json C1.7 check: "추출은 운영자 화면 — 결과 화면만").
// 그래서 추출 **결과**를 심고 화면만 찍는다 — `sNN-setup.sql` 관례와 같다.
//
// 좌표가 어긋나면 그 화면은 거짓말이 된다. 그래서 BOXES 한 곳에서 종이와 스키마를 같이 뽑는다.
//
//   node v2/_scripts/c17-form-asset.mjs        # PNG(스토리지) + v2/_scripts/c17-form-setup.sql
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DEMO = path.resolve(HERE, '../..')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PAGE = { w: 1240, h: 1754 }                      // A4 @ 150dpi
const TEMPLATE_ID = 'f0c17000-0000-4000-8000-000000000017'
const STORE = '/tmp/saas-storage'
const IMG_PATH = `form-templates/${TEMPLATE_ID}/page-1.png`

// 좌표는 정규화(0~1). 종이의 빈 칸과 스키마의 element가 이 표 하나를 같이 본다.
const BOXES = [
  { id: 'child_name',    label: '아동 성명',      type: 'text',     rect: [0.300, 0.148, 0.290, 0.030], required: true },
  { id: 'child_birth',   label: '생년월일',       type: 'date',     rect: [0.680, 0.148, 0.230, 0.030], required: true },
  { id: 'guardian_name', label: '보호자 성명',    type: 'text',     rect: [0.300, 0.196, 0.290, 0.030], required: true },
  { id: 'guardian_phone',label: '연락처',         type: 'phone',    rect: [0.680, 0.196, 0.230, 0.030], required: true },
  { id: 'school',        label: '학교 · 학년',    type: 'text',     rect: [0.300, 0.244, 0.610, 0.030] },
  { id: 'chief_complaint', label: '주호소 (오시게 된 이유)', type: 'textarea', rect: [0.090, 0.330, 0.820, 0.120], required: true },
  { id: 'onset',         label: '언제부터',       type: 'text',     rect: [0.300, 0.480, 0.610, 0.030] },
  { id: 'concern_areas', label: '염려되는 영역',  type: 'checkbox_group',
    rect: [0.090, 0.540, 0.820, 0.034],
    options: ['정서·불안', '행동', '또래관계', '학습', '수면'] },
  { id: 'prev_counseling', label: '이전 상담·치료 경험', type: 'radio',
    rect: [0.090, 0.606, 0.400, 0.034], options: ['있음', '없음'] },
  { id: 'medication',    label: '복용 중인 약',   type: 'text',     rect: [0.300, 0.660, 0.610, 0.030] },
  { id: 'guardian_note', label: '보호자가 더 알리고 싶은 것', type: 'textarea', rect: [0.090, 0.730, 0.820, 0.100] },
  { id: 'consent',       label: '개인정보 수집·이용 동의', type: 'checkbox_group',
    rect: [0.090, 0.880, 0.400, 0.034], options: ['동의합니다'] },
  // required 아님 — 제품에 서명 패드가 없다(apps/web·admin·mobile* 어디에도 canvas가 없고 목록 폴백은
  // signature를 아예 안 그린다). 필수로 두면 VerifyRequiredFieldsService가 제출을 400으로 막아
  // 보호자가 서식을 아예 제출할 수 없다. C1.9는 서명을 연출하지 않는다 — status/c19-formsend.md 참조.
  { id: 'sign',          label: '보호자 서명',    type: 'signature', rect: [0.620, 0.876, 0.290, 0.046] }
]

const pct = (v) => `${(v * 100).toFixed(3)}%`
const isChoice = (b) => b.type === 'checkbox_group' || b.type === 'radio'

// ── 종이 ────────────────────────────────────────────────────────────────────
// 복사기를 몇 번 거친 인쇄물처럼: 순수한 흰색이 아니고, 선이 고르지 않고, 아주 조금 기울어 있다.
const paper = `<!doctype html><meta charset="utf-8"><style>
  @import url('https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${PAGE.w}px;height:${PAGE.h}px;background:#f4f2ee;font-family:'Nanum Gothic','Apple SD Gothic Neo',sans-serif}
  .sheet{position:absolute;inset:0;transform:rotate(-0.35deg);filter:contrast(1.06) brightness(0.99)}
  .ttl{position:absolute;left:0;right:0;top:6.2%;text-align:center;font-size:34px;font-weight:700;letter-spacing:14px;color:#2c2c2c}
  .sub{position:absolute;left:0;right:0;top:10.0%;text-align:center;font-size:15px;color:#6a6a6a;letter-spacing:2px}
  .rule{position:absolute;background:#3a3a3a;opacity:.62}
  .lb{position:absolute;font-size:17px;color:#333;white-space:nowrap}
  .bx{position:absolute;border:1px solid #4a4a4a;opacity:.72}
  .opt{position:absolute;font-size:16px;color:#333;display:flex;align-items:center;gap:8px}
  .sq{display:inline-block;width:15px;height:15px;border:1px solid #4a4a4a}
  .ci{display:inline-block;width:15px;height:15px;border:1px solid #4a4a4a;border-radius:50%}
  .foot{position:absolute;left:9%;bottom:3.4%;font-size:13px;color:#7a7a7a}
  .grain{position:absolute;inset:0;pointer-events:none;
    background-image:radial-gradient(rgba(0,0,0,.055) 1px,transparent 1px);background-size:3px 3px;mix-blend-mode:multiply}
</style><div class="sheet">
  <div class="ttl">사 전 기 록 지</div>
  <div class="sub">마인드스코프 아동심리상담센터</div>
  <div class="rule" style="left:9%;top:12.4%;width:82%;height:2px"></div>
  ${BOXES.map((b) => {
    const [x, y, w, h] = b.rect
    if (isChoice(b)) {
      const mark = b.type === 'radio' ? 'ci' : 'sq'
      const gap = w / b.options.length
      return `<div class="lb" style="left:9%;top:${pct(y - 0.026)}">${b.label}</div>` +
        b.options.map((o, i) =>
          `<div class="opt" style="left:${pct(x + gap * i)};top:${pct(y)};height:${pct(h)}"><span class="${mark}"></span>${o}</div>`).join('')
    }
    if (b.type === 'signature') {
      return `<div class="lb" style="left:${pct(x)};top:${pct(y - 0.028)}">${b.label}</div>` +
        `<div class="rule" style="left:${pct(x)};top:${pct(y + h)};width:${pct(w)};height:1px"></div>` +
        `<div class="lb" style="left:${pct(x + w - 0.055)};top:${pct(y + h * 0.35)};font-size:15px;color:#555">(인)</div>`
    }
    if (b.type === 'textarea') {
      const lines = Math.max(2, Math.round(h / 0.028))
      return `<div class="lb" style="left:9%;top:${pct(y - 0.026)}">${b.label}</div>` +
        Array.from({ length: lines }, (_, i) =>
          `<div class="rule" style="left:${pct(x)};top:${pct(y + (h / lines) * (i + 1))};width:${pct(w)};height:1px"></div>`).join('')
    }
    // 라벨은 칸 바로 왼쪽에 붙인다 — 전부 9%에 두면 오른쪽 칸(생년월일·연락처)의 라벨이 겹친다
    return `<div class="lb" style="left:${pct(Math.max(0.09, x - 0.195))};top:${pct(y + 0.004)}">${b.label}</div>` +
      `<div class="rule" style="left:${pct(x)};top:${pct(y + h)};width:${pct(w)};height:1px"></div>`
  }).join('')}
  <div class="foot">※ 작성해 주신 내용은 상담 목적으로만 사용되며, 보관 기간이 지나면 폐기합니다.</div>
</div><div class="grain"></div>`

const tmp = path.join(DEMO, 'v2/_scripts/.c17-paper.html')
fs.writeFileSync(tmp, paper)
const outPng = path.join(STORE, IMG_PATH)
fs.mkdirSync(path.dirname(outPng), { recursive: true })
execFileSync(CHROME, [
  '--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
  `--window-size=${PAGE.w},${PAGE.h}`, `--screenshot=${outPng}`, `file://${tmp}`
], { stdio: 'ignore' })
fs.rmSync(tmp, { force: true })
if (!fs.existsSync(outPng)) { console.error('PNG 렌더 실패'); process.exit(1) }

// ── 스키마 ──────────────────────────────────────────────────────────────────
const fields = {}
const elements = []
let z = 0
for (const b of BOXES) {
  fields[b.id] = {
    type: b.type, label: b.label, required: !!b.required,
    ...(b.options ? { options: b.options.map((o) => ({ value: o, label: o })) } : {})
  }
  const [x, y, w, h] = b.rect
  if (isChoice(b)) {
    // 선택지는 칸마다 element를 나눈다 — 화면에서 그 네모 하나하나가 눌린다
    const gap = w / b.options.length
    // 정사각형으로 잡는다 — 종이의 네모(15px)가 세로로 늘어나면 체크칸으로 안 읽힌다.
    // 폭 0.020(=24.8px)에 맞춘 높이는 0.020 × (폭/높이) 비율이다.
    const sqH = 0.020 * PAGE.w / PAGE.h
    b.options.forEach((o, i) => elements.push({
      id: `${b.id}_${i}`, page: 1, rect: [x + gap * i, y + (h - sqH) / 2, 0.020, sqH], z: ++z,
      widget: b.type, field_refs: [b.id], option: o
    }))
  } else {
    elements.push({ id: b.id, page: 1, rect: [x, y, w, h], z: ++z, widget: b.type, field_refs: [b.id] })
  }
}
const schema = { pages: [{ no: 1, image: IMG_PATH, w: PAGE.w, h: PAGE.h }], fields, elements }

const sql = `-- C1.7 필드가 잡힌 서식 — 스캔 원본 + 그 위에 잡힌 필드.
-- 이 파일은 손으로 고치지 않는다. 좌표의 정본은 v2/_scripts/c17-form-asset.mjs의 BOXES다:
--   node movies/26IRDEMO/v2/_scripts/c17-form-asset.mjs
-- 그 스크립트가 종이 PNG(${STORE}/${IMG_PATH})와 이 SQL을 같이 만든다.
--
-- 이름이 '사전기록지'여야 한다 — 내담자 상세의 \`템플릿으로 작성\`이 그 이름으로 찾는다
-- (detail-service.ts handleOnlineRequest: items.find(t => t.name === '사전기록지' && t.is_active)).
delete from form_templates where id = '${TEMPLATE_ID}';
insert into form_templates (id, center_id, status, name, version, is_active, schema, created_at, updated_at)
select '${TEMPLATE_ID}', c.id, 'published', '사전기록지', 1, true,
       $schema$${JSON.stringify(schema)}$schema$::jsonb, now(), now()
from centers c where c.deleted_at is null order by c.created_at limit 1;

select id, name, status, schema->'pages'->0->>'image' as page_image,
       (select count(*) from jsonb_object_keys(schema->'fields')) as fields,
       jsonb_array_length(schema->'elements') as elements
from form_templates where id = '${TEMPLATE_ID}';
`
fs.writeFileSync(path.join(DEMO, 'v2/_scripts/c17-form-setup.sql'), sql)
console.log(`PNG   ${outPng}`)
console.log(`SQL   v2/_scripts/c17-form-setup.sql  (필드 ${Object.keys(fields).length} · element ${elements.length})`)
