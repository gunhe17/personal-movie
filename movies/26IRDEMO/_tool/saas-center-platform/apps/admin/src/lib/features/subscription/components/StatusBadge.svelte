<script lang="ts">
  import { STATUS_MAP, QUOTA_EXCEEDED_BADGE } from '../constants'

  interface Props {
    status: string
    quotaExceeded?: boolean
  }

  let { status, quotaExceeded = false }: Props = $props()

  const style = $derived(
    quotaExceeded
      ? QUOTA_EXCEEDED_BADGE
      : STATUS_MAP[status] ?? STATUS_MAP.active
  )
</script>

<span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium {style.bg} {style.text}">
  <span class="h-1.5 w-1.5 rounded-full {style.dot}"></span>
  {style.label}
</span>
