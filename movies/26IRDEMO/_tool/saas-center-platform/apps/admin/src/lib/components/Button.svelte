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
    | 'light-red'
    | 'tertiary'
    | 'white-action'
    | 'primary-dark'
    | 'stroke-primary'
    | 'stroke-secondary'
    | 'stroke-delete'
    | 'expense'
  type FontWeightType = 'bold' | 'medium' | 'normal'
  type SizeType = 'xs' | 'sm' | 'md' | 'lg'
  type TagNameType = 'a' | 'button'

  const backgroundClasses: ColorBasedClassesType = {
    primary: {
      default: 'bg-primary-400 hover:bg-primary-300',
      outline: 'bg-white hover:bg-primary'
    },
    dark: {
      default: 'bg-gray-500 hover:bg-gray-700',
      outline: 'bg-white hover:bg-gray-500'
    },
    light: {
      default: 'bg-gray-50 hover:bg-gray-100',
      outline: 'bg-gray-200 hover:bg-gray-300'
    },
    'light-red': {
      default: 'bg-[#FFF1F2] hover:bg-[#FDA4AF3A]',
      outline: 'bg-[#FFF1F2] hover:bg-[#FDA4AF3A]'
    },
    tertiary: {
      default: 'bg-primary-50 hover:bg-primary-100',
      outline: 'bg-primary-50 hover:bg-primary-100'
    },
    'white-action': {
      default: 'bg-white hover:bg-primary-50',
      outline: 'bg-white hover:bg-primary-50'
    },
    'primary-dark': {
      default: 'bg-primary-500 hover:bg-primary-400',
      outline: 'bg-white hover:bg-primary'
    },
    'stroke-primary': {
      default: 'bg-white hover:bg-primary-50',
      outline: 'bg-white hover:bg-primary-50'
    },
    'stroke-secondary': {
      default: 'bg-white hover:bg-gray-50',
      outline: 'bg-white hover:bg-gray-50'
    },
    'stroke-delete': {
      default: 'bg-white hover:bg-red-50',
      outline: 'bg-white hover:bg-red-50'
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
      default: 'ring-1 ring-inset ring-gray-200',
      outline: 'ring-1 ring-inset ring-gray-200'
    },
    'light-red': {
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
      default: 'ring-1 ring-inset ring-primary',
      outline: 'ring-1 ring-inset ring-primary'
    },
    'stroke-secondary': {
      default: 'ring-1 ring-inset ring-gray-300',
      outline: 'ring-1 ring-inset ring-gray-300'
    },
    'stroke-delete': {
      default: 'ring-1 ring-inset ring-red-400',
      outline: 'ring-1 ring-inset ring-red-400'
    },
    expense: {
      default: '',
      outline: ''
    }
  }
  const borderRadiusClasses: SizeBasedClassesType = {
    xs: 'rounded-sm',
    sm: 'rounded',
    md: 'rounded',
    lg: 'rounded'
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
      default: 'text-gray-500',
      outline: 'text-gray-500'
    },
    'light-red': {
      default: 'text-[#EF4967]',
      outline: 'text-[#EF4967]'
    },
    tertiary: {
      default: 'text-primary',
      outline: 'text-primary'
    },
    'white-action': {
      default: 'text-primary',
      outline: 'text-primary'
    },
    'primary-dark': {
      default: 'text-white',
      outline: 'text-white'
    },
    'stroke-primary': {
      default: 'text-primary',
      outline: 'text-primary'
    },
    'stroke-secondary': {
      default: 'text-gray-600',
      outline: 'text-gray-600'
    },
    'stroke-delete': {
      default: 'text-red-500',
      outline: 'text-red-500'
    },
    expense: {
      default: 'text-white',
      outline: 'text-white'
    }
  }
  const disabledClasses: DisabledClassesType = {
    primary: 'bg-primary-100 text-primary-300',
    dark: 'bg-gray-100 text-gray-300',
    light: 'bg-gray-50 text-gray-300',
    'light-red': 'bg-red-50 text-red-300',
    tertiary: 'bg-primary-50 text-primary-200',
    'white-action': 'bg-white text-primary-200',
    'primary-dark': 'bg-gray-200 text-gray-400',
    'stroke-primary':
      'bg-white text-primary-200 ring-1 ring-inset ring-primary-200',
    'stroke-secondary':
      'bg-white text-gray-300 ring-1 ring-inset ring-gray-200',
    'stroke-delete': 'bg-white text-red-200 ring-1 ring-inset ring-red-200',
    expense: 'bg-teal-100 text-teal-300'
  }
  const fontSizeClasses: SizeBasedClassesType = {
    xs: 'text-2xs',
    sm: 'text-xs',
    md: 'text-xs',
    lg: 'text-sm'
  }
  const fontWeightClasses = {
    bold: 'font-bold',
    medium: 'font-medium',
    normal: 'font-normal'
  }
  const heightClasses: SizeBasedClassesType = {
    xs: 'h-4.5',
    sm: 'h-7',
    md: 'h-9',
    lg: 'h-12'
  }
  const paddingClasses: SizeBasedClassesType = {
    xs: 'px-2',
    sm: 'px-3',
    md: 'px-4',
    lg: 'px-6'
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
      fontSizeClasses[size],
      fontWeightClasses[weight],
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
  <div class={twMerge('flex items-center', contentClass)}>
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
