// 검사 배경 이미지 import
import Assessment_BGT from '$lib/assets/assessmentCardBgImg/Assessment_BGT.png'
import Assessment_Bayley from '$lib/assets/assessmentCardBgImg/Assessment_Bayley.png'
import Assessment_CBCL_1_5 from '$lib/assets/assessmentCardBgImg/Assessment_CBCL 1.5-5.png'
import Assessment_CBCL_6_18 from '$lib/assets/assessmentCardBgImg/Assessment_CBCL 6- 18.png'
import Assessment_HTP from '$lib/assets/assessmentCardBgImg/Assessment_HTP.png'
import Assessment_JTCI_12_18 from '$lib/assets/assessmentCardBgImg/Assessment_JTCI 12-18.png'
import Assessment_JTCI_3_6 from '$lib/assets/assessmentCardBgImg/Assessment_JTCI 3-6.png'
import Assessment_JTCI_7_11 from '$lib/assets/assessmentCardBgImg/Assessment_JTCI 7-11.png'
import Assessment_K_WISC_V from '$lib/assets/assessmentCardBgImg/Assessment_K-WISC-V.png'
import Assessment_K_WPPSI_IV from '$lib/assets/assessmentCardBgImg/Assessment_K-WPPSI-IV.png'
import Assessment_KFD from '$lib/assets/assessmentCardBgImg/Assessment_KFD.png'
import Assessment_MMPI_2 from '$lib/assets/assessmentCardBgImg/Assessment_MMPI-2.png'
import Assessment_MMPI_A_Youth from '$lib/assets/assessmentCardBgImg/Assessment_MMPI-A-Youth.png'
import Assessment_PAT_1 from '$lib/assets/assessmentCardBgImg/Assessment_PAT-1.png'
import Assessment_PAT_2 from '$lib/assets/assessmentCardBgImg/Assessment_PAT-2.png'
import Assessment_RAVEN_CPM from '$lib/assets/assessmentCardBgImg/Assessment_RAVEN_CPM.png'
import Assessment_RAVEN_SPM from '$lib/assets/assessmentCardBgImg/Assessment_RAVEN_SPM.png'
import Assessment_Rorschach from '$lib/assets/assessmentCardBgImg/Assessment_Rorschach.png'
import Assessment_SCT from '$lib/assets/assessmentCardBgImg/Assessment_SCT.png'
import Assessment_TCI from '$lib/assets/assessmentCardBgImg/Assessment_TCI.png'
import Assessment_Smaratphone from '$lib/assets/assessmentCardBgImg/Assessment_Smartphone.png'

export const assessmentColorMapper: Record<
  string,
  { symbol_color: string; backgroundImage: string }
