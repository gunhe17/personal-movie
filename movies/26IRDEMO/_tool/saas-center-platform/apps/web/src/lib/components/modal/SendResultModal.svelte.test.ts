import { afterEach, describe, it, expect, vi } from 'vitest'
import '../../../app.css'
import { render, cleanup } from 'vitest-browser-svelte'
import { page } from '@vitest/browser/context'
import SendResultModal from './SendResultModal.svelte'
import type { AssessmentStatusRow } from '$lib/types/assessmentStatus'
import { createAssessmentSendLink } from '$lib/hooks/actions/quickLinks'

vi.mock('$lib/stores/center.store', () => ({ requireCenterId: () => 'center' }))
vi.mock('$lib/hooks/actions/link-assessments', () => ({
  getLinkAssessments: () => ({
    request: async () => [{ id: 'assessment', supports_online: true }]
  })
}))
vi.mock('$lib/hooks/actions/messageTemplate.action', () => ({
  getDefaultTemplate: () => ({
    request: async () => {
      await templateDefaults.wait
      return {
        template: null,
        fallback_content: '이전 양식',
        builtin_content: templateDefaults.builtin,
        source: 'hardcoded'
      }
    }
  }),
  getMessageTemplates: () => ({
    request: async () => ({
      items: [{ id: 'chosen', name: '검사 안내 양식', center_id: 'center' }]
    })
  }),
  getMessageTemplate: () => ({
    request: async () => ({
      content: '검사 안내 {assessment_url} 인증번호 {verification_code}'
    })
  })
}))
vi.mock('$lib/hooks/actions/quickLinks', () => ({
  createAssessmentSendLink: vi.fn()
}))
vi.mock('$lib/hooks/actions/sendLinkHistory.action', () => ({
  listLinkHistory: async () => [],
  getLinkDeliveries: async () => [],
  resendLinkMessage: vi.fn()
}))

const templateDefaults = vi.hoisted(() => ({
  builtin: '',
  wait: undefined as Promise<void> | undefined
}))

afterEach(() => {
  templateDefaults.builtin = ''
  templateDefaults.wait = undefined
  cleanup()
  vi.clearAllMocks()
})

