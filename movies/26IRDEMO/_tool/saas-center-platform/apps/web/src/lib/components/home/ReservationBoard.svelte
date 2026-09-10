<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import PulseDot from './PulseDot.svelte'

  interface Reservation {
    id: number
    time: string
    clientName: string
    clientCode: string
    program: string
    room: string
    counselor: string
    attendance: 'present' | 'absent' | null
    isFirst?: boolean
  }

  interface Props {
    reservations?: Reservation[]
    totalItems?: number
  }

  let { reservations = [], totalItems = 0 }: Props = $props()
</script>

<div
  class="flex h-full flex-col rounded-2xl bg-white p-6 shadow-sm border border-gray-200"
>
  <!-- 헤더 -->
  <div class="mb-4 flex shrink-0 items-center justify-between">
    <div class="flex items-center gap-2">
      <Typography variant="title-01-semibold">남은 예약</Typography>
      <Typography variant="title-01-semibold" color="text-primary-500">
        {totalItems}
        <span class="text-gray-700">건</span>
      </Typography>
    </div>
  </div>
  <!-- 테이블 -->
  <div class="grow overflow-y-auto">
    <table class="w-full">
      <thead>
        <tr class="border-b border-gray-100">
          <th class="px-4 py-3 text-center">
            <Typography variant="body-02-medium" color="text-gray-500"
              >시간</Typography
            >
          </th>
          <th class="px-4 py-3 text-center">
            <Typography variant="body-02-medium" color="text-gray-500"
              >내담자</Typography
            >
          </th>
          <th class="px-4 py-3 text-center">
            <Typography variant="body-02-medium" color="text-gray-500"
              >프로그램</Typography
            >
          </th>
          <th class="px-4 py-3 text-center">
            <Typography variant="body-02-medium" color="text-gray-500"
              >상담실</Typography
            >
          </th>
          <th class="px-4 py-3 text-center">
            <Typography variant="body-02-medium" color="text-gray-500"
              >담당자</Typography
            >
          </th>
        </tr>
      </thead>
      <tbody>
        {#each reservations as reservation, idx}
          <tr
            class="border-b border-gray-50 transition-colors hover:bg-gray-50"
          >
            <td class="px-4 py-4 text-center">
              <Typography variant="body-02-medium" color="text-gray-600">
                {reservation.time}
              </Typography>
            </td>
            <td class="px-4 py-4 text-center">
              <div class="flex items-center gap-2">
                <div class="flex items-center gap-1">
                  <Typography variant="body-01-medium"
                    >{reservation.clientName}</Typography
                  >
                  {#if idx === 0}
                    <PulseDot />
                  {/if}
                </div>
              </div>
            </td>
            <td class="px-4 py-4 text-center">
              <Typography variant="body-01-regular" color="text-gray-700"
                >{reservation.program}</Typography
              >
            </td>
            <td class="px-4 py-4 text-center">
              <Typography variant="body-01-regular" color="text-gray-700"
                >{reservation.room}</Typography
              >
            </td>
            <td class="px-4 py-4 text-center">
              <Typography variant="body-01-regular" color="text-gray-700"
                >{reservation.counselor}</Typography
              >
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
