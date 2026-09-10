<script lang="ts">
  import { fade } from 'svelte/transition'
  import { onMount, onDestroy } from 'svelte'

  import CloseIcon from '../assets/CloseIcon.svelte'
  import OptionIcon24 from '../assets/OptionIcon24.svelte'
  import Typography from '@common/components/Typography.svelte'
  import type { ClientDocumentItem } from '../types/client'

  export let document: ClientDocumentItem | null

  export let onClose: () => void

  let objectUrl = ''
  let zoom = 1.0

  const isPdf = document && document.file?.type === 'application/pdf'

  onMount(() => {
    objectUrl = (document?.file && URL.createObjectURL(document.file)) || ''
  })

  onDestroy(() => {
    URL.revokeObjectURL(objectUrl)
  })

  const zoomIn = () => {
    zoom = Math.min(zoom + 0.1, 2)
  }

  const zoomOut = () => {
    zoom = Math.max(zoom - 0.1, 0.5)
  }
</script>

<div
  class="fixed inset-0 z-50 bg-gray-50 flex flex-col"
  transition:fade={{ duration: 100 }}
>
  {#if document}
    <div
      class="h-16 px-8 py-4 w-full grid grid-cols-3 justify-between bg-gray-800 text-white"
    >
      <div>
        <button
          class="px-4 w-19 h-8 gap-2 flex items-center rounded-lg bg-gray-100 hover:bg-gray-200 duration-200"
          on:click={onClose}
        >
          <div class="w-4 h-4 flex-center">
            <CloseIcon class="w-auto h-full" color="#6D7882" />
          </div>
          <Typography variant="body-03-medium" color="text-gray-600">
            닫기
          </Typography>
        </button>
      </div>
      <Typography
        variant="title-01-normal-medium"
        color="text-white"
        className="grow flex-center"
      >
        {document.title}
      </Typography>
      <div class="flex justify-end">
        <button
          class="w-8 h-8 rounded-lg flex-center border border-gray-400 hover:border-gray-500 duration-200"
        >
          <OptionIcon24 />
        </button>
      </div>
    </div>
    <div
      class="flex-1 flex items-center justify-center bg-gray-100 overflow-auto"
    >
      {#if isPdf}
        <!-- svelte-ignore a11y_missing_attribute -->
        <!-- svelte-ignore element_invalid_self_closing_tag -->
        <iframe
          src={`${objectUrl}#zoom=${zoom * 100}`}
          class="bg-white shadow rounded"
          style="width: 720px; height: 90%;"
        />
      {:else}
        <img
          src={objectUrl}
          alt={document.title}
          class="shadow rounded"
          style="transform: scale({zoom}); transform-origin: center;"
        />
      {/if}
    </div>
    <div
      class="h-18.5 px-4 flex items-center justify-end gap-3 bg-white border-t border-gray-100 shadow-sm"
    >
      <div class="flex items-center gap-1 bg-gray-100 rounded-full px-1">
        <button
          class="w-7 h-7 flex-center rounded-full hover:bg-gray-200"
          on:click={zoomOut}
        >
          -
        </button>

        <span class="min-w-12 text-center text-gray-700">
          {Math.round(zoom * 100)}%
        </span>

        <button
          class="w-7 h-7 flex-center rounded-full hover:bg-gray-200"
          on:click={zoomIn}
        >
          +
        </button>
      </div>
      <button
        class="px-2 h-7.5 rounded-sm flex-center bg-gray-600 hover:bg-gray-500 duration-200"
        on:click={() => (zoom = 1)}
      >
        <Typography variant="body-02-normal-medium" color="text-white">
          화면맞춤
        </Typography>
      </button>
      {#if isPdf}
        <div class="text-gray-500 min-w-20 text-right">1 / 4 페이지</div>
      {/if}
    </div>
  {/if}
</div>