describe('quick link template selection', () => {
  it.each([
    [1200, 1000],
    [390, 700]
  ])(
    'keeps its frame stable while loading and switching tabs at %s by %s',
    async (width, height) => {
      await page.viewport(width, height)
      let finishLoading!: () => void
      templateDefaults.wait = new Promise<void>((resolve) => {
        finishLoading = resolve
      })
      render(SendResultModal, {
        rowData: {
          id: 'case',
          assessments: ['테스트 검사'],
          assessmentUids: ['assessment']
        } as AssessmentStatusRow,
        closeModal: vi.fn()
      })
      await expect
        .element(page.getByRole('status', { name: '전송 정보 불러오는 중' }))
        .toBeVisible()
      const frame = document.querySelector(
        '[data-testid="barolink-modal-frame"]'
      )!
      const initial = frame.getBoundingClientRect()
      const content = document.querySelector(
        '[data-testid="barolink-modal-content"]'
      )!
      const bodyStyle = getComputedStyle(content.parentElement!)
      expect(bodyStyle.transform).toBe('none')
      expect(bodyStyle.contain).toBe('none')
      expect(getComputedStyle(content).overflowY).toBe('auto')
      expect(initial.height).toBeCloseTo(Math.min(820, height * 0.9), 0)
      finishLoading()
      await expect
        .element(page.getByText('메시지 미리보기', { exact: true }))
        .toBeVisible()
      expect(frame.getBoundingClientRect().height).toBe(initial.height)
      await page.getByRole('tab', { name: '전송 내역' }).click()
      await expect
        .element(page.getByText('아직 전송 내역이 없습니다.'))
        .toBeVisible()
      expect(frame.getBoundingClientRect().height).toBe(initial.height)
      expect(frame.getBoundingClientRect().width).toBe(initial.width)
      await page.getByRole('tab', { name: '전송', exact: true }).click()
      await page.getByRole('button', { name: /온라인 테스트 검사/ }).click()
      await expect.element(page.getByPlaceholder('이름')).toBeVisible()
      expect(frame.getBoundingClientRect().height).toBe(initial.height)
    }
  )
  it('provides and sends the service default without registering a template', async () => {
    templateDefaults.builtin =
      '바로링크 안내 {assessment_url} {verification_code}'
    const request = vi
      .fn()
      .mockResolvedValue({ data: { delivery_results: [{ status: 'sent' }] } })
    vi.mocked(createAssessmentSendLink).mockReturnValue({
      key: ['test'],
      request
    })
    render(SendResultModal, {
      rowData: {
        id: 'case',
        assessments: ['테스트 검사'],
        assessmentUids: ['assessment']
      } as AssessmentStatusRow,
      closeModal: vi.fn()
    })
    await expect
      .element(
        page.getByText('바로링크 안내 #{바로링크} #{인증번호}', { exact: true })
      )
      .toBeVisible()
    expect(document.querySelector('details')?.open).toBe(false)
    await page.getByText('양식 변경 · 관리', { exact: true }).click()
    await expect
      .element(page.getByRole('combobox', { name: '사용할 메시지 양식' }))
      .toHaveValue('__builtin__')
    await page.getByText('양식 변경 · 관리', { exact: true }).click()
    expect(document.querySelector('details')?.open).toBe(false)
    await page.getByRole('button', { name: /온라인 테스트 검사/ }).click()
    await page.getByPlaceholder('이름').fill('테스트 수신자')
    await page.getByPlaceholder('01012345678').fill('01000000000')
    await page
      .getByRole('button', { name: '바로링크 전송', exact: true })
      .click()
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          template_id: '__builtin__',
          channel: 'sms'
        })
      })
    )
  })
  it('blocks incomplete templates and sends the selected template and channel', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ data: { delivery_results: [{ status: 'sent' }] } })
    vi.mocked(createAssessmentSendLink).mockReturnValue({
      key: ['test'],
      request
    })
    const closeModal = vi.fn()
    render(SendResultModal, {
      rowData: {
        id: 'case',
        assessments: ['테스트 검사'],
        assessmentUids: ['assessment']
      } as AssessmentStatusRow,
      closeModal
    })
    await expect
      .element(page.getByRole('alert'))
      .toHaveTextContent('모두 필요합니다')
    await expect
      .element(page.getByRole('button', { name: '바로링크 전송', exact: true }))
      .toBeDisabled()
    await page.getByText('양식 변경 · 관리', { exact: true }).click()
    await page
      .getByRole('combobox', { name: '사용할 메시지 양식' })
      .selectOptions('chosen')
    await expect
      .element(
        page.getByText('검사 안내 #{바로링크} 인증번호 #{인증번호}', {
          exact: true
        })
      )
      .toBeVisible()
    await expect
      .element(page.getByText('문자 (SMS/LMS)', { exact: true }))
      .toBeVisible()
    await page.getByRole('button', { name: /온라인 테스트 검사/ }).click()
    await page.getByPlaceholder('이름').fill('테스트 수신자')
    await page.getByPlaceholder('01012345678').fill('010-0000-0000')
    await page.viewport(1200, 1000)
    await page
      .getByRole('button', { name: '바로링크 전송', exact: true })
      .click()
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          template_id: 'chosen',
          recipients: [expect.objectContaining({ phone: '01000000000' })],
          channel: 'sms',
          assessment_ids: ['assessment']
        })
      })
    )
    expect(closeModal).not.toHaveBeenCalled()
    await expect
      .element(page.getByRole('tab', { name: '전송 내역' }))
      .toHaveAttribute('aria-selected', 'true')
  })
})
