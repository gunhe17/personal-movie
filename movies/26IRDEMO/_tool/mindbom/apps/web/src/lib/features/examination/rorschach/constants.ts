import type { RorschachCard } from './types'

export const RORSCHACH_CARDS: RorschachCard[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

/**
 * 반응 색 팔레트 — **칩과 영역을 잇는 유일한 끈**이다.
 *
 * 한때 없앴다가 되살렸다. 없앤 이유는 "위치가 반응당 하나가 되면서(§14-7)
 * 한 카드 안에서 조각끼리 구분할 대상이 사라졌다"였는데, 그건 카드 위만 본
 * 판단이었다. 화면이 통합되면서(§14-1) 칩 줄과 카드가 한 화면에 나란히 놓였고,
 * **"칩 3번이 카드의 어느 폴리곤인가"**를 잇는 것이 다시 필요해졌다. 라벨
 * 숫자만으로는 조각 중앙의 6px 글자를 읽어야 하지만, 색은 곁눈에 잡힌다.
 *
 * 카드 안에서 조각이 겹칠 때도 색이 있어야 경계가 읽힌다 — 같은 파랑 두 개가
 * 포개지면 어디까지가 한 조각인지 알 수 없다.
 */
export const RESPONSE_COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#F59E0B', // amber
  '#10B981', // green
  '#EF4444', // red
  '#06B6D4', // cyan
  '#F97316'  // orange
] as const

/** 반응 색이 정해지기 전(번호 없음)·미완 상태에서 쓰는 중립색 */
export const RESPONSE_COLOR_NEUTRAL = '#9CA3AF' // gray-400

/**
 * 반응 번호 → 색. **카드 안 번호를 기준으로 돈다.**
 *
 * 그래서 카드마다 1번은 항상 파랑, 2번은 보라다. 카드를 넘겨도 같은 자리에
 * 같은 색이 오므로 눈이 한 번만 학습하면 된다. 세션 통산으로 돌리면 카드 II-1과
 * III-1이 다른 색이 되어 그 학습이 무너진다.
 *
 * ⚠️ **색은 저장하지 않는다 — 번호에서 파생시킨다.** 조각에 `color` 컬럼이
 * 있었는데 그릴 당시 값이 박제된 것이라 규칙을 바꾸면 옛 데이터만 옛 색으로
 * 남았다(기존 조각은 전부 `#3B82F6`이었다). 화면은 이미 저장값을 버리고
 * 파생시키고 있었고, 2026-08-26에 컬럼 자체를 걷어냈다(`label`과 함께).
 * 파생시키면 두 곳이 어긋날 수 없다 — 값이 한 곳에만 있기 때문이다.
 *
 * 반응이 9개를 넘으면 색이 한 바퀴 돈다. 카드당 반응은 규준상 2.2개,
 * 최대 7~8개라(§14-13) 실제로 겹칠 일은 드물고, 겹쳐도 번호 라벨이 정본이다.
 */
export function responseColor(responseNo: number | null | undefined): string {
  // 서버는 1부터 매기지만, 0·음수가 들어오면 `(0-1) % 8 = -1`로 배열 밖을
  // 짚어 `undefined`가 색 자리에 들어간다. 폴리곤이 소리 없이 투명해지고
  // 원인을 카드 이미지 쪽에서 찾게 된다 — 중립색으로 떨어뜨린다.
  if (responseNo == null || responseNo < 1) return RESPONSE_COLOR_NEUTRAL
  return RESPONSE_COLORS[(responseNo - 1) % RESPONSE_COLORS.length]
}

/**
 * Exner CS 코딩 부호 — 임상가가 채점 화면에서 고르는 목록.
 *
 * ⚠️ 정본은 백엔드다. contracts/rorschach-coding.json이 계약이고, 그 파일은
 *    apps/api/.../rorschach/coding_codes.py에서 생성된다.
 *    이 표를 임의로 좁히면 채점이 읽는 부호를 임상가가 입력할 수 없게 되고,
 *    그 지표는 **에러 없이 항상 0**이 된다.
 *
 * 실제로 그랬다(2026-08). contents 8개(Bt/Cg/Cl/Fd/Ge/Ls/Na/Xy)와
 * specialScores 5개(AG/COP/CP/MOR/PER)가 빠져 있어서:
 *   - ISO Index = (Bt + 2Cl + Ge + Ls + 2Na) / R → 분자가 구조적으로 0
 *   - COP·AG(대인 지각), MOR(병적), PER(개인화), Fd(의존), CP(색채 투사) → 전부 0
 * 대인관계 클러스터가 통째로 비어 있었는데 화면은 멀쩡히 그려졌다.
 *
 * 계약과 어긋나면 coding-contract.spec.ts가 터진다. 부호를 바꾸려면
 * coding_codes.py를 고치고 계약을 다시 내보낼 것.
 */
