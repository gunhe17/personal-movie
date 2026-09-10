<script lang="ts" module>
  export interface TaskRowAction {
    label: string
    /** primary = 주 처리, outline = 보조, danger = 되돌리기 어려운 처리 */
    variant: 'primary' | 'outline' | 'danger'
    /**
     * 실행 후 true면 행을 목록에서 뺀다(false면 남긴다 — 확인 팝업에서 취소했거나,
     * 처리를 다른 모달에 넘긴 경우).
     * ctx.restore = 되돌리기 스낵바가 눌렸을 때 행을 목록에 되살리는 콜백.
     * ctx.close   = 이 드릴다운을 닫는다 (청구처럼 처리 화면이 모달로 이어질 때).
     * 확인 팝업·되돌리기는 호출부(서비스)가 소유하고, 모달은 목록 상태만 되돌린다.
     */
    run?: (ctx: {
      restore: () => void
      close: () => void
    }) => Promise<boolean | void> | boolean | void
    /** run 대신 이동 */
    href?: string
  }

  export interface TaskRow {
    id: string
    /** 주 표기 — 내담자 이름 */
    name: string
    /** 이름 옆 배지 (회기 수 등). 상담 화면과 같은 BadgeRectangle */
    badge?: string | null
    /** 하단 정보 — 세로선으로 구분해 나열 (예: 08.06 10:00-10:50 | 놀이치료 | 상담실 A) */
    subtitleParts: string[]
    /**
     * 아바타 — 값이 있을 때만 노출. 여러 명(그룹)이면 **대표 1명만 그리고 우하단에 +n 배지**를
     * 얹는다(상담 카드 CounselingCard와 같은 규격 — 겹쳐 쌓지 않는다).
     */
    avatars?: {
      name: string
      gender?: string | null
      profileImageUrl?: string | null
    }[]
    /** 있으면 버튼을 뺀 행 영역이 이 경로로 가는 링크가 된다(상세 보기) */
    href?: string | null
    actions: TaskRowAction[]
  }

  export interface TaskCategory {
    key: string
    label: string
    /** 전체 목록 화면 */
    href: string
    rows: TaskRow[]
  }
</script>

