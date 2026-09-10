<script lang="ts">
  interface Props {
    class?: string
  }
  let { class: className = '' }: Props = $props()
</script>

<svg
  width="20"
  height="20"
  viewBox="0 0 24 24"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  class={className}
>
  <path
    d="M12.5 20H6C4.89543 20 4 19.1046 4 18V7C4 5.89543 4.89543 5 6 5H18C19.1046 5 20 5.89543 20 7V12.5"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
  />
  <circle cx="16" cy="16" r="2.25" stroke="currentColor" stroke-width="1.5" />
  <path d="M18 18L20 20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
  <path d="M4 10H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
  <path d="M7 4V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
  <path d="M12 4V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
  <path d="M17 4V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
</svg>