export const CODING_OPTIONS = {
  // location은 드롭다운이 아니라 자유 입력이다 — 임상가가 'D7'·'Dd34'처럼
  // 세부 번호를 붙여 적는다. 여기 목록은 기본형 참고용.
  location: ['W', 'D', 'Dd', 'WS', 'DS', 'DdS'],
  dq: ['+', 'o', 'v/+', 'v'],
  determinants: [
    // 형태
    'F',
    // 운동 — 인간 / 동물 / 무생물
    'Ma', 'Mp', 'Ma-p',
    'FMa', 'FMp', 'FMa-p',
    "ma", "mp", "ma-p",
    // 유채색 / 무채색
    'FC', 'CF', 'C', 'Cn',
    "FC'", "C'F", "C'",
    // 재질 / 차원 / 확산음영
    'FT', 'TF', 'T',
    'FV', 'VF', 'V',
    'FY', 'YF', 'Y',
    // 형태차원 / 반사
    'FD', 'Fr', 'rF',
  ],
  fq: ['+', 'o', 'u', '-', 'none'],
  contents: [
    // 인간 / 동물
    'H', '(H)', 'Hd', '(Hd)', 'Hx',
    'A', '(A)', 'Ad', '(Ad)',
    // 해부·예술·인류
    'An', 'Art', 'Ay',
    // 자연·풍경 — ISO Index 구성 항
    'Bt', 'Cl', 'Ge', 'Ls', 'Na',
    // 기타 — CDI·특수지표에서 참조
    'Bl', 'Cg', 'Ex', 'Fd', 'Fi', 'Hh', 'Sc', 'Sx', 'Xy', 'Id',
  ],
  zScore: ['ZW', 'ZA', 'ZD', 'ZS'],
  specialScores: [
    // 인지적 특수점수 (Sum6 / WSum6)
    'DV1', 'DV2',
    'DR1', 'DR2',
    'INCOM1', 'INCOM2',
    'FABCOM1', 'FABCOM2',
    'ALOG', 'CONTAM',
    // 주제적 특수점수
    'AB', 'AG', 'COP', 'MOR', 'PER',
    // 기타
    'CP', 'PSV',
  ],
} as const

export function cardToIndex(card: RorschachCard): number {
  return RORSCHACH_CARDS.indexOf(card) + 1
}

/**
 * 카드 번호 → 로마숫자. **범위 밖이면 카드 I로 떨어진다 — 의도된 것이다.**
 *
 * 이 값은 표시에만 쓰이는 게 아니라 `currentCard` 상태로 들어간다. 그 칸은
 * 유효한 카드여야 화면이 성립하므로 숫자 문자열을 넣을 수 없다. 애초에
 * `card_no`는 API에서 `ge=1, le=10`으로 막혀 있어 여기 닿지 않는다.
 *
 * ⚠️ 백엔드의 `card_label()`은 **반대로** 정했다(범위 밖이면 숫자). 그쪽 값은
 * AI 채점 요청에 실려 나가서, 틀린 카드 이름을 대면 엉뚱한 카드로 채점된다.
 * 같은 물음에 답이 다른 이유가 이것이다 — 쓰이는 자리가 다르다.
 */
export function indexToCard(no: number): RorschachCard {
  return RORSCHACH_CARDS[no - 1] ?? RORSCHACH_CARDS[0]
}

/**
 * 카드 위에 겹치는 SVG들의 viewBox 한 변. **세 겹이 같은 값이어야 한다.**
 *
 * `FreehandDrawing`(그리기) · `RegionOverlay`(반응 조각) · `AreaOverlay`(영역
 * 안내)가 한 카드 위에 포개진다. path 좌표는 0..1로 저장하고 이 값으로 늘려
 * 그린다. 세 곳에 `const VB = 1000`이 각각 있었는데, 한쪽만 바뀌면 좌표는
 * 맞아도 **선 굵기와 글자 크기가 겹마다 달라진다**(둘 다 viewBox 단위다).
 */
