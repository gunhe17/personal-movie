<script lang="ts">
  import Typography from '@common/components/Typography.svelte'
  import Checkbox from './Checkbox.svelte'
  import { dateToString } from '../utils/date'

  export let reservationId: string
  export let manager: string
  export let client: string
  export let reservationType: string
  export let subject: string
  export let originDate: Date
  export let changedDate: Date | null
  export let reason: string | null = null
  export let decisionNote: string | null = null
  export let actionable: boolean = false
  export let busy: boolean = false
  export let onApprove: (() => void) | null = null
  export let onReject: (() => void) | null = null
</script>

<div
  class="w-full rounded-lg border border-gray-200 bg-white p-4 flex gap-6 justify-between h-19 hover:bg-gray-50 duration-200"
>
  <Checkbox id={reservationId} boxClass="w-6 h-6" containerClass="w-6 h-6" />
  <div class="space-y-2">
    <div
      class="text-body-02-normal-medium text-gray-700 bg-gray-100 rounded-sm p-1 w-fit"
    >
      {reservationType}
    </div>
    <Typography variant="body-02-reading">
      {dateToString(originDate, 'YYYY.MM.DD (d) HH:mm')}
    </Typography>
  </div>
  <div class="w-11 h-11 rounded-full bg-gray-50 flex-center">
    <svg
      width="36"
      height="36"
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M28.5 13.056H21.0162L27.7968 3H16.137L4.5 20.2581H13.322L12.8671 34.5L28.5 13.056Z"
        fill="#FFD800"
      />
      <path
        d="M14.8299 14.7468C14.8299 15.0802 14.5684 15.3504 14.2455 15.3504C13.9227 15.3504 13.6611 15.0802 13.6611 14.7468C13.6611 14.4134 13.9227 14.1432 14.2455 14.1432C14.5684 14.1432 14.8299 14.4134 14.8299 14.7468Z"
        fill="#231F20"
      />
      <path
        d="M18.6127 15.3504C18.9355 15.3504 19.1971 15.0802 19.1971 14.7468C19.1971 14.4135 18.9355 14.1432 18.6127 14.1432C18.29 14.1432 18.0283 14.4135 18.0283 14.7468C18.0283 15.0802 18.29 15.3504 18.6127 15.3504Z"
        fill="#231F20"
      />
      <path
        d="M16.4295 17.8996C15.6822 17.8996 15.0209 17.4657 14.7028 16.768C14.6577 16.6685 14.699 16.5498 14.7954 16.5032C14.8918 16.4567 15.0067 16.4993 15.0518 16.5988C15.3057 17.1558 15.8337 17.502 16.4295 17.502C17.0253 17.502 17.5536 17.1558 17.8072 16.5988C17.8523 16.4993 17.9676 16.4567 18.0635 16.5032C18.1599 16.5498 18.2012 16.6685 18.1561 16.768C17.838 17.4662 17.1762 17.8996 16.4295 17.8996Z"
        fill="#231F20"
      />
    </svg>
  </div>
  <div class="space-y-2">
    <Typography variant="title-02-semibold">
      {client}
    </Typography>
    <Typography variant="title-02-reading">
      {subject} | {manager} 담당자
    </Typography>
    {#if reason}
      <Typography variant="body-02-reading" color="text-gray-500">
        “{reason}”
      </Typography>
    {/if}
  </div>
  <div class="flex flex-1 items-center justify-center gap-9">
    <div class="space-y-2">
      <Typography variant="title-02-reading"
        >{changedDate ? '기존 날짜' : '날짜'}</Typography
      >
      <Typography variant="title-02-reading">
        {dateToString(originDate, 'YYYY.MM.DD (d) HH:mm')}
      </Typography>
    </div>
    {#if changedDate}
      <svg
        width="48"
        height="6"
        viewBox="0 0 48 6"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M1 5.00018H46.5L39.5718 1.00018"
          stroke="#256EF4"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <div class="space-y-2">
        <Typography variant="title-02-reading">변경 날짜</Typography>
        <Typography variant="title-02-reading">
          {dateToString(changedDate, 'YYYY.MM.DD (d) HH:mm')}
        </Typography>
      </div>
    {/if}
  </div>
  {#if actionable}
    <div class="flex gap-2">
      <button
        disabled={busy}
        onclick={() => onReject?.()}
        class="flex-center w-30 h-10 rounded-lg bg-[#D23E461A] hover:scale-105 duration-200 disabled:opacity-50 disabled:hover:scale-100"
      >
        <Typography variant="title-02-semibold" color="text-[#D23E46]">
          반려 처리
        </Typography>
      </button>
      <button
        disabled={busy}
        onclick={() => onApprove?.()}
        class="flex-center w-30 h-10 rounded-lg bg-primary-400 hover:scale-105 duration-200 disabled:opacity-50 disabled:hover:scale-100"
      >
        <Typography variant="title-02-semibold" color="text-white">
          승인 처리
        </Typography>
      </button>
    </div>
  {:else if decisionNote}
    <div class="flex w-60 items-center">
      <Typography variant="body-02-reading" color="text-gray-500">
        {decisionNote}
      </Typography>
    </div>
  {/if}
</div>
