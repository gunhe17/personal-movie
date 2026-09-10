/**
 * 비교 모드 공유 훅
 * Playground / STT Benchmark 등에서 A/B 비교 기능에 사용
 */

import { getLabExperimentDetail } from '$hooks/actions/aiLab.action'
import { mapExperimentDetail, type ExperimentDetailVM } from '../experiments/view-model'
import { MAX_COMPARE_ITEMS } from '../constants'

export function createComparisonState() {
  let comparisonIds = $state<string[]>([])
  let isCompareMode = $state(false)
  let compareDetails = $state<[ExperimentDetailVM | null, ExperimentDetailVM | null]>([null, null])
  let isLoadingCompare = $state<[boolean, boolean]>([false, false])

  function toggleSelection(id: string) {
    const idx = comparisonIds.indexOf(id)
    if (idx >= 0) {
      comparisonIds = comparisonIds.filter((cid) => cid !== id)
    } else if (comparisonIds.length < MAX_COMPARE_ITEMS) {
      comparisonIds = [...comparisonIds, id]
    }
  }

  async function enterCompare() {
    if (comparisonIds.length !== 2) return
    isCompareMode = true
    compareDetails = [null, null]
    isLoadingCompare = [true, true]

    const fetchDetail = async (id: string, index: 0 | 1) => {
      try {
        const result = await getLabExperimentDetail().request({ experimentId: id })
        const detail = mapExperimentDetail(result)
        compareDetails = index === 0
          ? [detail, compareDetails[1]]
          : [compareDetails[0], detail]
      } catch {
        compareDetails = index === 0
          ? [null, compareDetails[1]]
          : [compareDetails[0], null]
      } finally {
        isLoadingCompare = index === 0
          ? [false, isLoadingCompare[1]]
          : [isLoadingCompare[0], false]
      }
    }

    await Promise.all([
      fetchDetail(comparisonIds[0], 0),
      fetchDetail(comparisonIds[1], 1),
    ])
  }

  function exitCompare() {
    isCompareMode = false
    compareDetails = [null, null]
    isLoadingCompare = [false, false]
    comparisonIds = []
  }

  return {
    get comparisonIds() { return comparisonIds },
    get isCompareMode() { return isCompareMode },
    get compareDetails() { return compareDetails },
    get isLoadingCompare() { return isLoadingCompare },
    get canCompare() { return comparisonIds.length === MAX_COMPARE_ITEMS },
    toggleSelection,
    enterCompare,
    exitCompare,
  }
}