export const OVERLAY_VIEWBOX = 1000

/**
 * 영역 부호의 형태 — `W` / `DS6` / `Dd99`. 세 덩어리로 갈린다:
 * 범주(W/D/Dd) · 공백(S) · 번호.
 *
 * **정본은 백엔드 `coding_codes.LOCATION_RE`다.** 부호 목록과 달리 이건
 * 열거가 안 되므로(Dd99까지 있다) 계약이 패턴 문자열을 싣는다
 * (`contracts/rorschach-coding.json`의 `location_pattern`).
 * 어긋나면 **서버가 받아준 값을 화면이 못 읽어 칸이 비어 보이고**, 임상가가
 * 그 상태로 다시 저장하면 부호가 진짜 사라진다. `coding-contract.spec.ts`가
 * 이 문자열과 계약을 대조한다.
 *
 * ⚠️ `Dd`가 `D`보다 앞이어야 한다 — 뒤에 두면 `Dd6`이 `D` + `d6`으로 갈린다.
 */
export const LOCATION_PATTERN = '^(W|Dd|D)([Ss])?(\\d*)$'

/**
 * 반응 번호를 ①②③으로 — 임상가가 채점지에 쓰는 표기다.
 *
 * 번호가 없으면(아직 안 매겨짐) `·`. 21 이상은 원문자가 없어 `(21)`로 쓴다.
 * `ResponsePopover`와 `Review`에 같은 함수가 각각 있었다.
 */
export function circled(n: number | null): string {
  if (n == null) return '·'
  return n >= 1 && n <= 20 ? String.fromCharCode(0x245f + n) : `(${n})`
}

/**
 * 카드 방향 — ∧ 정위 / ∨ 180° / < > 90°. **반응마다 붙는다.**
 *
 * "피검자가 카드를 어느 쪽으로 놓고 봤는가"라는 **기록**이지 화면 표시가
 * 아니다. 자주 돌리는 것 자체가 해석 대상이라 남긴다.
 * 화면의 카드 그림은 돌리지 않는다 — 태블릿에서는 검사자가 기기를 직접
 * 돌리므로 화면까지 돌면 두 번 돌아간다.
 */
export type CardOrientation = 'up' | 'down' | 'left' | 'right'

/**
 * 방향 표기는 Material Icon으로 낸다.
 *
 * ∧∨<> 문자를 그대로 쓰면 폰트마다 자폭·베이스라인이 달라 버튼 안에서
 * 어긋난다. Icon 컴포넌트는 크기 사다리(12/16/20/24/32)에 맞춰 렌더된다.
 */
export const ORIENTATION_ICON: Record<CardOrientation, string> = {
  up: 'expand_less',
  down: 'expand_more',
  left: 'chevron_left',
  right: 'chevron_right'
}

export const ORIENTATION_LABEL: Record<CardOrientation, string> = {
  up: '정위',
  down: '180° 역위',
  left: '90° 좌회전',
  right: '90° 우회전'
}

/** 표시 순서 — 시계방향 */
export const ORIENTATION_ORDER: CardOrientation[] = ['up', 'right', 'down', 'left']

/**
 * 평범반응(P) 표 — **출처: 『로르샤하 종합체계 워크북』(Exner) 〈표 5-2〉 89쪽.**
 *
 * ⚠️ 정본은 백엔드다. `contracts/rorschach-coding.json`의 `popular_responses`가
 *    계약이고, 그 파일은 `coding_codes.py`의 `POPULAR_RESPONSES`에서 생성된다.
 *    어긋나면 `coding-contract.spec.ts`가 터진다.
 *
 * P는 **표의 함수**이지 임상가의 인상이 아니다. 예전 화면은 체크박스 하나로
 * 받고 기본값이 false여서 "안 눌렀다"와 "P 아님으로 확정했다"가 구분되지
 * 않았다(§13 E-2).
 *
 * ⚠️ **이 표로 P를 자동 판정하지 않는다.** 기준에 "반점의 꼭대기가 박쥐의
 * 상단부로 지각되고"처럼 **무엇으로 봤는지**가 걸려 있어, 영역이 맞아도 내용이
 * 다르면 P가 아니다. 표가 답하는 것은 딱 하나 — **"이 카드의 이 영역이
 * 평범반응 자리인가."** 나머지는 임상가가 본다(AI 초안 → 사람 확인과 같은 형태).
 */
