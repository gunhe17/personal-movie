<script lang="ts">
  import { dateToString } from '../utils/date'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName, maskPhone } from '$lib/utils/maskingHandler'

  import { goto } from '$app/navigation'
  import Typography from '@common/components/Typography.svelte'
  import { formatPhoneNumber } from '../utils/stringConverter'
  import PhoneIcon20 from '$lib/assets/PhoneIcon20.svg'
  import VoucherIcon20 from '$lib/assets/VoucherIcon20.svelte'
  import KebabMenu from '$lib/components/assessment/cells/KebabMenu.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import BadgeRound from '$lib/components/common/BadgeRound.svelte'

  interface Props {
    id: string
    name: string
    code: string
    phone: string
    birth: string
    memo: string
    gender: 'MALE' | 'FEMALE'
    guardianName?: string
    guardianRelation?: string
    /** role이 guardian/both — 카드 좌측 상단에 '보호자' 배지 */
    isGuardian?: boolean
    status?: 'ACTIVE' | 'INACTIVE'
    profileImageUrl?: string | null
    voucherPrimary?: { name: string; remaining: number; total: number } | null
    voucherCount?: number
    /** 활성/비활성 토글 (미전달 시 메뉴에 노출 안 함) */
    onStatusChange?: (id: string, status: string, name?: string) => void
    /** 삭제 (미전달 시 메뉴에 노출 안 함 — 권한 게이팅용) */
    onDelete?: (id: string, name: string) => void
  }

  let {
    id,
    name,
    code,
    phone,
    birth,
    memo,
    gender,
    guardianName = '',
    guardianRelation = '',
    isGuardian = false,
    status = 'ACTIVE',
    profileImageUrl = null,
    voucherPrimary = null,
    voucherCount = 0,
    onStatusChange,
    onDelete
  }: Props = $props()

  const isActive = $derived(status === 'ACTIVE')

  // 케밥 메뉴 항목: 핸들러가 주어진 것만 노출
  const menuItems = $derived([
    ...(onStatusChange
      ? [
          {
            label: status === 'ACTIVE' ? '비활성화' : '활성화',
            onClick: () =>
              onStatusChange(
                id,
                status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                name
              )
          }
        ]
      : []),
    ...(onDelete
      ? [
          {
            label: '삭제',
            variant: 'danger' as const,
            divider: true,
            onClick: () => onDelete(id, name)
          }
        ]
      : [])
  ])

  let imgError = $state(false)
  $effect(() => {
    profileImageUrl
    imgError = false
  })

  const displayName = $derived($isSecretMode ? maskName(name) : name)
  const avatarInitial = $derived(displayName.trim().charAt(0) || '?')
  const showImage = $derived(!!profileImageUrl && !imgError)

  // 연락처: 미등록이면 고스트 문구 (시크릿 모드는 등록 여부와 무관하게 마스킹)
  const hasPhone = $derived(!!formatPhoneNumber(phone))
  const phoneLabel = $derived(
    $isSecretMode
      ? maskPhone(phone || '') || '***-****-****'
      : formatPhoneNumber(phone) || '등록된 연락처가 없어요'
  )
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  onclick={() => {
    if (!id) return
    goto(`/clients/${id}`)
  }}
  class="relative w-full rounded-2xl border border-border-subtle bg-white px-5 pt-6 pb-5 flex flex-col items-center cursor-pointer transition-all duration-200 hover:border-primary-400 hover:shadow-card-hover"
