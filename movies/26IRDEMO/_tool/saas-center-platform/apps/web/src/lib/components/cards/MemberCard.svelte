<script lang="ts">
  import { goto } from '$app/navigation'
  import { twMerge } from 'tailwind-merge'

  import type { MemberVM } from '$lib/features/members'
  import CrownIcon from '$lib/assets/CrownIcon.svelte'
  import KebabMenu from '$lib/components/assessment/cells/KebabMenu.svelte'
  import Typography from '@common/components/Typography.svelte'
  import counselorMaleAvatar from '$lib/assets/counselor_male.png'
  import counselorFemaleAvatar from '$lib/assets/counselor_female.png'
  import PhoneIcon20 from '$lib/assets/PhoneIcon20.svg'
  import MailIcon20 from '$lib/assets/MailIcon20.svelte.svg'

  interface Props {
    member: MemberVM
    showMenu?: boolean
    isMe?: boolean
    onStatusChange?: (memberId: string, status: string) => void
    onDelete?: (member: MemberVM) => void
    onClick?: (member: MemberVM) => void
    class?: string
  }

  let {
    member,
    showMenu = false,
    onStatusChange,
    onDelete,
    onClick,
    class: className
  }: Props = $props()

  const handleCardClick = () => {
    if (onClick) {
      onClick(member)
    } else {
      goto(`/member/${member.id}`)
    }
  }

  // 아바타: 프로필 이미지 → 성별 상담사 일러스트 → 이니셜 (구성원 상세와 동일 규칙)
  let imgError = $state(false)
  $effect(() => {
    member.profileImageUrl
    imgError = false
  })
  const avatarInitial = $derived(member.name?.trim().charAt(0) || '?')
  const genderNorm = $derived.by<'male' | 'female' | null>(() => {
    const g = (member.gender ?? '').toLowerCase()
    if (['male', 'm', '남', '남자'].includes(g)) return 'male'
    if (['female', 'f', '여', '여자'].includes(g)) return 'female'
    return null
  })
  const counselorAvatar = $derived(
    genderNorm === 'male'
      ? counselorMaleAvatar
      : genderNorm === 'female'
        ? counselorFemaleAvatar
        : null
  )
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
  const showInitialAvatar = $derived(
    !(member.profileImageUrl && !imgError) && !counselorAvatar
  )

  const menuItems = $derived([
    {
      label: member.is_active ? '비활성화' : '활성화',
      onClick: () =>
        onStatusChange?.(member.id, member.is_active ? 'inactive' : 'active')
    },
    {
      label: '구성원 삭제',
      onClick: () => onDelete?.(member),
      variant: 'danger' as const
    }
  ])
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  onclick={handleCardClick}
  class={twMerge(
    'relative flex w-full cursor-pointer flex-col rounded-2xl border border-border-subtle bg-white px-5 pt-6 pb-5 duration-200',
    'hover:border-primary-400 hover:shadow-card-hover',
    className
  )}
>
  <!-- 더보기 (우상단, 공용 KebabMenu) -->
  {#if showMenu}
    <div
      class="absolute right-4 top-4 h-6 w-6"
      onclick={(e) => e.stopPropagation()}
    >
      <KebabMenu items={menuItems} />
    </div>
  {/if}

  <!-- 프로필: 아바타 + 이름 + 역할 (중앙 정렬) -->
  <div class="flex flex-col items-center gap-4">
    <div
      class="flex h-[58px] w-[58px] items-center justify-center overflow-hidden rounded-full {showInitialAvatar
        ? avatarBg
        : ''}"
    >
      {#if member.profileImageUrl && !imgError}
        <img
          src={member.profileImageUrl}
          alt=""
          class="h-full w-full object-cover"
          onerror={() => (imgError = true)}
        />
      {:else if counselorAvatar}
        <img src={counselorAvatar} alt="" class="h-full w-full object-cover" />
      {:else}
        <Typography variant="title-01-semibold" color={avatarFg}>
          {avatarInitial}
        </Typography>
      {/if}
    </div>
    <div class="flex flex-wrap items-center justify-center gap-2">
      <Typography variant="title-01-normal-semibold" color="text-gray-900">
        {member.name}
      </Typography>
      {#if member.role_code === 'ADMIN'}
        <span
          class="flex h-6 items-center gap-1 rounded bg-tag-orange-bg px-2 text-label-01-normal-medium text-tag-orange-fg"
        >
          <CrownIcon />
          {member.role_name}
        </span>
      {:else}
        <Typography variant="body-02-normal-regular" color="text-gray-500">
          {member.role_name}
        </Typography>
      {/if}
    </div>
  </div>

  <!-- 연락처 (중앙 정렬, 아이콘+데이터 프레임 높이 20) -->
  <div class="mt-4 flex flex-col items-center gap-2">
    <div class="flex h-5 items-center gap-2">
      <img src={PhoneIcon20} alt="" class="h-5 w-5 shrink-0" />
      <Typography variant="body-01-normal-regular" color="text-gray-800">
        {member.phone || '-'}
      </Typography>
    </div>
    <div class="flex h-5 max-w-full items-center gap-2">
      <img src={MailIcon20} alt="" class="h-5 w-5 shrink-0" />
      <!-- 말줄임은 truncate-safe (app.css). Normal 토큰은 line-height=폰트크기라
           일반 truncate(overflow:hidden)를 쓰면 디센더(g·@)가 잘린다. -->
      <Typography
        variant="body-01-normal-regular"
        color="text-gray-800"
        className="min-w-0 truncate-safe"
      >
        {member.email || '-'}
      </Typography>
    </div>
  </div>

  <!-- 메모 (내담자 카드와 동일 규격) -->
  <!-- 카드 안 메모는 미리보기 — 2줄까지만 보인다.
       높이 95 = 패딩 24 + 라벨 15 + gap 8 + 본문 2줄 48(16/150%) -->
  <div class="mt-4 h-[95px] w-full rounded-lg bg-gray-50 p-3">
    <Typography
      variant="body-02-normal-medium"
      color="text-gray-500"
      className="block"
    >
      메모
    </Typography>
    <Typography
      variant="body-01-reading-regular"
      color={member.memo ? 'text-gray-700' : 'text-gray-400'}
      className="mt-2 block line-clamp-2 whitespace-pre-wrap"
    >
      {member.memo || '등록된 메모가 없어요.'}
    </Typography>
  </div>
</div>
