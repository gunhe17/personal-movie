import { modalStore } from '$lib/stores/modal'
import type { QueryClient } from '@tanstack/svelte-query'
import {
  createAssessmentSet,
  updateAssessmentSet,
  deleteAssessmentSet,
  type AssessmentSetItem
} from '$lib/hooks/actions/assessmentSet.action'
import {
  updateCenterAssessment,
  getAssessmentDetail,
  type CenterAssessment
} from '$lib/hooks/actions/assessment.action'
import { requireCenterId } from '$lib/stores/center.store'
import PackageSettingModal from '$lib/components/modal/PackageSettingModal.svelte'
import AssessmentToggleModal from '$lib/components/modal/AssessmentToggleModal.svelte'
import AssessmentRequestModal from '$lib/components/modal/AssessmentRequestModal.svelte'
import AssessmentDetailModal from '$lib/components/modal/AssessmentDetailModal.svelte'
import DeleteConfirmModal from '$lib/components/modal/DeleteConfirmModal.svelte'
import { snackbarStore } from '$lib/stores/snackbar'
import { MODAL_SIZES, ASSESSMENT_DETAIL_STALE_TIME } from './constants'

interface CreateSetFormData {
  packageName: string
  description?: string
  selectedAssessments: string[]
  selectedStaff?: string[]
}

export interface ManageDeps {
  queryClient: QueryClient
}

export function createManageService(deps: ManageDeps) {
  const { queryClient } = deps

  const invalidateSets = () =>
    queryClient.invalidateQueries({
      queryKey: ['getAssessmentSetList'],
      exact: false
    })

  // 검사 세트 생성 모달
  const openCreatePackageModal = () => {
    modalStore.open({
      component: PackageSettingModal,
      props: {
        onConfirm: async (data: CreateSetFormData) => {
          try {
            await createAssessmentSet().request({
              centerId: requireCenterId(),
              name: data.packageName,
              description: data.description || '',
              assessment_ids: data.selectedAssessments,
              center_member_ids: data.selectedStaff || []
            })
            snackbarStore.success('검사 세트가 추가되었어요!')
            invalidateSets()
          } catch (error) {
            console.error('[createAssessmentSet] failed', error)
            snackbarStore.error('세트 추가 중 오류가 발생했어요.')
            throw error
          }
        }
      },
      options: MODAL_SIZES.packageSetting
    })
  }

  // 검사 세트 수정 모달
  const openEditPackageModal = (setData: AssessmentSetItem) => {
    modalStore.open({
      component: PackageSettingModal,
      props: {
        isEditMode: true,
        initialPackageName: setData.name,
        initialDescription: setData.description || '',
        initialSelectedAssessments: (setData.assessments ?? []).map(
          (a) => a.id
        ),
        onConfirm: async (data: CreateSetFormData) => {
          try {
            await updateAssessmentSet().request({
              centerId: requireCenterId(),
              setId: setData.id,
              name: data.packageName,
              description: data.description || '',
              assessment_ids: data.selectedAssessments,
              center_member_ids: data.selectedStaff || []
            })
            snackbarStore.success('검사 세트가 수정되었어요!')
            invalidateSets()
          } catch (error) {
            console.error('[updateAssessmentSet] failed', error)
            snackbarStore.error('세트 수정 중 오류가 발생했어요.')
            throw error
          }
        }
      },
      options: MODAL_SIZES.packageSetting
    })
  }

  // 운영 여부 변경 모달
  const openAssessmentToggleModal = () => {
    modalStore.open({
      component: AssessmentToggleModal,
      props: {},
      options: MODAL_SIZES.assessmentToggle
    })
  }

  // 검사 요청 모달
  const openAssessmentRequestModal = () => {
    modalStore.open({
      component: AssessmentRequestModal,
      props: {
        onConfirm: (data: {
          assessmentKorName: string
          assessmentEnName: string
          requestReason: string
        }) => {
          console.log('[Request Assessment]', data)
        }
      },
      options: MODAL_SIZES.assessmentRequest
    })
  }

  // 검사 상세 모달 — 어드민 '검사 특성'(소요 시간·대상 연령·설명)을 그대로 보여준다
  // 열고 나서 채우면 모달 높이가 늘어난다(검사 설명은 길이가 제각각) —
  // 먼저 받아두고 완성된 상태로 연다. 키는 queryBuilder가 만드는 것과 같아야
  // 모달의 쿼리가 캐시에 바로 붙는다: [key[0], keyId].
  const openAssessmentDetailModal = async (
    assessmentId: string,
    titleKo: string,
    titleEn: string
  ) => {
    try {
      await queryClient.fetchQuery({
        queryKey: ['getAssessmentDetail', { assessmentId }],
        queryFn: () => getAssessmentDetail().request({ assessmentId }),
        staleTime: ASSESSMENT_DETAIL_STALE_TIME
      })
    } catch (error) {
      console.error('[getAssessmentDetail] failed', error)
      snackbarStore.error('검사 정보를 불러오지 못했어요.')
      return
    }

    modalStore.open({
      component: AssessmentDetailModal,
      props: { assessmentId, titleKo, titleEn },
      options: MODAL_SIZES.assessmentDetail
    })
  }

  // 검사 세트 삭제
  const deletePackage = (setId: string) => {
    modalStore.open({
      component: DeleteConfirmModal,
      props: {
        targetId: setId,
        title: '검사 세트를 삭제할까요?',
        description: '삭제된 검사 세트는 복구할 수 없어요',
        confirmText: '삭제',
        onConfirm: async (id: string) => {
          try {
            await deleteAssessmentSet().request({
              centerId: requireCenterId(),
              setId: id
            })
            snackbarStore.success('검사 세트가 삭제되었어요!')
            invalidateSets()
          } catch (error) {
            console.error('[deleteAssessmentSet] failed', error)
            snackbarStore.error('세트 삭제 중 오류가 발생했어요.')
          }
        }
      },
      options: { customWidth: 420 }
    })
  }

  async function toggleAssessment(
    assessmentId: string,
    currentIsActive: boolean,
    assessmentName: string
  ) {
    try {
      const centerId = requireCenterId()
      await updateCenterAssessment().request({
        centerId,
        assessmentId,
        isActive: !currentIsActive
      })
      queryClient.setQueriesData<CenterAssessment[]>(
        { queryKey: ['getCenterAssessments'], exact: false },
        (prev) => {
          if (!prev) return prev
          return prev.map((item) =>
            item.assessment_id === assessmentId
              ? { ...item, is_active: !currentIsActive }
              : item
          )
        }
      )
      const formattedName = assessmentName.trim()
      const label = formattedName ? `${formattedName} 검사` : '해당 검사'
      snackbarStore.success(
        !currentIsActive
          ? `${label}가 운영중으로 변경되었습니다.`
          : `${label}가 운영 안함으로 변경되었습니다.`,
        { size: 'lg' }
      )
    } catch (err: unknown) {
      console.error('[ManagePage] 운영 상태 변경 실패:', err)
      snackbarStore.error('운영 상태 변경에 실패했습니다.')
    }
  }

  function editPackage(setId: string, setsData: AssessmentSetItem[]) {
    const setData = setsData.find((s) => s.id === setId)
    if (!setData) {
      snackbarStore.error('세트를 찾을 수 없습니다.')
      return
    }
    openEditPackageModal(setData)
  }

  return {
    openCreatePackageModal,
    openEditPackageModal,
    deletePackage,
    openAssessmentToggleModal,
    openAssessmentRequestModal,
    openAssessmentDetailModal,
    invalidateSets,
    toggleAssessment,
    editPackage
  }
}
