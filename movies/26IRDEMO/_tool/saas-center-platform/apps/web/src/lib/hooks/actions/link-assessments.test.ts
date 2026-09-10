import { describe, it, expect, vi } from 'vitest'
import { get } from '$lib/services/api/instances'
import { getLinkAssessments } from './link-assessments'

vi.mock('$lib/services/api/instances', () => ({ get: vi.fn() }))

describe('link assessment catalog', () => {
  it('loads every page using the API size parameter', async () => {
    const request = vi.mocked(get)
    request.mockResolvedValueOnce({
      items: [{ id: 'first', supports_online: false }],
      pages: 2
    })
    request.mockResolvedValueOnce({
      items: [{ id: 'second', supports_online: true }],
      pages: 2
    })
    const result = await getLinkAssessments().request()
    expect(result.map((assessment) => assessment.id)).toEqual([
      'first',
      'second'
    ])
    expect(request).toHaveBeenNthCalledWith(1, '/assessments', {
      page: 1,
      size: 100
    })
    expect(request).toHaveBeenNthCalledWith(2, '/assessments', {
      page: 2,
      size: 100
    })
  })
})
