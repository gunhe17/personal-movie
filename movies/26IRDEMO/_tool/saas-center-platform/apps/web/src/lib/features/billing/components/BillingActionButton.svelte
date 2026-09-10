<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import BillsIconCurrent20 from '$root/src/lib/assets/BillsIconCurrent20.svelte'
  import ChargeIcon24 from '$root/src/lib/assets/ChargeIcon24.svelte'

  let {
    state,
    source,
    canWrite = false,
    canRead = false,
    onCreate,
    onView,
    size = 'sm',
    className = ''
  } = $props<{
    /** 청구 상태: none(없음) | pending(진행중) | completed(완납) */
    state: 'none' | 'pending' | 'completed'
    /** 청구 출처: case(케이스 패키지 선결제) | session(세션 단위 청구) */
    source?: 'case' | 'session'
    canWrite?: boolean
    canRead?: boolean
    onCreate?: () => void
    onView?: () => void
    /** sm: 인라인 소형, md: 일지 버튼과 동일(h-12), lg: 모달 푸터용 */
    size?: 'sm' | 'md' | 'lg'
    /** 외부 레이아웃 클래스 (flex-1 등) */
    className?: string
  }>()

  const completedLabel = $derived(source === 'case' ? '납부 완료' : '청구 완료')

  const sizeClass = $derived(
    size === 'lg'
      ? 'min-h-13 px-6 py-2'
      : size === 'md'
        ? 'min-h-12 px-4 py-2'
        : 'min-h-7 px-2.5 py-1'
  )
  const labelVariant = $derived(
    size === 'lg'
      ? 'title-01-semibold'
      : size === 'md'
        ? 'body-01-normal-medium'
        : 'body-02-semibold'
  )
  const iconWrapClass = $derived(
    size === 'lg' ? 'w-5' : size === 'md' ? 'w-5' : 'w-3.5'
  )
</script>

{#if state === 'completed'}
  <button
    type="button"
    onclick={() => onView?.()}
    class="{sizeClass} {className} rounded-lg leading-tight text-center bg-white border border-billing-line text-billing-fg transition-colors hover:border-billing-line-hover hover:text-billing-fg-hover hover:bg-billing-surface-hover inline-flex items-center justify-center gap-2"
  >
    <span class={iconWrapClass}>
      <BillsIconCurrent20 className="w-full h-auto" />
    </span>
    <Typography variant={labelVariant} tag="span" color="text-current">
      {completedLabel}
    </Typography>
  </button>
{:else if state === 'pending' && canRead}
  <button
    type="button"
    onclick={() => onView?.()}
    class="{sizeClass} {className} rounded-lg leading-tight text-center bg-white border border-billing-line text-billing-fg transition-colors hover:border-billing-line-hover hover:text-billing-fg-hover hover:bg-billing-surface-hover inline-flex items-center justify-center gap-2"
  >
    <span class={iconWrapClass}>
      <BillsIconCurrent20 className="w-full h-auto" />
    </span>
    <Typography variant={labelVariant} tag="span" color="text-current">
      청구 확인
    </Typography>
  </button>
{:else if state === 'none' && canWrite}
  <button
    type="button"
    onclick={() => onCreate?.()}
    class="{sizeClass} {className} rounded-lg leading-tight text-center bg-white border border-billing-line text-billing-fg transition-colors hover:border-billing-line-hover hover:text-billing-fg-hover hover:bg-billing-surface-hover inline-flex items-center justify-center gap-2"
  >
    <span class={iconWrapClass}>
      <ChargeIcon24 className="w-full h-auto" />
    </span>
    <Typography variant={labelVariant} tag="span" color="text-current">
      청구하기
    </Typography>
  </button>
{/if}
