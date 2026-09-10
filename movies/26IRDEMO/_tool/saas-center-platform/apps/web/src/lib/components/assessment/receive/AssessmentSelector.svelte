<script lang="ts">
  import Typography, {
    type TypographyVariant
  } from '@common/components/Typography.svelte'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import type { PackageType } from '$lib/hooks/actions/package.action'

  interface Props {
    packages: PackageType[]
    assessmentOptions: string[]
    /** 영어이름 → 한글이름 매핑 */
    korNameMap?: Record<string, string>
    selectedPackageIds: string[]
    selectedAssessmentItems: string[]
    excludedAssessmentItems: string[]
    assessmentsInSelectedPackages: string[]
    onTogglePackage: (pkg: PackageType) => void
    onToggleAssessment: (item: string) => void
    onAddSet?: () => void
    label?: string
    /** 외부에서 라벨을 그릴 때 false로 내부 타이틀 숨김 (formRow 좌측 라벨 패턴) */
    showTitle?: boolean
    /** 라벨 타이포 — 접수 페이지는 필드 타이틀(18), 모달은 폼 라벨 규격(15) */
    labelVariant?: TypographyVariant
    /** 라벨↔콘텐츠 간격 — 폼 라벨 규격은 mb-2(8) */
    labelClass?: string
    /** 검사/세트가 모두 비어있을 때 '추가하기' 링크 URL */
    emptyActionHref?: string
    /** 유효성 검증 에러 상태 */
    hasError?: boolean
  }

  let {
    packages,
    assessmentOptions,
    korNameMap = {},
    selectedPackageIds,
    selectedAssessmentItems,
    excludedAssessmentItems,
    assessmentsInSelectedPackages,
    onTogglePackage,
    onToggleAssessment,
    onAddSet,
    label = '검사',
    showTitle = true,
    labelVariant = 'title-01-semibold' as TypographyVariant,
    labelClass = 'mb-3',
    emptyActionHref,
    hasError = false
  }: Props = $props()

  const hasPackages = $derived(packages.length > 0)
  const isEmpty = $derived(!hasPackages && assessmentOptions.length === 0)
  const selectedPackageNames = $derived(
    selectedPackageIds
      .map((id) => packages.find((p) => p.uid === id)?.name)
      .filter(Boolean) as string[]
  )
  const excludedInPackages = $derived(
    excludedAssessmentItems.filter((item) =>
      assessmentsInSelectedPackages.includes(item)
    )
  )
  /** 세트 외에 개별 추가한 검사 (세트에 검사 추가) */
  const addedItems = $derived(
    selectedAssessmentItems.filter(
      (item) => !assessmentsInSelectedPackages.includes(item)
    )
  )
  function packageAssessmentText(pkg: PackageType): string {
    const names =
      pkg.assessments?.map(
        (assessment) => assessment.kor_name || assessment.eng_name
      ) || []
    return names.join(', ')
  }
</script>

