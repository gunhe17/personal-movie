<script lang="ts">
  import { goto } from '$app/navigation'
  import Typography from '@common/components/Typography.svelte'

  // Assessment Start 배경 이미지 import
  import TestStartLeftBayley from '$lib/assets/assessmentStartBg/TestStartLeftBayley.png'
  import TestStartLeftBgt from '$lib/assets/assessmentStartBg/TestStartLeftBgt.png'
  import TestStartLeftCBCL from '$lib/assets/assessmentStartBg/TestStartLeftCBCL.png'
  import TestStartLeftHTP from '$lib/assets/assessmentStartBg/TestStartLeftHTP.png'
  import TestStartLeftJTCI from '$lib/assets/assessmentStartBg/TestStartLeftJTCI.png'
  import TestStartLeftKFD from '$lib/assets/assessmentStartBg/TestStartLeftKFD.png'
  import TestStartLeftMMPI from '$lib/assets/assessmentStartBg/TestStartLeftMMPI.png'
  import TestStartLeftPAT from '$lib/assets/assessmentStartBg/TestStartLeftPAT.png'
  import TestStartLeftRAVEN from '$lib/assets/assessmentStartBg/TestStartLeftRAVEN.png'
  import TestStartLeftRorschach from '$lib/assets/assessmentStartBg/TestStartLeftRorschach.png'
  import TestStartLeftSCT from '$lib/assets/assessmentStartBg/TestStartLeftSCT.png'
  import TestStartLeftTCI from '$lib/assets/assessmentStartBg/TestStartLeftTCI.png'
  import TestStartLeftWISC4 from '$lib/assets/assessmentStartBg/TestStartLeftWISC4.png'
  import TestStartLeftWISC5 from '$lib/assets/assessmentStartBg/TestStartLeftWISC5.png'
  import CloseIcon from '$root/src/lib/assets/CloseIcon.svelte'
  import Pencil from '$root/src/lib/assets/Pencil.svelte'
  import ArrowRightIcon from '$root/src/lib/assets/ArrowRightIcon.svelte'
  import ArrowRightV2 from '$root/src/lib/assets/ArrowRightV2.svelte'

  interface Props {
    params: { id: string }
  }

  let { params }: Props = $props()

  // 검사 코드 → 배경 이미지 매핑
  const backgroundImageMap: Record<string, string> = {
    BGT: TestStartLeftBgt,
    Bayley: TestStartLeftBayley,
    CBCL: TestStartLeftCBCL,
    HTP: TestStartLeftHTP,
    JTCI: TestStartLeftJTCI,
    KFD: TestStartLeftKFD,
    MMPI: TestStartLeftMMPI,
    PAT: TestStartLeftPAT,
    RAVEN: TestStartLeftRAVEN,
    Rorschach: TestStartLeftRorschach,
    SCT: TestStartLeftSCT,
    TCI: TestStartLeftTCI,
    WISC4: TestStartLeftWISC4,
    WISC5: TestStartLeftWISC5
  }

  // 검사 메타데이터 (실제 API 연동 시 대체)
  const assessmentMetadata: Record<
    string,
    {
      code: string
      korName: string
      description: string[]
      assessmentType: string
      targetAgeGroup: string
    }
  > = {
    BGT: {
      code: 'BGT',
      korName: '벤더게슈탈트검사',
      description: [
        '도형을 따라 그리는 과정을 통해',
        '아동의 시각-운동 협응력과 인지적 균형감을 평가해요.'
      ],
      assessmentType: '투사적 검사',
      targetAgeGroup: '5세 ~ 11세 (유아~초등)'
    },
    Rorschach: {
      code: 'Rorschach',
      korName: '로르샤흐 잉크 반점 검사',
      description: [
        '잉크 얼룩 이미지를 통해',
        '개인의 성격, 정서, 사고 과정을 심층적으로 분석해요.'
      ],
      assessmentType: '투사적 검사',
      targetAgeGroup: '만 5세 이상'
    },
    HTP: {
      code: 'HTP',
      korName: '집-나무-사람 검사',
      description: [
        '집, 나무, 사람 그림을 통해',
        '무의식적인 심리 상태와 자아 개념을 파악해요.'
      ],
      assessmentType: '투사적 검사',
      targetAgeGroup: '만 4세 이상'
    },
    KFD: {
      code: 'KFD',
      korName: '동적 가족화 검사',
      description: [
        '가족 구성원이 활동하는 모습을 그려',
        '가족 관계와 역동을 파악해요.'
      ],
      assessmentType: '투사적 검사',
      targetAgeGroup: '만 5세 이상'
    },
    WISC5: {
      code: 'WISC5',
      korName: '웩슬러 아동 지능검사 5판',
      description: [
        '아동의 인지 능력을 종합적으로 평가하는',
        '개인 지능검사예요.'
      ],
      assessmentType: '지능검사',
      targetAgeGroup: '6세 ~ 16세'
    },
    WISC4: {
      code: 'WISC4',
      korName: '웩슬러 아동 지능검사 4판',
      description: [
        '아동의 인지 능력을 종합적으로 평가하는',
        '개인 지능검사예요.'
      ],
      assessmentType: '지능검사',
      targetAgeGroup: '6세 ~ 16세'
    },
    Bayley: {
      code: 'Bayley',
      korName: '베일리 발달검사',
      description: [
        '영유아의 인지, 언어, 운동 발달 수준을 종합적으로 평가해요.'
      ],
      assessmentType: '발달검사',
      targetAgeGroup: '1개월 ~ 42개월'
    },
    CBCL: {
      code: 'CBCL',
      korName: '아동행동평가척도',
      description: ['아동 및 청소년의 정서, 행동 문제를 종합적으로 평가해요.'],
      assessmentType: '행동평가',
      targetAgeGroup: '1.5세 ~ 18세'
    },
    JTCI: {
      code: 'JTCI',
      korName: '기질 및 성격검사',
      description: ['아동 및 청소년의 기질과 성격 특성을 평가해요.'],
      assessmentType: '성격검사',
      targetAgeGroup: '3세 ~ 18세'
    },
    MMPI: {
      code: 'MMPI',
      korName: '다면적 인성검사',
      description: ['개인의 성격 특성과 정신병리를 종합적으로 평가해요.'],
      assessmentType: '성격검사',
      targetAgeGroup: '만 13세 이상'
    },
    PAT: {
      code: 'PAT',
      korName: '부모양육태도검사',
      description: ['부모의 양육 태도와 양육 스트레스를 평가해요.'],
      assessmentType: '부모검사',
      targetAgeGroup: '부모 대상'
    },
    RAVEN: {
      code: 'RAVEN',
      korName: '레이븐 지능검사',
      description: ['비언어적 추론 능력을 통해 일반 지능을 평가해요.'],
      assessmentType: '지능검사',
      targetAgeGroup: '만 5세 이상'
    },
    SCT: {
      code: 'SCT',
      korName: '문장완성검사',
      description: ['미완성 문장을 완성하여 개인의 내면 심리를 탐색해요.'],
      assessmentType: '투사적 검사',
      targetAgeGroup: '만 7세 이상'
    },
    TCI: {
      code: 'TCI',
      korName: '기질 및 성격검사',
      description: ['성인의 기질과 성격 특성을 종합적으로 평가해요.'],
      assessmentType: '성격검사',
      targetAgeGroup: '만 19세 이상'
    }
  }

  // 현재 검사 정보 가져오기
  const getAssessmentInfo = (id: string) => {
    // id에서 검사 코드 추출 (예: "BGT_123" → "BGT")
    const code = id.split('_')[0].toUpperCase()

    // 매칭되는 메타데이터 찾기
    for (const [key, value] of Object.entries(assessmentMetadata)) {
      if (key.toUpperCase() === code || value.code.toUpperCase() === code) {
        return {
          ...value,
          backgroundImage: backgroundImageMap[key] || TestStartLeftBgt
        }
      }
    }

    // 기본값 반환 (BGT)
    return {
      ...assessmentMetadata.BGT,
      backgroundImage: TestStartLeftBgt
    }
  }

  const assessmentInfo = $derived(getAssessmentInfo(params.id))

  const handleClose = () => {
    window.history.back()
  }

  const handleStartScoring = () => {
    // TODO: 채점 페이지로 이동 (검사 타입에 따라 다른 경로)
    const code = assessmentInfo.code.toLowerCase()
    if (code === 'rorschach') {
      goto(`/assessment/rorschach/${params.id}`)
    } else {
      // 일반 채점 페이지로 이동
      goto(`/assessment-case/${params.id}/scoring`)
    }
  }