>
  <!-- 상단 유틸 밴드 — 카드 좌우 패딩(px-5)과 같은 라인에 배지·더보기를 맞추고, 상단도 20 고정.
       (아바타만 상단 24로 띄우므로 pt-6를 따라가지 않도록 top-5를 유지한다)
       케밥은 히트영역(32)만 -mr-1.5로 밖으로 흘려 아이콘(20) 우측이 20px 라인에 오도록. -->
  {#if code || !isActive || menuItems.length > 0}
    <div
      class="absolute inset-x-5 top-5 z-10 flex h-8 items-center justify-between gap-2"
    >
      <!-- 좌측 한 자리 — 비활성이면 상태가 코드보다 먼저 알아야 할 정보라
           코드를 감추고 그 자리를 비활성 배지가 대신한다.
           배지는 딤드 밖(밴드)에 있어 카드가 흐려진 이유를 알려준다 -->
      <div class="flex min-w-0 items-center">
        {#if !isActive}
          <!-- 상태 표시 = Round(pill). Web_Design.md §Components>badge —
               inactive는 tag-gray(fg #606A74 / bg 6% 틴트) -->
          <BadgeRound
            status="completed"
            label="비활성"
            class="min-w-[60px] bg-tag-gray-bg px-3 text-tag-gray-fg"
          />
        {:else if code}
          <Tooltip text="내담자 코드">
            <BadgeRectangle label={code} size="sm" />
          </Tooltip>
        {/if}
      </div>
      {#if menuItems.length > 0}
        <!-- 케밥 hover 영역(40)이 카드 패딩 안에 들어오도록 음수 마진을 두지 않는다 -->
        <div class="flex shrink-0 items-center">
          <KebabMenu items={menuItems} showTooltip={false} />
        </div>
      {/if}
    </div>
  {/if}

  <!-- 본문(아바타~메모) — 비활성이면 여기만 딤드. 상단 밴드(코드·비활성·더보기)는 제외 -->
  <div class="flex w-full flex-col items-center {isActive ? '' : 'opacity-40'}">
    <!-- 아바타 -->
    <div
      class="w-[58px] h-[58px] rounded-full overflow-hidden flex items-center justify-center {gender ===
      'MALE'
        ? 'bg-blue-50'
        : 'bg-status-danger-bg'}"
    >
      {#if showImage}
        <img
          src={profileImageUrl}
          alt=""
          class="w-full h-full object-cover"
          onerror={() => (imgError = true)}
        />
      {:else}
        <Typography
          variant="title-01-semibold"
          color={gender === 'MALE' ? 'text-blue-500' : 'text-status-danger'}
        >
          {avatarInitial}
        </Typography>
      {/if}
    </div>

    <!-- 보호자 + 이름 — 코드는 상단 유틸 밴드로 이동(상담·검사 카드와 동일 위치).
       보호자는 태그가 아니라 이름 앞 브랜드 컬러 텍스트로 — 이름의 수식어라
       배지로 띄우면 코드(식별자)와 같은 급으로 읽힌다 -->
    <div class="mt-4 flex min-w-0 items-center gap-1.5">
      {#if isGuardian}
        <Typography
          variant="body-01-normal-medium"
          color="text-primary-500"
          className="shrink-0"
          tag="span"
        >
          보호자
        </Typography>
      {/if}
      <Typography
        variant="title-01-normal-semibold"
        color="text-gray-900"
        className="min-w-0 truncate-safe"
        tag="span"
      >
        {displayName}
      </Typography>
    </div>

    <!-- 생년월일 | 성별 -->
    <ClientBirthGender
      birthDate={dateToString(birth, 'YYYY-MM-DD') || null}
      {gender}
      class="mt-2"
    />

    <!-- 연락처 -->
    <div class="mt-4 flex h-5 items-center gap-2">
      <img src={PhoneIcon20} alt="" class="h-5 w-5 shrink-0" />
      <Typography
        variant="body-01-normal-regular"
        color={hasPhone || $isSecretMode ? 'text-gray-800' : 'text-gray-400'}
      >
        {phoneLabel}
      </Typography>
    </div>

    <!-- 바우처 -->
    <div
      class="mt-4 w-full flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-3"
    >
      <!-- 아이콘 색은 감싸는 span이 소유 (VoucherIcon20은 currentColor).
         etc-mint = 확장 팔레트 — 청구 전용 mint-500과 겹치지 않는 톤.
         바우처가 없으면 아이콘도 함께 딤 처리(icon-secondary = gray-400) —
         옆 문구가 이미 고스트 색이라 아이콘만 유채색이면 값이 있는 것처럼 읽힌다 -->
      <span
        class="flex shrink-0 {voucherPrimary
          ? 'text-etc-mint'
          : 'text-icon-secondary'}"
        aria-hidden="true"
      >
        <VoucherIcon20 />
      </span>
      {#if voucherPrimary}
        <!-- 이름 + '외 N개'는 한 덩어리 — 바깥 flex에 나란히 두면 이름이 flex-1로
             늘어나 '외 N개'가 잔여 회차 쪽으로 밀려난다. 묶어서 gap 8로 붙이고,
             남는 폭은 이 묶음이 차지해 잔여 회차를 우측 끝에 고정한다.
             이름만 shrink 대상(min-w-0 + truncate-safe)이라 길면 …로 잘린다. -->
        <div class="flex min-w-0 flex-1 items-center gap-2">
          <Typography
            variant="body-01-normal-regular"
            color="text-body-strong"
            className="truncate-safe min-w-0"
          >
            {voucherPrimary.name}
          </Typography>
          {#if voucherCount > 1}
            <span
              class="shrink-0 text-body-02-normal-regular text-body-default"
            >
              외 {voucherCount - 1}개
            </span>
          {/if}
        </div>
        <Typography
          variant="body-01-normal-regular"
          color="text-body-default"
          className="shrink-0 whitespace-nowrap"
        >
          {voucherPrimary.remaining}/{voucherPrimary.total}
        </Typography>
      {:else}
        <Typography
          variant="body-01-normal-regular"
          color="text-gray-400"
          className="flex-1"
        >
          등록된 바우처가 없어요
        </Typography>
      {/if}
    </div>

    <!-- 메모 -->
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
        color="text-gray-700"
        className="mt-2 block line-clamp-2 whitespace-pre-wrap"
      >
        {$isSecretMode ? '***' : memo || '메모가 없습니다'}
      </Typography>
    </div>
  </div>
</div>
