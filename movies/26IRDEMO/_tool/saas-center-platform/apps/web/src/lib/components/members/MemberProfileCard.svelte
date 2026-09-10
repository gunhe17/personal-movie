<script lang="ts">
  import { emptyValueLabel } from '$lib/utils/stringConverter'
  import EditIcon from '$lib/assets/EditIcon.svelte'
  import PermissionGuard from '@common/components/PermissionGuard.svelte'
  import { canAccess } from '$lib/stores/permission.view'
  import { MEMBER_PERMISSIONS } from '$lib/features/members/permissions'
  import { MEMBER_EMPLOYMENT_TYPE_MAP } from '$lib/features/members/constants'
  import { formatUtcToKst } from '$lib/utils/date'
  import Typography from '@common/components/Typography.svelte'
  import CertifiedExpertBadge from '$lib/features/credentials/components/CertifiedExpertBadge.svelte'
  import CrownIcon from '$lib/assets/CrownIcon.svelte'
  import counselorMaleAvatar from '$lib/assets/counselor_male.png'
  import counselorFemaleAvatar from '$lib/assets/counselor_female.png'
  import { getMemberMetrics } from '$lib/hooks/actions/member.action'
  import type {
    MemberDetailResponse,
    MemberMetricsResponse
  } from '$lib/hooks/actions/member.action'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { centerId } from '$lib/stores/center.store'
  import { goto } from '$app/navigation'
  import ClientIcon28 from '$lib/assets/ClientIcon28.svelte'
  import Counsel28Icon from '$lib/assets/Counsel28Icon.svelte'
  import AssessmentIcon28 from '$lib/assets/AssessmentIcon28.svelte'
  import ScrollFadeArea from '$lib/components/common/ScrollFadeArea.svelte'

  interface Props {
    member: MemberDetailResponse
    onModify?: () => void
    /** 제공되면 아바타 클릭으로 사진 변경 가능 (없으면 표시 전용) */
    onAvatarChange?: (file: File) => void | Promise<void>
    bare?: boolean
  }

  let { member, onModify, onAvatarChange, bare = false }: Props = $props()

  // ── 프로필 사진 업로드 ──
  let fileInput = $state<HTMLInputElement | null>(null)
  let uploading = $state(false)
  let imgError = $state(false)

  $effect(() => {
    member.profile_image_url
    imgError = false
  })

  const avatarInitial = $derived(
    (member.person.name ?? '').trim().charAt(0) || '?'
  )
  const canEditAvatar = $derived(
    !!onAvatarChange && $canAccess({ any: [MEMBER_PERMISSIONS.modify] })
  )

  async function onAvatarFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file || !onAvatarChange) return
    uploading = true
    try {
      await onAvatarChange(file)
    } finally {
      uploading = false
      if (fileInput) fileInput.value = ''
    }
  }

  // ── 활동 지표 (카드 자체 쿼리) ──
  const metricsQuery = $derived(
    queryBuilder(getMemberMetrics, () => ({
      centerId: $centerId!,
      memberId: member.id
    }))
  )
  const metrics = $derived(
    metricsQuery.data as MemberMetricsResponse | undefined
  )

  // 드릴다운: 지표 클릭 시 이 구성원으로 필터된 목록으로 이동
  // (상담 현황은 selectedManagerNames, 검사 현황은 staff 쿼리키 사용)
  const goCounseling = () =>
    goto(`/counseling/status?selectedManagerNames=${member.id}`)
  const goAssessment = () => goto(`/assessment/status?staff=${member.id}`)

  // 성별 정규화 (male/MALE/M/남/남자 등 다양한 형식 포용)
  const genderNorm = $derived.by<'male' | 'female' | null>(() => {
    const g = (member.person.gender ?? '').toLowerCase()
    if (['male', 'm', '남', '남자'].includes(g)) return 'male'
    if (['female', 'f', '여', '여자'].includes(g)) return 'female'
    return null
  })
  // 이미지 폴백 시 성별 매칭 배경/글자색 (내담자 아바타와 동일 규칙)
  const avatarBg = $derived(
    genderNorm === 'male'
      ? 'bg-blue-50'
      : genderNorm === 'female'
        ? 'bg-status-danger-bg'
        : 'bg-gray-100'
  )
  const avatarFg = $derived(
    genderNorm === 'male'
      ? 'text-blue-500'
      : genderNorm === 'female'
        ? 'text-status-danger'
        : 'text-gray-500'
  )
  // 프로필 사진이 없을 때 성별에 맞는 기본 상담사 일러스트로 폴백
  const counselorAvatar = $derived(
    genderNorm === 'male'
      ? counselorMaleAvatar
      : genderNorm === 'female'
        ? counselorFemaleAvatar
        : null
  )
  // 이미지(사진·일러스트)로 박스를 채울 땐 배경색을 두지 않는다.
  // (상담사 일러스트는 원형+투명 모서리라 배경색이 네모로 비쳐 보임)
  const showInitialAvatar = $derived(
    !(member.profile_image_url && !imgError) && !counselorAvatar
  )
  const employmentLabel: string = $derived(
    MEMBER_EMPLOYMENT_TYPE_MAP[
      member.employment_type as keyof typeof MEMBER_EMPLOYMENT_TYPE_MAP
    ] ||
      member.employment_type ||
      ''
  )
  // 가입일·입사일 통합 → 등록일 (created_at 기준, KST)
  const registeredAt = $derived(
    member.created_at ? formatUtcToKst(member.created_at, 'YYYY-MM-DD') : '-'
  )

  // ── 근속: hire_date 기준 경과 기간 (년·개월 + 총 누적 일수) ──
  const tenureLabel = $derived.by<string | null>(() => {
    if (!member.hire_date) return null
    const hire = new Date(member.hire_date)
    if (Number.isNaN(hire.getTime())) return null
    const now = new Date()
    if (now < hire) return null

    // 완성된 총 개월 수
    let months =
      (now.getFullYear() - hire.getFullYear()) * 12 +
      (now.getMonth() - hire.getMonth())
    if (now.getDate() < hire.getDate()) months -= 1

    // 입사일부터 오늘까지 총 누적 일수
    const MS_PER_DAY = 1000 * 60 * 60 * 24
    const totalDays = Math.floor((now.getTime() - hire.getTime()) / MS_PER_DAY)

    const years = Math.floor(months / 12)
    const restMonths = months % 12

    const parts: string[] = []
    if (years > 0) parts.push(`${years}년`)
    if (restMonths > 0) parts.push(`${restMonths}개월`)

    // 1개월 미만이면 누적 일수만 표기
    if (parts.length === 0) {
      return totalDays > 0 ? `${totalDays}일` : '오늘 입사'
    }
    // 기간 + (총 누적 일수)
    return `${parts.join(' ')} (총 ${totalDays}일)`
  })

  // 입사일 (KST). hire_date 있을 때만 행 노출.
  const hireDateLabel = $derived(
    member.hire_date ? formatUtcToKst(member.hire_date, 'YYYY-MM-DD') : null
  )

  // 기본 정보 행 (빈값이면 회색 처리). 생년월일·성별은 프로필 헤더가 소유한다.
  // 입사일·근속은 hire_date 있을 때만 행으로 추가.
  const infoRows = $derived([
    {
      label: '연락처',
      value: member.person.phone,
      empty: !member.person.phone
    },
    {
      label: '이메일',
      value: member.person.email,
      empty: !member.person.email
    },
    { label: '고용형태', value: employmentLabel, empty: !employmentLabel },
    { label: '등록일', value: registeredAt, empty: registeredAt === '-' },
    ...(hireDateLabel
      ? [{ label: '입사일', value: hireDateLabel, empty: false }]
      : []),
    ...(tenureLabel
      ? [{ label: '근속', value: tenureLabel, empty: false }]
      : [])
  ])
