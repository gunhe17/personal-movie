import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { render, cleanup } from 'vitest-browser-svelte'
import { page } from '@vitest/browser/context'
import axios from 'axios'
import PublicLinkPage from './+page.svelte'
import { testPage } from '$lib/features/assessment/test-page-state.svelte'
import '../../app.css'

const routerLifecycle = vi.hoisted(() => ({ ready: false }))

vi.mock('$app/state', async () => ({
  page: (await import('$lib/features/assessment/test-page-state.svelte'))
    .testPage
}))
vi.mock('$app/navigation', async () => {
  const { onMount } = await import('svelte')
  const { testPage: state } = await import(
    '$lib/features/assessment/test-page-state.svelte'
  )
  return {
    afterNavigate: (callback: () => void) => {
      onMount(() => {
        callback()
        routerLifecycle.ready = true
      })
    },
    pushState: (_url: string, next: Record<string, unknown>) => {
      window.history.pushState(next, '')
      state.state = next
    },
    replaceState: (_url: string, next: Record<string, unknown>) => {
      if (!routerLifecycle.ready) throw new Error('Router is not initialized')
      window.history.replaceState(next, '')
      state.state = next
    }
  }
})
vi.mock('axios', () => ({ default: { post: vi.fn() } }))
const onPop = (event: PopStateEvent) => {
  testPage.state = event.state ?? {}
}
beforeEach(() => {
  routerLifecycle.ready = false
  testPage.state = {}
  sessionStorage.clear()
  window.addEventListener('popstate', onPop)
  vi.mocked(axios.post).mockResolvedValue({
    data: {
      access_token: 'test-token',
      center_name: '테스트 센터',
      recipient_name: '테스트',
      tasks: [
        {
          task_id: 'task',
          assessment_id: 'assessment',
          assessment_name: '테스트 검사',
          status: 'pending'
        }
      ]
    }
  })
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    if (String(input).endsWith('/session'))
      return new Response('{}', { status: 401 })
    return new Response(
      JSON.stringify({
        id: 'task',
        status: 'pending',
        assessment: {
          workflow_type: 'self_report',
          code: 'TEST',
          kor_name: '테스트 검사',
          definition: {
            questions: Array.from({ length: 6 }, (_, index) => ({
              number: index + 1,
              text: `문항 ${index + 1}`,
              options: [
                { value: 1, label: '아니요' },
                { value: 2, label: '예' }
              ]
            }))
          }
        }
      }),
      { status: 200 }
    )
  })
})
afterEach(() => {
  cleanup()
  window.removeEventListener('popstate', onPop)
  vi.restoreAllMocks()
  vi.clearAllMocks()
  sessionStorage.clear()
})

it('records question navigation so browser back returns to questions and list, not the external app', async () => {
  await page.viewport(390, 844)
  render(PublicLinkPage)
  await expect.element(page.getByLabelText('인증번호 1번째 자리')).toBeVisible()
  await page.getByLabelText('인증번호 1번째 자리').fill('0123')
  await expect
    .element(page.getByRole('heading', { name: '검사 목록', exact: true }))
    .toBeVisible()
  await page.getByRole('button', { name: /테스트 검사/ }).click()
  await expect
    .element(page.getByText('1. 문항 1', { exact: true }))
    .toBeVisible()
  await page.getByRole('button', { name: '1번 문항으로 이동' }).click()
  expect(document.activeElement).toBe(
    document.querySelector('input[type="radio"]')
  )
  for (let index = 0; index < 5; index += 1)
    await page.getByText('아니요', { exact: true }).nth(index).click()
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await expect
    .element(page.getByText('6. 문항 6', { exact: true }))
    .toBeVisible()
  window.history.back()
  await expect
    .element(page.getByText('1. 문항 1', { exact: true }))
    .toBeVisible()
  await expect.element(page.getByRole('radio').first()).toBeChecked()
  window.history.back()
  await expect
    .element(page.getByRole('heading', { name: '검사 목록', exact: true }))
    .toBeVisible()
  expect(axios.post).toHaveBeenCalledTimes(1)
  expect(JSON.stringify(window.history.state)).not.toContain('test-token')
  expect(JSON.stringify(window.history.state)).not.toContain('0123')
  await page.getByRole('button', { name: /테스트 검사/ }).click()
  await expect
    .element(page.getByRole('button', { name: '다음', exact: true }))
    .toBeEnabled()
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await page.getByText('아니요', { exact: true }).click()
  await page.getByRole('button', { name: '제출', exact: true }).click()
  await expect
    .element(page.getByRole('heading', { name: /응답을 잘 받았어요/ }))
    .toBeVisible()
  await page.getByRole('button', { name: '검사 목록으로', exact: true }).click()
  await expect
    .element(page.getByRole('heading', { name: '검사 목록', exact: true }))
    .toBeVisible()
  expect(axios.post).toHaveBeenCalledTimes(1)
  window.history.back()
  await expect
    .element(page.getByRole('heading', { name: '검사 목록', exact: true }))
    .toBeVisible()
  await expect
    .element(page.getByRole('button', { name: /테스트 검사/ }))
    .toBeDisabled()
})

it('can authenticate again after a fresh page mount with the same code', async () => {
  render(PublicLinkPage)
  await page.getByLabelText('인증번호 1번째 자리').fill('0123')
  await expect
    .element(page.getByRole('heading', { name: '검사 목록', exact: true }))
    .toBeVisible()
  cleanup()
  render(PublicLinkPage)
  await page.getByLabelText('인증번호 1번째 자리').fill('0123')
  await expect
    .element(page.getByRole('heading', { name: '검사 목록', exact: true }))
    .toBeVisible()
  expect(axios.post).toHaveBeenCalledTimes(2)
})

