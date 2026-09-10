<script lang="ts">
  import { twJoin, twMerge } from 'tailwind-merge'
  import type { Snippet } from 'svelte'

  import LinesIndicator from './LinesIndicator.svelte'

  type ColorBasedClassesType = {
    [Property in ColorType]: { default: string; outline: string }
  }
  type DisabledClassesType = {
    [Property in ColorType]: string
  }
  type SizeBasedClassesType = {
    [Property in SizeType]: string
  }
  type ColorType =
    | 'primary'
    | 'dark'
    | 'light'
    | 'tertiary'
    | 'white-action'
    | 'primary-dark'
    | 'stroke-primary'
    | 'stroke-secondary'
    | 'stroke-delete'
    | 'expense'
  type FontWeightType = 'bold' | 'medium' | 'normal'
  type SizeType = 'xs' | 'sm' | 'md' | 'title' | 'lg' | 'xl'
  type TagNameType = 'a' | 'button'

  const backgroundClasses: ColorBasedClassesType = {
    // button-primary — Solid. primary-500 + 흰 텍스트, hover 600 (§button-primary)
    primary: {
      default: 'bg-primary-500 hover:bg-primary-600',
      outline: 'bg-transparent hover:bg-primary-50'
    },
    dark: {
      default: 'bg-gray-500 hover:bg-gray-700',
      outline: 'bg-white hover:bg-gray-500'
    },
    light: {
      default: 'bg-[#FFF1F2] hover:bg-[#FDA4AF3A]',
      outline: 'bg-[#FFF1F2] hover:bg-[#FDA4AF3A]'
    },
    // button-tertiary — Gray solid (§button-tertiary). 옛 primary-50 톤은 폐기 —
    // 보조 액션이 파란 계열이면 primary CTA와 위계가 겹친다
    tertiary: {
      default: 'bg-gray-100 hover:bg-gray-200',
      outline: 'bg-gray-100 hover:bg-gray-200'
    },
    // button-white — 흰 면 위 중립 액션. hover는 gray-50 (§button-white)
    'white-action': {
      default: 'bg-white hover:bg-gray-50',
      outline: 'bg-white hover:bg-gray-50'
    },
    // primary-dark — button-primary의 레거시 별칭. 같은 값으로 맞춘다
    'primary-dark': {
      default: 'bg-primary-500 hover:bg-primary-600',
      outline: 'bg-transparent hover:bg-primary-50'
    },
    // outline 3색 — 보더는 옅은 단계, 텍스트는 진한 단계 (§button-outline)
    'stroke-primary': {
      default: 'bg-white hover:bg-primary-50',
      outline: 'bg-white hover:bg-primary-50'
    },
    'stroke-secondary': {
      default: 'bg-white hover:bg-gray-50',
      outline: 'bg-white hover:bg-gray-50'
    },
    'stroke-delete': {
      default: 'bg-white hover:bg-status-danger-bg',
      outline: 'bg-white hover:bg-status-danger-bg'
    },
    expense: {
      default: 'bg-teal-500 hover:bg-teal-600',
      outline: 'bg-teal-500 hover:bg-teal-600'
    }
  }
  const borderClasses: ColorBasedClassesType = {
    primary: {
      default: '',
      outline: 'ring-1 ring-inset ring-primary'
    },
    dark: {
      default: '',
      outline: 'ring-1 ring-inset ring-gray-500'
    },
    light: {
      default: 'ring-1 ring-inset ring-[#FDA4AF]',
      outline: 'ring-1 ring-inset ring-[#FDA4AF]'
    },
    tertiary: {
      default: '',
      outline: ''
    },
    'white-action': {
      default: 'ring-1 ring-inset ring-primary-200',
      outline: 'ring-1 ring-inset ring-primary-200'
    },
    'primary-dark': {
      default: '',
      outline: ''
    },
    'stroke-primary': {
      default: 'ring-1 ring-inset ring-primary-300',
      outline: 'ring-1 ring-inset ring-primary-300'
    },
    'stroke-secondary': {
      default: 'ring-1 ring-inset ring-gray-200',
      outline: 'ring-1 ring-inset ring-gray-200'
    },
    'stroke-delete': {
      default: 'ring-1 ring-inset ring-red-200',
      outline: 'ring-1 ring-inset ring-red-200'
    },
    expense: {
      default: '',
      outline: ''
    }
  }
  // §button — radius는 전 사이즈 8 고정. Tailwind v4의 `rounded`는 4라
  // 전부 `rounded-lg`(8)를 쓴다(옛 값이 4로 렌더되던 원인)
  const borderRadiusClasses: SizeBasedClassesType = {
    xs: 'rounded-lg',
    sm: 'rounded-lg',
    md: 'rounded-lg',
    title: 'rounded-lg',
    lg: 'rounded-lg',
    xl: 'rounded-lg'
  }
  const colorClasses: ColorBasedClassesType = {
    primary: {
      default: 'text-white',
      outline: 'text-primary hover:text-white'
    },
    dark: {
      default: 'text-white',
      outline: 'text-gray-500 hover:text-white'
    },
    light: {
      default: 'text-primary',
      outline: 'text-primary'
    },
    tertiary: {
      default: 'text-gray-600',
      outline: 'text-gray-600'
    },
    'white-action': {
      default: 'text-gray-600 hover:text-gray-800',
      outline: 'text-gray-600 hover:text-gray-800'
    },
    'primary-dark': {
      default: 'text-white',
      outline: 'text-white'
    },
    'stroke-primary': {
      default: 'text-primary-500',
      outline: 'text-primary-500'
    },
    'stroke-secondary': {
      default: 'text-gray-700',
      outline: 'text-gray-700'
    },
    'stroke-delete': {
      default: 'text-status-danger',
      outline: 'text-status-danger'
    },
    expense: {
      default: 'text-white',
      outline: 'text-white'
    }
  }
  const disabledClasses: DisabledClassesType = {
    primary: 'bg-action-primary-disabled text-action-primary-disabled-fg',
    dark: 'bg-gray-100 text-gray-300',
    light: 'bg-status-danger-bg text-red-300',
    tertiary: 'bg-gray-50 text-gray-300',
    'white-action': 'bg-gray-50 text-gray-300',
    'primary-dark':
      'bg-action-primary-disabled text-action-primary-disabled-fg',
    'stroke-primary':
      'bg-white text-primary-200 ring-1 ring-inset ring-primary-200',
    'stroke-secondary':
      'bg-white text-gray-300 ring-1 ring-inset ring-gray-200',
    'stroke-delete': 'bg-white text-red-200 ring-1 ring-inset ring-red-200',
    expense: 'bg-teal-100 text-teal-300'
  }
  /**
   * 레이블 타이포 — **버튼 클래스가 아니라 안쪽 컨텐트 div가 소유한다.**
   * twMerge는 `text-body-01-normal-medium`을 텍스트 *색* 클래스와 같은 충돌
   * 그룹으로 보고 뒤에 온 쪽만 남긴다 — 버튼 클래스에 함께 두면 colorClasses의
   * `text-white`가 지워져 primary 버튼 레이블이 검게 렌더된다(BadgeRectangle이
   * 같은 이유로 내부 span에 둔다).
   *
   * 굵기는 §button "레이블 굵기 = Medium(500) 고정"이라 토큰이 함께 진다 —
   * `weight` prop은 호환을 위해 남기지만 반영하지 않는다(SemiBold·Bold 금지).
   */
  const labelClasses: SizeBasedClassesType = {
    xs: 'text-label-02-normal-medium',
    sm: 'text-body-03-normal-medium',
    md: 'text-body-02-normal-medium',
    title: 'text-body-01-normal-medium',
    lg: 'text-body-01-normal-medium',
    xl: 'text-body-01-normal-medium'
  }
  // §button 사이즈 사다리 — Small 32 / Medium 40 / Title 44 / Large 48 / XLarge 52.
  // xs(18)는 MD 사다리 밖 레거시 micro 버튼이라 높이만 유지한다.
  const heightClasses: SizeBasedClassesType = {
    xs: 'h-4.5',
    sm: 'h-8',
    md: 'h-10',
    title: 'h-11',
    lg: 'h-12',
    xl: 'h-13'
  }
  const paddingClasses: SizeBasedClassesType = {
    xs: 'px-2',
    sm: 'px-4',
    md: 'px-6',
    title: 'px-5',
    lg: 'px-5',
    xl: 'px-6'
  }

  interface Props {
    color?: ColorType
    content?: string
    contentClass?: string
    disabled?: boolean
    loading?: boolean
    outline?: boolean
    pill?: boolean
    size?: SizeType
    weight?: FontWeightType
    href?: string
    class?: string
    onclick?: (e: MouseEvent) => void
    children?: Snippet
    [key: string]: unknown
  }

  let {
    color = 'primary',
    content = 'Button',
    contentClass = '',
    disabled = false,
    loading = false,
    outline = false,
    pill = false,
    size = 'lg',
    weight = 'bold',
    href,
    class: className,
    onclick,
    children,
    ...restProps
  }: Props = $props()

  const tagName: TagNameType = $derived(href ? 'a' : 'button')

  const getColorBasedClasses = (classesList: ColorBasedClassesType[]) =>
    twJoin(
      classesList.map(
        (classes) => classes[color][outline ? 'outline' : 'default']
      )
    )

  const classes = $derived(
    twMerge(
      'group/button flex items-center justify-center transition',
      disabled && `${disabledClasses[color]} cursor-not-allowed`,
      !disabled &&
        getColorBasedClasses([backgroundClasses, borderClasses, colorClasses]),
      pill && 'rounded-full',
      !pill && borderRadiusClasses[size],
      heightClasses[size],
      paddingClasses[size],
      loading && 'pointer-events-none',
      className
    )
  )
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<svelte:element
  this={tagName}
  {disabled}
  {onclick}
  {href}
  {...restProps}
  class={classes}
>
  <div class={twMerge('flex items-center', labelClasses[size], contentClass)}>
    {#if loading}
      <LinesIndicator class="mr-1 w-6 stroke-white" />
    {/if}
    {#if children}
      {@render children()}
    {:else}
      {content}
    {/if}
  </div>
</svelte:element>
