<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import ClientBirthGender from '$lib/components/common/ClientBirthGender.svelte'
  import { goto } from '$app/navigation'
  import { isSecretMode } from '$lib/stores/secret-mode.store'
  import { maskName } from '$lib/utils/maskingHandler'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { centerId } from '$lib/stores/center.store'
  import { calcScheduleDDay } from '$lib/types/assessmentStatus'
  import { formatUtcToKst } from '$lib/utils/date'
  import {
    getCenterVoucherClients,
    type CenterVoucherClientItem
  } from '$lib/hooks/actions/centerVoucher.action'
  import { getFormTemplates } from '$lib/hooks/actions/form.action'
  import type { CenterVoucherVM } from '$lib/features/voucher/center-voucher/view-model'

  let {
    item
  }: {
    item: CenterVoucherVM
  } = $props()

  /** 내담자 이름 표기 — 시크릿 모드 마스킹 (다른 화면의 내담자 카드와 동일) */
  function displayName(name: string): string {
    return $isSecretMode ? maskName(name) : name
  }

  function goToClientVouchers(clientId: string) {
    goto(`/clients/${clientId}?tab=vouchers`)
  }

  const clientsQuery = $derived(
    queryBuilder(
      getCenterVoucherClients,
      () => ({ centerId: $centerId, centerVoucherId: item.id }),
      { enabled: !!$centerId && !!item.id }
    )
  )

  const clients = $derived<CenterVoucherClientItem[]>(
    clientsQuery.data?.items ?? []
  )

  // 레이블+데이터(가로형) — 패널 규격: body-01 · 레이블↔값 24 · 행 높이 20 · 행간 12
  const infoRows = $derived([
    { label: '단가', value: item.unitPriceFormatted },
    { label: '기본 회기', value: item.defaultTotalSessionsFormatted },
    { label: '사업 기간', value: item.programPeriod ?? '-' },
    // 사업 기간과 같은 날짜 표기(YYYY. MM. DD)로 맞춘다 — 한 그리드 안에서 구분자가 갈리지 않게
    { label: '등록일', value: formatUtcToKst(item.createdAt, 'YYYY. MM. DD') }
  ])

  // 이 사업에 연결된 서식 — 카탈로그는 id 만 주고(모듈 경계), 이름은 서식 목록에서 해소한다
  const templatesQuery = $derived(
    queryBuilder(
      getFormTemplates,
      () => ({ centerId: $centerId, includeSystem: true }),
      { enabled: !!$centerId && item.formTemplateIds.length > 0 }
    )
  )
  const voucherForms = $derived(
    item.formTemplateIds
      .map((id) => (templatesQuery.data?.items ?? []).find((t: any) => t.id === id))
      .filter(Boolean) as { id: string; name: string }[]
  )

  function formatAmount(n: number | null): string {
    if (n == null) return '-'
    return `${n.toLocaleString()}원`
  }

  /** 'YYYY-MM-DD' → 'YYYY. MM. DD' */
  function formatDate(date: string): string {
    return date.replaceAll('-', '. ')
  }

  function usedPercent(remaining: number, total: number): number {
    if (total <= 0) return 0
    const used = Math.max(0, total - remaining)
    return Math.max(0, Math.min(100, Math.round((used / total) * 100)))
  }

  function daysUntil(date: string | null): number | null {
    if (!date) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const target = new Date(date)
    target.setHours(0, 0, 0, 0)
    return Math.round((target.getTime() - today.getTime()) / 86400000)
  }
</script>

