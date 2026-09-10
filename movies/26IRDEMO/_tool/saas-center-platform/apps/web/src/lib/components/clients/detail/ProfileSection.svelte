<script lang="ts">
  import { emptyValueLabel } from '$lib/utils/stringConverter'
  import EditIcon from '$lib/assets/EditIcon.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import AppLinkSection from './AppLinkSection.svelte'
  import ScrollFadeArea from '$lib/components/common/ScrollFadeArea.svelte'
  import Typography from '@common/components/Typography.svelte'
  import { maskAllText, maskName, maskPhone } from '$lib/utils/maskingHandler'
  import { calculateAge } from '$lib/utils/date'
  import VoucherIcon20 from '$lib/assets/VoucherIcon20.svelte'
  import PlusIcon20 from '$lib/assets/PlusIcon20.svelte'
  import type {
    ClientDetailVM,
    RelationInfo
  } from '$lib/features/clients/detail'
  import type { ClientVoucherCardVM } from '$lib/features/clients/detail/voucher'

  interface Props {
    client: ClientDetailVM
    clientId: string
    relationList: RelationInfo[]
    isSecretMode: boolean
    onEditClick: () => void
    onRelationClick: (relation: RelationInfo) => void
    /** 좌측 '사전기록지' 버튼 클릭 → 우측 사전기록지 패널 진입 */
    onPreAdmissionClick?: () => void
    vouchers?: ClientVoucherCardVM[]
    vouchersLoading?: boolean
    onVoucherSelect?: (voucherId: string) => void
    onVoucherCreate?: () => void
    /** 제공되면 아바타 클릭으로 사진 변경 가능 (없으면 표시 전용) */
    onAvatarChange?: (file: File) => void | Promise<void>
    /** 카드 껍데기 없이 흐름만 (모바일 오버레이 패널 안 — 부모가 스크롤 담당) */
    bare?: boolean
  }

  let {
    client,
    clientId,
    relationList,
    isSecretMode,
    onEditClick,
    onRelationClick,
    onPreAdmissionClick,
    vouchers = [],
    vouchersLoading = false,
    onVoucherSelect,
    onVoucherCreate,
    onAvatarChange,
    bare = false
  }: Props = $props()

  // ── 프로필 아바타 (이미지 또는 이니셜 폴백 + 업로드) ──
  let fileInput: HTMLInputElement | null = $state(null)
  let uploading = $state(false)
  let imgError = $state(false)

  const displayName = $derived(
    isSecretMode ? maskName(client.name) : client.name
  )
  // role이 guardian/both — 목록 카드와 동일하게 '보호자' 배지 노출
  const isGuardian = $derived(
    ['guardian', 'both'].includes(String(client.role || '').toLowerCase())
  )
  const avatarInitial = $derived(displayName.trim().charAt(0) || '?')
  // 이미지 URL이 바뀌면 에러 플래그 초기화
  $effect(() => {
    client.profileImageUrl
    imgError = false
  })

  async function onAvatarFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file || !onAvatarChange) return
    uploading = true
    try {
      await onAvatarChange(file)
    } finally {
      uploading = false
      if (fileInput) fileInput.value = '' // 같은 파일 재선택 허용
    }
  }

  // 기본 정보 행 (빈값이면 회색 처리) — 구성원 상세 프로필과 같은 라벨/값 그리드
  // 내담자 코드가 맨 앞 — 상세는 이미 그 내담자 안이라 코드가 식별자가 아니라
  // 조회 대상 속성이다. 배지 형태는 목록에서 카드를 식별할 때만 쓴다(2026-08-26).
  const infoRows = $derived([
    {
      label: '내담자 코드',
      value: client.code ?? '',
      empty: !client.code
    },
    {
      label: '연락처',
      value: client.phone
        ? isSecretMode
          ? maskPhone(client.phone)
          : client.phone
        : '',
      empty: !client.phone
    },
    {
      label: '이메일',
      value: client.email
        ? isSecretMode
          ? maskAllText(client.email)
          : client.email
        : '',
      empty: !client.email
    },
    {
      label: '주소',
      value: client.address
        ? isSecretMode
          ? maskAllText(client.address)
          : client.address
        : '',
      empty: !client.address
    }
  ])
