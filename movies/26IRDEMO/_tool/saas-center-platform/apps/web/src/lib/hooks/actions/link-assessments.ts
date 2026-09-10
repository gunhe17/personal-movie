import { get } from '$lib/services/api/instances'
import type { Page } from '$lib/types/apiResponse'

export interface LinkAssessment {
  id: string
  kor_name: string
  eng_name: string
  supports_online: boolean
}

export const getLinkAssessments = () => ({
  key: ['link-assessments'],
  request: async () => {
    const assessments: LinkAssessment[] = []
    let page = 1
    let pages = 1
    do {
      const response = await get<Page<LinkAssessment>>('/assessments', {
        page,
        size: 100
      })
      assessments.push(...response.items)
      pages = response.pages
      page += 1
    } while (page <= pages)
    return assessments
  }
})
