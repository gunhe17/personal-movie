<script lang="ts">
  import Switch from '$lib/components/Switch.svelte'
  import Tooltip from '$lib/components/common/Tooltip.svelte'

  interface Props {
    /** 활성 여부 */
    active: boolean
    /** 토글 시 호출 (다음 활성 여부 전달) */
    onToggle?: (next: boolean) => void
    disabled?: boolean
  }

  let { active, onToggle, disabled = false }: Props = $props()
</script>

<Tooltip text={active ? '활성' : '비활성'}>
  <Switch
    checked={active}
    {disabled}
    ariaLabel={active ? '활성' : '비활성'}
    onclick={() => onToggle?.(!active)}
  />
</Tooltip>
