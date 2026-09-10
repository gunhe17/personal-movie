import type { SvelteComponent } from 'svelte'
import type {
  Assessment,
  AssessmentType as AssessmentKind,
  CenterAssessment
} from '$lib/hooks/actions/assessment.action'
import type { PackageType } from '$lib/hooks/actions/package.action'
import type { AssessmentSetItem, AssessmentSummary } from '$lib/hooks/actions/assessmentSet.action'
import { assessmentColorMapper } from '$root/src/lib/utils/assessmentColorMapper'
import { resolveCategoryColor } from '$lib/features/assessment/status-detail/constants'
import IntelligenceDevelopmentFolder from '$lib/assets/assessmentCardFolderBgImg/IntelligenceDevelopmentFolder.svelte'
import ProjectiveFolder from '$lib/assets/assessmentCardFolderBgImg/ProjectiveFolder.svelte'
import ObjectiveFolder from '$lib/assets/assessmentCardFolderBgImg/ObjectiveFolder.svelte'
import IntelligenceDevelopmentIcon from '$lib/assets/assessmentCardFolderBgImg/IntelligenceDevelopmentIcon.svelte'
import ProjectiveIcon from '$lib/assets/assessmentCardFolderBgImg/ProjectiveIcon.svelte'
import ObjectiveIcon from '$lib/assets/assessmentCardFolderBgImg/ObjectiveIcon.svelte'

export interface AssessmentVM {
  id: string
  titleKo: string
  titleEn: string
  isOnlineAvailable: boolean
  isActive: boolean
  bgColor: string
  bgImage: string
  backgroundComponent?: typeof SvelteComponent<any>
  iconComponent?: typeof SvelteComponent<any>
}

export interface PackageVM {
  id: string
  name: string
  assessments: AssessmentVM[]
  isActive: boolean
  clientCount: number
}

const folderBackgroundMapper: Partial<
  Record<AssessmentKind, typeof SvelteComponent<any>>
> = {
  projective: ProjectiveFolder,
  intelligence: IntelligenceDevelopmentFolder,
  objective: ObjectiveFolder,
  developmental: IntelligenceDevelopmentFolder
}

const folderIconMapper: Partial<
  Record<AssessmentKind, typeof SvelteComponent<any>>
> = {
  projective: ProjectiveIcon,
  intelligence: IntelligenceDevelopmentIcon,
  objective: ObjectiveIcon,
  developmental: IntelligenceDevelopmentIcon
}

export function mapAssessmentToVM(
  item: Assessment,
  isActive = false
): AssessmentVM {
  const colorInfo = assessmentColorMapper[item.eng_name] || {}
  const backgroundComponent =
    folderBackgroundMapper[item.assessment_type as AssessmentKind]
  const iconComponent = folderIconMapper[item.assessment_type as AssessmentKind]

  return {
    id: item.uid,
    titleKo: item.kor_name,
    titleEn: item.eng_name,
    isOnlineAvailable: item.is_online_available,
    isActive,
    bgColor: resolveCategoryColor(item.assessment_type as string),
    bgImage: colorInfo.backgroundImage || '',
    backgroundComponent,
    iconComponent
  }
}

export function mapAssessmentsToVM(list: Assessment[] = []): AssessmentVM[] {
  return list.map((item) => mapAssessmentToVM(item))
}

/**
 * 센터 운영 검사 목록(CenterAssessment[])을 VM으로 변환
 * type 기반으로 배경/아이콘 매핑, eng_name 기반으로 색상 매핑
 */
export function mapCenterAssessmentsToVM(
  centerAssessments: CenterAssessment[] = []
): AssessmentVM[] {
  return centerAssessments.map((ca) => {
    const colorInfo = assessmentColorMapper[ca.eng_name] || {}
    const backgroundComponent =
      folderBackgroundMapper[ca.assessment_type as AssessmentKind]
    const iconComponent = folderIconMapper[ca.assessment_type as AssessmentKind]

    return {
      id: ca.assessment_id,
      titleKo: ca.kor_name,
      titleEn: ca.eng_name,
      isOnlineAvailable: ca.supports_online ?? false,
      isActive: ca.is_active,
      bgColor: resolveCategoryColor(ca.assessment_type as string),
      bgImage: colorInfo.backgroundImage || '',
      backgroundComponent,
      iconComponent
    }
  })
}

/**
 * 검사 세트 VM
 */
export interface AssessmentSetVM {
  id: string
  name: string
  assessmentCount: number
  assessments: AssessmentVM[]
}

/**
 * AssessmentSummary → AssessmentVM 변환 (세트 내 검사 항목용)
 */
function mapSummaryToVM(item: AssessmentSummary): AssessmentVM {
  const colorInfo = assessmentColorMapper[item.eng_name] || {}
  const backgroundComponent =
    folderBackgroundMapper[item.assessment_type as AssessmentKind]
  const iconComponent = folderIconMapper[item.assessment_type as AssessmentKind]

  return {
    id: item.id,
    titleKo: item.kor_name,
    titleEn: item.eng_name,
    isOnlineAvailable: item.supports_online ?? false,
    isActive: true,
    bgColor: resolveCategoryColor(item.assessment_type as string),
    bgImage: colorInfo.backgroundImage || '',
    backgroundComponent,
    iconComponent
  }
}

/**
 * AssessmentSetItem[] → AssessmentSetVM[] 변환
 */
export function mapAssessmentSetsToVM(
  sets: AssessmentSetItem[] = []
): AssessmentSetVM[] {
  return sets.map((set) => ({
    id: set.id,
    name: set.name,
    assessmentCount: set.assessments?.length ?? 0,
    assessments: (set.assessments ?? []).map(mapSummaryToVM)
  }))
}

export function mapPackagesToVM(list: PackageType[] = []): PackageVM[] {
  return list.map((pkg) => ({
    id: pkg.uid,
    name: pkg.name,
    isActive: pkg.is_active,
    clientCount: 0, // TODO: API에서 제공 시 실제 값으로 대체
    assessments: mapAssessmentsToVM(
      // PackageType.assessments는 AssessmentType 배열. 필요한 필드만 매핑.
      (pkg.assessments || []).map((assessment) => ({
        uid: assessment.uid,
        kor_name: assessment.kor_name,
        eng_name: assessment.eng_name,
        is_online_available: assessment.is_online_available,
        assessment_type: assessment.assessment_type
      })) as unknown as Assessment[]
    )
  }))
}
