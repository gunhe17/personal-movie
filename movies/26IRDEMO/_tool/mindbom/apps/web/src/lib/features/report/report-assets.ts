/**
 * 실검사에서 뽑아 온 첨부 에셋의 화면 모델.
 *
 * MaterialAsset(사이드바 그리드의 한 칸)과 나눠 둔다 — 저쪽은 목업을 포함해
 * "그려지는 것"이고, 이건 실검사 모듈이 돌려준 것에 소속 검사 메타를 붙인
 * 중간 형태다. 본문 삽입은 이 모양을 보고 한다(원본 src/table을 들고 있다).
 */
import type { TableMeta } from '$lib/components/document-editor/editor-core'

export interface AssetItem {
  id: string
  name: string
  /** image: 그림 삽입, table: 해석/점수 표 삽입 */
  kind: 'image' | 'table'
  src?: string // image
  table?: TableMeta // table
  count?: number // table 행 수 표시용
  /** 소속 검사 (그룹핑용) */
  examId: string
  /** 소속 검사 종류 라벨 (HTP/Rorschach/SCT) */
  examLabel: string
}

/** 개별 검사 로더가 만드는 에셋 (검사 메타는 loadAssets에서 부착) */
export type RawAsset = Omit<AssetItem, 'examId' | 'examLabel'>
