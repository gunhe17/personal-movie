/**
 * 바우처 자료 등록 페이지 도메인 모델.
 *
 * - Row: 등록 폼의 한 행을 표현. 같은 자료의 여러 확장자 파일을 한 행에 묶어 입력.
 * - PendingVoucherLink: 행에 사전 연결된 바우처 (등록 시 한 트랜잭션에 함께 생성)
 * - emptyRow / buildRowFromFile: Row 팩토리
 */
import { detectVoucherFileType, type VoucherFileType } from './constants'

/** 행에 사전 연결할 바우처 (업로드 시 한 트랜잭션에 함께 생성). */
export interface UploadVoucherFileLinkPayload {
  voucher_id: string
  page_range?: [number, number] | null
  note?: string | null
}

export type PendingVoucherLink = UploadVoucherFileLinkPayload & {
  /** 미리보기 표시용 바우처 메타 (저장 안 됨) */
  voucher: {
    id: string
    name: string
    program_year: number
  }
}

export type Row = {
  id: string
  name: string
  /** 빈 문자열 = 미선택 (사용자가 명시적으로 골라야 함) */
  type: VoucherFileType | ''
  sourceUrl: string
  /** 같은 자료의 여러 확장자 파일들 — 확장자별 슬롯으로 묶임 */
  files: File[]
  voucherLinks: PendingVoucherLink[]
  /** 자료명이 파일명에서 자동 채워졌고, 사용자가 아직 확인/편집하지 않은 상태 */
  nameAutoFilled: boolean
  /** 자료 유형이 파일명 키워드로 자동 추정되었고, 사용자가 아직 확인/변경하지 않은 상태 */
  typeAutoFilled: boolean
}

function genId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `r-${Math.random().toString(36).slice(2)}-${Date.now()}`
}

/**
 * 파일명 → 자료 제목으로 쓸 만한 텍스트로 정리.
 *
 * 처리:
 *   1. 확장자 제거
 *   2. NFC 정규화 (macOS NFD 대응)
 *   3. `+`, `_`, `-` 등 단어 구분자 → 공백
 *   4. 대괄호/소괄호/중괄호/한글 따옴표 → 공백
 *   5. 연속 공백 → 단일 공백 + 양끝 trim
 *
 * 예) `2026년도+지역사회서비스+투자사업+안내.hwpx`
 *      → `2026년도 지역사회서비스 투자사업 안내`
 *
 * 자료 제목은 사용자가 자유롭게 편집 가능하므로 unique 키로 쓰지 않는다.
 * 같은 자료를 여러 확장자(PDF/HWPX)로 묶어 한 행에 넣을 수 있다.
 */
export function titleFromFilename(filename: string): string {
  const dot = filename.lastIndexOf('.')
  const stem = dot > 0 ? filename.slice(0, dot) : filename
  return stem
    .normalize('NFC')
    .replace(/[+_\-]+/g, ' ')
    .replace(/[\[\]\(\){}「」『』]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function emptyRow(): Row {
  return {
    id: genId(),
    name: '',
    type: '',
    sourceUrl: '',
    files: [],
    voucherLinks: [],
    nameAutoFilled: false,
    typeAutoFilled: false
  }
}

// ── 파일 추가 시점 검증 ──────────────────────────────────────────

/** 백엔드 _validate_file과 동일한 50MB. */
export const MAX_FILE_SIZE = 50 * 1024 * 1024

/**
 * 백엔드 ALLOWED_CONTENT_TYPES + .hwpx fallback과 매칭되는 확장자 화이트리스트.
 * 새 확장자 허용 시 백엔드도 함께 업데이트.
 */
export const ALLOWED_FILE_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.jpg',
  '.jpeg',
  '.png',
  '.md',
  '.markdown',
  '.txt',
  '.hwpx'
])

function fileExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i).toLowerCase() : ''
}

/** 확장자 → dict 슬롯 키 (앞의 점 제거). `.jpg` → `jpg`. */
export function slotKeyFromFilename(name: string): string {
  const ext = fileExt(name)
  return ext.startsWith('.') ? ext.slice(1) : ext
}

/**
 * 파일명에서 확장자 제거한 본체(stem)를 정규화해 반환.
 * `보고서.pdf` 와 `보고서.hwpx` 가 같은 자료임을 식별하는 키로 쓴다.
 *
 * - NFC 정규화 (macOS NFD 차이 흡수)
 * - 소문자화, 양끝 공백 제거
 */
export function stemFromFilename(name: string): string {
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  return stem.normalize('NFC').toLowerCase().trim()
}

export interface ValidateFileContext {
  /**
   * 같은 행에 이미 들어있는 파일들의 슬롯 키(확장자, 앞의 점 없음).
   * 같은 확장자가 한 행에 두 번 들어가는 것만 차단한다.
   */
  currentRowSlotKeys?: Set<string>
}

/**
 * 파일 추가 시점 검증.
 * @returns 거부 사유 (사용자 친화 메시지) 또는 null(통과)
 */
export function validateFile(
  file: File,
  ctx: ValidateFileContext = {}
): string | null {
  if (file.size === 0) return '빈 파일은 올릴 수 없어요'
  if (file.size > MAX_FILE_SIZE) {
    const mb = Math.round(MAX_FILE_SIZE / (1024 * 1024))
    return `파일이 너무 커요 (최대 ${mb}MB)`
  }

  const ext = fileExt(file.name)
  if (!ext || !ALLOWED_FILE_EXTENSIONS.has(ext)) {
    return `이 형식은 올릴 수 없어요 (${ext || '확장자 없음'})`
  }

  const slotKey = ext.slice(1)
  if (ctx.currentRowSlotKeys?.has(slotKey)) {
    return `같은 형식(.${slotKey}) 파일은 한 자료에 하나만 넣을 수 있어요`
  }
  return null
}

export function buildRowFromFile(file: File, sourceUrl = ''): Row {
  const r = emptyRow()
  r.files = [file]
  r.name = titleFromFilename(file.name)
  r.nameAutoFilled = true
  r.sourceUrl = sourceUrl
  const detected = detectVoucherFileType(file.name)
  if (detected) {
    r.type = detected
    r.typeAutoFilled = true
  }
  return r
}
