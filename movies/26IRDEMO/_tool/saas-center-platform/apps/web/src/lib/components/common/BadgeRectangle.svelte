<script lang="ts">
  import { twMerge } from 'tailwind-merge'
  import type { Snippet } from 'svelte'

  type TagColor =
    | 'gray'
    | 'blue'
    | 'indigo'
    | 'purple'
    | 'pink'
    | 'red'
    | 'orange'
    | 'amber'
    | 'green'
    | 'teal'

  type BadgeSize = 'sm' | 'lg'

  const FILL_CLASS: Record<TagColor, string> = {
    gray: 'bg-tag-gray-bg text-tag-gray-fg',
    blue: 'bg-tag-blue-bg text-tag-blue-fg',
    indigo: 'bg-tag-indigo-bg text-tag-indigo-fg',
    purple: 'bg-tag-purple-bg text-tag-purple-fg',
    pink: 'bg-tag-pink-bg text-tag-pink-fg',
    red: 'bg-tag-red-bg text-tag-red-fg',
    orange: 'bg-tag-orange-bg text-tag-orange-fg',
    amber: 'bg-tag-amber-bg text-tag-amber-fg',
    green: 'bg-tag-green-bg text-tag-green-fg',
    teal: 'bg-tag-teal-bg text-tag-teal-fg'
  }

  // outlined 전용 — 채움 없이 글자색만 (배경은 흰색)
  const FG_CLASS: Record<TagColor, string> = {
    gray: 'text-tag-gray-fg',
    blue: 'text-tag-blue-fg',
    indigo: 'text-tag-indigo-fg',
    purple: 'text-tag-purple-fg',
    pink: 'text-tag-pink-fg',
    red: 'text-tag-red-fg',
    orange: 'text-tag-orange-fg',
    amber: 'text-tag-amber-fg',
    green: 'text-tag-green-fg',
    teal: 'text-tag-teal-fg'
  }

  const OUTLINE_CLASS: Record<TagColor, string> = {
    gray: 'border border-tag-gray-outline',
    blue: 'border border-tag-blue-outline',
    indigo: 'border border-tag-indigo-outline',
    purple: 'border border-tag-purple-outline',
    pink: 'border border-tag-pink-outline',
    red: 'border border-tag-red-outline',
    orange: 'border border-tag-orange-outline',
    amber: 'border border-tag-amber-outline',
    green: 'border border-tag-green-outline',
    teal: 'border border-tag-teal-outline'
  }

  const SIZE_CLASS: Record<BadgeSize, string> = {
    sm: 'h-6 min-w-[38px] px-2',
    lg: 'h-8 min-w-[48px] px-3'
  }

  // 타이포 클래스는 twMerge가 text-tag-*-fg(색)와 충돌 그룹으로 오판해
  // 삭제하므로 머지 대상 밖(내부 span)에 둔다.
  const TEXT_CLASS: Record<BadgeSize, string> = {
    sm: 'text-label-01-normal-medium',
    lg: 'text-body-02-normal-medium'
  }

  interface Props {
    label: string
    color?: TagColor
    size?: BadgeSize
    /** 아웃라인형 — 흰 배경 + 연한 테두리 + 컬러 텍스트 (채움형 대신) */
    outlined?: boolean
    /** 라벨 좌측 아이콘 — 아이콘↔텍스트 gap 4는 배지 공통 규약(§Components>badge) */
    icon?: Snippet
    class?: string
  }

  let {
    label,
    color = 'gray',
    size = 'sm',
    outlined = false,
    icon,
    class: className
  }: Props = $props()
</script>

<span
  class={twMerge(
    'inline-flex shrink-0 items-center justify-center gap-1 rounded-md whitespace-nowrap',
    SIZE_CLASS[size],
    outlined ? `bg-white ${FG_CLASS[color]}` : FILL_CLASS[color],
    outlined && OUTLINE_CLASS[color],
    className
  )}
>
  {#if icon}
    {@render icon()}
  {/if}
  <span class={TEXT_CLASS[size]}>{label}</span>
</span>
