import { afterEach, expect, it, vi } from 'vitest'
import { render, cleanup } from 'vitest-browser-svelte'
import { page } from '@vitest/browser/context'
import { goto } from '$app/navigation'
import AssessmentCaseCard from './AssessmentCaseCard.svelte'
import type { CaseData } from '$lib/types/assessmentStatus'
import '../../../app.css'

vi.mock('$app/navigation', () => ({ goto: vi.fn() }))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
const caseInfo = {
  uid: 'case',
  status: 'pending',
  clients: [],
  assessment_names: ['테스트 검사'],
  has_uninvoiced_sessions: true
} as unknown as CaseData

it('sends from the card without navigation and preserves billing', async () => {
  await page.viewport(360, 500)
  const onSendLink = vi.fn()
  const onBilling = vi.fn()
  render(AssessmentCaseCard, {
    caseInfo,
    hasOnlineLink: true,
    canSendLink: true,
    onSendLink,
    canBill: true,
    onBilling
  })
  await page.getByRole('button', { name: '바로링크 전송', exact: true }).click()
  expect(onSendLink).toHaveBeenCalledWith(caseInfo)
  expect(goto).not.toHaveBeenCalled()
  await page.getByRole('button', { name: '청구하기', exact: true }).click()
  expect(onBilling).toHaveBeenCalledWith(caseInfo)
  expect(goto).not.toHaveBeenCalled()
})

it.each([
  { canSendLink: false, hasOnlineLink: true, status: 'pending' },
  { canSendLink: true, hasOnlineLink: false, status: 'pending' },
  { canSendLink: true, hasOnlineLink: true, status: 'cancelled' }
])('hides unavailable sending for %j', async ({ status, ...props }) => {
  render(AssessmentCaseCard, {
    caseInfo: { ...caseInfo, status } as CaseData,
    ...props,
    onSendLink: vi.fn()
  })
  await expect
    .element(page.getByRole('button', { name: '바로링크 전송', exact: true }))
    .not.toBeInTheDocument()
})