</script>

{#snippet avatarBox()}
  <div
    class="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center {client.gender ===
    'MALE'
      ? 'bg-blue-50'
      : 'bg-status-danger-bg'}"
  >
    {#if client.profileImageUrl && !imgError}
      <img
        src={client.profileImageUrl}
        alt=""
        class="w-full h-full object-cover"
        onerror={() => (imgError = true)}
      />
    {:else}
      <Typography
        variant="headline-02-normal-bold"
        color={client.gender === 'MALE'
          ? 'text-blue-500'
          : 'text-status-danger'}
      >
        {avatarInitial}
      </Typography>
    {/if}
  </div>
{/snippet}

{#snippet profileHeader()}
  <!-- pt-8(32) = 아바타 이하만 밀어내는 상단 여백. 유틸 밴드는 absolute top-0이라
       padding 영향을 받지 않고 컨테이너 최상단(= 패널 전체 패딩)에 그대로 남는다 -->
  <div class="relative flex flex-col items-center gap-4 pt-8">
    <!-- 상단 유틸 밴드 — 정보 수정. 내담자 코드는 배지가 아니라
         아래 기본 정보 그리드 첫 행으로 내려갔다(2026-08-26) -->
    <div
      class="absolute inset-x-0 top-0 z-10 flex h-6 items-center justify-end"
    >
      <button
        onclick={onEditClick}
        aria-label="수정"
        class="flex items-center gap-2 text-gray-600 transition-colors hover:text-gray-700"
      >
        <EditIcon />
        <span class="text-body-02-normal-medium">수정</span>
      </button>
    </div>

    <!-- 아바타 -->
    {#if onAvatarChange}
      <button
        type="button"
        class="relative shrink-0 group/avatar rounded-full focus:outline-none"
        aria-label="프로필 사진 변경"
        onclick={() => fileInput?.click()}
        disabled={uploading}
      >
        {@render avatarBox()}
        <span
          class="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover/avatar:opacity-100 {uploading
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

    <!-- 이름 + 보호자 배지 / 생년월일 · 성별 (가운데 정렬) -->
    <div class="flex flex-col items-center gap-2">
      <div class="flex flex-wrap items-center justify-center gap-2">
        <Typography variant="headline-02-normal-semibold" color="text-gray-900">
          {displayName}
        </Typography>
        {#if isGuardian}
          <BadgeRectangle label="보호자" size="sm" />
        {/if}
      </div>
      <!-- 생년월일 · 성별 — 색은 리스트/카드와 같은 시맨틱 default, 크기만 상세라 16 -->
      <div class="flex flex-wrap items-center justify-center gap-2">
        <Typography variant="body-01-normal-regular" color="text-body-default">
          {client.birth || '-'}
          {#if client.birth}(만 {calculateAge(
              new Date(client.birth).toDateString()
            )}세){/if}
        </Typography>
        <span class="h-3 w-px bg-gray-300" aria-hidden="true"></span>
        <Typography variant="body-01-normal-regular" color="text-body-default">
          {client.gender === 'MALE' ? '남' : '여'}
        </Typography>
      </div>
    </div>
  </div>
{/snippet}

{#snippet profileBody()}
  <!-- 사전기록지 + 앱 연동 — 정확히 반반(2열 그리드). flex-1은 각 버튼의 콘텐츠
       최소폭에 밀려 폭이 갈렸다(실측 176 vs 126) — 그리드는 1fr 1fr로 고정된다 -->
  <div class="grid grid-cols-2 items-center gap-2">
    <button
      type="button"
      onclick={() => onPreAdmissionClick?.()}
      class="flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-border-default bg-white px-6 text-body-default transition-colors hover:bg-bg-base hover:text-body-strong"
    >
      <!-- 프로젝트 에셋 재사용 — 컨테이너 안 그레이톤 추가 버튼 전용으로 만들어진
           Plus 20(currentColor · stroke 1.5). 손으로 그리지 않는다. -->
      <span class="shrink-0" aria-hidden="true"><PlusIcon20 /></span>
      <Typography variant="body-02-normal-medium" color="text-inherit">
        사전기록지
      </Typography>
    </button>
    <!-- 앱 연동 (보호자 전용 — 초대 코드 발급/상태) -->
    <div class="min-w-0">
      <AppLinkSection
        {clientId}
        role={client.role}
        guardianName={displayName}
        {isSecretMode}
      />
    </div>
  </div>

  <!-- 기본 정보 (라벨/값 그리드 — 구성원 상세와 동일 규격) -->
  <div class="mt-6 pt-6 border-t border-gray-100">
    <!-- 값이 두 줄 이상 되는 항목(주소·가족관계)이 있어 행 높이를 고정하지 않는다.
         레이블은 상단 정렬(items-start)해 첫 줄에 붙고, 값은 reading(150%)으로
         행간을 확보한다. 레이블도 같은 reading을 써야 첫 줄 높이가 같아 정렬이 맞는다. -->
    <dl class="grid grid-cols-[auto_1fr] items-start gap-x-6 gap-y-3">
      {#each infoRows as row (row.label)}
        <div class="flex min-h-6 items-start">
          <Typography
            variant="body-01-reading-regular"
            color="text-gray-600"
            className="whitespace-nowrap"
          >
            {row.label}
          </Typography>
        </div>
        <div class="flex min-h-6 items-start">
          <Typography
            variant="body-01-reading-regular"
            color={row.empty ? 'text-gray-400' : 'text-body-strong'}
            className="min-w-0 break-all"
          >
            {row.empty ? emptyValueLabel(row.label) : row.value}
          </Typography>
        </div>
      {/each}
      {#if relationList.length > 0}
        <div class="flex min-h-6 items-start">
          <Typography
            variant="body-01-reading-regular"
            color="text-gray-600"
            className="whitespace-nowrap"
          >
            가족관계
          </Typography>
        </div>
        <div class="flex min-h-6 items-start">
          <!-- 다른 행과 같은 reading(150%)이라야 첫 줄 높이가 24로 같아져 레이블과
               정렬이 맞는다. normal(16)로 두면 레이블(24)보다 4px 위로 떠 보인다.
               줄바꿈 간격도 gap-y-1(4)이면 24 행간과 어긋나 gap-y-0으로 둔다. -->
          <div class="flex flex-wrap items-center gap-x-2">
            {#each relationList as relation, idx}
              <button
                type="button"
                class="group flex cursor-pointer items-center gap-1"
                onclick={() => onRelationClick(relation)}
              >
                <!-- 관계 라벨 색으로 방향을 가른다 — 보호자(위) 브랜드 블루 /
                     자녀(아래) 오렌지 / 형제(옆) 연두. 셋 다 확장 팔레트(etc-*) -->
                <Typography
                  variant="body-01-reading-regular"
                  color={relation.relationLabel === '자녀'
                    ? 'text-etc-orange'
                    : relation.relationLabel === '형제'
                      ? 'text-etc-green-yellow'
                      : 'text-primary-500'}
                  tag="span"
                >
                  {relation.relationLabel}
                </Typography>
                <Typography
                  variant="body-01-reading-regular"
                  color="text-body-strong"
                  tag="span"
                  className="underline underline-offset-4 decoration-gray-300 transition-colors group-hover:text-primary-500 group-hover:decoration-primary-500"
                >
                  {isSecretMode ? maskName(relation.name) : relation.name}
                </Typography>
              </button>
              {#if idx < relationList.length - 1}
                <Typography
                  variant="body-01-reading-regular"
                  color="text-gray-300"
                  tag="span">·</Typography
                >
              {/if}
            {/each}
          </div>
        </div>
      {/if}
    </dl>
  </div>

  <!-- 메모 (gray-50 박스, 패딩 12, 타이틀 스택) — 위 기본정보(가족관계)와 20 -->
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
        color={client.memo ? 'text-gray-700' : 'text-gray-400'}
        className="mt-2 block whitespace-pre-wrap"
      >
        {client.memo
          ? isSecretMode
            ? maskAllText(client.memo)
            : client.memo
          : '등록된 메모가 없어요.'}
      </Typography>
    </div>
  </div>
  <!-- 바우처 (컴팩트 행: 이름 + 사용/총 회기, 클릭 시 우측 바우처 탭 진입).
       위 메모 블록과 24. 레이블은 메모 블록의 라벨과 같은 규격(Body_02 Medium)이고
       아래 카드와 8 — 카드만 덩그러니 놓이면 무슨 목록인지 읽히지 않는다 -->
  {#if vouchersLoading || vouchers.length > 0 || onVoucherCreate}
    <Typography
      variant="body-02-normal-medium"
      color="text-title-subtitle"
      className="mt-6 block"
    >
      바우처
    </Typography>
  {/if}
  {#if vouchersLoading}
    <div class="mt-2">
      <Typography variant="body-01-normal-regular" color="text-gray-400">
        로딩 중...
      </Typography>
    </div>
  {:else if vouchers.length > 0}
    <div class="mt-2 flex flex-col gap-2">
      {#each vouchers as voucher (voucher.id)}
        {@const used = voucher.totalSessions - voucher.remainingSessions}
        <button
          type="button"
          onclick={() => onVoucherSelect?.(voucher.id)}
          class="flex w-full items-center gap-2 rounded-xl border border-border-default bg-white p-3 text-left transition-colors hover:bg-gray-50"
        >
          <!-- 아이콘 색은 감싸는 span이 소유 (VoucherIcon20은 currentColor).
               etc-mint = 확장 팔레트 — 내담자 카드 리스트와 동일 톤
               (청구 전용 mint-500과 겹치지 않는다) -->
          <span class="flex shrink-0 text-etc-mint" aria-hidden="true">
            <VoucherIcon20 />
          </span>
          <Typography
            variant="body-02-normal-medium"
            color="text-gray-900"
            className="min-w-0 flex-1 truncate-safe"
          >
            {voucher.name}
          </Typography>
          <Typography
            variant="body-03-normal-regular"
            color="text-gray-700"
            className="shrink-0 whitespace-nowrap"
          >
            {used}/{voucher.totalSessions}
          </Typography>
        </button>
      {/each}
    </div>
  {:else if onVoucherCreate}
    <button
      type="button"
      onclick={() => onVoucherCreate?.()}
      class="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong text-action-primary transition-colors hover:border-icon-secondary hover:bg-gray-50"
    >
      <span class="flex shrink-0" aria-hidden="true">
        <PlusIcon20 />
      </span>
      <Typography variant="body-01-normal-medium" color="text-current">
        바우처 추가
      </Typography>
    </button>
  {/if}
{/snippet}

{#if bare}
  <!-- 모바일 패널 안: 부모(ProfileSectionPanel)가 스크롤을 담당하므로 단순 흐름 -->
  <section class="bg-white">
    <div class="mb-6">{@render profileHeader()}</div>
    {@render profileBody()}
  </section>
{:else}
  <!-- 데스크탑 좌측 패널: 프로필 헤더 고정 + 본문만 ScrollFadeArea로 스크롤 -->
  <section
    class="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 xl:h-full xl:min-h-0"
  >
    <div class="shrink-0">{@render profileHeader()}</div>
    <ScrollFadeArea
      class="-mx-6 mt-6 px-6"
      bounceArrow
      deps={[client, relationList, vouchers, vouchersLoading]}
    >
      {@render profileBody()}
    </ScrollFadeArea>
  </section>
{/if}
