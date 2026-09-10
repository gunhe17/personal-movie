<!--
  알림 설정 토글 행 — 알림 설정 화면(카테고리 행 · 그룹 행 · 푸시 행)의 단일 규격.

  규격은 Web_Design.md를 따른다:
  - 아이콘 타일 = 36(size-9) `rounded-lg bg-bg-base` + 에셋 네이티브 20 아이콘
    (대시보드 `PendingActionBanner`의 leading 타일과 동일 선례 — 앱 아이콘 언어 통일)
  - 중첩 radius = 카드 16 ⊃ 행 12 ⊃ 타일 8 (§Rounded 중첩 규칙, 동일값 금지)
  - 아이콘 ↔ 텍스트 12 · 타이틀 ↔ 설명 8 (§Spacing)
  - 타이포 = 카테고리 행 Body_01/Medium(16, 토글 선택 항목) / 그룹 행 Body_02/Medium(15),
    설명은 둘 다 Body_03/Regular(14)
  - 행 우측 = 스위치 → 셰브론 순. 셰브론이 맨 끝이고, 셰브론 없는 행도 같은 목록
    안이면 `chevronSlot`으로 자리를 비워 스위치 축을 맞춘다.

  펼침은 좌측 텍스트 영역과 우측 셰브론 두 곳에서 되고, 스위치는 그 둘 밖이라 클릭이 겹치지 않는다.
-->
<script lang="ts">
  import type { Snippet } from 'svelte'
  import Switch from '$lib/components/Switch.svelte'
  import Typography from '@common/components/Typography.svelte'
  import ArrowDownIcon20 from '$lib/assets/ArrowDownIcon20.svelte'

  interface Props {
    title: string
    description?: string
    checked: boolean
    onToggle: () => void
    ariaLabel: string
    /** 저장 중 — 행을 흐리게 하고 타이틀 옆에 상태 문구를 붙인다 */
    saving?: boolean
    /** 좌측 아이콘(에셋 네이티브 20). 없으면 타일 자체를 렌더하지 않는다 */
    icon?: Snippet
    /** 하위 그룹을 가진 행 — 좌측 영역이 펼침 버튼이 된다 */
    expandable?: boolean
    expanded?: boolean
    onExpand?: () => void
    /**
     * 셰브론이 없는 행도 셰브론 자리(24)를 비워 둔다 — 같은 목록에 펼침 행이
     * 섞여 있을 때 스위치 세로축을 맞추기 위한 것. 카드에 홀로 있는 행은 끈다.
     */
    chevronSlot?: boolean
    /**
     * 상위(마스터) 토글이 꺼져 스스로는 켤 수 없는 상태 — 스위치를 잠근다.
     * `saving`과 달리 행 전체를 흐리게 하지 않는다(무엇이 꺼져 있는지는 읽혀야 한다).
     */
    disabled?: boolean
    /** 'category' = 카드 직속 상위 행 / 'group' = 아코디언 하위 행 */
    level?: 'category' | 'group'
  }

  let {
    title,
    description,
    checked,
    onToggle,
    ariaLabel,
    saving = false,
    icon,
    expandable = false,
    expanded = false,
    onExpand,
    chevronSlot = false,
    disabled = false,
    level = 'category'
  }: Props = $props()

  const isCategory = $derived(level === 'category')
</script>

{#snippet body()}
  {#if icon}
    <!-- 아이콘은 에셋 네이티브 크기(20) 그대로 -->
    <span
      class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-bg-base text-icon-primary"
    >
      {@render icon()}
    </span>
  {/if}

  <div class="min-w-0 flex-1">
    <div class="flex items-center gap-2">
      <Typography
        variant={isCategory ? 'body-01-normal-medium' : 'body-02-normal-medium'}
        color={isCategory ? 'text-body-strong' : 'text-body-default'}
        tag="span"
        className="min-w-0 truncate"
      >
        {title}
      </Typography>

      {#if saving}
        <Typography
          variant="body-03-normal-regular"
          color="text-caption-subtle"
          tag="span"
          className="shrink-0"
        >
          저장 중...
        </Typography>
      {/if}
    </div>

    {#if description}
      <!-- 타이틀 ↔ 설명 = 8 (전 행 공통) -->
      <Typography
        variant="body-03-normal-regular"
        color="text-body-subtle"
        className="mt-2"
      >
        {description}
      </Typography>
    {/if}
  </div>
{/snippet}

<div
  class="flex items-center gap-3 rounded-xl px-3 transition-colors {isCategory
    ? 'py-4'
    : 'py-3'} {saving ? 'opacity-60' : 'hover:bg-gray-50'}"
>
  {#if expandable}
    <button
      type="button"
      class="flex min-w-0 flex-1 items-center gap-3 text-left"
      aria-expanded={expanded}
      onclick={() => onExpand?.()}
    >
      {@render body()}
    </button>
  {:else}
    <div class="flex min-w-0 flex-1 items-center gap-3">
      {@render body()}
    </div>
  {/if}

  <div class="shrink-0 pl-4">
    <Switch
      {checked}
      disabled={saving || disabled}
      onclick={onToggle}
      {ariaLabel}
    />
  </div>

  <!--
    펼침 셰브론은 행의 **맨 오른쪽**(스위치 오른쪽)에 선다 — 여러 행이 쌓여도
    셰브론 축이 타이틀 길이를 따라 흔들리지 않는다.
    스위치와 히트 영역이 겹치지 않도록 별도 버튼이며, 좌측 텍스트 영역 버튼과
    같은 펼침 동작을 한다(스크린리더에는 아이콘 버튼 하나만 이름을 갖는다).
    아이콘은 에셋 네이티브 20 그대로, 접힘/펼침은 회전으로만 표현한다.
  -->
  {#if expandable}
    <button
      type="button"
      class="flex size-6 shrink-0 items-center justify-center"
      aria-label="{title} 세부 설정 {expanded ? '접기' : '펼치기'}"
      aria-expanded={expanded}
      onclick={() => onExpand?.()}
    >
      <span class="flex transition-transform {expanded ? 'rotate-180' : ''}">
        <ArrowDownIcon20 color="var(--color-icon-secondary)" />
      </span>
    </button>
  {:else if chevronSlot}
    <!-- 셰브론 없는 행도 같은 목록 안이면 자리를 비워 둔다 — 그래야 스위치 축이 맞는다 -->
    <span class="size-6 shrink-0" aria-hidden="true"></span>
  {/if}
</div>