</script>

{#snippet avatarBox()}
  <div
    class="w-20 h-20 rounded-lg overflow-hidden flex items-center justify-center {showInitialAvatar
      ? avatarBg
      : ''}"
  >
    {#if member.profile_image_url && !imgError}
      <img
        src={member.profile_image_url}
        alt=""
        class="w-full h-full object-cover"
        onerror={() => (imgError = true)}
      />
    {:else if counselorAvatar}
      <img src={counselorAvatar} alt="" class="w-full h-full object-cover" />
    {:else}
      <Typography variant="headline-02-normal-bold" color={avatarFg}>
        {avatarInitial}
      </Typography>
    {/if}
  </div>
{/snippet}

{#snippet profileHeader()}
  <div class="relative flex flex-col items-center gap-4">
    <!-- 정보 수정: 카드 우상단 고정 -->
    {#if onModify}
      <PermissionGuard permission={MEMBER_PERMISSIONS.modify}>
        <button
          onclick={onModify}
          aria-label="수정"
          class="absolute right-0 top-0 flex-center group items-center gap-2 overflow-hidden text-gray-600 hover:text-gray-700 transition-colors"
        >
          <EditIcon />
          <span class="text-body-02-normal-medium">수정</span>
        </button>
      </PermissionGuard>
    {/if}

    <!-- 아바타 -->
    {#if canEditAvatar}
      <button
        type="button"
        class="relative shrink-0 group/avatar rounded-lg focus:outline-none"
        aria-label="프로필 사진 변경"
        onclick={() => fileInput?.click()}
        disabled={uploading}
      >
        {@render avatarBox()}
        <span
          class="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 opacity-0 transition-opacity group-hover/avatar:opacity-100 {uploading
            ? 'opacity-100'
            : ''}"
        >
          <!-- 프로필이 크게(80) 들어가는 영역의 오버레이 힌트 — 10(caption)은 너무 작아
               13(Label_01)으로 올린다. 프로필 편집이 가능한 영역 전체 동일 규격. -->
          <Typography variant="label-01-normal-medium" color="text-white">
            {uploading ? '업로드 중' : '변경하기'}
          </Typography>
        </span>
      </button>
      <input
        bind:this={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        class="hidden"
        onchange={onAvatarFileChange}
      />
    {:else}
      {@render avatarBox()}
    {/if}

    <!-- 이름 + 권한 / 생년월일 · 성별 (가운데 정렬 — 내담자 상세와 동일 규격·간격) -->
    <div class="flex flex-col items-center gap-2">
      <div class="flex flex-wrap items-center justify-center gap-2">
        <Typography variant="headline-02-normal-semibold" color="text-gray-900">
          {member.person.name}
        </Typography>
        {#if member.is_certified}
          <CertifiedExpertBadge size="sm" iconOnly />
        {/if}
        <!-- 관리자(ADMIN)는 구성원 리스트와 동일한 왕관 + tag-orange 배지 -->
        {#if member.role_code === 'ADMIN'}
          <span
            class="flex h-6 shrink-0 items-center gap-1 rounded bg-tag-orange-bg px-2 text-label-01-normal-medium text-tag-orange-fg"
          >
            <CrownIcon />
            {member.role_name}
          </span>
        {:else}
          <Typography variant="body-01-normal-regular" color="text-gray-500">
            {member.role_name}
          </Typography>
        {/if}
      </div>
      <div class="flex flex-wrap items-center justify-center gap-2">
        <Typography variant="body-01-normal-regular" color="text-body-default">
          {member.person.birth || '-'}
        </Typography>
        <span class="h-3 w-px bg-gray-300" aria-hidden="true"></span>
        <Typography variant="body-01-normal-regular" color="text-body-default">
          {genderNorm === 'male' ? '남' : genderNorm === 'female' ? '여' : '-'}
        </Typography>
      </div>
    </div>
  </div>
{/snippet}

{#snippet profileBody()}
  <!-- 기본 정보 -->
  <!-- 프로필 헤더(생년월일·성별)와 기본 정보 사이 구분선 없음 — 간격 20으로만 구분 -->
  <div class="pt-5">
    <dl
      class="grid grid-cols-[auto_1fr] auto-rows-[20px] items-center gap-x-6 gap-y-3"
    >
      <!-- 생년월일·성별은 프로필 헤더(이름 하단)로 이동 — 여기서 중복 표기하지 않는다 -->
      {#each infoRows as row (row.label)}
        <Typography variant="body-01-normal-regular" color="text-gray-600">
          {row.label}
        </Typography>
        <Typography
          variant="body-01-normal-regular"
          color={row.empty ? 'text-gray-400' : 'text-gray-900'}
        >
          {row.empty ? emptyValueLabel(row.label) : row.value}
        </Typography>
      {/each}
    </dl>
  </div>

  <!-- 메모 (gray-50 박스, 패딩 12, 타이틀 스택) — 위 기본정보와 20 (내담자 상세와 동일) -->
  <div class="mt-5">
    <!-- 상세 메모 — 최소 높이 95(패딩 24 + 라벨 15 + gap 8 + 본문 2줄 48).
         최소값일 뿐이라 본문이 3줄 이상이면 그만큼 높이가 늘어난다(카드 미리보기는 2줄 고정). -->
    <div class="min-h-[95px] rounded-xl bg-gray-50 p-3">
      <Typography
        variant="body-02-normal-medium"
        color="text-title-subtitle"
        className="block"
      >
        메모
      </Typography>
      <Typography
        variant="body-01-reading-regular"
        color={member.memo ? 'text-gray-700' : 'text-gray-400'}
        className="mt-2 block whitespace-pre-wrap"
      >
        {member.memo || '등록된 메모가 없어요.'}
      </Typography>
    </div>
  </div>

  <!-- 활동 지표 -->
  <div class="mt-6 pt-6 border-t border-gray-100">
    <Typography
      variant="title-01-semibold"
      color="text-gray-900"
      className="mb-4 block"
    >
      활동 지표
    </Typography>
    <div class="flex flex-col gap-2">
      <!-- 담당 내담자 (정보성, 클릭 X) -->
      <div class="flex items-center gap-3 rounded-xl bg-gray-50 p-4">
        {@render metricRow(
          ClientIcon28,
          '담당 내담자',
          metrics ? metrics.assigned_clients_count : '-',
          metrics ? '명' : ''
        )}
      </div>

      <!-- 상담 / 검사 (2열, 클릭 → 현황 드릴다운) -->
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          onclick={goCounseling}
          class="flex items-center gap-2 rounded-xl bg-gray-50 p-4 text-left transition-colors hover:bg-gray-100"
        >
          {@render metricRow(
            Counsel28Icon,
            '상담',
            metrics ? metrics.counseling.total : '-',
            metrics ? '건' : ''
          )}
        </button>
        <button
          type="button"
          onclick={goAssessment}
          class="flex items-center gap-2 rounded-xl bg-gray-50 p-4 text-left transition-colors hover:bg-gray-100"
        >
          {@render metricRow(
            AssessmentIcon28,
            '검사',
            metrics ? metrics.assessment.total : '-',
            metrics ? '건' : ''
          )}
        </button>
      </div>
    </div>
  </div>
{/snippet}

{#if bare}
  <!-- 모바일 패널 안: 부모(MemberProfileCardPanel)가 스크롤을 담당하므로 단순 흐름 -->
  <section class="bg-white">
    <div class="mb-6">{@render profileHeader()}</div>
    {@render profileBody()}
  </section>
{:else}
  <!-- 데스크탑 좌측 패널: 프로필 헤더 고정 + 본문만 ScrollFadeArea로 스크롤 -->
  <section
    class="flex h-full min-h-0 flex-col rounded-2xl border border-gray-200 bg-white p-6"
  >
    <div class="shrink-0">{@render profileHeader()}</div>
    <ScrollFadeArea
      class="-mx-6 mt-6 px-6"
      bounceArrow
      deps={[member, metrics]}
    >
      {@render profileBody()}
    </ScrollFadeArea>
  </section>
{/if}

<!-- 활동 지표 카드 내부: 아이콘 + 라벨 + 단일 숫자 + 단위 (3카드 공통) -->
{#snippet metricRow(
  Icon: typeof Counsel28Icon,
  label: string,
  value: number | string,
  unit: string
)}
  <Icon />
  <div class="min-w-0 flex-1">
    <Typography
      variant="body-02-normal-medium"
      color="text-title-subtitle"
      className="block"
    >
      {label}
    </Typography>
    <div class="mt-2 flex items-baseline gap-1">
      <Typography variant="headline-02-normal-semibold" color="text-gray-900">
        {value}
      </Typography>
      {#if unit}
        <Typography variant="body-02-normal-regular" color="text-gray-700">
          {unit}
        </Typography>
      {/if}
    </div>
  </div>
{/snippet}