export interface PopularResponse {
  card_no: number
  locations: string[]
  content: string
  criteria: string
}

export const POPULAR_RESPONSES: PopularResponse[] = [
  { card_no: 1, locations: ['W'], content: '박쥐', criteria: '반점의 꼭대기가 박쥐의 상단부로 지각되고 항상 반점 전체를 포함해야 한다.' },
  { card_no: 1, locations: ['W'], content: '나비', criteria: '반점의 꼭대기가 나비의 상단부로 지각되고 항상 반점 전체를 포함해야 한다.' },
  { card_no: 2, locations: ['D1'], content: '구체적으로 밝혀진 동물', criteria: '곰, 개, 코끼리 또는 양. 보통 머리나 상체가 있으나 동물 전체를 포함하고 있어도 P를 부여한다.' },
  { card_no: 3, locations: ['D9'], content: '인간상이나 인형·만화 등의 묘사', criteria: 'D1이 두 인간상으로 사용되었다면, D7이나 Dd31은 인간상의 부분으로 보고되지 않아야 P로 기호화한다.' },
  { card_no: 4, locations: ['W', 'D7'], content: '인간이나 거인', criteria: '괴물, 공상과학에서 나오는 생명체와 같이 인간을 닮은 모양. 동물상은 P로 기호화하지 않는다.' },
  { card_no: 5, locations: ['W'], content: '박쥐', criteria: '반점의 꼭대기를 박쥐의 상단부로 지각해야 하고 항상 반점 전체를 포함해야 한다.' },
  { card_no: 5, locations: ['W'], content: '나비', criteria: '반점의 꼭대기를 나비의 상단부로 지각해야 하고 항상 반점 전체를 포함해야 한다.' },
  { card_no: 6, locations: ['W', 'D1'], content: '동물가죽·짐승가죽·융단이나 모피', criteria: '고양이나 여우 같은 동물 전체를 기술하는 데 자주 포함된다. 수검자가 가죽·융단·모피를 실제로 언급했는지, 반응기술에 분명하게 내포되어 있는지에 근거해 결정한다.' },
  { card_no: 7, locations: ['D9'], content: '사람의 머리나 얼굴', criteria: '여자·아이·인디언처럼 밝힐 수도, 성별을 밝히지 않을 수도 있다. D2나 Dd23 영역을 포함한다면 D9 영역에 한해서 머리나 얼굴이라고 할 때만 P로 기호화된다.' },
  { card_no: 8, locations: ['D1'], content: '전체 동물상', criteria: '개·고양이·다람쥐 같은 종류로 보고 D4 영역과 가까운 부분을 동물의 머리로 지각한다.' },
  { card_no: 9, locations: ['D3'], content: '인간 또는 인간과 유사한 형상', criteria: '마녀, 거인, 괴물, 공상과학에 나오는 생명체.' },
  { card_no: 10, locations: ['D1'], content: '게', criteria: '모든 부속기관은 D1 영역에 한정되어 있어야 한다.' },
  { card_no: 10, locations: ['D1'], content: '거미', criteria: '모든 부속기관은 D1 영역에 한정되어 있어야 한다.' }
]

/**
 * 이 카드·영역이 평범반응 자리인가 — 해당하는 표 항목들.
 *
 * 빈 배열이면 그 자리에서는 P가 나올 수 없다. 비어 있지 않다고 P인 것은
 * **아니다** — 무엇으로 봤는지는 임상가가 본다.
 *
 * 공백 반응(S)이 붙은 형태는 범주를 떼어 비교한다: `WS`도 W 자리다.
 * 백엔드 `popular_candidates()`와 같은 규칙이어야 한다.
 */
export function popularCandidates(
  cardNo: number,
  location: string | null | undefined
): PopularResponse[] {
  if (!location) return []
  const normalized = location.replace('S', '')
  return POPULAR_RESPONSES.filter(
    (p) => p.card_no === cardNo && p.locations.includes(normalized)
  )
}

