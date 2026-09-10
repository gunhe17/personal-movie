/**
 * 엑셀 초대 검토 페이지용 임시 스토어
 * ExcelUploadModal → /member/invite 페이지로 데이터 전달
 */

import { writable } from 'svelte/store'
import type { InvitationItem } from '$lib/hooks/actions/member.action'

const { subscribe, set } = writable<InvitationItem[]>([])

export const inviteReviewStore = {
  subscribe,
  set(items: InvitationItem[]) {
    set(items)
  },
  clear() {
    set([])
  }
}
