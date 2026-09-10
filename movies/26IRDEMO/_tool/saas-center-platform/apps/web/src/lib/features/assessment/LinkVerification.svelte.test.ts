import { afterEach, expect, it, vi } from 'vitest'
import { render, cleanup } from 'vitest-browser-svelte'
import { page, userEvent } from '@vitest/browser/context'
import LinkVerification from './LinkVerification.svelte'
import '../../../app.css'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it('automatically verifies four digits typed consecutively', async () => {
  const verify = vi.fn().mockRejectedValue(new Error('테스트 오류'))
  render(LinkVerification, { verify, onVerified: vi.fn() })
  await page.getByLabelText('인증번호 1번째 자리').click()
  await userEvent.keyboard('0123')
  await expect.poll(() => verify.mock.calls.length).toBe(1)
  expect(verify).toHaveBeenCalledWith('0123')
  await expect
    .element(page.getByRole('button', { name: '다시 확인' }))
    .toBeEnabled()
})

it('accepts a pasted leading-zero code once and transitions only after verification', async () => {
  let resolve!: () => void
  const verify = vi.fn(
    () =>
      new Promise<void>((done) => {
        resolve = done
      })
  )
  const onVerified = vi.fn()
  render(LinkVerification, { verify, onVerified })
  await page.getByLabelText('인증번호 1번째 자리').fill('0123')
  expect(verify).toHaveBeenCalledExactlyOnceWith('0123')
  expect(onVerified).not.toHaveBeenCalled()
  await expect
    .element(page.getByLabelText('인증번호 4번째 자리'))
    .toHaveValue('3')
  resolve()
  await expect
    .element(page.getByRole('status', { name: '인증 완료' }))
    .toBeVisible()
  await expect.poll(() => onVerified.mock.calls.length).toBe(1)
})

it('allows explicit retry of the same code without an automatic retry loop', async () => {
  const verify = vi
    .fn()
    .mockRejectedValueOnce(new Error('연결 오류'))
    .mockResolvedValue(undefined)
  const onVerified = vi.fn()
  render(LinkVerification, { verify, onVerified })
  await page.getByLabelText('인증번호 1번째 자리').fill('0123')
  await expect.element(page.getByRole('alert')).toHaveTextContent('연결 오류')
  expect(verify).toHaveBeenCalledTimes(1)
  await page.getByRole('button', { name: '다시 확인' }).click()
  await expect.poll(() => onVerified.mock.calls.length).toBe(1)
  expect(verify).toHaveBeenLastCalledWith('0123')
})

it('moves backward across empty fields and does not verify incomplete input', async () => {
  const verify = vi.fn()
  render(LinkVerification, { verify, onVerified: vi.fn() })
  await page.getByLabelText('인증번호 1번째 자리').fill('0')
  await page.getByLabelText('인증번호 2번째 자리').fill('1')
  const third = document.querySelector(
    'input[aria-label="인증번호 3번째 자리"]'
  )!
  third.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true })
  )
  await expect
    .element(page.getByLabelText('인증번호 2번째 자리'))
    .toHaveValue('')
  expect(verify).not.toHaveBeenCalled()
})
