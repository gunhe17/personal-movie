<script lang="ts">
  import { fade } from 'svelte/transition'
  import Typography from '@common/components/Typography.svelte'

  interface Props {
    manager: any
    toggleManager: (manager: any) => void
  }

  let { manager, toggleManager }: Props = $props()
</script>

<div
  transition:fade
  class="flex items-center px-2.5 py-2 gap-1.5 rounded-lg border border-primary-400 bg-primary-50"
>
  <Typography variant="body-03-medium" color="text-primary-500">
    {manager.name}
  </Typography>
  <!-- svelte-ignore a11y_consider_explicit_label -->
  <button onclick={() => toggleManager(manager)}>
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clip-path="url(#clip0_2434_7433)">
        <path
          d="M13.6591 13.6593C16.7844 10.534 16.7844 5.46694 13.6591 2.34164C10.5339 -0.783649 5.46676 -0.78365 2.34146 2.34164C-0.783832 5.46694 -0.783832 10.534 2.34146 13.6593C5.46676 16.7846 10.5339 16.7846 13.6591 13.6593Z"
          fill="#8A949E"
        />
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M10.4368 11.5682L4.77958 5.91097C4.46801 5.59946 4.46801 5.09122 4.77958 4.77964C5.09115 4.46807 5.59946 4.46801 5.91097 4.77958L11.5682 10.4368C11.8798 10.7483 11.8798 11.2565 11.5682 11.5681C11.2566 11.8797 10.7483 11.8798 10.4368 11.5682Z"
          fill="white"
        />
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M4.77958 10.4368L10.4368 4.77958C10.7483 4.46801 11.2565 4.46801 11.5681 4.77958C11.8797 5.09115 11.8798 5.59946 11.5682 5.91097L5.91097 11.5682C5.59946 11.8798 5.09122 11.8798 4.77964 11.5682C4.46807 11.2566 4.46801 10.7483 4.77958 10.4368Z"
          fill="white"
        />
      </g>
      <defs>
        <clipPath id="clip0_2434_7433">
          <rect width="16" height="16" fill="white" />
        </clipPath>
      </defs>
    </svg>
  </button>
</div>
