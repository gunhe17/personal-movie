/**
 * 로르샤하 카드 이미지 — 단일 출처.
 *
 * 이 10줄짜리 import가 CardCanvas·CardTabs·admin 영역편집 화면에
 * 각각 복붙돼 있었다. 카드 이미지를 교체하거나 해상도를 바꿀 때 한 곳만
 * 놓치면 화면마다 다른 그림이 뜨고, 그런 어긋남은 눈으로 봐야만 발견된다.
 *
 * 카드는 로마숫자('I'~'X')로 다루고 파일명은 1~10이라, 그 변환도 여기서
 * 한 번만 한다(호출부가 `cardToIndex(card) - 1` 같은 계산을 재현하지 않게).
 */
import card1 from '$lib/assets/rorschach/card-1.png'
import card2 from '$lib/assets/rorschach/card-2.png'
import card3 from '$lib/assets/rorschach/card-3.png'
import card4 from '$lib/assets/rorschach/card-4.png'
import card5 from '$lib/assets/rorschach/card-5.png'
import card6 from '$lib/assets/rorschach/card-6.png'
import card7 from '$lib/assets/rorschach/card-7.png'
import card8 from '$lib/assets/rorschach/card-8.png'
import card9 from '$lib/assets/rorschach/card-9.png'
import card10 from '$lib/assets/rorschach/card-10.png'

/**
 * 썸네일(384px) — 탭 칩처럼 작게 쓰는 자리 전용.
 *
 * 원본은 4000x2250, 10장 합계 7.9MB다. 64x56 썸네일에 그걸 쓰면 브라우저가
 * 매 렌더마다 축소해야 해서 탭 전환·첫 렌더가 눈에 띄게 느려진다.
 * 축소본은 합계 256KB(-97%)이고, 레티나 2배(128x112)에도 여유가 있다.
 */
import thumb1 from '$lib/assets/rorschach/card-1-thumb.png'
import thumb2 from '$lib/assets/rorschach/card-2-thumb.png'
import thumb3 from '$lib/assets/rorschach/card-3-thumb.png'
import thumb4 from '$lib/assets/rorschach/card-4-thumb.png'
import thumb5 from '$lib/assets/rorschach/card-5-thumb.png'
import thumb6 from '$lib/assets/rorschach/card-6-thumb.png'
import thumb7 from '$lib/assets/rorschach/card-7-thumb.png'
import thumb8 from '$lib/assets/rorschach/card-8-thumb.png'
import thumb9 from '$lib/assets/rorschach/card-9-thumb.png'
import thumb10 from '$lib/assets/rorschach/card-10-thumb.png'

import { cardToIndex } from './constants'
import type { RorschachCard } from './types'

/** 카드 1~10 이미지 (0-based 배열) */
const CARD_IMAGES = [
  card1,
  card2,
  card3,
  card4,
  card5,
  card6,
  card7,
  card8,
  card9,
  card10
]

/** 카드 1~10 썸네일 (0-based 배열) */
const CARD_THUMBS = [
  thumb1,
  thumb2,
  thumb3,
  thumb4,
  thumb5,
  thumb6,
  thumb7,
  thumb8,
  thumb9,
  thumb10
]

/** 로마숫자 카드 → 이미지 URL */
export function cardImage(card: RorschachCard): string {
  return CARD_IMAGES[cardToIndex(card) - 1]
}

/**
 * 로마숫자 카드 → 썸네일 URL.
 *
 * 칩·목록처럼 작게 그리는 자리에서만 쓴다. 캔버스처럼 확대해서 보는 곳은
 * cardImage(원본)를 써야 한다 — 썸네일을 키우면 뭉개진다.
 */
export function cardThumb(card: RorschachCard): string {
  return CARD_THUMBS[cardToIndex(card) - 1]
}

/** 1-based 카드 번호 → 이미지 URL (admin 영역편집 화면이 쓴다) */
export function cardImageByNumber(cardNo: number): string | undefined {
  return CARD_IMAGES[cardNo - 1]
}