/**
 * 조직활동 Z값 — 카드별 ZW/ZA/ZD/ZS.
 *
 * **출처: 『로르샤하 종합체계 워크북』(Exner) 〈표 6-1〉 94쪽.**
 * 정본은 백엔드 `scoring.py`의 `Z_TABLE`이고, `contracts/rorschach-coding.json`의
 * `z_values`가 계약이다. 어긋나면 `coding-contract.spec.ts`가 터진다.
 *
 * 화면이 이 값을 알아야 하는 이유: **값이 카드마다 다르다.** 카드 I의 ZW은
 * 1.0인데 카드 IX의 ZW은 5.5다. 부호만 보이면 임상가가 무엇을 고르는지 알 수
 * 없고, "두 기준을 함께 만족하면 더 높은 값을 준다"(워크북 94쪽)는 규칙도
 * 적용할 수 없다.
 */
export const Z_VALUES: Record<number, Record<string, number>> = {
  1: { ZW: 1.0, ZA: 4.0, ZD: 6.0, ZS: 3.5 },
  2: { ZW: 4.5, ZA: 3.0, ZD: 5.5, ZS: 4.5 },
  3: { ZW: 5.5, ZA: 3.0, ZD: 4.0, ZS: 4.5 },
  4: { ZW: 2.0, ZA: 4.0, ZD: 3.5, ZS: 5.0 },
  5: { ZW: 1.0, ZA: 2.5, ZD: 5.0, ZS: 4.0 },
  6: { ZW: 2.5, ZA: 2.5, ZD: 6.0, ZS: 6.5 },
  7: { ZW: 2.5, ZA: 1.0, ZD: 3.0, ZS: 4.0 },
  8: { ZW: 4.5, ZA: 3.0, ZD: 3.0, ZS: 4.0 },
  9: { ZW: 5.5, ZA: 2.5, ZD: 4.5, ZS: 5.0 },
  10: { ZW: 5.5, ZA: 4.0, ZD: 4.5, ZS: 6.0 }
}

/**
 * 이 카드에서 이 Z부호가 갖는 값. 모르는 조합이면 null.
 *
 * ⚠️ **1.0을 "1"로 줄이지 않는다.** 채점지 표기가 소수 한 자리이고
 * (`W+ FMa.FCo (2) A,Ls P 4.5`), 3.5·6.5 같은 값과 나란히 놓이므로
 * 자릿수가 흔들리면 표가 들쭉날쭉해진다.
 */
export function zValue(
  cardNo: number | null | undefined,
  code: string | null | undefined
): string | null {
  if (!cardNo || !code) return null
  const v = Z_VALUES[cardNo]?.[code]
  return v === undefined ? null : v.toFixed(1)
}

/**
 * AI 채점에 필요한 입력이 다 있는가 — **없으면 채점을 걸지 않는다.**
 *
 * 셋 다 필요하다. 하나라도 비면 AI는 "모른다"가 아니라 **그럴듯한 값**을
 * 내놓고, 그 값이 초안 칸에 앉아 임상가가 검토할 대상이 된다. 근거 없는
 * 제안을 검토하게 만드는 것이 검토를 안 받는 것보다 나쁘다.
 *
 * - `free_association_text`: 채점의 원자료. 이게 없으면 볼 것이 없다.
 * - `inquiry_text`: 결정인은 대부분 질문 단계에서 정해진다(Exner). 자유반응만
 *   보면 형태(F)로 몰린다.
 * - `area_code`: 없으면 `coding.location`이 null로 저장되고 그 반응은 **위치
 *   집계에서 조용히 빠진다**(§14-7 · 피드백 v2 b에서 실제로 겪은 것).
 *
 * ⚠️ 서버(`ScoreResponseService`)도 **같은 규칙**으로 막는다. 화면만 잠그면
 * 일괄 채점 경로로 그대로 통과한다.
 */
export function canAiScore(r: {
  free_association_text: string | null
  inquiry_text: string | null
  area_code: string | null
}): boolean {
  return missingScoreInputs(r).length === 0
}

/** 무엇이 비었는가 — 버튼 툴팁이 이름을 대는 데 쓴다(§14-12) */
export function missingScoreInputs(r: {
  free_association_text: string | null
  inquiry_text: string | null
  area_code: string | null
}): string[] {
  const missing: string[] = []
  if (!r.free_association_text?.trim()) missing.push('반응 내용')
  if (!r.inquiry_text?.trim()) missing.push('질문 답변')
  if (!r.area_code?.trim()) missing.push('위치')
  return missing
}
