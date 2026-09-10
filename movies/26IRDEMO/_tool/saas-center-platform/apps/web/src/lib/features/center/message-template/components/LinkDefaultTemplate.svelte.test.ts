import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render } from 'vitest-browser-svelte'
import { page } from '@vitest/browser/context'
import LinkDefaultTemplate from './LinkDefaultTemplate.svelte'
import type { DefaultTemplateResponse } from '$lib/hooks/actions/messageTemplate.action'
import '../../../../../app.css'

afterEach(cleanup)
it('offers the new built-in body without replacing the existing default', async () => {
  const onCustomize = vi.fn()
  const data = {
    template: null,
    fallback_content: '기존 {assessment_url} {verification_code}',
    builtin_content: '바로링크 {assessment_url} {verification_code}',
    source: 'hardcoded' as const
  }
  render(LinkDefaultTemplate, {
    loading: false,
    error: false,
    onRetry: vi.fn(),
    onSelect: vi.fn(),
    onCustomize,
    data
  })
  expect(onCustomize).not.toHaveBeenCalled()
  await page
    .getByRole('button', { name: '새 바로링크 문구로 양식 만들기' })
    .click()
  expect(onCustomize).toHaveBeenCalledWith(data.builtin_content)
})
const content = '검사 {assessment_url} 인증번호 {verification_code}'
const props = {
  loading: false,
  error: false,
  onRetry: vi.fn(),
  onCustomize: vi.fn(),
  onSelect: vi.fn()
}

it('shows built-in content even without a stored template and copies its actual body', async () => {
  const onCustomize = vi.fn()
  render(LinkDefaultTemplate, {
    ...props,
    onCustomize,
    data: { template: null, fallback_content: content, source: 'hardcoded' }
  })
  await expect
    .element(page.getByText('서비스 내장 기본 문구', { exact: true }))
    .toBeVisible()
  await page.getByText('기본 본문 확인').click()
  await page.viewport(1000, 700)
  await expect
    .element(
      page.getByText('검사 #{바로링크} 인증번호 #{인증번호}', { exact: true })
    )
    .toBeVisible()
  await page.getByRole('button', { name: '센터 기본 양식으로 복사' }).click()
  expect(onCustomize).toHaveBeenCalledWith(content)
})

it('opens the effective center template instead of offering a system edit', async () => {
  const onSelect = vi.fn()
  const data = {
    template: { name: '센터 안내', content },
    fallback_content: '',
    source: 'template'
  } as DefaultTemplateResponse
  render(LinkDefaultTemplate, { ...props, data, onSelect })
  await page.getByRole('button', { name: '센터 기본 양식 편집' }).click()
  expect(onSelect).toHaveBeenCalledOnce()
})

it('shows system origin and warns about incomplete old content', async () => {
  const data = {
    template: { name: '공통 안내', content: '이전 문구' },
    fallback_content: '',
    source: 'system'
  } as DefaultTemplateResponse
  render(LinkDefaultTemplate, { ...props, data })
  await expect
    .element(page.getByText('시스템 기본 양식 · 공통 안내', { exact: true }))
    .toBeVisible()
  await expect
    .element(page.getByRole('alert'))
    .toHaveTextContent('전송할 수 없습니다')
})

it('offers retry on lookup failure, not a fabricated default', async () => {
  const onRetry = vi.fn()
  render(LinkDefaultTemplate, { ...props, error: true, onRetry })
  await page.getByRole('button', { name: '다시 불러오기' }).click()
  expect(onRetry).toHaveBeenCalledOnce()
  await expect.element(page.getByRole('alert')).toBeVisible()
})