<script lang="ts">
  /**
   * 처리할 일 드릴다운 모달.
   *
   * 카드를 누르면 그 큐의 목록이 뜨고, 목록에서 바로 처리한다.
   * 좌우 화살표(또는 ←/→ 키)로 다른 큐로 넘어간다.
   */
  import { fly } from 'svelte/transition'
  import { cubicOut } from 'svelte/easing'
  import Typography from '@common/components/Typography.svelte'
  import ClientAvatar from '$lib/components/ClientAvatar.svelte'
  import BadgeRectangle from '$lib/components/common/BadgeRectangle.svelte'
  import ChevronIcon from '$lib/assets/ChevronIcon.svelte'
  import CompleteCheckIcon20 from '$lib/assets/CompleteCheckIcon20.svelte'
  import BaseModal from '$lib/components/modal/BaseModal.svelte'

  interface Props {
    categories: TaskCategory[]
    initialKey: string
    closeModal?: () => void
  }

  let { categories, initialKey, closeModal = () => {} }: Props = $props()

  let index = $state(
    Math.max(
      0,
      categories.findIndex((c) => c.key === initialKey)
    )
  )
  /** 이 모달에서 처리 완료해 목록에서 뺀 행 */
  let processed = $state(new Set<string>())
  let busyRowId = $state<string | null>(null)

  const category = $derived(categories[index] ?? categories[0])
  const rows = $derived(
    (category?.rows ?? []).filter((r) => !processed.has(r.id))
  )

  /** 마지막 이동 방향 — 전환 애니메이션이 이동 방향에서 들어오게 한다 */
  let dir = $state(1)

  function move(delta: number) {
    if (categories.length < 2) return
    dir = delta > 0 ? 1 : -1
    index = (index + delta + categories.length) % categories.length
  }

  /** 카테고리 전환 슬라이드 — 나가는 쪽/들어오는 쪽이 같은 방향으로 흐른다.
   * 나가는 쪽은 짧게 끊어 잔상을 빨리 지우고, 들어오는 쪽은 살짝 늦게 시작해
   * 겹치는 순간의 밀도를 낮춘다 (대칭 250/250은 잔상이 진하게 남았음) */
  const SLIDE_IN = { duration: 250, delay: 40, easing: cubicOut }
  const SLIDE_OUT = { duration: 160, easing: cubicOut }

  async function runAction(row: TaskRow, action: TaskRowAction) {
    if (!action.run || busyRowId) return
    // 확인 팝업이 떠 있는 동안에도 busy를 잡는다 — 이 한 상태가 좌우 이동(키·버튼)을 함께
    // 막아, 팝업 뒤에서 큐가 넘어가거나 body로 포털된 화살표(z-10001, 모달 층 10000보다
    // 위)가 팝업을 덮는 걸 막는다.
    busyRowId = row.id
    try {
      // 되돌리기로 복구되면 이 행을 목록에 되살린다
      const restore = () => {
        processed = new Set([...processed].filter((id) => id !== row.id))
      }
      const removed = await action.run({ restore, close: closeModal })
      if (removed !== false) processed = new Set([...processed, row.id])
    } finally {
      busyRowId = null
    }
  }

  /**
   * 좌우 이동 버튼은 모달 밖 딤 영역에 둔다.
   * ModalContainer의 스택 래퍼가 transform을 걸고 있어 그 안에서는 position:fixed가
   * 뷰포트가 아닌 래퍼 기준이 되고 overflow-hidden에 잘린다 → body로 포털한다.
   */
  function portal(node: HTMLElement) {
    document.body.appendChild(node)
    return { destroy: () => node.remove() }
  }

  /** 모달 폭(560)의 절반 + 여백 — 버튼이 모달 바깥에 여유롭게 선다 */
  const NAV_OFFSET = '300px'

  const ACTION_CLASS = {
    primary:
      'bg-primary-500 text-white hover:bg-primary-600 disabled:bg-action-primary-disabled',
    outline:
      'border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:text-gray-400',
    danger:
      'border border-red-200 text-status-danger hover:border-transparent hover:bg-status-danger-bg disabled:text-gray-400'
  }
</script>

<svelte:window
  onkeydown={(e) => {
    // 처리·확인 팝업 중에는 뒤 목록이 넘어가지 않게 막는다
    if (busyRowId) return
    if (e.key === 'ArrowLeft') move(-1)
    if (e.key === 'ArrowRight') move(1)
  }}
/>

<!-- 커스텀 header 스니펫은 자체 패딩을 갖지 않아 headerClass가 패딩을 준다.
     Web_Design.md §Components>modal Header(2026-08-06 개정): 좌우 24 · 상하 16 → 높이 65.
     (상하 24를 주면 닫기 아이콘 32 때문에 81까지 부푼다) -->
