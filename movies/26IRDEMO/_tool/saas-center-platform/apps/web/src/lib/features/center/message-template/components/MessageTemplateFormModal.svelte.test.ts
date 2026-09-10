import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render } from 'vitest-browser-svelte'
import { page } from '@vitest/browser/context'
import MessageTemplateFormModal from './MessageTemplateFormModal.svelte'
import '../../../../../app.css'

vi.mock('$lib/stores/modal', () => ({ modalStore: { close: vi.fn() } }))
vi.mock('$lib/stores/snackbar', () => ({ snackbarStore: { error: vi.fn() } }))
afterEach(cleanup)

it('lets users create link templates and blocks missing required variables', async () => {
  const onConfirm = vi.fn().mockResolvedValue(undefined)
  render(MessageTemplateFormModal, { mode: 'create', onConfirm })
  await page.getByLabelText('양식 유형').selectOptions('assessment_send_link')
  await page.getByPlaceholder('예: 우리 센터 결과 안내 양식').fill('링크 안내')
  await page
    .getByPlaceholder('여기에 메시지 내용을 작성하세요.')
    .fill('검사 #{검사 링크}')
  await expect
    .element(page.getByRole('button', { name: '양식 만들기', exact: true }))
    .toBeDisabled()
  await page
    .getByPlaceholder('여기에 메시지 내용을 작성하세요.')
    .fill('검사 #{검사 링크} 인증번호 #{인증번호}')
  await page.getByRole('button', { name: '양식 만들기', exact: true }).click()
  expect(onConfirm).toHaveBeenCalledWith({
    template_type: 'assessment_send_link',
    name: '링크 안내',
    content: '검사 {assessment_url} 인증번호 {verification_code}',
    is_default: false
  })
})

it('preserves copied default content, type and default selection', async () => {
  const onConfirm = vi.fn().mockResolvedValue(undefined)
  render(MessageTemplateFormModal, {
    mode: 'create',
    onConfirm,
    initialData: {
      template_type: 'assessment_send_link',
      name: '센터 기본',
      content: '{assessment_url} {verification_code}',
      is_default: true
    }
  })
  await expect
    .element(page.getByLabelText('양식 유형'))
    .toHaveValue('assessment_send_link')
  await expect
    .element(page.getByRole('checkbox', { name: '기본 양식으로 사용' }))
    .toBeChecked()
  await page.getByRole('button', { name: '양식 만들기', exact: true }).click()
  expect(onConfirm).toHaveBeenCalledWith(
    expect.objectContaining({
      template_type: 'assessment_send_link',
      content: '{assessment_url} {verification_code}',
      is_default: true
    })
  )
})
