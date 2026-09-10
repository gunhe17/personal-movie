import { centerId } from '$lib/stores/center.store'
import { getMe } from '$lib/hooks/actions/auth.action'
import { getPublicFAQList, getMyInquiryList } from '$lib/hooks/actions/support.action'
import { queryBuilder } from '$lib/hooks/queries/builder'
import { useQueryClient } from '@tanstack/svelte-query'
import { createSupportService } from './support-service'
import type { FaqTabValue } from './constants'

export function createSupportHooks() {
  const queryClient = useQueryClient()

  // centerId store → 반응형 state로 변환
  let currentCenterId = $state<string | null>(null)
  centerId.subscribe((v) => (currentCenterId = v))

  // 내 문의 페이지네이션
  const MY_INQUIRY_PAGE_SIZE = 5
  let myInquiryPage = $state(1)

  // 쿼리
  const meQuery = $derived(queryBuilder<any, any>(getMe, () => ({})))
  const myInquiriesQuery = $derived(
    queryBuilder<any, any>(getMyInquiryList, () => ({
      center_id: currentCenterId,
      page: myInquiryPage,
      size: MY_INQUIRY_PAGE_SIZE
    }))
  )
  const faqsQuery = $derived(queryBuilder<any, any>(getPublicFAQList, () => ({})))

  // 서비스
  const service = $derived(createSupportService({ meQuery, queryClient }))

  // 파생 데이터
  const myInquiries = $derived(myInquiriesQuery.data?.items ?? [])
  const myInquiryTotal = $derived(myInquiriesQuery.data?.total ?? 0)
  const allFaqItems = $derived(faqsQuery.data?.items ?? [])

  // FAQ 탭 상태
  let activeTab = $state<FaqTabValue>('all')
  const faqItems = $derived(
    activeTab === 'all'
      ? allFaqItems
      : allFaqItems.filter((f: any) => f.category === activeTab)
  )

  // 펼침 상태
  let expandedFaqId = $state<string | null>(null)
  let expandedMyInquiryId = $state<string | null>(null)

  function setActiveTab(tab: FaqTabValue) {
    activeTab = tab
    expandedFaqId = null
  }

  function toggleFaq(id: string) {
    expandedFaqId = expandedFaqId === id ? null : id
  }

  function toggleMyInquiry(id: string) {
    expandedMyInquiryId = expandedMyInquiryId === id ? null : id
  }

  function setMyInquiryPage(page: number) {
    myInquiryPage = page
    expandedMyInquiryId = null
  }

  return {
    get service() { return service },
    get myInquiries() { return myInquiries },
    get myInquiryTotal() { return myInquiryTotal },
    get myInquiryPage() { return myInquiryPage },
    myInquiryPageSize: MY_INQUIRY_PAGE_SIZE,
    get faqItems() { return faqItems },
    get activeTab() { return activeTab },
    get expandedFaqId() { return expandedFaqId },
    get expandedMyInquiryId() { return expandedMyInquiryId },
    setActiveTab,
    toggleFaq,
    toggleMyInquiry,
    setMyInquiryPage
  }
}
