// C1.9 보호자 폰에서 서식 작성 — `--profile phone`(SPEC v8 · 390×844@3x).
// 시뮬레이터가 아니라 폰용 공개 웹 화면이다(규칙 2-0). 로그인 없다 — 문자로 받은 4자리 코드로 연다.
// 배역: 보호자 이수진(010-3000-0001) · 아동 이하준.
// 시작 URL: /forms/fill/<instanceId>  ·  코드는 환경변수 C19_CODE (자격증명 아님, 발송마다 바뀐다)
//
// **원본 위에 보기 그대로** 몇 칸만 채우고 끝낸다 — 제출하지 않는다(2026-09-14 결정).
// 목록 폴백은 "스캔한 그 종이"가 안 보여 컷의 약속이 사라진다. 폰 폭에서 A4가 302px로 눌려도 칸이 종이 위에 선 것이 보인다.
// 오버레이 칸은 `<div title="{라벨}">` 안의 input/button이다(FormFillBody.svelte). 체크칸은 같은 title이 옵션 순서대로 반복된다.
const CODE = process.env.C19_CODE
if (!CODE || !/^\d{4}$/.test(CODE)) throw new Error('C19_CODE=<4자리> 필요 — forms.verification_code')

const box = (t) => `[title="${t}"] input`
const check = (t, n) => `xpath=(//div[@title="${t}"])[${n}]/button`

export default async function steps(page, h) {
  await h.beat('문자로 온 링크 — 4자리 인증')
  await h.type('input[inputmode="numeric"]', CODE, '인증코드')
  await h.click('button:has-text("확인")', '확인')
  await h.until('img[alt="서식 1쪽"]', '스캔한 그 종이가 폰에 떴다')

  h.nocutStart('종이 위 칸을 폰에서 채운다')
  await h.type(box('아동 성명'), '이하준', '이하준')
  // <input type=date>의 연도 칸은 6자리까지 먹는다 — 연도만 치고 ArrowRight로 칸을 넘긴다.
  await h.type(box('생년월일'), '2016', '2016-09-22')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.type('0922', { delay: 60 })
  await h.type(box('보호자 성명'), '이수진', '이수진')
  await h.type(box('연락처'), '010-3000-0001', '연락처')
  await h.click(check('염려되는 영역', 1), '정서·불안')
  await h.click(check('염려되는 영역', 3), '또래관계')
  h.nocutEnd()
  await h.hold(600, '끝')
}
