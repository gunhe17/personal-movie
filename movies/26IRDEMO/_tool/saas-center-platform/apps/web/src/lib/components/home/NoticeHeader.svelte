<style>
  .box-border-gradient {
    border: 1.5px solid transparent;
    background-image: linear-gradient(#fff, #fff),
      linear-gradient(315deg, #a40ef4 5.74%, #45c9ff 94.27%);
    background-origin: border-box;
    background-clip: content-box, border-box;
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { fly } from 'svelte/transition'

  import { dateToString } from '../../utils/date'
  import { queryBuilder } from '$lib/hooks/queries/builder'
  import { getNoticeList } from '$lib/hooks/actions/notice.action'

  import Megaphone from '../../assets/Megaphone.svelte'
  import Typography from '@common/components/Typography.svelte'

  const listQuery = queryBuilder(getNoticeList, () => ({ size: 5 }))
  const notices = $derived(listQuery.data?.items ?? [])

  let index = $state(0)
  let timer: ReturnType<typeof setInterval>

  onMount(() => {
    timer = setInterval(() => {
      if (notices.length > 0) {
        index = (index + 1) % notices.length
      }
    }, 5000)

    return () => clearInterval(timer)
  })
</script>

<div
  class="h-18 rounded-lg border overflow-hidden box-border-gradient shadow-md"
>
  <div
    class="w-full h-full bg-primary-50/40 backdrop-blur-md flex items-center"
  >
    <div class="flex items-center gap-8 w-full px-4">
      <span
        class="bg-linear-to-r from-[#4C87F6] to-[#12C2B8] bg-clip-text text-transparent text-title-02-normal-semibold font-semibold text-sm shrink-0 flex gap-2 items-center"
      >
        <Megaphone />
        공지사항
      </span>
      <div class="relative h-6 overflow-hidden w-full">
        {#if notices.length > 0}
          {#key index}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
              onclick={() => goto(`/notice/${notices[index].id}`)}
              class="w-full absolute left-0 top-0 flex items-center justify-between group cursor-pointer"
              in:fly={{ y: 12, duration: 300 }}
              out:fly={{ y: -12, duration: 300 }}
            >
              <p
                class="text-title-02-reading text-gray-800 truncate-safe select-none group-hover:underline"
              >
                {notices[index].title}
              </p>
              <Typography variant="title-02-reading" color="text-gray-500">
                {dateToString(
                  notices[index].published_at ?? notices[index].created_at,
                  'YYYY-MM-DD'
                )}
              </Typography>
            </div>
          {/key}
        {/if}
      </div>
    </div>
  </div>
</div>