> = {
  // 0. Smaratphone
  'Smartphone Addiction Scale': {
    symbol_color: 'bg-[#5A5A5A]',
    backgroundImage: Assessment_Smaratphone
  },

  'NEOFECT Smart Balance': {
    symbol_color: 'bg-[#1297E5]',
    backgroundImage: Assessment_Smaratphone
  },

  // 1. BGT
  BGT: { symbol_color: 'bg-etc-orange', backgroundImage: Assessment_BGT },

  // 2-5. RAVEN 시리즈
  'RAVEN CPM': {
    symbol_color: 'bg-etc-yellow',
    backgroundImage: Assessment_RAVEN_CPM
  },
  'RAVEN CPM(온라인)': {
    symbol_color: 'bg-etc-yellow',
    backgroundImage: Assessment_RAVEN_CPM
  },
  'RAVEN SPM': {
    symbol_color: 'bg-etc-yellow',
    backgroundImage: Assessment_RAVEN_SPM
  },
  'RAVEN SPM(온라인)': {
    symbol_color: 'bg-etc-yellow',
    backgroundImage: Assessment_RAVEN_SPM
  },

  // 6. KFD
  KFD: { symbol_color: 'bg-etc-violet', backgroundImage: Assessment_KFD },

  // 7-8. HTP
  HTP: { symbol_color: 'bg-etc-purple-blue', backgroundImage: Assessment_HTP },
  'HTP(온라인)': {
    symbol_color: 'bg-etc-purple-blue',
    backgroundImage: Assessment_HTP
  },

  // 9. Rorschach
  Rorschach: {
    symbol_color: 'bg-etc-blue',
    backgroundImage: Assessment_Rorschach
  },

  // 10-11. K-WISC/WPPSI
  'K-WISC-V': {
    symbol_color: 'bg-etc-light-blue',
    backgroundImage: Assessment_K_WISC_V
  },
  'K-WPPSI-IV': {
    symbol_color: 'bg-etc-green',
    backgroundImage: Assessment_K_WPPSI_IV
  },

  // 12. SCT
  SCT: { symbol_color: 'bg-etc-purple', backgroundImage: Assessment_SCT },

  // 13. Bayley
  Bayley: {
    symbol_color: 'bg-etc-green-yellow',
    backgroundImage: Assessment_Bayley
  },
  'K-Bayley-Ⅲ': {
    symbol_color: 'bg-etc-green-yellow',
    backgroundImage: Assessment_Bayley
  },
  'K-Bayley-III': {
    symbol_color: 'bg-etc-green-yellow',
    backgroundImage: Assessment_Bayley
  },

  // 14-15. MMPI
  'MMPI-2': { symbol_color: 'bg-etc-pink', backgroundImage: Assessment_MMPI_2 },
  'MMPI-A': {
    symbol_color: 'bg-etc-pink',
    backgroundImage: Assessment_MMPI_A_Youth
  },

  // 16. TCI
  TCI: { symbol_color: 'bg-etc-pink', backgroundImage: Assessment_TCI },

  // 17-19. JTCI 시리즈
  'JTCI 3-6': {
    symbol_color: 'bg-etc-mint',
    backgroundImage: Assessment_JTCI_3_6
  },
  'JTCI 7-11': {
    symbol_color: 'bg-etc-mint',
    backgroundImage: Assessment_JTCI_7_11
  },
  'JTCI 12-18': {
    symbol_color: 'bg-etc-mint',
    backgroundImage: Assessment_JTCI_12_18
  },

  // 20-21. PAT
  'PAT-1(온라인)': {
    symbol_color: 'bg-etc-red',
    backgroundImage: Assessment_PAT_1
  },
  'PAT-2': { symbol_color: 'bg-etc-red', backgroundImage: Assessment_PAT_2 },

  // 22-24. CBCL 시리즈
  'CBCL 6-18': {
    symbol_color: 'bg-etc-brick',
    backgroundImage: Assessment_CBCL_6_18
  },
  'CBCL 6-18(온라인)': {
    symbol_color: 'bg-etc-brick',
    backgroundImage: Assessment_CBCL_6_18
  },
  'CBCL 1.5-5': {
    symbol_color: 'bg-etc-brick',
    backgroundImage: Assessment_CBCL_1_5
  },

  // 기존 호환성을 위한 추가 매핑
  PAT: { symbol_color: 'bg-etc-red', backgroundImage: Assessment_PAT_1 },
  'PAT-1': { symbol_color: 'bg-etc-red', backgroundImage: Assessment_PAT_1 },
  'HTP ONLINE': {
    symbol_color: 'bg-etc-purple-blue',
    backgroundImage: Assessment_HTP
  },
  'CBCL 6-18 ONLINE': {
    symbol_color: 'bg-etc-brick',
    backgroundImage: Assessment_CBCL_6_18
  },
  'PAT ONLINE': {
    symbol_color: 'bg-etc-red',
    backgroundImage: Assessment_PAT_1
  },
  'RAVEN ONLINE': {
    symbol_color: 'bg-etc-yellow',
    backgroundImage: Assessment_RAVEN_SPM
  },

  // 추가 매핑 (목데이터용)
  'Smartphone Usage Habit': {
    symbol_color: 'bg-[#5A5A5A]',
    backgroundImage: Assessment_Smaratphone
  },
  'Smart Body Checker': {
    symbol_color: 'bg-[#5A5A5A]',
    backgroundImage: Assessment_Smaratphone
  },
  'Comprehensive Attention Test': {
    symbol_color: 'bg-etc-blue',
    backgroundImage: Assessment_SCT
  }
}
