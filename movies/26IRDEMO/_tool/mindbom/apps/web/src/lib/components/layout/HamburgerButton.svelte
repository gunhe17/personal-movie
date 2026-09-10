<script lang="ts">
  import Icon from '$components/ui/Icon.svelte'

  interface Props {
    onClick: () => void
    hideAt?: 'lg' | 'xl'
    label?: string
    tone?: 'dark' | 'light'
  }

  let {
    onClick,
    hideAt = 'lg',
    label = '메뉴 열기',
    tone = 'dark'
  }: Props = $props()

  let hiddenClass = $derived(hideAt === 'lg' ? 'lg:hidden' : 'xl:hidden')
  let toneClass = $derived(
    tone === 'dark'
      ? 'text-gray-400 hover:bg-sidebar-hover hover:text-white'
      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  )
</script>

<button
  type="button"
  onclick={onClick}
  class="inline-flex size-10 items-center justify-center rounded-lg transition-colors {toneClass} {hiddenClass}"
  aria-label={label}
>
  <Icon name="menu" size="lg" />
</button>
