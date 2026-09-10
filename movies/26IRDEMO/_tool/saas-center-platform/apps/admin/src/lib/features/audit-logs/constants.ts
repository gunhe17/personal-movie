// ─── 액션 한글 라벨 매핑 ───
const ACTION_LABEL: Record<string, string> = {
  'center_application.approved': '센터 신청 승인',
  'center_application.rejected': '센터 신청 반려',
  'account.locked': '센터 계정 잠금',
  'account.unlocked': '센터 계정 잠금 해제',
  'account.force_logout': '강제 로그아웃',
  'admin_account.invited': '어드민 초대',
  'admin_account.locked': '어드민 잠금',
  'admin_account.unlocked': '어드민 잠금 해제',
  'admin_account.updated': '어드민 역할 변경',
  'admin_account.deleted': '어드민 해임',
  'assessment.created': '검사도구 등록',
  'assessment.updated': '검사도구 수정',
  'cs_memo.created': 'CS 메모 작성',
  'cs_memo.updated': 'CS 메모 수정',
  'cs_memo.deleted': 'CS 메모 삭제',
  'cs_memo.bulk_deleted': 'CS 메모 일괄 삭제',
  'faq.created': 'FAQ 등록',
  'faq.updated': 'FAQ 수정',
  'faq.deleted': 'FAQ 삭제',
  'inquiry.answered': '문의 답변',
  'inquiry.deleted': '문의 삭제',
  'notice.created': '공지사항 작성',
  'notice.updated': '공지사항 수정',
  'notice.deleted': '공지사항 삭제',
  'notice.notify_remind': '공지 리마인드 발송',
  'notice.notify_remind_member': '공지 미열람자 리마인드 발송',
  'center.warned': '센터 경고',
  'center.suspended': '센터 정지',
  'center.activated': '센터 활성화',
  'center.terminated': '센터 해지',
  'center.purged': '센터 데이터 삭제',
  'center.restored': '센터 해지 철회'
}

// target_type → 한글 (fallback용)
const TARGET_LABEL: Record<string, string> = {
  center_application: '센터 신청',
  center: '센터',
  admin_account: '어드민 계정',
  admin_account_invitation: '어드민 초대',
  account: '센터 계정',
  notice: '공지사항',
  inquiry: '문의',
  faq: 'FAQ',
  cs_memo: 'CS 메모',
  assessment: '검사도구'
}

/** 액션 코드 → 한글 라벨 변환 (매핑 없으면 자동 fallback) */
export function getActionLabel(action: string): string {
  if (ACTION_LABEL[action]) return ACTION_LABEL[action]
  const [target, verb] = action.split('.')
  const targetLabel = TARGET_LABEL[target] ?? target
  return `${targetLabel} · ${verb}`
}

// ─── 액션 뱃지 색상 ───
const ACTION_COLOR: Record<string, { bg: string; text: string }> = {
  approved: { bg: 'bg-green-50', text: 'text-green-700' },
  rejected: { bg: 'bg-red-50', text: 'text-red-700' },
  deleted: { bg: 'bg-red-50', text: 'text-red-600' },
  bulk_deleted: { bg: 'bg-red-50', text: 'text-red-600' },
  created: { bg: 'bg-blue-50', text: 'text-blue-700' },
  updated: { bg: 'bg-yellow-50', text: 'text-yellow-700' },
  invited: { bg: 'bg-purple-50', text: 'text-purple-700' },
  locked: { bg: 'bg-orange-50', text: 'text-orange-700' },
  unlocked: { bg: 'bg-green-50', text: 'text-green-700' },
  answered: { bg: 'bg-blue-50', text: 'text-blue-700' },
  force_logout: { bg: 'bg-orange-50', text: 'text-orange-700' },
  notify_remind: { bg: 'bg-purple-50', text: 'text-purple-700' },
  notify_remind_member: { bg: 'bg-purple-50', text: 'text-purple-700' },
  warned: { bg: 'bg-amber-50', text: 'text-amber-700' },
  suspended: { bg: 'bg-orange-50', text: 'text-orange-700' },
  activated: { bg: 'bg-green-50', text: 'text-green-700' },
  terminated: { bg: 'bg-red-50', text: 'text-red-700' },
  purged: { bg: 'bg-red-100', text: 'text-red-800' },
  restored: { bg: 'bg-blue-50', text: 'text-blue-700' }
}

/** 액션 verb에 따른 뱃지 색상 반환 */
export function getActionColor(action: string): { bg: string; text: string } {
  const verb = action.split('.')[1] ?? ''
  return ACTION_COLOR[verb] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }
}
