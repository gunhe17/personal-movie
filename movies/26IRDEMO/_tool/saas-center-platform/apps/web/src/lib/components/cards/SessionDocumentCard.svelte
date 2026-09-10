<script lang="ts">
  import type { SessionDocumentType } from '$lib/stores/sessionStatus_local'

  import docImg from '$lib/assets/doc_img.png'
  import DotsIcon from '$lib/assets/DotsIcon.svelte'
  import Typography from '@common/components/Typography.svelte'
  import NoteIcon from '$lib/assets/sessionDetail/NoteIcon.svelte'

  interface Props {
    document: SessionDocumentType
  }

  let { document }: Props = $props()
</script>

<div
  class="max-w-[288px] space-y-3 rounded-xl border border-gray-200 p-3 duration-200"
  style="box-shadow: 0px 4px 12px 0px rgba(226, 226, 226, 0.2);"
>
  <img
    src={docImg}
    alt="docThumb"
    draggable="false"
    class="max-h-[108px] w-full bg-contain"
  />
  <!-- <img
		src={document.document_url}
		alt="docThumb"
		draggable="false"
		class="max-h-[108px] w-full bg-contain"
	/> -->
  <div class="flex items-center justify-between border-t border-gray-100 pt-2">
    <div class="flex items-center gap-1">
      <NoteIcon />
      <Typography variant="body-02-regular">{document.document_name}</Typography
      >
    </div>
    <!-- <button>
			<DotsIcon />
		</button> -->
  </div>
</div>
