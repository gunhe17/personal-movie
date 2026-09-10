<!--
  Typography Component

  명명 규칙: {category}-{number}-{type}-{weight}
  - type: normal (100% line-height) | reading (150% line-height)
  - weight: regular (400) | medium (500) | semibold (600) | bold (700)

  사용 예시:
  <Typography variant="headline-01-normal-bold">대제목</Typography>
  <Typography variant="body-03-normal-medium">본문</Typography>

  Legacy aliases도 지원 (하위 호환성):
  <Typography variant="body-02-medium">본문</Typography>
-->

<script lang="ts">
  import type { Snippet } from 'svelte'

  // 타이포그라피 변형 목록 - 새 디자인 시스템 기준
  export type TypographyVariant =
    // Display_01 - 44px
    | 'display-01-normal-bold'

    // Display_02 - 32px
    | 'display-02-reading-bold'
    | 'display-02-normal-semibold'

    // Headline_00 - 28px
    | 'headline-00-normal-medium'
    | 'headline-00-normal-semibold'
    | 'headline-00-normal-bold'

    // Headline_01 - 24px
    | 'headline-01-normal-regular'
    | 'headline-01-normal-medium'
    | 'headline-01-normal-semibold'
    | 'headline-01-normal-bold'
    | 'headline-01-reading-bold'
    | 'headline-01-reading-semibold'

    // Headline_02 - 20px
    | 'headline-02-normal-regular'
    | 'headline-02-normal-medium'
    | 'headline-02-normal-semibold'
    | 'headline-02-normal-bold'
    | 'headline-02-reading-semibold'
    | 'headline-02-reading-bold'

    // Title_01 - 18px
    | 'title-01-normal-regular'
    | 'title-01-normal-medium'
    | 'title-01-normal-semibold'
    | 'title-01-normal-bold'
    | 'title-01-reading-regular'
    | 'title-01-reading-semibold'

    // Body_01 - 16px
    | 'body-01-normal-regular'
    | 'body-01-normal-medium'
    | 'body-01-normal-semibold'
    | 'body-01-normal-bold'
    | 'body-01-reading-regular'
    | 'body-01-reading-medium'
    | 'body-01-reading-semibold'

    // Body_02 - 15px
    | 'body-02-normal-regular'
    | 'body-02-normal-medium'
    | 'body-02-normal-semibold'
    | 'body-02-reading-regular'
    | 'body-02-reading-semibold'

    // Body_03 - 14px
    | 'body-03-normal-regular'
    | 'body-03-normal-medium'
    | 'body-03-normal-semibold'
    | 'body-03-normal-bold'
    | 'body-03-reading-regular'
    | 'body-03-reading-semibold'

    // Label_01 - 13px
    | 'label-01-normal-regular'
    | 'label-01-normal-medium'
    | 'label-01-normal-bold'
    | 'label-01-reading-regular'

    // Label_02 - 12px
    | 'label-02-normal-regular'
    | 'label-02-normal-medium'
    | 'label-02-normal-bold'

    // Caption_01 - 10px
    | 'caption-01-normal-regular'
    | 'caption-01-normal-medium'
    | 'caption-01-normal-bold'
    | 'caption-01-reading-medium'

    // Caption_02 - 8px
    | 'caption-02-normal-regular'
    | 'caption-02-normal-medium'
    | 'caption-02-normal-bold'
    | 'caption-02-reading-medium'

    // ========== Legacy Aliases (하위 호환성) ==========
    // Headline legacy
    | 'headline-01'
    | 'headline-01-bold'
    | 'headline-01-medium'
    | 'headline-02'
    | 'headline-02-semibold'
    | 'headline-02-medium'
    | 'headline-02-reading-semibold'
    | 'normal-bold'
    | 'normal-medium'

    // Title legacy
    | 'title-01'
    | 'title-01-semibold'
    | 'title-01-medium'
    | 'title-01-reading'
    | 'title-01-reading-regular'
    | 'title-02'
    | 'title-02-regular'
    | 'title-02-semibold'
    | 'title-02-reading'
    | 'title-02-reading-regular'
    | 'title-02-reading-semibold'
    | 'normal-regular'
    | 'reading-semibold'
    | 'reading-regular'

    // Body legacy
    | 'body-01-bold'
    | 'body-01-semibold'
    | 'body-01-medium'
    | 'body-01-regular'
    | 'body-02'
    | 'body-02-regular'
    | 'body-02-semibold'
    | 'body-02-medium'
    | 'body-02-reading'
    | 'body-03-reading'
    | 'body-03-medium'
    | 'body-03-regular'

    // Label legacy
    | 'label-01-semibold'
    | 'label-01-regular'
    | 'label-01-reading'
    | 'label-02-regular'
    | 'label-02-medium'
    | 'label-03-regular'
    | 'label-03-medium'
    | 'reading-medium'

  // Body legacy (추가)

  type HTMLTag =
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6'
    | 'p'
    | 'span'
    | 'div'
    | 'label'

  interface Props {
    variant: TypographyVariant
    tag?: HTMLTag
    className?: string
    color?: string
    whitespace?: 'normal' | 'pre-line' | 'pre-wrap' | 'pre'
    children?: Snippet
  }

  let {
    variant,
    tag = 'p',
    className = '',
    color = 'text-gray-900',
    whitespace = 'normal',
    children
  }: Props = $props()

  const classes = $derived(
    `font-pretendard text-${variant} ${color} ${className} ${whitespace !== 'normal' ? `whitespace-${whitespace}` : ''}`.trim()
  )
</script>

<svelte:element this={tag} class={classes}>
  {@render children?.()}
</svelte:element>
