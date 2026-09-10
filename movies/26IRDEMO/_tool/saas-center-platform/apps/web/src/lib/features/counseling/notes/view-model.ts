import type { MyCounselingNoteItem } from '$lib/hooks/actions/counseling.action'
import { formatUtcToKst } from '$lib/utils/date'

export interface CounselingNoteVM {
  key: string
  clientName: string
  birthDate: string | null
  gender: string | null
  profileImageUrl: string | null
  /** "놀이치료 - 개별" — 프로그램명 + 유형 */
  programLabel: string | null
  /** "2026. 08. 21 (금) 18:00 - 19:30" */
  scheduleLabel: string
  summaryLine: string
  isWritten: boolean
  item: MyCounselingNoteItem
}

/** 줄바꿈·연속 공백을 한 칸으로 접는다 (카드 미리보기용) */
function collapse(text: string | null | undefined): string | null {
  const value = text?.replace(/\s+/g, ' ').trim()
  return value ? value : null
}

const PROGRAM_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: '개별',
  GROUP: '그룹'
}

export function mapToNoteVM(item: MyCounselingNoteItem): CounselingNoteVM {
  const start = item.session_start
  const end = item.session_end

  const dateLabel = start
    ? formatUtcToKst(start, 'YYYY. MM. DD (d)')
    : '날짜 미정'
  const timeLabel = start
    ? end
      ? `${formatUtcToKst(start, 'HH:mm')} - ${formatUtcToKst(end, 'HH:mm')}`
      : formatUtcToKst(start, 'HH:mm')
    : null

  const typeLabel = item.program_type
    ? PROGRAM_TYPE_LABELS[item.program_type]
    : null

  return {
    key: `${item.counseling_session_id}:${item.client_id}`,
    clientName: item.client_name ?? '내담자',
    birthDate: item.client_birth_date,
    gender: item.client_gender,
    profileImageUrl: item.client_profile_image_url,
    programLabel: item.program_name
      ? typeLabel
        ? `${item.program_name} - ${typeLabel}`
        : item.program_name
      : null,
    scheduleLabel: timeLabel ? `${dateLabel} ${timeLabel}` : dateLabel,
    summaryLine: item.is_written
      ? // 미리보기는 본문(진행 내용 → 상담 목표 → …) 앞부분. AI 초안이 있으면 summary.
        // 카드에선 줄바꿈을 접어 흘려 보여준다 — 문단을 살리면 몇 줄 안에 두세 문장밖에 안 들어간다.
        (collapse(item.preview) ??
        collapse(item.summary) ??
        '작성된 내용이 없어요')
      : '상담일지를 작성해주세요',
    isWritten: item.is_written,
    item
  }
}