it('restores an existing session without asking for a code and opens only available reports', async () => {
  const replace = vi.fn()
  const popup = { opener: {}, location: { replace }, close: vi.fn() }
  vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
  vi.mocked(fetch).mockImplementation(
    async (input) =>
      new Response(
        JSON.stringify(
          String(input).endsWith('/report')
            ? { download_url: 'https://reports.example.test/signed.pdf' }
            : {
                session_active: true,
                tasks: [
                  {
                    task_id: 'published',
                    assessment_name: '공개된 검사',
                    status: 'completed',
                    report_available: true
                  },
                  {
                    task_id: 'private',
                    assessment_name: '공개 전 검사',
                    status: 'completed',
                    report_available: false
                  },
                  {
                    task_id: 'submitted',
                    assessment_name: '검수 전 검사',
                    status: 'submitted',
                    report_available: false
                  }
                ]
              }
        )
      )
  )
  render(PublicLinkPage)
  await expect
    .element(page.getByRole('heading', { name: '검사 목록', exact: true }))
    .toBeVisible()
  expect(axios.post).not.toHaveBeenCalled()
  expect(
    document.querySelector('input[autocomplete="one-time-code"]')
  ).toBeNull()
  await expect
    .element(page.getByRole('button', { name: /공개 전 검사/ }))
    .toBeDisabled()
  await expect
    .element(page.getByText('제출 완료 · 결과 준비 중', { exact: true }))
    .toBeVisible()
  await page.getByRole('button', { name: /공개된 검사/ }).click()
  await expect.poll(() => replace.mock.calls.length).toBe(1)
  expect(replace).toHaveBeenCalledWith(
    'https://reports.example.test/signed.pdf'
  )
  expect(popup.opener).toBeNull()
  await page.getByRole('button', { name: '목록 새로고침' }).click()
  await expect
    .element(page.getByRole('button', { name: '목록 새로고침' }))
    .toBeEnabled()
  await expect
    .element(page.getByText('검사 완료 · 결과 공개 대기', { exact: true }))
    .toBeVisible()
  expect(axios.post).not.toHaveBeenCalled()
})

it('shows linked visit schedules in Korean time without enabling online responses', async () => {
  vi.mocked(axios.post).mockResolvedValue({
    data: {
      access_token: 'test-token',
      tasks: [
        {
          task_id: 'visit',
          assessment_name: '방문 검사',
          status: 'pending',
          execution_method: 'onsite',
          schedule_id: 'schedule'
        }
      ],
      schedules: [
        {
          schedule_id: 'schedule',
          start: '2026-09-10T01:00:00Z',
          end: '2026-09-10T02:00:00Z',
          status: 'scheduled',
          assessment_names: ['방문 검사']
        }
      ]
    }
  })
  render(PublicLinkPage)
  await page.getByLabelText('인증번호 1번째 자리').fill('0123')
  await expect
    .element(page.getByRole('region', { name: '방문 검사 일정' }))
    .toBeVisible()
  await expect.element(page.getByText(/9월 10일.*10:00/)).toBeVisible()
  await expect
    .element(page.getByRole('button', { name: /방문 검사/ }))
    .toBeDisabled()
  expect(
    vi
      .mocked(fetch)
      .mock.calls.every(([input]) => String(input).endsWith('/session'))
  ).toBe(true)
})

it.each(['external_service', 'unknown'])(
  'does not render the self-report form for %s',
  async (workflow) => {
    const original = vi.mocked(fetch).getMockImplementation()!
    vi.mocked(fetch).mockImplementation(async (...args) => {
      const response = await original(...args)
      if (!response.ok) return response
      const data = await response.json()
      data.assessment.workflow_type = workflow
      return new Response(JSON.stringify(data))
    })
    render(PublicLinkPage)
    await page.getByLabelText('인증번호 1번째 자리').fill('0123')
    await page.getByRole('button', { name: /테스트 검사/ }).click()
    await expect
      .element(page.getByText(/현재 바로링크의 문항 화면에서 진행할 수 없어요/))
      .toBeVisible()
    expect(document.querySelector('input[type="radio"]')).toBeNull()
  }
)

it('checks server completion before retrying a submission whose response was lost', async () => {
  const original = vi.mocked(fetch).getMockImplementation()!
  let submissions = 0
  vi.mocked(fetch).mockImplementation(async (...args) => {
    if (args[1]?.method === 'POST') {
      submissions++
      throw new TypeError('Failed to fetch')
    }
    const response = await original(...args)
    if (!response.ok) return response
    const data = await response.json()
    if (submissions) data.status = 'submitted'
    return new Response(JSON.stringify(data))
  })
  render(PublicLinkPage)
  await page.getByLabelText('인증번호 1번째 자리').fill('0123')
  await page.getByRole('button', { name: /테스트 검사/ }).click()
  for (let index = 0; index < 5; index++)
    await page.getByText('아니요', { exact: true }).nth(index).click()
  await page.getByRole('button', { name: '다음', exact: true }).click()
  await page.getByText('아니요', { exact: true }).click()
  await page.getByRole('button', { name: '제출', exact: true }).click()
  await expect
    .element(page.getByRole('alert'))
    .toHaveTextContent('제출 결과를 확인하지 못했어요')
  expect(sessionStorage.length).toBeGreaterThan(0)
  await page.getByRole('button', { name: '제출', exact: true }).click()
  await expect
    .element(page.getByRole('heading', { name: /응답을 잘 받았어요/ }))
    .toBeVisible()
  expect(submissions).toBe(1)
  expect(sessionStorage.length).toBe(0)
})