<div>
  {#if showTitle}
    <Typography
      variant={labelVariant}
      color="text-body-default"
      className={labelClass}
    >
      {label} <span class="field-required">*</span>
    </Typography>
  {/if}

  {#if isEmpty}
    <div class="flex flex-col items-center gap-2 rounded-xl bg-gray-50 py-8">
      <Typography variant="body-02-normal-regular" color="text-title-subtitle">
        운영 중인 검사가 없어요
      </Typography>
      <Typography variant="body-02-normal-regular" color="text-caption-subtle">
        검사 관리에서 검사를 운영 중으로 변경해주세요
      </Typography>
      <a
        href="/center/manage?is_active=enabled&active=all"
        class="mt-1 flex items-center gap-2 text-body-02-normal-medium text-action-primary hover:text-action-primary-hover"
      >
        검사 관리로 이동
      </a>
    </div>
  {:else}
    <div class="rounded-xl bg-gray-50 p-4">
      <!-- 검사 세트 (있을 때만) -->
      {#if hasPackages}
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-3"
        >
          검사 세트
        </Typography>

        <div class="flex flex-wrap gap-3">
          {#each packages as pkg}
            {@const isSelected = selectedPackageIds.includes(pkg.uid)}
            <button
              type="button"
              onclick={() => onTogglePackage(pkg)}
              class="w-52 max-w-full rounded-xl border p-4 text-left transition-colors {isSelected
                ? 'border-border-active bg-brand-subtle'
                : 'border-border-default hover:border-border-strong bg-white'}"
            >
              <!-- 세트명 = 카드의 앵커라 body-strong, 그 밑 검사 목록은 본문이라
                   body-default. 선택 여부로 글자색을 바꾸지 않는다 —
                   선택은 면(brand-subtle)과 보더(border-active)가 이미 말한다. -->
              <Typography
                variant="body-01-normal-medium"
                color="text-body-strong"
              >
                {pkg.name}
              </Typography>
              <Typography
                variant="body-01-reading-regular"
                color="text-body-default"
                className="mt-2 break-keep"
              >
                {packageAssessmentText(pkg)}
              </Typography>
            </button>
          {/each}
          {#if onAddSet}
            <button
              type="button"
              onclick={onAddSet}
              class="flex w-52 max-w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong p-4 text-action-primary transition-colors hover:border-icon-secondary hover:text-action-primary-hover bg-white"
            >
              <!-- + 는 문자가 아니라 공용 에셋 — 아이콘↔텍스트 gap 8 (§button 추가 액션) -->
              <PlusIcon20 />
              <Typography variant="body-02-normal-medium" color="text-current">
                추가
              </Typography>
            </button>
          {/if}
        </div>
      {/if}

      <!-- 개별 검사 -->
      {#if assessmentOptions.length > 0}
        {#if hasPackages}
          <hr class="border-border-subtle my-4" />
        {/if}
        <Typography
          variant="body-02-normal-medium"
          color="text-title-subtitle"
          className="mb-3"
        >
          개별 검사
        </Typography>
        <div class="flex flex-wrap gap-2">
          {#each assessmentOptions as item}
            {@const isInPackage = assessmentsInSelectedPackages.includes(item)}
            {@const isExcluded = excludedAssessmentItems.includes(item)}
            {@const isSelected = isInPackage
              ? !isExcluded
              : selectedAssessmentItems.includes(item)}
            {@const korName = korNameMap[item]}
            <button
              type="button"
              onclick={() => onToggleAssessment(item)}
              class="flex items-center rounded-lg border p-4 text-body-02-normal-medium transition-colors {isSelected
                ? 'border-border-active bg-brand-subtle text-action-primary'
                : isInPackage
                  ? 'border-border-default bg-white text-caption-subtle hover:bg-gray-50'
                  : 'border-border-default bg-white text-body-default hover:bg-gray-50'}"
            >
              <!-- 한글명만 노출 — 영문 코드는 사용자가 고를 때 쓰는 이름이 아니다
                   (한글명이 없는 항목만 코드로 대체) -->
              {korName || item}
            </button>
          {/each}
        </div>
      {:else}
        <div class="flex items-center gap-2 rounded-lg px-4 py-3">
          <Typography
            variant="body-02-normal-regular"
            color="text-caption-subtle"
          >
            운영 중인 개별 검사가 없어요.
          </Typography>
          <a
            href="/center/manage?is_active=enabled&active=all"
            class="text-body-02-normal-medium text-action-primary hover:text-action-primary-hover whitespace-nowrap"
          >
            검사 관리로 이동
          </a>
        </div>
      {/if}
    </div>
  {/if}

  {#if selectedPackageNames.length > 0}
    <div class="mt-3">
      <Typography variant="body-01-normal-semibold" color="text-action-primary">
        {selectedPackageNames.join(', ')} 세트를 선택했어요
      </Typography>
      {#if excludedInPackages.length > 0}
        <div class="mt-1">
          {#each excludedInPackages as excluded}
            <Typography
              variant="body-01-normal-medium"
              color="text-action-primary"
            >
              - {excluded} 제외
            </Typography>
          {/each}
        </div>
      {/if}
      {#if addedItems.length > 0}
        <div class="mt-1">
          {#each addedItems as name}
            <Typography
              variant="body-01-normal-medium"
              color="text-action-primary"
            >
              - {name} 세트에 검사 추가
            </Typography>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
