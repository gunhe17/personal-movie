<script lang="ts">
  interface Props {
    class?: string
  }

  let { class: className = 'w-full' }: Props = $props()
</script>

<svg
  class={className}
  height="2"
  viewBox="0 0 400 2"
  preserveAspectRatio="none"
  xmlns="http://www.w3.org/2000/svg"
  aria-hidden="true"
>
  <path
    d="M1,1.5 C80,1.4 160,1.55 240,1.45 C300,1.5 350,1.55 399,1.5"
    fill="none"
    stroke="#00a8a2"
    stroke-width="1.3"
    stroke-linecap="round"
  />
</svg>
