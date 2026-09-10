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
  import VacationIcon from '$lib/assets/VacationIcon.png'
  import PlansIcon from '$lib/assets/PlansIcon.png'
  import ProgramIcon from '$lib/assets/ProgramIcon.png'
  import RoomIcon from '$lib/assets/RoomIcon.png'
  import { twMerge } from 'tailwind-merge'
  import ShineIcon from '../../assets/ShineIcon.svelte'
  import { fade } from 'svelte/transition'
  import { goto } from '$app/navigation'
  import Typography from '@common/components/Typography.svelte'
  import RightChevron24 from '../../assets/RightChevron24.svelte'

  let isQuickMenuOpen: boolean = false

  const clickOutside = (node: HTMLElement, callback: () => void) => {
    const handleClick = (event: MouseEvent) => {
      if (!node.contains(event.target as Node)) {
        callback()
      }
    }
    document.addEventListener('click', handleClick, true)
    return {
      destroy() {
        document.removeEventListener('click', handleClick, true)
      }
    }
  }
</script>

<button
  onclick={() => (isQuickMenuOpen = !isQuickMenuOpen)}
  class={twMerge(
    'absolute box-border-gradient left-1/2 bottom-7.25 -translate-x-1/2 flex-center w-36',
    'h-13 gap-2 rounded-[120px] border duration-200 opacity-70 bg-white hover:scale-105 hover:opacity-100'
  )}
>
  <ShineIcon />
  <span
    class="text-title-02-normal-semibold bg-linear-to-r from-[#a40ef4] to-[#45c9ff] bg-clip-text text-transparent"
  >
    초기 예약 세팅
  </span>
</button>
{#if isQuickMenuOpen}
  <div
    use:clickOutside={() => (isQuickMenuOpen = false)}
    transition:fade={{ duration: 200 }}
    class="absolute w-122.25 rounded-lg box-border-gradient left-1/2 bottom-27.75 -translate-x-1/2"
  >
    <div class="p-6 flex flex-col gap-3">
      <button
        onclick={() => goto('/center/info')}
        class="px-2 py-1 flex justify-between rounded-lg bg-gray-50 items-center w-full h-12 hover:scale-105 duration-200"
      >
        <div class="flex items-center">
          <img src={VacationIcon} alt="icon" class="w-10 h-10" />
          <Typography variant="body-01-medium" color="text-gray-700">
            센터 휴무일·예약 시간
          </Typography>
        </div>
        <div class="flex items-center">
          <Typography variant="body-02-reading" color="text-gray-400">
            휴무일과 예약 가능 시간을 정해요
          </Typography>
          <RightChevron24 />
        </div>
      </button>
      <!-- <button
        onclick={() => goto('/center/info')}
        class="px-2 py-1 flex justify-between rounded-lg bg-gray-50 items-center w-full h-12 hover:scale-105 duration-200"
      >
        <div class="flex items-center">
          <img src={PlansIcon} alt="icon" class="w-10 h-10" />
          <Typography variant="body-01-medium" color="text-gray-700">
            지원 사업
          </Typography>
        </div>
        <div class="flex items-center">
          <Typography variant="body-02-reading" color="text-gray-400">
            활용 가능한 지원 사업을 추가해요
          </Typography>
          <RightChevron24 />
        </div>
      </button> -->
      <button
        onclick={() => goto('/center/program')}
        class="px-2 py-1 flex justify-between rounded-lg bg-gray-50 items-center w-full h-12 hover:scale-105 duration-200"
      >
        <div class="flex items-center">
          <img src={ProgramIcon} alt="icon" class="w-10 h-10" />
          <Typography variant="body-01-medium" color="text-gray-700">
            프로그램
          </Typography>
        </div>
        <div class="flex items-center">
          <Typography variant="body-02-reading" color="text-gray-400">
            진행 중인 프로그램을 추가해요
          </Typography>
          <RightChevron24 />
        </div>
      </button>
      <button
        onclick={() => goto('/center/room')}
        class="px-2 py-1 flex justify-between rounded-lg bg-gray-50 items-center w-full h-12 hover:scale-105 duration-200"
      >
        <div class="flex items-center">
          <img src={RoomIcon} alt="icon" class="w-10 h-10" />
          <Typography variant="body-01-medium" color="text-gray-700">
            상담실
          </Typography>
        </div>
        <div class="flex items-center">
          <Typography variant="body-02-reading" color="text-gray-400">
            상담실 공간을 등록해 예약에 활용해요
          </Typography>
          <RightChevron24 />
        </div>
      </button>
    </div>
  </div>
{/if}
