import { afterEach, describe, it, expect, vi } from 'vitest'
import { render, cleanup } from 'vitest-browser-svelte'
import { page } from '@vitest/browser/context'
import AssessmentCaseTable from './AssessmentCaseTable.svelte'
import type { AssessmentStatusRow } from '$lib/types/assessmentStatus'
import { modalStore } from '$lib/stores/modal'

const row: AssessmentStatusRow = {
  id: 'test-case',
  status: 'pending',
  clientName: '테스트 수신자',
  clientCode: '',
  clientGender: 'male',
  birthDate: '',
  clientProfileImageUrl: null,
  clientCount: 1,
  clientMembers: [],
  reportStatus: 'not_required',
  staffName: '담당자',
  organization: '',
  organizationType: 'individual',
  assessments: ['테스트 검사'],
  setName: null,
  assessmentUids: ['assessment'],
  hasOnlineLink: true,
  accessCode: 'TEST',
  registeredAt: '',
  scheduledStart: null,
  scheduledDateLabel: null,
  scheduledTimeLabel: null,
  scheduledDDay: null,
  completedCount: 0,
  totalCount: 1,
  hasUninvoicedSessions: false
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('assessment list quick link', () => {
  it('opens sending without navigating the row and restores the help modal', async () => {
    const onSendLink = vi.fn()
    const onRowClick = vi.fn()
    const open = vi.spyOn(modalStore, 'open').mockReturnValue('test-modal')
    render(AssessmentCaseTable, {
      data: [row],
      onSendLink,
      onRowClick,
      canSendLink: true
    })
    await page
      .getByRole('button', { name: '테스트 수신자 바로링크 전송', exact: true })
      .click()
    expect(onSendLink).toHaveBeenCalledWith(row)
    expect(onRowClick).not.toHaveBeenCalled()
    await page.getByRole('button', { name: '바로링크 안내' }).click()
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({ options: { customWidth: 640 } })
    )
  })
  it('does not offer sending without permission or for cancelled/offline cases', async () => {
    render(AssessmentCaseTable, {
      data: [row],
      onSendLink: vi.fn(),
      canSendLink: false
    })
    await expect
      .element(
        page.getByRole('button', { name: '테스트 수신자 바로링크 전송' })
      )
      .not.toBeInTheDocument()
    cleanup()
    render(AssessmentCaseTable, {
      data: [
        { ...row, status: 'cancelled' },
        { ...row, id: 'offline', hasOnlineLink: false }
      ],
      onSendLink: vi.fn(),
      canSendLink: true
    })
    await expect
      .element(
        page.getByRole('button', { name: '테스트 수신자 바로링크 전송' })
      )
      .not.toBeInTheDocument()
  })
})