<div class="flex flex-col">
  <!-- 기본 정보 -->
  <section>
    <div class="mb-4 flex h-6 shrink-0 items-center">
      <Typography variant="title-01-normal-semibold" color="text-gray-800">
        기본 정보
      </Typography>
    </div>

    <dl
      class="grid grid-cols-[auto_1fr] auto-rows-[20px] items-center gap-x-6 gap-y-3"
    >
      {#each infoRows as row (row.label)}
        <Typography variant="body-01-normal-regular" color="text-gray-600">
          {row.label}
        </Typography>
        <Typography
          variant="body-01-normal-regular"
          color={row.value === '-' ? 'text-gray-400' : 'text-gray-900'}
        >
          {row.value}
        </Typography>
      {/each}
    </dl>

    <!-- 메모 (구성원·내담자 상세와 동일 규격) — 최소 높이 95
         (패딩 24 + 라벨 15 + gap 8 + 본문 2줄 48). 3줄 이상이면 그만큼 늘어난다. -->
    <div class="mt-5 min-h-[95px] rounded-xl bg-gray-50 p-3">
      <Typography
        variant="body-02-normal-medium"
        color="text-title-subtitle"
        className="block"
      >
        메모
      </Typography>
      <Typography
        variant="body-01-reading-regular"
        color={item.memo ? 'text-gray-700' : 'text-gray-400'}
        className="mt-2 block whitespace-pre-wrap"
      >
        {item.memo || '등록된 메모가 없어요.'}
      </Typography>
    </div>
  </section>

  <!-- 이 사업의 서식 — 발급 시 자동 생성하지 않는다. 필요할 때 내담자 화면에서 작성 -->
  {#if item.formTemplateIds.length > 0}
    <section class="mt-7 border-t border-gray-100 pt-7">
      <div class="mb-4 flex h-6 shrink-0 items-center gap-2">
        <Typography variant="title-01-normal-semibold" color="text-gray-800">
          서식
        </Typography>
        <Typography variant="body-03-normal-regular" color="text-title-subtitle">
          {item.formTemplateIds.length}건
        </Typography>
      </div>

      {#if templatesQuery.isLoading}
        <Typography
          variant="body-02-normal-regular"
          color="text-gray-400"
          className="block py-6 text-center"
        >
          불러오는 중...
        </Typography>
      {:else}
        <ul class="flex flex-col gap-2">
          {#each voucherForms as form (form.id)}
            <li class="flex items-center gap-2 rounded-lg border border-gray-100 px-4 py-3">
              <Typography variant="body-02-normal-medium" color="text-gray-800">
                {form.name}
              </Typography>
            </li>
          {:else}
            <Typography
              variant="body-02-normal-regular"
              color="text-gray-400"
              className="block py-6 text-center"
            >
              연결된 서식을 찾을 수 없어요
            </Typography>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}

  <!-- 바우처 보유 내담자 — 섹션 ↔ 섹션은 구분선 + 위아래 28 (Web_Design.md §Spacing) -->
  <section class="mt-7 border-t border-gray-100 pt-7">
    <!-- 섹션 타이틀 행 — 타이틀 + gap 8 + 카운트(숫자만, Body_03 14 Regular).
         카운트에 단위를 붙이지 않는 것이 목록 카운트 병기의 공통 규격 -->
    <div class="mb-4 flex h-6 shrink-0 items-center gap-2">
      <Typography variant="title-01-normal-semibold" color="text-gray-800">
        사용중인 내담자
      </Typography>
      {#if clients.length > 0}
        <Typography
          variant="body-03-normal-regular"
          color="text-title-subtitle"
        >
          {clients.length}
        </Typography>
      {/if}
    </div>

    {#if clientsQuery.isLoading}
      <Typography
        variant="body-02-normal-regular"
        color="text-gray-400"
        className="block py-10 text-center"
      >
        불러오는 중...
      </Typography>
    {:else if clients.length === 0}
      <!-- 섹션 안 빈 상태 — 검사 접수 패널과 동일 규격(gray-50 박스 · body-02) -->
      <div class="flex flex-col items-center gap-2 rounded-xl bg-gray-50 py-8">
        <Typography variant="body-02-normal-regular" color="text-gray-600">
          아직 바우처를 보유한 내담자가 없어요
        </Typography>
        <Typography variant="body-03-normal-regular" color="text-gray-400">
          내담자에게 바우처를 발급하면 여기에 표시돼요
        </Typography>
      </div>
    {:else}
      <ul
        class="grid gap-4"
        style="grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));"
      >
        {#each clients as c (c.client_voucher_id)}
          {@const used = Math.max(0, c.total_sessions - c.remaining_sessions)}
          {@const pct = usedPercent(c.remaining_sessions, c.total_sessions)}
          {@const dLeft = daysUntil(c.valid_until)}
          {@const isExpired = dLeft !== null && dLeft < 0}
          {@const isExpiringSoon = dLeft !== null && dLeft >= 0 && dLeft <= 30}
          <li>
            <!-- 카드(16) 안에 놓이는 중형 블록 → radius 12 (중첩 규칙: 바깥 > 안쪽) -->
            <button
              type="button"
              onclick={() => goToClientVouchers(c.client_id)}
              class="flex h-full w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-left transition-all duration-200 hover:border-primary-400 hover:shadow-card-hover"
            >
              <!-- 상단: 내담자(+기한 배지) · 사용 진행바 — 상하 여백 16 -->
              <div class="flex flex-1 flex-col gap-3 px-4 py-4">
                <!-- 내담자 최소 단위 — 아바타 + 이름 + [생년월일 | 성별].
                     전 화면 공통 규격이라 여기서 이름만 쓰지 않는다 -->
                <div class="flex min-w-0 items-center gap-3">
                  <ClientAvatar
                    profileImageUrl={c.profile_image_url}
                    name={c.client_name}
                    gender={c.gender}
                    sizeClass="h-10 w-10"
                    textClass="text-[15px]"
                  />
                  <div class="flex min-w-0 flex-col gap-2">
                    <div class="flex min-w-0 items-center gap-2">
                      <Typography
                        variant="title-01-normal-semibold"
                        color="text-gray-900"
                        tag="span"
                        className="min-w-0 truncate-safe"
                      >
                        {displayName(c.client_name)}
                      </Typography>
                      {#if isExpired}
                        <BadgeRectangle label="만료" color="red" size="sm" />
                      {:else if isExpiringSoon && dLeft !== null}
                        <BadgeRectangle
                          label={calcScheduleDDay(c.valid_until) ??
                            `D-${dLeft}`}
                          color="amber"
                          size="sm"
                        />
                      {/if}
                    </div>
                    <ClientBirthGender
                      birthDate={c.birth_date}
                      gender={c.gender}
                    />
                  </div>
                </div>

                <div class="flex items-center gap-3">
                  <span
                    class="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-200"
                  >
                    <span
                      class="block h-full rounded-full bg-primary-500"
                      style="width: {pct}%"
                    ></span>
                  </span>
                  <Typography
                    variant="body-02-normal-regular"
                    color="text-gray-500"
                    className="shrink-0 whitespace-nowrap"
                  >
                    {used}/{c.total_sessions}회
                  </Typography>
                </div>
              </div>

              <!-- 하단 푸터(48): 유효기간 · 잔액 — 상하 여백을 한 단계 낮춘 값 -->
              <div
                class="flex h-12 flex-wrap items-center gap-y-1 border-t border-gray-200 bg-bg-base px-4"
              >
                {@render metaItem(
                  '유효기간',
                  c.valid_until ? formatDate(c.valid_until) : '기한 없음'
                )}
                {#if c.remaining_amount != null}
                  <span class="mx-2 h-3 w-px bg-gray-300" aria-hidden="true"
                  ></span>
                  {@render metaItem('잔액', formatAmount(c.remaining_amount))}
                {/if}
              </div>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>

{#snippet metaItem(label: string, value: string)}
  <span class="flex items-center gap-2">
    <Typography variant="body-02-normal-regular" color="text-body-subtle">
      {label}
    </Typography>
    <Typography variant="body-02-normal-medium" color="text-body-default">
      {value}
    </Typography>
  </span>
{/snippet}
