// C1.9 (뒤 절반) 보호자 폰에서 서식 작성·제출 — `--profile phone`(SPEC v7 · 390×844@3x).
// 시뮬레이터가 아니라 폰용 공개 웹 화면이다(규칙 2-0). 로그인 없다 — 문자로 받은 4자리 코드로 연다.
// 배역: 보호자 이수진(010-3000-0001) · 아동 이하준.
// 시작 URL: /forms/fill/<instanceId>  ·  코드는 환경변수 C19_CODE (자격증명 아님, 발송마다 바뀐다)
//
// 실측: 좁은 폭에서 원본 오버레이는 A4 스캔이 302px로 눌려 글자가 안 읽힌다.
//       제품이 준 `목록으로 보기`로 갈아탄 뒤 작성한다 — 폰용 폴백이 제품의 의도다.
// 서명은 연출하지 않는다 — `signature` 타입은 목록 폴백이 아예 안 그린다(제품 미구현, status 참조).
const CODE = process.env.C19_CODE
if (!CODE || !/^\d{4}$/.test(CODE)) throw new Error('C19_CODE=<4자리> 필요 — forms.verification_code')

const label = (t) => `xpath=//p[contains(text(),"${t}")]`
const fieldOf = (t, tag) => `xpath=//p[contains(text(),"${t}")]/following-sibling::${tag}`
const option = (t) => `xpath=//label[.//span[text()="${t}"]]`

export default async function steps(page, h) {
  await h.beat('문자로 온 링크 — 4자리 인증')
  await h.type('input[inputmode="numeric"]', CODE, '인증코드')
  await h.click('button:has-text("확인")', '확인')
  await h.until('text=사전기록지', '그 서식이 폰에 떴다')
  await h.beat('원본 그대로 — 스캔한 그 종이')
  await h.click('button:has-text("목록으로 보기")', '목록으로 보기')
  await h.until(label('아동 성명'), '작성 화면')

  h.nocutStart('보호자가 폰에서 채운다 → 제출')
  await h.type(fieldOf('아동 성명', 'input'), '이하준', '이하준')
  // <input type=date>의 연도 칸은 6자리까지 먹는다 — '20160922'를 한 번에 치면 연도가 201609가 된다.
  // 연도만 치고 ArrowRight로 칸을 넘긴다(월·일 칸은 두 자리에서 알아서 넘어간다).
  await h.type(fieldOf('생년월일', 'input'), '2016', '2016-09-22')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.type('0922', { delay: 60 })
  await h.reveal(label('보호자 성명'), '보호자')
  await h.type(fieldOf('보호자 성명', 'input'), '이수진', '이수진')
  await h.type(fieldOf('연락처', 'input'), '010-3000-0001', '연락처')
  await h.reveal(label('주호소'), '주호소')
  await h.type(fieldOf('주호소', 'textarea'), '또래 사이에서 자꾸 움츠러들고, 밤에 잠들기를 힘들어해요.', '주호소')
  await h.reveal(label('염려되는 영역'), '염려되는 영역')
  await h.click(option('정서·불안'), '정서·불안')
  await h.click(option('또래관계'), '또래관계')
  await h.click(option('수면'), '수면')
  await h.reveal(label('이전 상담·치료 경험'), '이전 상담 경험')
  await h.click(option('없음'), '없음')
  await h.reveal(label('개인정보 수집·이용 동의'), '동의')
  await h.click(option('동의합니다'), '동의합니다')
  await h.click('button:has-text("제출하기")', '제출하기')
  await h.until('text=제출이 완료되었어요', '제출됨')
  h.nocutEnd()
  await h.hold(800, '끝')
}