</script>

<div class="flex h-screen w-screen">
  <!-- 왼쪽: 검사 정보 영역 -->
  <div class="relative flex w-1/2 flex-col p-[72px] text-white">
    <!-- 배경 이미지 -->
    <div
      class="absolute inset-0 bg-cover bg-center bg-no-repeat"
      style="background-image: url({assessmentInfo.backgroundImage})"
    ></div>

    <!-- 닫기 버튼 -->
    <button
      onclick={handleClose}
      class="relative z-10 flex h-[48px] w-[110px] items-center justify-center gap-2 rounded-[100px] bg-white/10 transition-colors hover:bg-white/20"
    >
      <CloseIcon />
      <Typography variant="title-02-semibold" color="text-white"
        >닫기</Typography
      >
    </button>

    <!-- 검사 정보 컨텐츠 -->
    <div
      class="relative z-10 mt-auto flex h-full w-full flex-col items-center justify-center px-12 pb-24"
    >
      <div>
        <!-- 검사 코드 -->
        <Typography variant="headline-01" color="text-white" className="mb-2">
          {assessmentInfo.code}
        </Typography>

        <!-- 검사명 -->
        <Typography variant="headline-01" color="text-white" className="mb-6">
          {assessmentInfo.korName}
        </Typography>

        <div class="my-6">
          {#each assessmentInfo.description as item}
            <!-- 설명 -->
            <Typography
              variant="title-01-reading-regular"
              color="text-white"
              className="">{item}</Typography
            >
          {/each}
        </div>

        <!-- 배지들 -->
        <div class="flex gap-2">
          <div
            class="flex h-[40px] items-center justify-center rounded-[8px] bg-white/10 px-3 text-white"
          >
            <Typography variant="body-01-medium" color="text-white"
              >{assessmentInfo.assessmentType}</Typography
            >
          </div>
          <div
            class="flex h-[40px] items-center justify-center rounded-[8px] bg-white/10 px-3 text-white"
          >
            <Typography variant="body-01-medium" color="text-white"
              >{assessmentInfo.targetAgeGroup}</Typography
            >
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 오른쪽: 채점 시작 카드 영역 -->
  <div class="flex w-1/2 items-center justify-center bg-gray-50">
    <button
      onclick={handleStartScoring}
      class="group flex h-[400px] w-[400px] flex-col rounded-lg border border-gray-200 bg-white p-8 shadow-sm transition-all hover:border-primary-300 hover:shadow-lg"
    >
      <!-- 아이콘 -->
      <div class="mb-auto">
        <Pencil />
      </div>

      <div class="flex w-full justify-between">
        <!-- 텍스트 -->
        <div class="text-left">
          <Typography
            variant="headline-02"
            color="text-gray-900"
            className="mb-1">채점</Typography
          >
          <Typography
            variant="headline-02"
            color="text-gray-900"
            className="mb-3"
          >
            시작
          </Typography>
          <Typography variant="body-02-regular" color="text-gray-500">
            지금 바로 채점하고 결과를 확인하세요
          </Typography>
        </div>

        <!-- 화살표 -->
        <div class="mt-4 flex items-end justify-end">
          <div
            class="flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-black transition-colors"
          >
            <ArrowRightV2 />
          </div>
        </div>
      </div>
    </button>
  </div>
</div>