<BaseModal {closeModal} bodyClass="p-0!" headerClass="px-5 py-4">
  {#snippet header()}
    <!-- 전환 중 이전/새 타이틀이 겹치도록 같은 grid 셀에 스택 -->
    <div class="grid min-w-0 flex-1 overflow-hidden">
      {#key index}
        <div
          class="min-w-0 [grid-area:1/1]"
          in:fly={{ x: 24 * dir, ...SLIDE_IN }}
          out:fly={{ x: -16 * dir, ...SLIDE_OUT }}
        >
          <Typography
            variant="headline-02-normal-semibold"
            color="text-gray-800"
            tag="h2"
            className="min-w-0 truncate-safe"
          >
            {category?.label}
          </Typography>
        </div>
      {/key}
    </div>
  {/snippet}

  {#snippet body()}
    <!-- 카테고리 전환: 이동 방향으로 흐르는 슬라이드+페이드.
         이전/새 내용이 같은 grid 셀에 겹쳐 높이 점프 없이 크로스된다 -->
    <div class="grid overflow-hidden">
      {#key index}
        <div
          class="min-w-0 [grid-area:1/1]"
          in:fly={{ x: 32 * dir, ...SLIDE_IN }}
          out:fly={{ x: -20 * dir, ...SLIDE_OUT }}
        >
          {#if rows.length === 0}
            <div
              class="flex h-[64vh] flex-col items-center justify-center gap-2 px-5"
            >
              <CompleteCheckIcon20 />
              <Typography
                variant="body-01-normal-semibold"
                color="text-gray-700"
              >
                모두 처리했어요
              </Typography>
              <Typography
                variant="body-02-normal-regular"
                color="text-gray-400"
              >
                지금은 처리할 항목이 없어요
              </Typography>
            </div>
          {:else}
            <!-- 카운트 + 목록을 한 스크롤 영역에 둔다 — 카운트를 고정시키면 첫 행이 그 아래로
           스크롤되며 겹친다. 카운트 행에 고정 높이를 주지 않는다 — 목록 페이지의 h-11/h-9는
           위에 필터 바가 있어 티가 안 나지만, 모달에선 헤더 구분선 바로 아래라
           세로 가운데 정렬이 남긴 여백(36 − line-height 15 = 위아래 10.5)이 본문 상단
           패딩 20에 그대로 얹혀 30이 된다(§modal Content 상단 20 초과). -->
            <!-- 64vh — 헤더 65 + 본문이 BaseModal 상한(max-h-90vh) 안에 들어오는 범위에서
                 최대한 확보한다(옛 52vh는 6행 남짓에서 잘렸다) -->
            <div class="h-[64vh] overflow-y-auto p-5 pb-10">
              <!-- 상단 여백은 위 p-5(20)가 전부 소유한다 — 여기에 mt를 더하면
                   §modal 본문 상단 20을 넘어 헤더와 첫 줄이 멀어진다(옛 mt-2 = 28) -->
              <div class="mb-1 flex items-center">
                <Typography
                  variant="body-02-normal-regular"
                  color="text-gray-700"
                >
                  총 {rows.length}건
                </Typography>
              </div>
              <ul class="flex flex-col">
                {#each rows as row (row.id)}
                  <li
                    class="flex items-center gap-3 border-b border-gray-100 py-4 last:border-0"
                  >
                    <!--
                      버튼을 뺀 행 영역 = 상세로 가는 링크(href 있을 때).
                      액션 버튼은 이 밖에 있어 클릭이 겹치지 않는다.
                    -->
                    {#snippet rowBody()}
                      {#if row.avatars?.length}
                        <!-- 그룹 표기 = 대표 1명 + 우하단 +n 배지 (상담 카드와 동일 규격) -->
                        {@const lead = row.avatars[0]}
                        <div class="relative shrink-0">
                          <ClientAvatar
                            profileImageUrl={lead.profileImageUrl}
                            name={lead.name}
                            gender={lead.gender}
                            sizeClass="h-10 w-10"
                            textClass="text-[15px]"
                          />
                          {#if row.avatars.length > 1}
                            <span
                              class="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-gray-100"
                            >
                              <Typography
                                variant="caption-01-normal-medium"
                                color="text-caption-default"
                                tag="span"
                              >
                                +{row.avatars.length - 1}
                              </Typography>
                            </span>
                          {/if}
                        </div>
                      {/if}
                      <div class="min-w-0 flex-1">
                        <!-- 이름 행 높이 고정 24 — 배지(1회기 등)가 있는 행과 없는 행의
                             이름↔하단정보 간격이 갈리지 않게 한다(배지 없으면 15로 줄어 붙어 보였다) -->
                        <div class="flex min-h-6 items-center gap-2">
                          <Typography
                            variant="body-02-normal-semibold"
                            color="text-gray-800"
                            tag="span"
                            className="min-w-0 truncate-safe"
                          >
                            {row.name}
                          </Typography>
                          {#if row.badge}
                            <BadgeRectangle label={row.badge} size="sm" />
                          {/if}
                        </div>
                        <!-- 인라인 병기 — 값 + gap 6 + 세로선 + gap 6 + 값 -->
                        <div
                          class="mt-2 flex items-center gap-1.5 truncate-safe"
                        >
                          <!-- 값이 겹칠 수 있으므로 인덱스 key (값 key는 중복 시 예외로 모달 전체가 죽는다) -->
                          {#each row.subtitleParts as part, i (i)}
                            {#if i > 0}
                              <span
                                class="h-2.5 w-px shrink-0 bg-gray-300"
                                aria-hidden="true"
                              ></span>
                            {/if}
                            <Typography
                              variant="body-03-normal-regular"
                              color="text-gray-500"
                              tag="span"
                              className="shrink-0"
                            >
                              {part}
                            </Typography>
                          {/each}
                        </div>
                      </div>
                    {/snippet}

                    {#if row.href}
                      <a
                        href={row.href}
                        onclick={closeModal}
                        class="flex min-w-0 flex-1 items-center gap-3 rounded-lg"
                      >
                        {@render rowBody()}
                      </a>
                    {:else}
                      {@render rowBody()}
                    {/if}

                    <div class="flex shrink-0 items-center gap-2">
                      {#each row.actions as action, ai (ai)}
                        {#if action.href}
                          <a
                            href={action.href}
                            onclick={closeModal}
                            class="flex h-9 min-w-[60px] items-center justify-center whitespace-nowrap rounded-lg px-3 text-body-03-normal-medium transition-colors {ACTION_CLASS[
                              action.variant
                            ]}"
                          >
                            {action.label}
                          </a>
                        {:else}
                          <button
                            type="button"
                            disabled={busyRowId === row.id}
                            onclick={() => runAction(row, action)}
                            class="flex h-9 min-w-[60px] items-center justify-center whitespace-nowrap rounded-lg px-3 text-body-03-normal-medium transition-colors {ACTION_CLASS[
                              action.variant
                            ]}"
                          >
                            {action.label}
                          </button>
                        {/if}
                      {/each}
                    </div>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/key}
    </div>
  {/snippet}
</BaseModal>

<!--
  모달 밖 딤 영역의 큐 이동 버튼 (body로 포털).
  버튼 두 개를 각각 포털한다 — 전체 화면 래퍼(fixed inset-0)를 두면 모달 위를 덮는
  레이어가 생겨, pointer-events-none이 한 번이라도 어긋나면 모달 전체(닫기 포함)가
  클릭을 못 받는다. 화면을 덮는 요소 자체를 만들지 않는 게 안전하다.
-->
{#if categories.length > 1 && !busyRowId}
  <button
    use:portal
    type="button"
    aria-label="이전 항목"
    onclick={() => move(-1)}
    style="right: calc(50% + {NAV_OFFSET})"
    class="fixed top-1/2 z-[10001] hidden size-14 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gray-600 shadow-card-hover transition-colors duration-200 hover:bg-gray-50 lg:flex"
  >
    <ChevronIcon width={10} height={16} strokeColor="currentColor" />
  </button>
  <button
    use:portal
    type="button"
    aria-label="다음 항목"
    onclick={() => move(1)}
    style="left: calc(50% + {NAV_OFFSET})"
    class="fixed top-1/2 z-[10001] hidden size-14 -translate-y-1/2 rotate-180 items-center justify-center rounded-full bg-white text-gray-600 shadow-card-hover transition-colors duration-200 hover:bg-gray-50 lg:flex"
  >
    <ChevronIcon width={10} height={16} strokeColor="currentColor" />
  </button>
{/if}
