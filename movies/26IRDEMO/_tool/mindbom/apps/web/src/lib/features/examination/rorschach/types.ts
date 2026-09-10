export type RorschachCard = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII' | 'VIII' | 'IX' | 'X'

export interface Point {
  x: number
  y: number
}

export interface Region {
  /** 클라이언트 임시 ID */
  id: number
  /** 백엔드 UUID — 저장 후 채워짐. null이면 아직 미저장 */
  serverId: string | null
  cardNumber: RorschachCard
  path: Point[]
  timestamp: string
  /** 그리기 시작 시점 녹음 타임코드 (초). 트랜스크립트 매핑용 */
  audioStartSec: number | null
  /** 그리기 종료 시점 녹음 타임코드 (초) */
  audioEndSec: number | null
  color: string
  label: string
  memo: string
}

export interface RorschachCoding {
  location: string | null
  dq: string | null
  determinants: string[]
  fq: string | null
  /**
   * 쌍반응 (2) — **세 값이다.** `popular`와 같은 규칙이다(아래 주석).
   * `null` 아직 안 봤다 / `true` 쌍 / `false` 쌍 아님으로 확정.
   *
   * 여기서 유독 값이 센 이유: (2)는 **자아중심성 지표 3r+(2)/R**에 직접
   * 들어가고 그 값이 다시 S-CON(자살지표)·DEPI로 흘러간다. 검토하지 않은
   * 반응이 "쌍 아님"으로 집계되면 지표가 조용히 낮아진다.
   */
  pair: boolean | null
  contents: string[]
  /**
   * 평범반응 — **세 값이다.**
   * `null` 아직 안 봤다 / `true` P / `false` P 아님으로 확정.
   *
   * P는 Exner 표(〈표 5-2〉)의 함수이지 인상이 아니다. "안 눌렀다"와
   * "표를 보고 P가 아니라고 판단했다"가 같은 값이면 검토가 성립하지 않는다.
   */
  popular: boolean | null
  zScore: string | null
  specialScores: string[]
}

