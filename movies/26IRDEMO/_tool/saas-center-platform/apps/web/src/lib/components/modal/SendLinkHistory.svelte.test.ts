import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render } from 'vitest-browser-svelte'
import { page } from '@vitest/browser/context'
import SendLinkHistory from './SendLinkHistory.svelte'
import {
  listLinkHistory,
  getLinkDeliveries,
  resendLinkMessage
} from '$lib/hooks/actions/sendLinkHistory.action'

vi.mock('$lib/stores/center.store', () => ({ requireCenterId: () => 'center' }))
vi.mock('$lib/hooks/actions/sendLinkHistory.action', () => ({
  listLinkHistory: vi.fn(),
  getLinkDeliveries: vi.fn(),
  resendLinkMessage: vi.fn()
}))
afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})
const link = {
  id: 'existing-link',
  recipients: [{ name: '테스트 수신자', phone: '01000000000' }],
  created_at: '2026-09-07T01:00:00Z',
  expires_at: null,
  revoked_at: null,
  channel: 'sms' as const
}

describe('real link delivery history', () => {
  it('reads actual logs and confirms resend of the same link and chosen template', async () => {
    vi.mocked(listLinkHistory).mockResolvedValue([link])
    vi.mocked(getLinkDeliveries).mockResolvedValue([
      {
        id: 'log',
        recipient: '01000000000',
        message_type: 'lms',
        status: 'failed',
        error_message: null,
        created_at: link.created_at
      }
    ])
    vi.mocked(resendLinkMessage).mockResolvedValue({
      delivery_results: [{ status: 'sent' }]
    } as never)
    const onSent = vi.fn()
    render(SendLinkHistory, {
      caseId: 'case',
      templateId: 'chosen',
      templateName: '선택 양식',
      canResend: true,
      onSent
    })
    await expect.element(page.getByText(/발송 실패/)).toBeVisible()
    await page.getByRole('button', { name: '재전송', exact: true }).click()
    expect(resendLinkMessage).not.toHaveBeenCalled()
    await page.getByRole('button', { name: '재전송 확인' }).click()
    await expect
      .element(page.getByRole('status'))
      .toHaveTextContent('메시지를 재전송했습니다.')
    expect(resendLinkMessage).toHaveBeenCalledWith(
      'center',
      'case',
      'existing-link',
      'chosen'
    )
    expect(onSent).toHaveBeenCalledOnce()
  })
  it('does not allow revoked links to be resent', async () => {
    vi.mocked(listLinkHistory).mockResolvedValue([
      { ...link, revoked_at: link.created_at }
    ])
    vi.mocked(getLinkDeliveries).mockResolvedValue([])
    render(SendLinkHistory, {
      caseId: 'case',
      templateName: '기본',
      canResend: true
    })
    await expect
      .element(page.getByRole('button', { name: '재전송', exact: true }))
      .toBeDisabled()
    expect(resendLinkMessage).not.toHaveBeenCalled()
  })
  it('shows a load failure rather than an empty history', async () => {
    vi.mocked(listLinkHistory).mockRejectedValue(new Error('denied'))
    render(SendLinkHistory, {
      caseId: 'case',
      templateName: '기본',
      canResend: true
    })
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('전송 내역을 불러오지 못했습니다')
    expect(getLinkDeliveries).not.toHaveBeenCalled()
  })
})
