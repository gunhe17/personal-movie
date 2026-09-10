<script lang="ts">
  /**
   * Button — Web_Design.md §button 정본 구현.
   *
   * 4축: Category(solid/outline) × Hierarchy × Size × Status.
   * 공통 규약
   *   - radius 8 고정 (rounded-lg), 아이콘–텍스트 gap 8 고정
   *   - 레이블 굵기 Medium(500) 고정 — SemiBold/Bold로 키우지 않는다(진해 보임)
   *   - 🔴 Solid 계열은 보더 없음. 위계는 면(배경색)으로만 표현한다
   *   - 그림자 없음 — 버튼은 떠 있는 표면이 아니다
   *   - 상호작용은 단조 심화: hover < pressed 로 더 어두워진다. scale/transform 없음
   *
   * 레이블 카피는 명사(형)로 끝낸다 — `~하기` 어미 금지 (저장 O / 저장하기 X).
   */
  import type { Snippet } from 'svelte'
  import Icon from './Icon.svelte'

  type Variant =
    | 'primary' // solid — 주 CTA
    | 'secondary' // tonal — 파란 틴트 면
    | 'tertiary' // gray solid — 중립 액션
    | 'white' // 흰 면 + 회색 글자
    | 'outlinePrimary'
    | 'outlineSecondary'
    | 'outlineCaution'
  /** Title(44)은 페이지 타이틀 행·검색입력 옆 정렬 전용 사이즈다. */
  type Size = 'sm' | 'md' | 'title' | 'lg' | 'xl'

  let {
    variant = 'primary',
    size = 'md',
    type = 'button',
    href,
    disabled = false,
    loading = false,
    icon,
    iconAfter,
    fullWidth = false,
    onclick,
    class: className = '',
    children
  }: {
    variant?: Variant
    size?: Size
    type?: 'button' | 'submit' | 'reset'
    href?: string
    disabled?: boolean
    loading?: boolean
    icon?: string
    iconAfter?: string
    fullWidth?: boolean
    onclick?: (e: MouseEvent) => void
    class?: string
    children: Snippet
  } = $props()

  /** hover·pressed 모두 default보다 어둡고, pressed가 hover보다 더 어둡다. */
  const variants: Record<Variant, string> = {
    primary:
      'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700',
    secondary:
      'bg-primary-100 text-primary-500 hover:bg-primary-200 active:bg-primary-300 active:text-primary-600',
    tertiary: 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:bg-gray-200',
    // 흰 버튼은 중립 액션 — 파란 글자를 쓰지 않는다(primary CTA와 위계 충돌).
    white:
      'bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-800 active:bg-gray-200 active:text-gray-900',
    outlinePrimary:
      'border border-primary-300 text-primary-500 hover:bg-primary-50 active:bg-primary-100',
    outlineSecondary:
      'border border-gray-200 text-gray-700 hover:bg-gray-50 active:bg-gray-100',
    outlineCaution:
      'border border-red-200 text-red-500 hover:border-red-300 hover:bg-red-50 active:border-red-400 active:bg-red-100'
  }

  const disabledCls: Record<Variant, string> = {
    primary: 'bg-primary-200 text-primary-300',
    secondary: 'bg-primary-100 text-primary-300',
    tertiary: 'bg-gray-50 text-gray-300',
    white: 'bg-gray-50 text-gray-300',
    outlinePrimary: 'border border-primary-200 text-primary-300',
    outlineSecondary: 'border border-gray-100 text-gray-400',
    outlineCaution: 'border border-red-100 text-gray-400'
  }

  /** 높이 × 좌우 padding. 레이블은 커질수록 작아지지 않는다(단조 비감소). */
  const sizes: Record<Size, string> = {
    sm: 'h-8 px-4 text-body-03-normal-medium', // 32 · 14
    md: 'h-10 px-6 text-body-02-normal-medium', // 40 · 15
    title: 'h-11 px-5 text-body-01-normal-medium', // 44 · 16
    lg: 'h-12 px-5 text-body-01-normal-medium', // 48 · 16
    xl: 'h-13 px-6 text-body-01-normal-medium' // 52 · 16
  }

  /** 버튼 높이 → 아이콘 크기: 52→24 · 48·44·40→20 · 32→16 */
  const iconSize: Record<Size, 'sm' | 'md' | 'lg'> = {
    sm: 'sm', // 16
    md: 'md', // 20
    title: 'md',
    lg: 'md',
    xl: 'lg' // 24
  }

  let isDisabled = $derived(disabled || loading)
  let stateCls = $derived(
    isDisabled
      ? `${disabledCls[variant]} ${loading ? 'cursor-wait' : 'cursor-not-allowed'} pointer-events-none`
      : variants[variant]
  )
  let cls = $derived(
    [
      'inline-flex items-center justify-center gap-2 rounded-lg transition-colors',
      fullWidth ? 'w-full' : '',
      sizes[size],
      stateCls,
      className
    ]
      .filter(Boolean)
      .join(' ')
  )
</script>

{#snippet content()}
  {#if loading}
    <Icon name="progress_activity" size={iconSize[size]} />
  {:else if icon}
    <Icon name={icon} size={iconSize[size]} />
  {/if}
  {@render children()}
  {#if iconAfter && !loading}
    <Icon name={iconAfter} size={iconSize[size]} />
  {/if}
{/snippet}

{#if href}
  <a
    href={isDisabled ? undefined : href}
    class={cls}
    aria-disabled={isDisabled}
    role="button"
    tabindex={isDisabled ? -1 : 0}
    onclick={onclick as any}
  >
    {@render content()}
  </a>
{:else}
  <button {type} class={cls} disabled={isDisabled} {onclick}>
    {@render content()}
  </button>
{/if}
